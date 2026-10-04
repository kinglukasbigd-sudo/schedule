import { END_OF_DAY } from './constants';
import { occurrencesOn, type Occurrence } from './schedule';
import { atTime, minutesOf } from './time';
import type { DateKey, Due, HHmm, ID, Schedule, Task } from './types';

/** A due date at a lesson, with the lesson's start kept as a snapshot (R-6). */
export function dueAtLesson(occ: Occurrence): Due {
  return { date: occ.date, lessonId: occ.lesson.id, time: occ.startTime };
}

/**
 * Due on a date for a subject: an explicit time wins (and clears the lesson link, R-6);
 * otherwise the subject's first lesson that day; otherwise end of day.
 */
export function dueOn(date: DateKey, subjectId: ID | null, schedule: Schedule, time: HHmm | null = null): Due {
  if (time) return { date, lessonId: null, time };
  const occ = subjectId ? occurrencesOn(date, schedule).find((o) => o.lesson.subjectId === subjectId) : undefined;
  return occ ? dueAtLesson(occ) : { date, lessonId: null, time: null };
}

/** The instant a task is due (R-6): its lesson's start that day, else its time, else 23:59. */
export function dueMoment(task: Pick<Task, 'due'>, schedule: Schedule): Date {
  const { date, lessonId, time } = task.due;
  if (lessonId) {
    const occ = occurrencesOn(date, schedule).find((o) => o.lesson.id === lessonId);
    if (occ) return occ.start;
  }
  return atTime(date, time ?? END_OF_DAY);
}

export function isDone(task: Pick<Task, 'doneAt'>): boolean {
  return task.doneAt != null;
}

/** Homework and assignments become overdue; tests never do (D-022). */
export function isOverdue(task: Task, now: Date, schedule: Schedule): boolean {
  return task.kind !== 'test' && !isDone(task) && dueMoment(task, schedule) < now;
}

/** A test whose time has passed was written: it waits for a result instead of turning red. */
export function isWritten(task: Task, now: Date, schedule: Schedule): boolean {
  return task.kind === 'test' && !isDone(task) && dueMoment(task, schedule) < now;
}

/**
 * The lesson occurrence a task belongs to (R-7): its own lesson on its due date, or — when that
 * link is missing or doesn't resolve — a lesson of its subject that day: the one containing its
 * time, else the last one starting before it, else the first.
 */
export function occurrenceOfTask(task: Pick<Task, 'due' | 'subjectId'>, schedule: Schedule): Occurrence | null {
  const occs = occurrencesOn(task.due.date, schedule);
  if (task.due.lessonId) {
    const own = occs.find((o) => o.lesson.id === task.due.lessonId);
    if (own) return own;
  }
  if (!task.subjectId) return null;
  const subject = occs.filter((o) => o.lesson.subjectId === task.subjectId);
  if (subject.length === 0) return null;
  const time = task.due.time;
  if (time) {
    const t = minutesOf(time);
    const containing = subject.find((o) => minutesOf(o.startTime) <= t && t < minutesOf(o.endTime));
    if (containing) return containing;
    const before = subject.filter((o) => minutesOf(o.startTime) <= t);
    if (before.length) return before[before.length - 1] as Occurrence;
  }
  return subject[0] as Occurrence;
}
