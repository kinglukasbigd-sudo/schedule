import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { atMinutes, fromDateKey, isValidBell, parseHm, toDateKey } from './schedule';
import type { Task, TaskKind, Timetable } from './types';

/** Days before the due moment a task starts competing for "next up". */
export const LEAD_DAYS: Record<TaskKind, number> = { homework: 0, test: 2, assignment: 3 };

/** Tie-breaker weight: tests matter most. */
const KIND_WEIGHT: Record<TaskKind, number> = { test: 0, assignment: 1, homework: 2 };

const END_OF_DAY = 23 * 60 + 59;

/** When the task is due: start of its lesson, or end of the day when no period is set. */
export function dueAt(task: Pick<Task, 'due' | 'period'>, tt: Timetable | undefined): Date {
  const day = fromDateKey(task.due);
  const bell = task.period == null ? undefined : tt?.bells[task.period];
  return atMinutes(day, isValidBell(bell) ? parseHm(bell.start) : END_OF_DAY);
}

export function isOpen(task: Task): boolean {
  return task.doneAt == null;
}

export function isOverdue(task: Task, tt: Timetable | undefined, now: Date): boolean {
  return isOpen(task) && dueAt(task, tt) < now;
}

/** Ordering for "what do I need to do next": effective start, then due time, kind, age. */
export function rankNextUp(tasks: Task[], tt: Timetable | undefined, now: Date): Task[] {
  const scored = tasks.filter(isOpen).map((task) => {
    const due = dueAt(task, tt).getTime();
    const overdue = due < now.getTime();
    const effective = overdue ? due : addDays(new Date(due), -LEAD_DAYS[task.kind]).getTime();
    return { task, due, overdue, effective };
  });
  scored.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      a.effective - b.effective ||
      a.due - b.due ||
      KIND_WEIGHT[a.task.kind] - KIND_WEIGHT[b.task.kind] ||
      a.task.createdAt - b.task.createdAt,
  );
  return scored.map((s) => s.task);
}

export const BUCKETS = ['overdue', 'today', 'tomorrow', 'week', 'later'] as const;
export type Bucket = (typeof BUCKETS)[number];

export function bucketOf(task: Task, tt: Timetable | undefined, now: Date): Bucket {
  if (isOverdue(task, tt, now)) return 'overdue';
  const days = differenceInCalendarDays(fromDateKey(task.due), startOfDay(now));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return 'week';
  return 'later';
}

export interface TaskGroup {
  bucket: Bucket;
  tasks: Task[];
}

/** Open tasks grouped into time buckets, each sorted by due time then kind. */
export function groupOpenTasks(tasks: Task[], tt: Timetable | undefined, now: Date): TaskGroup[] {
  const byBucket = new Map<Bucket, Task[]>(BUCKETS.map((b) => [b, []]));
  for (const task of tasks) {
    if (!isOpen(task)) continue;
    byBucket.get(bucketOf(task, tt, now))?.push(task);
  }
  return BUCKETS.map((bucket) => ({
    bucket,
    tasks: (byBucket.get(bucket) ?? []).sort(
      (a, b) =>
        dueAt(a, tt).getTime() - dueAt(b, tt).getTime() ||
        KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind] ||
        a.createdAt - b.createdAt,
    ),
  })).filter((g) => g.tasks.length > 0);
}

/** Recently completed tasks, newest first. */
export function recentlyDone(tasks: Task[], limit = 30): Task[] {
  return tasks
    .filter((t) => t.doneAt != null)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
    .slice(0, limit);
}

/** Open tasks due on a date for a subject — used to attach tasks to lessons. */
export function tasksForLesson(
  tasks: Task[],
  date: string,
  subjectId: string,
  period: number,
  firstPeriodOfSubject: number,
): Task[] {
  return tasks.filter(
    (t) =>
      isOpen(t) &&
      t.due === date &&
      t.subjectId === subjectId &&
      (t.period === period || (t.period == null && period === firstPeriodOfSubject)),
  );
}

/** Tests and assignments coming up within `days`, excluding today. */
export function comingUp(tasks: Task[], now: Date, days = 14): Task[] {
  const today = toDateKey(now);
  const until = toDateKey(addDays(now, days));
  return tasks
    .filter((t) => isOpen(t) && t.kind !== 'homework' && t.due > today && t.due <= until)
    .sort((a, b) => a.due.localeCompare(b.due) || KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind]);
}
