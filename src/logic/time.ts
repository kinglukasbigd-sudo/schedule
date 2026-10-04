import { addDays as addDaysToDate, differenceInCalendarDays, getISODay } from 'date-fns';
import type { DateKey, HHmm, Weekday } from './types';

/**
 * Floating dates and times (R-1). A DateKey is a calendar date and an HHmm a wall-clock time, both
 * in whatever zone the device is in. All arithmetic goes through date-fns calendar functions on
 * local dates — never ±86 400 000 ms — so DST transitions can't shift a day.
 */

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parts(key: DateKey): [number, number, number] {
  const m = DATE_KEY.exec(key);
  if (!m) throw new RangeError(`Not a date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** A real calendar date in "yyyy-MM-dd" form (rejects 2026-02-30). */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false;
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Validated cast, for literals and untrusted input. */
export function dateKey(value: string): DateKey {
  if (!isDateKey(value)) throw new RangeError(`Not a date key: ${value}`);
  return value;
}

export function isHHmm(value: unknown): value is HHmm {
  return typeof value === 'string' && HH_MM.test(value);
}

export function hhmm(value: string): HHmm {
  if (!isHHmm(value)) throw new RangeError(`Not a time: ${value}`);
  return value;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar date of an instant. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DateKey;
}

/** Local midnight of a date. */
export function dateOf(key: DateKey): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  return toDateKey(addDaysToDate(dateOf(key), days));
}

/** Calendar days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return differenceInCalendarDays(dateOf(a), dateOf(b));
}

export function weekdayOf(key: DateKey): Weekday {
  return getISODay(dateOf(key)) as Weekday;
}

/** The first day of the week containing `key`. Weeks start on Monday (1) unless told otherwise. */
export function weekStart(key: DateKey, weekStartsOn: 0 | 1 = 1): DateKey {
  const day = weekdayOf(key) % 7; // Sunday → 0
  return addDays(key, -((day - weekStartsOn + 7) % 7));
}

/** Monday of the ISO week containing `key`. Rotation always counts ISO weeks (R-3). */
export function mondayOf(key: DateKey): DateKey {
  return weekStart(key, 1);
}

/** The seven dates of the week containing `key`. */
export function weekOf(key: DateKey, weekStartsOn: 0 | 1 = 1): DateKey[] {
  const first = weekStart(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a <= b ? a : b;
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}

/** Inclusive list of dates. Empty when `to` is before `from`. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** "08:05" → 485. */
export function minutesOf(time: HHmm): number {
  const m = HH_MM.exec(time);
  if (!m) throw new RangeError(`Not a time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 485 → "08:05". Clamps to the day: no lesson runs past midnight. */
export function toHHmm(minutes: number): HHmm {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}` as HHmm;
}

/** The local wall-clock time of an instant. */
export function timeOf(date: Date): HHmm {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}` as HHmm;
}

function exactly(y: number, m: number, d: number, minutes: number): Date | null {
  const date = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const ok =
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d &&
    date.getHours() * 60 + date.getMinutes() === minutes;
  return ok ? date : null;
}

/**
 * The instant of a floating wall-clock time on a date (R-1). A time that doesn't exist (DST
 * spring-forward gap) moves forward to the first minute that does; a time that exists twice
 * (fall-back) is its first occurrence, which is what `Date` gives.
 */
export function atTime(key: DateKey, time: HHmm): Date {
  const [y, m, d] = parts(key);
  const minutes = minutesOf(time);
  for (let t = minutes; t < 24 * 60; t++) {
    const date = exactly(y, m, d, t);
    if (date) return date;
  }
  // A gap running to midnight (no zone does this): the start of the next day.
  return dateOf(addDays(key, 1));
}
