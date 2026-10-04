import { abbreviate, fold } from '@/lib/text';
import { NEXT_LESSON_HORIZON_DAYS, NIGHT_OWL_UNTIL } from './constants';
import { dueAtLesson, dueOn } from './due';
import { nextLessonOfSubject, occurrencesOn } from './schedule';
import { addDays, diffDays, isDateKey, minutesOf, mondayOf, timeOf, toDateKey, toHHmm, weekdayOf } from './time';
import type { DateKey, Due, HHmm, ID, Language, Schedule, Subject, TaskKind } from './types';

/**
 * Natural-language quick add (F-6, R-12) in English, Macedonian and German:
 * "Math test friday", "домашна по англиски утре", "Deutsch Aufsatz 12.10", "essay 12 nov at 14:00".
 * Pure text → understanding; `resolveQuickAddDue` then places it on the timetable.
 * Nothing is guessed below confidence: no fuzzy spelling, the first match per slot wins.
 */

export type DateSource = 'relative' | 'weekday' | 'next-week' | 'in-days' | 'numeric' | 'month';

export interface QuickAdd {
  kind: TaskKind | null;
  subjectId: ID | null;
  /** The date phrase, when one was understood. */
  when: { date: DateKey; source: DateSource } | null;
  time: HHmm | null;
  /** What was typed minus the date and time phrases (D-013): subject and kind words stay. */
  title: string;
}

// ── Vocabulary ───────────────────────────────────────────────────────────────

const f = (words: string[]) => words.map(fold);

const KIND_WORDS: [TaskKind, string[]][] = [
  [
    'test',
    f([
      'test', 'tests', 'exam', 'exams', 'quiz', 'quizzes', 'midterm', 'midterms', 'finals',
      'тест', 'тестот', 'контролна', 'контролната', 'писмена', 'писмената', 'испит', 'испитот', 'квиз',
      'klausur', 'prüfung', 'klassenarbeit', 'schulaufgabe', 'arbeit', 'kurzarbeit', 'stegreifaufgabe',
    ]),
  ],
  [
    'assignment',
    f([
      'essay', 'essays', 'project', 'projects', 'assignment', 'report', 'presentation', 'coursework',
      'есеј', 'проект', 'проектна', 'семинарска', 'реферат', 'презентација',
      'aufsatz', 'projekt', 'referat', 'präsentation', 'hausarbeit', 'facharbeit', 'projektarbeit',
      'gruppenarbeit', 'seminararbeit',
    ]),
  ],
  [
    'homework',
    f([
      'homework', 'hw', 'worksheet', 'exercises',
      'домашна', 'домашно', 'домашни', 'домашната',
      'hausaufgabe', 'hausaufgaben', 'übung', 'übungen', 'arbeitsblatt',
    ]),
  ],
];
const KIND_BY_WORD = new Map(KIND_WORDS.flatMap(([kind, words]) => words.map((w) => [w, kind] as const)));
/** German compounds, most specific first: "Facharbeit" is an assignment, "Mathearbeit" a test. */
const KIND_SUFFIXES: [string, TaskKind][] = [
  ['hausarbeit', 'assignment'],
  ['facharbeit', 'assignment'],
  ['projektarbeit', 'assignment'],
  ['klausur', 'test'],
  ['prufung', 'test'],
  ['arbeit', 'test'],
  ['test', 'test'],
];

const RELATIVE: Record<string, { days: number; nightOwl: boolean }> = {};
for (const w of ['today', 'tonight', 'денес', 'вечерва', 'heute']) RELATIVE[fold(w)] = { days: 0, nightOwl: false };
for (const w of ['tomorrow', 'tmrw', 'tmr', 'утре', 'morgen']) RELATIVE[fold(w)] = { days: 1, nightOwl: true };
for (const w of ['задутре', 'übermorgen']) RELATIVE[fold(w)] = { days: 2, nightOwl: true };

/** Weekday words. Two-letter German forms are only read in German, capitalised ("Fr", "Do"). */
const WEEKDAYS: Record<string, number> = {};
const weekdayNames: [number, string[]][] = [
  [1, ['monday', 'mon', 'понеделник', 'пон', 'montag']],
  [2, ['tuesday', 'tue', 'tues', 'вторник', 'вто', 'dienstag']],
  [3, ['wednesday', 'wed', 'среда', 'сре', 'mittwoch']],
  [4, ['thursday', 'thu', 'thur', 'thurs', 'четврток', 'чет', 'donnerstag']],
  [5, ['friday', 'fri', 'петок', 'freitag']],
  [6, ['saturday', 'sat', 'сабота', 'саб', 'samstag', 'sonnabend']],
  [7, ['sunday', 'sun', 'недела', 'нед', 'sonntag']],
];
for (const [day, names] of weekdayNames) for (const n of names) WEEKDAYS[fold(n)] = day;
const GERMAN_SHORT_WEEKDAYS: Record<string, number> = { mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 7 };

const MONTHS: Record<string, number> = {};
const monthNames: [number, string[]][] = [
  [1, ['january', 'jan', 'januar', 'jänner', 'јануари', 'јан']],
  [2, ['february', 'feb', 'februar', 'февруари', 'фев']],
  [3, ['march', 'mar', 'märz', 'maerz', 'mrz', 'март', 'мар']],
  [4, ['april', 'apr', 'април', 'апр']],
  [5, ['may', 'mai', 'мај']],
  [6, ['june', 'jun', 'juni', 'јуни', 'јун']],
  [7, ['july', 'jul', 'juli', 'јули', 'јул']],
  [8, ['august', 'aug', 'август', 'авг']],
  [9, ['september', 'sep', 'sept', 'септември', 'сеп']],
  [10, ['october', 'oct', 'oktober', 'okt', 'октомври', 'окт']],
  [11, ['november', 'nov', 'ноември', 'ное']],
  [12, ['december', 'dec', 'dezember', 'dez', 'декември', 'дек']],
];
for (const [month, names] of monthNames) for (const n of names) MONTHS[fold(n)] = month;

const NUMBER_WORDS: Record<string, number> = {};
const numberNames: [number, string[]][] = [
  [1, ['one', 'a', 'еден', 'една', 'едно', 'ein', 'einem', 'einen', 'einer', 'eins']],
  [2, ['two', 'два', 'две', 'zwei']],
  [3, ['three', 'три', 'drei']],
  [4, ['four', 'четири', 'vier']],
  [5, ['five', 'пет', 'fünf']],
  [6, ['six', 'шест', 'sechs']],
  [7, ['seven', 'седум', 'sieben']],
  [8, ['eight', 'осум', 'acht']],
  [9, ['nine', 'девет', 'neun']],
  [10, ['ten', 'десет', 'zehn']],
];
for (const [n, names] of numberNames) for (const w of names) NUMBER_WORDS[fold(w)] = n;

const AMBIGUOUS_MONTHS = new Set(['may', 'march']);
/** Between a day number and its month: "12th of November", "12-ти ноември". */
const LINK_WORDS = new Set(f(['of', 'ти', 'ви', 'ри', 'ми']));
const DAY_UNITS = new Set(f(['day', 'days', 'ден', 'дена', 'дни', 'tag', 'tage', 'tagen']));
const IN_WORDS = new Set(f(['in', 'за']));
const NEXT_WORDS = new Set(f(['next', 'следната', 'следнава', 'идната', 'наредната', 'nächste', 'nächster', 'nächsten', 'kommende', 'kommenden']));
const WEEK_WORDS = new Set(f(['week', 'недела', 'woche']));
const TIME_PREPS = new Set(f(['at', 'во', 'um', 'gegen']));
/** Words that only introduce a date or time and go with it ("test on friday", "до петок", "bis Montag"). */
const DATE_PREPS = new Set(
  f(['on', 'by', 'for', 'until', 'till', 'this', 'next', 'the', 'at', 'до', 'во', 'за', 'на', 'am', 'bis', 'zum', 'zur', 'für', 'um', 'ab', 'nächsten', 'kommenden', 'diesen']),
);
/** Removed only when left dangling at the end ("Essay due" keeps "due" mid-sentence). */
const TRAILING_PREPS = new Set([...DATE_PREPS, ...f(['due', 'of'])]);

/** Within this many days a day-month without a year is read as a date ("ex 4.7" is not July, E-24). */
const NUMERIC_DATE_DAYS = 120;
/** A month name is unambiguous, so it may point up to a year ahead (D-043). */
const MONTH_DATE_DAYS = 365;

// ── Tokens ───────────────────────────────────────────────────────────────────

interface Token {
  raw: string;
  word: string;
  start: number;
  end: number;
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({
    raw: m[0],
    word: fold(m[0]),
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** "SAT", "MON": short words in capitals are acronyms, not weekday abbreviations. */
const isAcronym = (raw: string) => raw.length <= 4 && raw.length >= 2 && raw === raw.toLocaleUpperCase() && /\p{Lu}/u.test(raw);

function numberAt(tok: Token | undefined): number | null {
  if (!tok) return null;
  if (/^\d{1,3}$/.test(tok.word)) return Number(tok.word);
  return NUMBER_WORDS[tok.word] ?? null;
}

/** "12", "12th", "1st" → 12, 1. */
function dayNumber(tok: Token | undefined): number | null {
  const m = tok ? /^(\d{1,2})(st|nd|rd|th)?$/.exec(tok.word) : null;
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 31 ? n : null;
}

// ── Dates ────────────────────────────────────────────────────────────────────

interface Match<T> {
  start: number;
  end: number;
  value: T;
}

/** The earliest match in the text wins; at the same position, the longer one. */
function first<T>(matches: Match<T>[]): Match<T> | null {
  return matches.sort((a, b) => a.start - b.start || b.end - a.end)[0] ?? null;
}

interface DateContext {
  today: DateKey;
  /** The day relative words count from: yesterday during the night-owl hours (R-12). */
  ref: DateKey;
  locale: Language;
}

function nextWeekday(from: DateKey, isoDay: number): DateKey {
  return addDays(from, (isoDay - weekdayOf(from) + 7) % 7 || 7);
}

function calendarDate(year: number, month: number, day: number): DateKey | null {
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isDateKey(key) ? key : null;
}

/** A day and month with an optional year: never in the past, and without a year only within `limit` days. */
function futureDate(ctx: DateContext, day: number, month: number, year: number | null, limit: number): DateKey | null {
  const thisYear = Number(ctx.today.slice(0, 4));
  if (year != null) {
    const full = year < 100 ? 2000 + year : year;
    const date = calendarDate(full, month, day);
    return date && date >= ctx.today ? date : null;
  }
  for (const y of [thisYear, thisYear + 1]) {
    const date = calendarDate(y, month, day);
    if (date && date >= ctx.today) return diffDays(date, ctx.today) <= limit ? date : null;
  }
  return null;
}

type DateMatch = Match<{ date: DateKey; source: DateSource; weekday?: number }>;

/** A date phrase takes a dot right after it along: "Fr.", "12. Nov.", "… friday." */
function withDot(text: string, end: number): number {
  return text[end] === '.' && (end + 1 >= text.length || /\s/.test(text[end + 1] as string)) ? end + 1 : end;
}

/** "friday next week", "next week friday", "во петок следната недела" → that Friday. */
function mergeNextWeek(text: string, matches: DateMatch[]): DateMatch[] {
  const nextWeek = matches.find((m) => m.value.source === 'next-week');
  if (!nextWeek) return matches;
  const gap = (a: DateMatch, b: DateMatch) => text.slice(Math.min(a.end, b.end), Math.max(a.start, b.start));
  const day = matches.find(
    (m) =>
      m.value.weekday != null &&
      (m.end <= nextWeek.start || m.start >= nextWeek.end) &&
      gap(m, nextWeek)
        .split(/[^\p{L}]+/u)
        .filter(Boolean)
        .every((w) => DATE_PREPS.has(fold(w))),
  );
  if (!day?.value.weekday) return matches;
  const merged: DateMatch = {
    start: Math.min(day.start, nextWeek.start),
    end: Math.max(day.end, nextWeek.end),
    value: { date: addDays(nextWeek.value.date, day.value.weekday - 1), source: 'weekday' },
  };
  return [merged, ...matches.filter((m) => m !== day && m !== nextWeek)];
}

function findDates(text: string, toks: Token[], ctx: DateContext): DateMatch[] {
  const out: DateMatch[] = [];
  const add = (from: Token, to: Token, date: DateKey | null, source: DateSource, weekday?: number) => {
    if (date) out.push({ start: from.start, end: withDot(text, to.end), value: { date, source, ...(weekday ? { weekday } : {}) } });
  };

  toks.forEach((tok, i) => {
    const next = toks[i + 1];
    const after = toks[i + 2];
    // "day after tomorrow"
    if (tok.word === 'day' && next?.word === 'after' && after?.word === 'tomorrow') {
      add(tok, after, addDays(ctx.ref, 2), 'relative');
    }
    const rel = RELATIVE[tok.word];
    if (rel) add(tok, tok, addDays(rel.nightOwl ? ctx.ref : ctx.today, rel.days), 'relative');

    // "next week" / "следната недела" / "nächste Woche" — before weekdays: "недела" is also Sunday.
    if (NEXT_WORDS.has(tok.word) && next && WEEK_WORDS.has(next.word)) {
      add(tok, next, addDays(mondayOf(ctx.ref), 7), 'next-week');
      return;
    }
    const prev = toks[i - 1];
    const weekday =
      WEEKDAYS[tok.word] ??
      (ctx.locale === 'de' && /^\p{Lu}\p{Ll}$/u.test(tok.raw) ? GERMAN_SHORT_WEEKDAYS[tok.word] : undefined);
    const partOfNextWeek = WEEK_WORDS.has(tok.word) && prev && NEXT_WORDS.has(prev.word);
    if (weekday && !partOfNextWeek && !(tok.raw.length <= 4 && isAcronym(tok.raw))) {
      add(tok, tok, nextWeekday(ctx.ref, weekday), 'weekday', weekday);
    }

    // "in 3 days" / "за 3 дена" / "in drei Tagen"
    if (IN_WORDS.has(tok.word)) {
      const n = numberAt(next);
      if (n != null && n >= 0 && n <= 365 && after && DAY_UNITS.has(after.word)) add(tok, after, addDays(ctx.today, n), 'in-days');
    }

    // "12 nov", "12th of November", "12. Oktober 2026", "Nov 12"
    const month = MONTHS[tok.word];
    // "may" and "march" are also verbs ("5 may be hard"): lowercase, they count as months only with
    // "of", at the end, or before a year or a date/time word ("essay 1 may", "1 may at 10").
    const verbLike =
      AMBIGUOUS_MONTHS.has(tok.word) &&
      !/^\p{Lu}/u.test(tok.raw) &&
      prev?.word !== 'of' &&
      next != null &&
      !/^\d{4}$/.test(next.word) &&
      !DATE_PREPS.has(next.word);
    if (month && !verbLike) {
      // "12 nov", "12th of November", "12-ти ноември"
      const before = dayNumber(prev) != null ? prev : prev && LINK_WORDS.has(prev.word) ? toks[i - 2] : undefined;
      const beforeDay = dayNumber(before);
      const afterDay = dayNumber(next);
      const yearTok = beforeDay != null ? next : after;
      const year = yearTok && /^\d{4}$/.test(yearTok.word) ? Number(yearTok.word) : null;
      if (beforeDay != null && before) {
        add(before, year != null && yearTok ? yearTok : tok, futureDate(ctx, beforeDay, month, year, MONTH_DATE_DAYS), 'month');
      } else if (afterDay != null && next) {
        add(tok, year != null && after ? after : next, futureDate(ctx, afterDay, month, year, MONTH_DATE_DAYS), 'month');
      }
    }
  });

  // Day-first numeric dates: 12.10, 12/10, 12.10.2026, 12.10.
  for (const m of text.matchAll(/(?<![\d.:/])(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2})(?!\d))?(?![\d:/]|\.\d)(?:\.(?=\s|$))?/g)) {
    const [whole, d, mo, y] = m;
    // "10.30" is a time or a decimal, not a date.
    const date = futureDate(ctx, Number(d), Number(mo), y ? Number(y) : null, NUMERIC_DATE_DAYS);
    if (date) out.push({ start: m.index, end: m.index + whole.length, value: { date, source: 'numeric' } });
  }
  return mergeNextWeek(text, out);
}

// ── Times ────────────────────────────────────────────────────────────────────

/** Bare hours 1–6 mean the afternoon: nobody hands in homework at 3 a.m. (D-043). */
function clockTime(hours: number, minutes: number, meridiem: string | undefined): HHmm | null {
  if (minutes > 59) return null;
  let h = hours;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (meridiem.startsWith('p') ? 12 : 0);
  } else if (h >= 1 && h <= 6) {
    h += 12;
  }
  return h <= 23 ? toHHmm(h * 60 + minutes) : null;
}

function findTimes(text: string): Match<HHmm>[] {
  const out: Match<HHmm>[] = [];
  const push = (m: RegExpMatchArray, time: HHmm | null) => {
    if (time) out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: time });
  };
  const end = '(?![\\p{L}\\p{N}])';
  // "at 10", "um 10.30 Uhr", "во 9 часот", "at 3 pm"
  const prep = [...TIME_PREPS].join('|');
  const withPrep = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${prep})\\s+(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*(a\\.m\\.|p\\.m\\.|am|pm)|\\s*(?:uhr|часот|h))?${end}`,
    'giu',
  );
  for (const m of text.matchAll(withPrep)) push(m, clockTime(Number(m[1]), Number(m[2] ?? 0), m[3]?.toLowerCase()));
  // "10:30" anywhere
  for (const m of text.matchAll(/(?<![\d.:/])(\d{1,2}):(\d{2})(?![\d:])/g)) push(m, clockTime(Number(m[1]), Number(m[2]), undefined));
  // "10 Uhr", "9 часот", "3pm", "3 p.m."
  for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}.:/])(\\d{1,2})(?:[:.](\\d{2}))?\\s*(uhr|часот|a\\.m\\.|p\\.m\\.|am|pm)${end}`, 'giu'))) {
    const unit = (m[3] ?? '').toLowerCase();
    push(m, clockTime(Number(m[1]), Number(m[2] ?? 0), /^[ap]/.test(unit) ? unit : undefined));
  }
  // "10h", "10h30" — glued, and only school hours: "2h" is a duration.
  for (const m of text.matchAll(/(?<![\p{L}\p{N}.:/])(\d{1,2})h(\d{2})?(?![\p{L}\p{N}])/giu)) {
    if (Number(m[1]) >= 7) push(m, clockTime(Number(m[1]), Number(m[2] ?? 0), undefined));
  }
  return out;
}

// ── Kind and subject ─────────────────────────────────────────────────────────

function findKind(toks: Token[]): TaskKind | null {
  for (const tok of toks) {
    const kind = KIND_BY_WORD.get(tok.word);
    if (kind) return kind;
    for (const [suffix, k] of KIND_SUFFIXES) if (tok.word.length > suffix.length + 2 && tok.word.endsWith(suffix)) return k;
  }
  return null;
}

/** Longest match wins: the whole name, then its short form, then a prefix ("bio") or compound ("Mathetest"). */
function findSubject(toks: Token[], subjects: readonly Subject[], ignore: Set<Token>): ID | null {
  let best: { id: ID; length: number; rank: number; at: number } | null = null;
  const words = toks.filter((t) => !ignore.has(t));
  for (const s of subjects) {
    const name = tokenize(s.name).map((t) => t.word);
    const head = name[0];
    if (!head) continue;
    const shortForms = new Set([s.short, abbreviate(s.name)].filter((x): x is string => !!x && x.length >= 2).map(fold));
    const consider = (length: number, rank: number, at: number) => {
      if (!best || length > best.length || (length === best.length && rank > best.rank)) best = { id: s.id, length, rank, at };
    };
    words.forEach((tok, i) => {
      if (name.every((w, j) => words[i + j]?.word === w)) consider(name.join(' ').length, 3, tok.start);
      // "Math", "maths" for Mathematics
      if (shortForms.has(tok.word) || shortForms.has(tok.word.replace(/s$/, ''))) consider(tok.word.length, 2, tok.start);
      if (tok.word.length >= 3 && head.startsWith(tok.word)) consider(tok.word.length, 1, tok.start);
      if (head.length >= 4 && tok.word.length > head.slice(0, 4).length + 2 && tok.word.startsWith(head.slice(0, 4))) {
        consider(4, 0, tok.start);
      }
    });
  }
  return (best as { id: ID } | null)?.id ?? null;
}

// ── Title ────────────────────────────────────────────────────────────────────

function stripSpans(text: string, spans: { start: number; end: number }[]): string {
  const toks = tokenize(text);
  const cut = spans.map((s) => {
    let start = s.start;
    // Take introducing words with it: "on friday", "bis zum 12.10", "the day after tomorrow".
    for (let i = toks.findIndex((t) => t.start >= s.start) - 1; i >= 0; i--) {
      const t = toks[i] as Token;
      if (!DATE_PREPS.has(t.word) || !/^\s*$/.test(text.slice(t.end, start))) break;
      start = t.start;
    }
    return { start, end: s.end };
  });
  let out = text;
  for (const { start, end } of cut.sort((a, b) => b.start - a.start)) out = `${out.slice(0, start)} ${out.slice(end)}`;
  // A preposition left at the end introduced what was removed ("Read ch. 3 by").
  for (let m = /\s([\p{L}]+)\s*$/u.exec(out); m && TRAILING_PREPS.has(fold(m[1] as string)); m = /\s([\p{L}]+)\s*$/u.exec(out)) {
    out = out.slice(0, m.index);
  }
  return out
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[,;:.!?])/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
}

// ── Public API ───────────────────────────────────────────────────────────────

export function parseQuickAdd(text: string, subjects: readonly Subject[], now: Date, locale: Language): QuickAdd {
  const today = toDateKey(now);
  const nightOwl = minutesOf(timeOf(now)) < minutesOf(NIGHT_OWL_UNTIL);
  const ctx: DateContext = { today, ref: nightOwl ? addDays(today, -1) : today, locale };
  const toks = tokenize(text);

  const date = first(findDates(text, toks, ctx));
  const time = first(findTimes(text).filter((m) => !date || m.end <= date.start || m.start >= date.end));
  const used = new Set(toks.filter((t) => [date, time].some((m) => m && t.start >= m.start && t.end <= m.end)));

  return {
    kind: findKind(toks),
    subjectId: findSubject(toks, subjects, used),
    when: date ? { date: date.value.date, source: date.value.source } : null,
    time: time?.value ?? null,
    title: stripSpans(text, [date, time].filter((m): m is Match<never> => m != null)),
  };
}

export type DueSource = 'typed' | 'next-lesson' | 'no-lesson' | 'default';

/**
 * Where a quick add is due (F-7, R-12): a typed date attaches to the subject's lesson that day;
 * "next week" to the subject's first lesson that week, else Monday; no date → the subject's next
 * lesson, else tomorrow (end of day). A typed time always wins over a lesson.
 */
export function resolveQuickAddDue(parsed: Pick<QuickAdd, 'subjectId' | 'when' | 'time'>, now: Date, schedule: Schedule): {
  due: Due;
  source: DueSource;
} {
  const { subjectId, when, time } = parsed;
  const today = toDateKey(now);
  if (when?.source === 'next-week') {
    if (subjectId && !time) {
      for (let i = 0; i < 7; i++) {
        const occ = occurrencesOn(addDays(when.date, i), schedule).find((o) => o.lesson.subjectId === subjectId);
        if (occ) return { due: dueAtLesson(occ), source: 'typed' };
      }
    }
    return { due: { date: when.date, lessonId: null, time }, source: 'typed' };
  }
  if (when) {
    if (time || !subjectId) return { due: dueOn(when.date, subjectId, schedule, time), source: 'typed' };
    // The subject's lesson that day — one still ahead: a lesson that already started is no due time.
    const occ = occurrencesOn(when.date, schedule, (l) => l.subjectId === subjectId).find((o) => o.start > now);
    return { due: occ ? dueAtLesson(occ) : { date: when.date, lessonId: null, time: null }, source: 'typed' };
  }
  if (time) {
    // A time alone: today if it's still ahead, otherwise tomorrow.
    const date = minutesOf(time) > minutesOf(timeOf(now)) ? today : addDays(today, 1);
    return { due: { date, lessonId: null, time }, source: 'typed' };
  }
  const tomorrow = { date: addDays(today, 1), lessonId: null, time: null };
  if (!subjectId) return { due: tomorrow, source: 'default' };
  const next = nextLessonOfSubject(subjectId, now, schedule.timetables, schedule.holidays, NEXT_LESSON_HORIZON_DAYS);
  return next ? { due: dueAtLesson(next), source: 'next-lesson' } : { due: tomorrow, source: 'no-lesson' };
}
