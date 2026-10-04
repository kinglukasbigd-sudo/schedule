import { uid } from '@/lib/id';
import { MAX_PERIODS } from './constants';
import { addDays, isHHmm, minutesOf, toHHmm } from './time';
import type { DateKey, ID, Period, Timetable } from './types';

/** 45-minute lessons with 5-minute breaks: what a missing or broken time becomes. */
const DEFAULT_LENGTH = 45;
const DEFAULT_BREAK = 5;

/**
 * Turn loose start/end pairs into valid periods (invariant 2): ordered, non-overlapping,
 * `end > start`, at most 14. Broken times are repaired from their neighbours, not dropped,
 * so lessons keep their slots.
 */
export function normalizePeriods(times: readonly { start: string; end: string }[], newId: () => ID = uid): Period[] {
  const out: Period[] = [];
  for (const raw of times.slice(0, MAX_PERIODS)) {
    const prevEnd = out.length ? minutesOf((out[out.length - 1] as Period).end) : null;
    let start = isHHmm(raw.start) ? minutesOf(raw.start) : prevEnd != null ? prevEnd + DEFAULT_BREAK : 8 * 60;
    if (prevEnd != null && start < prevEnd) start = prevEnd;
    let end = isHHmm(raw.end) ? minutesOf(raw.end) : start + DEFAULT_LENGTH;
    if (end <= start) end = start + DEFAULT_LENGTH;
    if (start >= 23 * 60 + 59) break;
    out.push({ id: newId(), label: null, start: toHHmm(start), end: toHHmm(Math.min(end, 23 * 60 + 59)) });
  }
  return out;
}

/** "Timetable", or "Timetable 2" … when the name is taken. */
export function nextTimetableName(existing: readonly Pick<Timetable, 'name'>[], base = 'Timetable'): string {
  const names = new Set(existing.map((t) => t.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

/**
 * Fit a new timetable starting `from` among the others (R-2): a neighbour that overlaps is trimmed
 * to end the day before, or to start the day after the new one ends; one left with no days is
 * replaced. Returns the timetables to keep (changed ones included) and the ids that go.
 */
export function placeTimetable(
  others: readonly Timetable[],
  from: DateKey,
  to: DateKey | null,
): { kept: Timetable[]; removed: ID[] } {
  const kept: Timetable[] = [];
  const removed: ID[] = [];
  for (const t of others) {
    const overlaps = t.validFrom <= (to ?? '9999-12-31') && from <= (t.validTo ?? '9999-12-31');
    if (!overlaps) {
      kept.push(t);
    } else if (t.validFrom < from) {
      kept.push({ ...t, validTo: addDays(from, -1) });
    } else if (to != null && (t.validTo == null || t.validTo > to)) {
      // The anchor stays: moving it would flip the neighbour's A/B weeks.
      kept.push({ ...t, validFrom: addDays(to, 1) });
    } else {
      removed.push(t.id);
    }
  }
  return { kept, removed };
}
