import { NEXT_LESSON_HORIZON_DAYS } from './constants';
import { addDays, atTime, diffDays, mondayOf, toDateKey, weekdayOf } from './time';
import type { DateKey, HHmm, Holiday, ID, Lesson, Schedule, Timetable, Weekday } from './types';

// ── Holidays ─────────────────────────────────────────────────────────────────

/** The holiday covering a date. With overlapping ranges, the one that started first. */
export function holidayOn(date: DateKey, holidays: readonly Holiday[]): Holiday | undefined {
  let found: Holiday | undefined;
  for (const h of holidays) {
    if (h.start <= date && date <= h.end && (!found || h.start < found.start)) found = h;
  }
  return found;
}

export function isHoliday(date: DateKey, holidays: readonly Holiday[]): boolean {
  return holidays.some((h) => h.start <= date && date <= h.end);
}

// ── Timetable for a date (R-2) ───────────────────────────────────────────────

export function coversDate(t: Pick<Timetable, 'validFrom' | 'validTo'>, date: DateKey): boolean {
  return t.validFrom <= date && (t.validTo == null || date <= t.validTo);
}

/** The timetable valid on a date. Ranges never overlap (invariant 1); if they do, the latest start wins. */
export function timetableFor(date: DateKey, timetables: readonly Timetable[]): Timetable | undefined {
  let found: Timetable | undefined;
  for (const t of timetables) {
    if (coversDate(t, date) && (!found || t.validFrom > found.validFrom)) found = t;
  }
  return found;
}

// ── Rotation (R-3) ───────────────────────────────────────────────────────────

const WEEK_LABELS = ['A', 'B', 'C', 'D'] as const;

/** A week counts as skipped when every school day in it is a holiday. */
function isHolidayWeek(monday: DateKey, t: Timetable, holidays: readonly Holiday[]): boolean {
  if (t.days.length === 0) return false;
  return t.days.every((d) => isHoliday(addDays(monday, d - 1), holidays));
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Which week of the rotation a date falls in (R-3): continuous ISO weeks counted from the
 * anchor Monday, not advancing through holiday-only weeks when `skipHolidayWeeks` is on.
 * A week that is itself all holiday has no lessons, so its own index doesn't matter.
 */
export function resolveWeekType(
  date: DateKey,
  timetable: Timetable,
  holidays: readonly Holiday[] = [],
): { index: number; label: string } {
  const { weeks: cycle, anchorIndex, skipHolidayWeeks } = timetable.rotation;
  if (cycle <= 1) return { index: 0, label: 'A' };
  const anchor = mondayOf(timetable.rotation.anchor);
  const monday = mondayOf(date);
  const weeks = Math.round(diffDays(monday, anchor) / 7);
  let skipped = 0;
  if (skipHolidayWeeks && holidays.length > 0 && Math.abs(weeks) > 1) {
    const step = Math.sign(weeks);
    for (let w = step; Math.abs(w) < Math.abs(weeks); w += step) {
      if (isHolidayWeek(addDays(anchor, w * 7), timetable, holidays)) skipped++;
    }
  }
  const index = mod(anchorIndex + Math.sign(weeks) * (Math.abs(weeks) - skipped), cycle);
  return { index, label: WEEK_LABELS[index] ?? String(index + 1) };
}

// ── Occurrences (R-4) ────────────────────────────────────────────────────────

/** A lesson on a concrete date. Derived, never stored. */
export interface Occurrence {
  date: DateKey;
  lesson: Lesson;
  timetableId: ID;
  /** Index of the lesson's first period. */
  periodIndex: number;
  startTime: HHmm;
  endTime: HHmm;
  start: Date;
  end: Date;
}

/** Start and end wall-clock times of a lesson: its override, or its periods (spans included). */
export function lessonTimes(lesson: Lesson, t: Timetable): { periodIndex: number; start: HHmm; end: HHmm } | null {
  const i = t.periods.findIndex((p) => p.id === lesson.periodId);
  if (i < 0) return null;
  const first = t.periods[i];
  const last = t.periods[Math.min(i + Math.max(1, lesson.span) - 1, t.periods.length - 1)];
  if (!first || !last) return null;
  return { periodIndex: i, start: lesson.time?.start ?? first.start, end: lesson.time?.end ?? last.end };
}

export function occurrencesOn(date: DateKey, schedule: Schedule): Occurrence[] {
  const t = timetableFor(date, schedule.timetables);
  if (!t || isHoliday(date, schedule.holidays)) return [];
  const day = weekdayOf(date);
  if (!t.days.includes(day)) return [];
  const week = resolveWeekType(date, t, schedule.holidays).index;
  const out: Occurrence[] = [];
  for (const lesson of t.lessons) {
    if (lesson.day !== day || lesson.week !== week) continue;
    const times = lessonTimes(lesson, t);
    if (!times) continue;
    out.push({
      date,
      lesson,
      timetableId: t.id,
      periodIndex: times.periodIndex,
      startTime: times.start,
      endTime: times.end,
      start: atTime(date, times.start),
      end: atTime(date, times.end),
    });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || a.periodIndex - b.periodIndex);
}

/** Last date anything can happen on, or null when some timetable is open-ended. */
function lastScheduledDate(timetables: readonly Timetable[]): DateKey | null {
  let last: DateKey | null = null;
  for (const t of timetables) {
    if (t.validTo == null) return null;
    if (!last || t.validTo > last) last = t.validTo;
  }
  return last;
}

/** Dates from `from` for `horizon` days, stopping after the last timetable ends. */
function* searchDates(from: DateKey, schedule: Schedule, horizon: number): Generator<DateKey> {
  if (schedule.timetables.length === 0) return;
  const stop = lastScheduledDate(schedule.timetables);
  for (let i = 0; i <= horizon; i++) {
    const date = addDays(from, i);
    if (stop && date > stop) return;
    yield date;
  }
}

/** The timetable a lesson belongs to. */
export function timetableOfLesson(lessonId: ID, timetables: readonly Timetable[]): Timetable | undefined {
  return timetables.find((t) => t.lessons.some((l) => l.id === lessonId));
}

/**
 * The next time a lesson takes place strictly after `from` (a lesson starting exactly at `from`
 * is current, not next). Holidays, rotation weeks and its timetable's dates all apply.
 */
export function nextOccurrenceOfLesson(
  lesson: Lesson | ID,
  from: Date,
  schedule: Schedule,
  horizon = NEXT_LESSON_HORIZON_DAYS,
): Occurrence | null {
  const id = typeof lesson === 'string' ? lesson : lesson.id;
  const t = timetableOfLesson(id, schedule.timetables);
  if (!t) return null;
  const own: Schedule = { timetables: [t], holidays: schedule.holidays };
  const target = t.lessons.find((l) => l.id === id) as Lesson;
  for (const date of searchDates(toDateKey(from), own, horizon)) {
    if (weekdayOf(date) !== target.day || !coversDate(t, date)) continue;
    const occ = occurrencesOn(date, own).find((o) => o.lesson.id === id);
    if (occ && occ.start > from) return occ;
  }
  return null;
}

/**
 * The next lesson of a subject (R-5). Once one of the subject's lessons has started today, the
 * rest of today doesn't count: homework given in period 2 is due next time, not in period 6.
 * Before the first one starts, today's lesson is still the next one.
 */
export function nextLessonOfSubject(
  subjectId: ID,
  from: Date,
  timetables: readonly Timetable[],
  holidays: readonly Holiday[],
  horizon = NEXT_LESSON_HORIZON_DAYS,
): Occurrence | null {
  const schedule: Schedule = { timetables: [...timetables], holidays: [...holidays] };
  const today = toDateKey(from);
  for (const date of searchDates(today, schedule, horizon)) {
    const own = occurrencesOn(date, schedule).filter((o) => o.lesson.subjectId === subjectId);
    if (date === today && own.some((o) => o.start <= from)) continue;
    const next = own.find((o) => o.start > from);
    if (next) return next;
  }
  return null;
}

/** The next date after `date` with at least one lesson, within the horizon. */
export function nextSchoolDay(date: DateKey, schedule: Schedule, horizon = NEXT_LESSON_HORIZON_DAYS): DateKey | null {
  for (const d of searchDates(addDays(date, 1), schedule, horizon - 1)) {
    if (occurrencesOn(d, schedule).length > 0) return d;
  }
  return null;
}

/** The lessons of a timetable on a weekday in a rotation week, in period order. */
export function lessonsOnDay(t: Timetable, day: Weekday, week = 0): Lesson[] {
  const order = new Map(t.periods.map((p, i) => [p.id, i]));
  return t.lessons
    .filter((l) => l.day === day && l.week === week && order.has(l.periodId))
    .sort((a, b) => (order.get(a.periodId) ?? 0) - (order.get(b.periodId) ?? 0));
}
