import { editDistance, fold } from '@/lib/text';
import { defaultBells, formatHm, isValidBell, parseHm } from '@/domain/schedule';
import type { Bell, DraftCell, DraftTimetable, Weekday } from '@/domain/types';
import { isBreakText } from './days';

const TIME = /(\d{1,2})[:.](\d{2})/g;

/** Pull up to two "HH:mm" times out of a label like "1. 08:00 – 08:45". */
export function extractTimes(text: string): { start?: string; end?: string } {
  const found: string[] = [];
  for (const m of text.matchAll(TIME)) {
    const minutes = Number(m[1]) * 60 + Number(m[2]);
    if (Number(m[1]) <= 23 && Number(m[2]) <= 59) found.push(formatHm(minutes));
    if (found.length === 2) break;
  }
  const [start, end] = found;
  return { ...(start ? { start } : {}), ...(end ? { end } : {}) };
}

const ROOM_PREFIX = '(?:r|rm|room|raum|каб|кабинет|уч|училница|сала|lab|labor)';
const ROOM_ONLY = new RegExp(`^(?:${ROOM_PREFIX}\\.?\\s*)?[a-zа-я]?-?\\d{1,4}[a-zа-я]?(?:\\.\\d{1,3})?$`, 'iu');
// A trailing room needs a prefix, two+ digits or a letter+digit ("Math 101", "Bio R2") — "English 2" stays a name.
const ROOM_TRAILING = new RegExp(
  `^(.*?\\p{L}.*?)[\\s,]+((?:${ROOM_PREFIX}\\.?\\s*[a-zа-я]?-?\\d{1,4}[a-zа-я]?)|(?:[a-zа-я]?-?\\d{2,4}[a-zа-я]?)|(?:[a-zа-я]-?\\d{1,4}))$`,
  'iu',
);
const ROOM_PARENS = /^(.*?)\s*[([]([^)\]]+)[)\]]\s*$/u;
const ROOM_AT = /^(.*?)\s*@\s*(\S+)\s*$/u;

export function isRoomText(text: string): boolean {
  return ROOM_ONLY.test(text.trim());
}

/** "Math (R12)", "Math @ 12", "Math 101" → subject + room. */
export function splitRoom(raw: string): { subject: string; room?: string } {
  const text = raw.trim();
  for (const re of [ROOM_PARENS, ROOM_AT, ROOM_TRAILING]) {
    const m = re.exec(text);
    if (m?.[1]?.trim() && m[2]?.trim()) return { subject: m[1].trim(), room: m[2].trim() };
  }
  return { subject: text };
}

/** "MATHEMATICS" → "Mathematics"; keeps short acronyms ("PE", "ICT") and mixed case as typed. */
export function tidyName(raw: string): string {
  const s = raw
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—•*.,:;|]+|[\s\-–—•*.,:;|]+$/g, '')
    .trim();
  if (!s) return s;
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length > 3 && letters === letters.toLocaleUpperCase() && /\p{Lu}/u.test(letters)) {
    return s
      .toLocaleLowerCase()
      .replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toLocaleUpperCase());
  }
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/**
 * Merge spelling variants ("Englsh" ≈ "English", "math" ≈ "Math") into the most frequent
 * spelling, so OCR noise does not create duplicate subjects.
 */
export function canonicalNames(names: string[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const name of names) {
    const key = fold(name);
    const variants = counts.get(key) ?? new Map<string, number>();
    variants.set(name, (variants.get(name) ?? 0) + 1);
    counts.set(key, variants);
  }
  const groups = [...counts.entries()].map(([key, variants]) => {
    const total = [...variants.values()].reduce((a, b) => a + b, 0);
    const best = [...variants.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key;
    return { key, total, best, members: [...variants.keys()] };
  });
  groups.sort((a, b) => b.total - a.total);

  const result = new Map<string, string>();
  const parents: typeof groups = [];
  // Tolerance follows the shorter name, so short names ("Art", "Math") never merge fuzzily.
  const tolerance = (len: number) => (len >= 9 ? 2 : len >= 5 ? 1 : 0);
  for (const g of groups) {
    const parent = parents.find((p) => {
      const tol = tolerance(Math.min(p.key.length, g.key.length));
      return tol > 0 && Math.abs(p.key.length - g.key.length) <= tol && editDistance(p.key, g.key, tol) <= tol;
    });
    const target = parent ?? g;
    if (!parent) parents.push(g);
    for (const m of g.members) result.set(m, target.best);
  }
  return result;
}

/** Build a clean draft: drop breaks, merge name variants, fill bells, sort days. */
export function finalizeDraft(
  cells: DraftCell[],
  bellHints: (Partial<Bell> | undefined)[],
  dayHints: Weekday[] = [],
): DraftTimetable | null {
  const kept = cells
    .map((c) => ({ ...c, subject: tidyName(c.subject) }))
    .filter((c) => c.subject && !isBreakText(c.subject));
  if (kept.length === 0) return null;

  const canon = canonicalNames(kept.map((c) => c.subject));
  const unique = new Map<string, DraftCell>();
  for (const c of kept) {
    const key = `${c.day}:${c.period}`;
    if (!unique.has(key)) unique.set(key, { ...c, subject: canon.get(c.subject) ?? c.subject });
  }

  // Compact periods: rows with no lessons on any day (break rows, empty leading rows) go away.
  const usedPeriods = [...new Set([...unique.values()].map((c) => c.period))].sort((a, b) => a - b);
  const periodMap = new Map<number, number>(usedPeriods.map((p, i) => [p, i]));
  const next = usedPeriods.length;

  const fallback = defaultBells(Math.max(next, 1));
  const bells: Bell[] = [];
  for (const [orig, idx] of periodMap) {
    const hint = bellHints[orig];
    const start = hint?.start ?? (idx > 0 ? undefined : fallback[0]?.start);
    let bell: Bell | undefined;
    if (start) {
      const end = hint?.end ?? formatHm(parseHm(start) + 45);
      bell = { start, end };
    }
    if (!isValidBell(bell)) {
      // Continue from the previous bell, or use the default rhythm.
      const prev = bells[idx - 1];
      bell = prev
        ? { start: formatHm(parseHm(prev.end) + 5), end: formatHm(parseHm(prev.end) + 50) }
        : (fallback[idx] as Bell);
    }
    bells[idx] = bell;
  }

  const finalCells = [...unique.values()]
    .filter((c) => periodMap.has(c.period))
    .map((c) => ({ ...c, period: periodMap.get(c.period) as number }));
  const days = [...new Set([...dayHints, ...finalCells.map((c) => c.day)])].sort((a, b) => a - b) as Weekday[];
  return { days: fillDayGaps(days), bells, cells: finalCells };
}

/** Mon, Tue, Thu → Mon–Thu: a weekday between two school days is a school day. */
export function fillDayGaps(days: Weekday[]): Weekday[] {
  if (days.length === 0) return days;
  const min = days[0] as Weekday;
  const max = days[days.length - 1] as Weekday;
  const out: Weekday[] = [];
  for (let d = min; d <= max; d++) out.push(d as Weekday);
  return out;
}
