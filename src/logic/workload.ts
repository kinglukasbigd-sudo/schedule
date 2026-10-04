import { DEFAULT_ESTIMATE_MIN, LEAD_DAYS } from './constants';
import { dueMoment, isDone } from './due';
import { addDays, maxKey, toDateKey, weekOf } from './time';
import type { DateKey, ID, Schedule, Task } from './types';

/**
 * Load per day (R-10, F-10): estimated minutes of work allocated to dates from today on, and a
 * 0–4 level relative to the student's daily study cap. Drives the heat bars and the planner.
 */

export type LoadLevel = 0 | 1 | 2 | 3 | 4;

export interface DayLoad {
  date: DateKey;
  minutes: number;
  /** Tasks contributing to this day. */
  count: number;
  level: LoadLevel;
  /** A test is due this day (marked independently of the level). */
  testDue: boolean;
}

export interface LoadOptions {
  now: Date;
  maxMinutesPerDay: number;
  /** Resolves lesson-linked due moments; without it, the stored time snapshot is used. */
  schedule?: Schedule;
}

const EMPTY: Schedule = { timetables: [], holidays: [] };

export function estimateOf(task: Pick<Task, 'kind' | 'estimateMin'>): number {
  return task.estimateMin ?? DEFAULT_ESTIMATE_MIN[task.kind];
}

/** `level = 0` for 0 min, else min(4, 1 + floor(3 × minutes / cap)): 1–3 below the cap, 4 at or above. */
export function loadLevel(minutes: number, maxMinutesPerDay: number): LoadLevel {
  if (minutes <= 0) return 0;
  const cap = Math.max(1, maxMinutesPerDay);
  return Math.min(4, 1 + Math.floor((3 * minutes) / cap)) as LoadLevel;
}

/** Split whole minutes evenly; the leftover goes to the days closest to the due date. */
function spread(minutes: number, dates: DateKey[]): [DateKey, number][] {
  const base = Math.floor(minutes / dates.length);
  const extra = minutes - base * dates.length;
  return dates.map((d, i) => [d, base + (i >= dates.length - extra ? 1 : 0)]);
}

/** Where a task's minutes go, before planned steps are taken out. */
function unplannedDays(task: Task, today: DateKey): DateKey[] {
  const due = task.due.date;
  if (task.kind === 'homework') return [maxKey(addDays(due, -1), today)];
  const lead = LEAD_DAYS[task.kind];
  const days: DateKey[] = [];
  for (let i = lead + 1; i >= 1; i--) {
    const d = addDays(due, -i);
    if (d >= today) days.push(d);
  }
  return days.length ? days : [today];
}

/** Whether a task still needs work: open, and not a test that has already been written. */
export function needsWork(task: Task, now: Date, schedule: Schedule = EMPTY): boolean {
  if (isDone(task)) return false;
  return task.kind !== 'test' || dueMoment(task, schedule) > now;
}

/** Minutes and contributing tasks per date, for every date that has any. */
export function allocateLoad(tasks: readonly Task[], options: Omit<LoadOptions, 'maxMinutesPerDay'>): Map<DateKey, { minutes: number; tasks: Set<ID> }> {
  const today = toDateKey(options.now);
  const out = new Map<DateKey, { minutes: number; tasks: Set<ID> }>();
  const add = (date: DateKey, minutes: number, id: ID) => {
    if (minutes <= 0) return;
    const day = out.get(date) ?? { minutes: 0, tasks: new Set<ID>() };
    day.minutes += minutes;
    day.tasks.add(id);
    out.set(date, day);
  };
  for (const task of tasks) {
    if (!needsWork(task, options.now, options.schedule)) continue;
    const planned = task.subtasks.filter((s) => s.plannedFor != null && s.minutes != null);
    for (const step of planned) {
      if (!step.done) add(maxKey(step.plannedFor as DateKey, today), step.minutes as number, task.id);
    }
    const rest = estimateOf(task) - planned.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
    if (rest > 0) for (const [date, minutes] of spread(rest, unplannedDays(task, today))) add(date, minutes, task.id);
  }
  return out;
}

/**
 * Load for each day of a week: pass any date in the week (weeks start on Monday unless
 * `weekStartsOn` is 0) or an explicit list of dates.
 */
export function workloadScore(
  week: DateKey | readonly DateKey[],
  tasks: readonly Task[],
  options: LoadOptions & { weekStartsOn?: 0 | 1 },
): DayLoad[] {
  const dates = typeof week === 'string' ? weekOf(week, options.weekStartsOn ?? 1) : week;
  const load = allocateLoad(tasks, options);
  const tests = new Set(tasks.filter((t) => t.kind === 'test' && !isDone(t)).map((t) => t.due.date));
  return dates.map((date) => {
    const day = load.get(date);
    const minutes = day?.minutes ?? 0;
    return {
      date,
      minutes,
      count: day?.tasks.size ?? 0,
      level: loadLevel(minutes, options.maxMinutesPerDay),
      testDue: tests.has(date),
    };
  });
}
