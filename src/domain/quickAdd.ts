import { addDays, differenceInCalendarDays, getISODay, setYear, startOfDay } from 'date-fns';
import { abbreviate, fold, tokens } from '@/lib/text';
import { toDateKey } from './schedule';
import type { Subject, TaskKind } from './types';

/**
 * Understands short natural input in English, Macedonian and German:
 * "math test friday", "домашна по англиски утре", "Deutsch Aufsatz 12.10".
 * Only returns what it is confident about; the sheet treats results as suggestions.
 */
export interface QuickAddHints {
  kind?: TaskKind;
  subjectId?: string;
  /** "yyyy-MM-dd" */
  date?: string;
}

const KIND_WORDS: Record<TaskKind, string[]> = {
  test: [
    'test', 'tests', 'exam', 'exams', 'quiz', 'midterm', 'final', 'finals',
    'тест', 'тестот', 'контролна', 'писмена', 'испит', 'квиз',
    'klausur', 'prufung', 'klassenarbeit', 'schulaufgabe', 'arbeit', 'kurzarbeit',
  ],
  assignment: [
    'essay', 'project', 'assignment', 'report', 'presentation', 'paper', 'coursework',
    'есеј', 'проект', 'проектна', 'семинарска', 'реферат', 'презентација',
    'aufsatz', 'projekt', 'referat', 'prasentation', 'hausarbeit', 'facharbeit',
    'projektarbeit', 'gruppenarbeit', 'seminararbeit',
  ],
  homework: [
    'homework', 'hw', 'worksheet', 'exercises',
    'домашна', 'домашно', 'домашни',
    'hausaufgabe', 'hausaufgaben', 'ubung', 'ubungen', 'arbeitsblatt',
  ],
};

/** German compounds: "Mathearbeit", "Bioklausur", "Vokabeltest". */
const KIND_SUFFIXES: [string, TaskKind][] = [
  ['hausarbeit', 'assignment'],
  ['projektarbeit', 'assignment'],
  ['klausur', 'test'],
  ['prufung', 'test'],
  ['arbeit', 'test'],
  ['test', 'test'],
];

const RELATIVE_DAYS: Record<string, number> = {
  today: 0, tonight: 0, денес: 0, вечерва: 0, heute: 0,
  tomorrow: 1, tmrw: 1, tmr: 1, утре: 1, morgen: 1,
  задутре: 2, ubermorgen: 2,
};

/** Weekday words → ISO weekday. Two-letter forms are omitted on purpose ("do", "so" are English words). */
const WEEKDAY_WORDS: Record<string, number> = {
  monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4,
  thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 7, sun: 7,
  понеделник: 1, пон: 1, вторник: 2, вто: 2, среда: 3, сре: 3, четврток: 4, чет: 4, петок: 5,
  сабота: 6, саб: 6, недела: 7, нед: 7,
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6, sonntag: 7,
};

const ALL_KIND_WORDS = new Map<string, TaskKind>(
  (Object.entries(KIND_WORDS) as [TaskKind, string[]][]).flatMap(([kind, words]) =>
    words.map((w) => [fold(w), kind] as [string, TaskKind]),
  ),
);

export function detectKind(toks: string[]): TaskKind | undefined {
  for (const t of toks) {
    const kind = ALL_KIND_WORDS.get(t);
    if (kind) return kind;
  }
  for (const t of toks) {
    for (const [suffix, kind] of KIND_SUFFIXES) {
      if (t.length > suffix.length + 2 && t.endsWith(suffix)) return kind;
    }
  }
  return undefined;
}

const NEAR_DATE_DAYS = 120;

function nextWeekday(now: Date, isoDay: number): Date {
  const today = getISODay(now);
  const delta = (isoDay - today + 7) % 7 || 7;
  return addDays(startOfDay(now), delta);
}

export function detectDate(text: string, now: Date): string | undefined {
  const toks = tokens(text);

  // "day after tomorrow"
  const i = toks.indexOf('after');
  if (i > 0 && toks[i - 1] === 'day' && toks[i + 1] === 'tomorrow') return toDateKey(addDays(now, 2));

  for (const t of toks) {
    const rel = RELATIVE_DAYS[t];
    if (rel !== undefined) return toDateKey(addDays(now, rel));
  }
  for (const t of toks) {
    const wd = WEEKDAY_WORDS[t];
    if (wd !== undefined) return toDateKey(nextWeekday(now, wd));
  }

  // Day-first numeric dates: 12.10, 12/10, 12.10.2026
  const m = /(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d])/.exec(text);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let year = m[3] ? Number(m[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      let date = new Date(year, month - 1, day);
      if (date.getMonth() !== month - 1) return undefined; // 31.02
      if (!m[3] && date < startOfDay(now)) date = setYear(date, year + 1);
      // Without a year, only near dates count — "ex 4.7" is an exercise, not July.
      if (!m[3] && differenceInCalendarDays(date, now) > NEAR_DATE_DAYS) return undefined;
      return toDateKey(date);
    }
  }
  return undefined;
}

/** Little words that only introduce a date: "test on friday", "до петок", "bis Montag". */
const DATE_PREPOSITIONS = new Set(
  ['on', 'by', 'for', 'due', 'until', 'till', 'next', 'this', 'до', 'во', 'за', 'на', 'am', 'bis', 'zum', 'fur', 'nachsten'].map(fold),
);
const NUMERIC_DATE = /(^|[^\d])(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)(?![\d])/g;

/** Remove the date phrase quick-add understood, keeping the rest of the title as typed. */
export function stripDate(text: string): string {
  let out = text.replace(/\bthe day after tomorrow\b|\bday after tomorrow\b/gi, ' ');
  out = out.replace(NUMERIC_DATE, (_, pre: string) => `${pre} `);
  const words = [...out.matchAll(/[\p{L}\p{N}]+/gu)];
  const drop: [number, number][] = [];
  words.forEach((m, i) => {
    const w = fold(m[0]);
    if (RELATIVE_DAYS[w] === undefined && WEEKDAY_WORDS[w] === undefined) return;
    let start = m.index;
    const prev = words[i - 1];
    if (prev && DATE_PREPOSITIONS.has(fold(prev[0])) && /^\s*$/.test(out.slice(prev.index + prev[0].length, m.index))) {
      start = prev.index;
    }
    drop.push([start, m.index + m[0].length]);
  });
  for (const [a, b] of drop.reverse()) out = out.slice(0, a) + out.slice(b);
  // A preposition left dangling at the end ("read ch. 3 by") introduced the removed date.
  let trailing: RegExpExecArray | null;
  while ((trailing = /\s([\p{L}]+)\s*$/u.exec(out)) && DATE_PREPOSITIONS.has(fold(trailing[1] as string))) {
    out = out.slice(0, trailing.index);
  }
  return out
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
}

export function detectSubject(toks: string[], subjects: Subject[]): Subject | undefined {
  let best: { subject: Subject; score: number } | undefined;
  for (const subject of subjects) {
    const nameToks = tokens(subject.name);
    const first = nameToks[0];
    if (!first) continue;
    let score = 0;

    // Whole name appears as a token sequence.
    for (let i = 0; i + nameToks.length <= toks.length; i++) {
      if (nameToks.every((nt, j) => toks[i + j] === nt)) score = Math.max(score, 3 + nameToks.length);
    }
    const abbr = fold(abbreviate(subject.name));
    for (const t of toks) {
      if (abbr.length >= 2 && t === abbr) score = Math.max(score, 2.5);
      // "bio" → Biology, "mathe" → Mathematik
      if (t.length >= 3 && first.startsWith(t)) score = Math.max(score, 1 + t.length / 100);
      // German compounds: "mathetest" → Mathematik
      if (first.length >= 4 && t.length > 4 && t.startsWith(first.slice(0, 4))) score = Math.max(score, 0.5);
    }
    if (score > 0 && (!best || score > best.score)) best = { subject, score };
  }
  return best?.subject;
}

export function parseQuickAdd(text: string, subjects: Subject[], now: Date): QuickAddHints {
  const toks = tokens(text);
  const hints: QuickAddHints = {};
  const kind = detectKind(toks);
  if (kind) hints.kind = kind;
  const subject = detectSubject(toks, subjects);
  if (subject) hints.subjectId = subject.id;
  const date = detectDate(text, now);
  if (date) hints.date = date;
  return hints;
}
