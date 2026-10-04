import { fold } from '@/lib/text';
import type { Weekday } from '@/domain/types';

/**
 * Day names as they appear in timetable headers (EN / DE / MK, full and abbreviated).
 * Short German forms ("Mo", "Di") are safe here because they only count in a header context.
 */
const DAY_NAMES: Record<Weekday, string[]> = {
  1: ['monday', 'mon', 'mo', 'montag', 'понеделник', 'пон', 'пн'],
  2: ['tuesday', 'tue', 'tues', 'tu', 'dienstag', 'di', 'вторник', 'вто', 'вт'],
  3: ['wednesday', 'wed', 'we', 'mittwoch', 'mi', 'среда', 'сре', 'ср'],
  4: ['thursday', 'thu', 'thur', 'thurs', 'th', 'donnerstag', 'do', 'четврток', 'чет', 'чт'],
  5: ['friday', 'fri', 'fr', 'freitag', 'петок', 'пет', 'пт'],
  6: ['saturday', 'sat', 'sa', 'samstag', 'sonnabend', 'сабота', 'саб', 'сб'],
  7: ['sunday', 'sun', 'su', 'sonntag', 'so', 'недела', 'нед', 'нд'],
};

const LOOKUP = new Map<string, Weekday>();
for (const [day, names] of Object.entries(DAY_NAMES)) {
  for (const n of names) LOOKUP.set(fold(n), Number(day) as Weekday);
}

/** Recognise a day name in a short string ("Monday", "Mo.", "ПОН", "Montag:"). */
export function matchDay(raw: string): Weekday | null {
  const word = fold(raw).replace(/[^\p{L}]/gu, '');
  if (!word || word.length > 12) return null;
  return LOOKUP.get(word) ?? null;
}

/** Words that mark a break row or a free period rather than a lesson. */
const BREAK_WORDS = new Set(
  [
    'break', 'lunch', 'recess', 'free', 'period',
    'pause', 'mittagspause', 'grosse', 'große', 'frei', 'freistunde',
    'одмор', 'голем', 'мал', 'пауза', 'ручек', 'слободен', 'час',
  ].map(fold),
);

export function isBreakText(text: string): boolean {
  if (/^[\s\-—–x.·/]*$/i.test(text)) return true;
  const words = fold(text).split(/[^\p{L}]+/u).filter(Boolean);
  return words.length > 0 && words.length <= 3 && words.every((w) => BREAK_WORDS.has(w));
}
