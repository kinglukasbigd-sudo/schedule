import { addDays, format, getISODay, parseISO, startOfDay } from 'date-fns';
import type { Bell, Lesson, Timetable, Weekday } from './types';

/** How far ahead "next lesson" searches go. Two weeks covers any repeating week. */
export const SEARCH_DAYS = 14;

export interface LessonInstance {
  lesson: Lesson;
  /** "yyyy-MM-dd" */
  date: string;
  start: Date;
  end: Date;
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromDateKey(key: string): Date {
  return parseISO(key);
}

export function weekdayOf(date: Date): Weekday {
  return getISODay(date) as Weekday;
}

/** "08:05" → 485. Returns NaN for malformed input. */
export function parseHm(hm: string): number {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(hm.trim());
  if (!m) return Number.NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return Number.NaN;
  return h * 60 + min;
}

export function formatHm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function atMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  d.setMinutes(minutes);
  return d;
}

export function isValidBell(bell: Bell | undefined): bell is Bell {
  if (!bell) return false;
  const s = parseHm(bell.start);
  const e = parseHm(bell.end);
  return Number.isFinite(s) && Number.isFinite(e) && e > s;
}

/** Lessons on a weekday, ordered by period, skipping periods without a valid bell. */
export function lessonsForWeekday(tt: Timetable, day: Weekday): Lesson[] {
  return tt.lessons
    .filter((l) => l.day === day && isValidBell(tt.bells[l.period]))
    .sort((a, b) => a.period - b.period);
}

export function instanceOf(tt: Timetable, lesson: Lesson, date: Date): LessonInstance {
  const bell = tt.bells[lesson.period] as Bell;
  return {
    lesson,
    date: toDateKey(date),
    start: atMinutes(date, parseHm(bell.start)),
    end: atMinutes(date, parseHm(bell.end)),
  };
}

export function lessonsOnDate(tt: Timetable | undefined, date: Date): LessonInstance[] {
  if (!tt) return [];
  const day = weekdayOf(date);
  if (!tt.days.includes(day)) return [];
  return lessonsForWeekday(tt, day).map((l) => instanceOf(tt, l, date));
}

/** Iterate lesson instances from `from` (inclusive of that day) for `days` days. */
export function* upcomingLessons(tt: Timetable | undefined, from: Date, days = SEARCH_DAYS): Generator<LessonInstance> {
  if (!tt) return;
  for (let i = 0; i < days; i++) {
    yield* lessonsOnDate(tt, addDays(startOfDay(from), i));
  }
}

export function currentLesson(tt: Timetable | undefined, now: Date): LessonInstance | null {
  return lessonsOnDate(tt, now).find((li) => li.start <= now && now < li.end) ?? null;
}

export function nextLesson(tt: Timetable | undefined, now: Date): LessonInstance | null {
  for (const li of upcomingLessons(tt, now)) if (li.start > now) return li;
  return null;
}

/** First lesson of the subject that starts strictly after `after`. */
export function nextLessonOfSubject(tt: Timetable | undefined, subjectId: string, after: Date): LessonInstance | null {
  for (const li of upcomingLessons(tt, after)) {
    if (li.lesson.subjectId === subjectId && li.start > after) return li;
  }
  return null;
}

/** The lesson of a subject on a given date (first one), if any. */
export function lessonOfSubjectOn(tt: Timetable | undefined, subjectId: string, date: Date): LessonInstance | null {
  return lessonsOnDate(tt, date).find((li) => li.lesson.subjectId === subjectId) ?? null;
}

/** Next date after `date` with at least one lesson. */
export function nextSchoolDay(tt: Timetable | undefined, date: Date): Date | null {
  for (let i = 1; i <= SEARCH_DAYS; i++) {
    const d = addDays(startOfDay(date), i);
    if (lessonsOnDate(tt, d).length > 0) return d;
  }
  return null;
}

export function lessonAt(tt: Timetable | undefined, day: Weekday, period: number): Lesson | undefined {
  return tt?.lessons.find((l) => l.day === day && l.period === period);
}

/** Sensible default bell schedule: 45-minute lessons, 5-minute breaks, a long break after period 3. */
export function defaultBells(count = 7, firstStart = '08:00'): Bell[] {
  const bells: Bell[] = [];
  let t = parseHm(firstStart);
  for (let i = 0; i < count; i++) {
    bells.push({ start: formatHm(t), end: formatHm(t + 45) });
    t += 45 + (i === 2 ? 20 : 5);
  }
  return bells;
}

/** Append a bell continuing the rhythm of the last one. */
export function nextBell(bells: Bell[]): Bell {
  const last = bells[bells.length - 1];
  if (!last || !isValidBell(last)) return defaultBells(1)[0] as Bell;
  const len = parseHm(last.end) - parseHm(last.start);
  const start = Math.min(parseHm(last.end) + 5, 23 * 60);
  return { start: formatHm(start), end: formatHm(Math.min(start + len, 23 * 60 + 59)) };
}

export const WORK_WEEK: Weekday[] = [1, 2, 3, 4, 5];
