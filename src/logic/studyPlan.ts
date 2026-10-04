import { MAX_PLAN_SESSIONS, PLAN_WINDOW_DAYS } from './constants';
import { uid } from '@/lib/id';
import { addDays, dateRange, diffDays, maxKey, toDateKey, weekdayOf } from './time';
import { allocateLoad, estimateOf } from './workload';
import type { Assignment, DateKey, ID, Schedule, SessionMinutes, StudyPlan, StudySettings, Subtask, Task, Test } from './types';

/**
 * Study and work plans (F-9, R-11): sessions spaced back from the due date at expanding
 * intervals, moved to a free neighbour when a day would go over the daily cap. Pure and
 * deterministic, so *Re-plan* is predictable.
 */

/** What a session is called, so the caller can word it in the app's language. */
export type SessionTitle =
  | { type: 'topic'; topic: string }
  | { type: 'numbered'; index: number; total: number }
  | { type: 'review' }
  | { type: 'quick-review' }
  | { type: 'work'; title: string; index: number; total: number }
  | { type: 'finish' };

export function englishSessionTitle(t: SessionTitle): string {
  switch (t.type) {
    case 'topic':
      return `Study: ${t.topic}`;
    case 'numbered':
      return `Study ${t.index}/${t.total}`;
    case 'review':
      return 'Full review';
    case 'quick-review':
      return 'Quick review';
    case 'work':
      return `Work on ${t.title} ${t.index}/${t.total}`;
    case 'finish':
      return 'Finish & check';
  }
}

/** The free slots a plan can use: the window, the student's limits and any choices they made. */
export interface FreeSlots {
  now: Date;
  study: Pick<StudySettings, 'maxMinutesPerDay' | 'sessionMinutes' | 'weekends'>;
  /** The student's chosen number of sessions (1–12); default from the estimate. */
  sessions?: number;
  /** The student's chosen session length; default from the stored plan, then settings. */
  sessionMinutes?: SessionMinutes;
  schedule?: Schedule;
}

export interface PlanOptions {
  newId?: () => ID;
  title?: (t: SessionTitle) => string;
}

/** Offsets back from the due date, expanding (R-11.3). */
const TARGET_OFFSETS = [1, 2, 4, 7, 11, 14];

/** Days a plan may use: up to two weeks before the due date, from today, minus weekends if off. */
export function studyWindow(due: DateKey, today: DateKey, weekends: boolean): DateKey[] {
  return dateRange(maxKey(today, addDays(due, -PLAN_WINDOW_DAYS)), addDays(due, -1)).filter(
    (d) => weekends || weekdayOf(d) < 6,
  );
}

function titleFor(task: Test | Assignment, index: number, total: number): SessionTitle {
  const last = index === total;
  if (task.kind === 'assignment') return last ? { type: 'finish' } : { type: 'work', title: task.title, index, total };
  if (last) return { type: 'review' };
  const topics = task.topics.filter((t) => t.trim());
  return topics.length ? { type: 'topic', topic: topics[(index - 1) % topics.length] as string } : { type: 'numbered', index, total };
}

function pickDates(window: DateKey[], due: DateKey, count: number, minutes: number, cap: number, load: Map<DateKey, number>): DateKey[] {
  const inWindow = new Set(window);
  const picked: DateKey[] = [];
  const free = (d: DateKey) => inWindow.has(d) && !picked.includes(d) && (load.get(d) ?? 0) + minutes <= cap;
  const nearest = [...window].sort((a, b) => diffDays(due, a) - diffDays(due, b));
  const targets = [...TARGET_OFFSETS.map((o) => addDays(due, -o)), ...nearest];
  for (const target of targets) {
    if (picked.length >= count) break;
    if (!inWindow.has(target) || picked.includes(target)) continue;
    let choice = target;
    if (!free(target)) {
      // Least-loaded free neighbour within a day; ties go to the one closer to the due date.
      const neighbours = [addDays(target, 1), addDays(target, -1)].filter(free);
      neighbours.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
      choice = neighbours[0] ?? target;
    }
    picked.push(choice);
    load.set(choice, (load.get(choice) ?? 0) + minutes);
  }
  return picked.sort();
}

/**
 * Sessions for a test or assignment (R-11). Returns the new planned steps and the parameters to
 * keep for re-planning. Nothing to plan once the due date has passed.
 */
export function generateStudyPlan(
  task: Test | Assignment,
  slots: FreeSlots,
  tasks: readonly Task[],
  options: PlanOptions = {},
): { subtasks: Subtask[]; plan: StudyPlan } {
  const newId = options.newId ?? uid;
  const name = options.title ?? englishSessionTitle;
  const today = toDateKey(slots.now);
  const due = task.due.date;
  const minutes = slots.sessionMinutes ?? task.plan?.sessionMinutes ?? slots.study.sessionMinutes;
  const step = (date: DateKey, title: SessionTitle): Subtask => ({
    id: newId(),
    title: name(title),
    done: false,
    plannedFor: date,
    minutes,
    origin: 'plan',
  });
  const plan = (sessions: number): StudyPlan => ({ generatedAt: slots.now.getTime(), sessionMinutes: minutes, sessions });

  if (due < today) return { subtasks: [], plan: plan(0) };
  const window = studyWindow(due, today, slots.study.weekends);
  // Too late for spacing (due today or tomorrow, E-40): one quick review today.
  if (window.length <= 1) return { subtasks: [step(today, { type: 'quick-review' })], plan: plan(1) };

  const wanted = slots.sessions ?? Math.ceil(estimateOf(task) / minutes);
  const count = Math.max(1, Math.min(wanted, window.length, MAX_PLAN_SESSIONS));
  const load = new Map(
    [...allocateLoad(tasks.filter((t) => t.id !== task.id), { now: slots.now, ...(slots.schedule ? { schedule: slots.schedule } : {}) })].map(
      ([date, day]) => [date, day.minutes] as const,
    ),
  );
  const dates = pickDates(window, due, count, minutes, slots.study.maxMinutesPerDay, load);
  return {
    subtasks: dates.map((date, i) => step(date, titleFor(task, i + 1, dates.length))),
    plan: plan(dates.length),
  };
}

/**
 * *Re-plan* (R-11.6): drop the unfinished planned sessions and plan again with the stored
 * parameters. Finished sessions and the student's own steps stay.
 */
export function replan<T extends Test | Assignment>(task: T, slots: FreeSlots, tasks: readonly Task[], options: PlanOptions = {}): T {
  const kept = task.subtasks.filter((s) => s.origin !== 'plan' || s.done);
  const finished = task.subtasks.filter((s) => s.origin === 'plan' && s.done).length;
  const stored = task.plan;
  // Every planned session done: nothing to re-plan.
  if (stored && finished >= stored.sessions) return { ...task, subtasks: kept };
  const sessions = stored ? stored.sessions - finished : undefined;
  const { subtasks, plan } = generateStudyPlan(
    { ...task, subtasks: kept },
    {
      ...slots,
      ...(sessions != null ? { sessions } : {}),
      ...(stored ? { sessionMinutes: stored.sessionMinutes } : {}),
    },
    tasks,
    options,
  );
  return { ...task, subtasks: [...kept, ...subtasks], plan: { ...plan, sessions: finished + plan.sessions } };
}
