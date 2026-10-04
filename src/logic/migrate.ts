import { uid } from '@/lib/id';
import { fold } from '@/lib/text';
import { DEFAULT_SETTINGS } from './constants';
import { hueOfPreset } from './subjects';
import { normalizePeriods } from './timetable';
import { isDateKey, isHHmm, mondayOf, toDateKey, weekdayOf } from './time';
import { ACCENTS, LANGUAGES, THEMES, TASK_KINDS } from './types';
import type { AppData, DateKey, ID, Lesson, Settings, Subject, Task, TaskKind, Timetable, Weekday } from './types';

/** The v1 storage format (one timetable, period indexes, named colours), as stored and as backed up. */
export interface V1Subject {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}
export interface V1Lesson {
  day: number;
  period: number;
  subjectId: string;
  room?: string;
}
export interface V1Timetable {
  id: 'main';
  days: number[];
  bells: { start: string; end: string }[];
  lessons: V1Lesson[];
  updatedAt: number;
}
export interface V1Task {
  id: string;
  kind: string;
  title: string;
  subjectId: string | null;
  due: string;
  period: number | null;
  notes: string;
  doneAt: number | null;
  createdAt: number;
  updatedAt: number;
}
export interface V1Settings {
  theme: string;
  accent: string;
  language: string;
  onboarded: boolean;
}
export interface V1Data {
  settings: V1Settings | null;
  subjects: V1Subject[];
  timetable: V1Timetable | null;
  tasks: V1Task[];
}

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
/** v1 rows come straight from IndexedDB, unvalidated: read every field defensively. */
const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const millis = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const dayOf = (ms: number): DateKey => toDateKey(new Date(ms));

export function migrateSettings(v1: Partial<V1Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    theme: oneOf(THEMES, v1?.theme, DEFAULT_SETTINGS.theme),
    accent: oneOf(ACCENTS, v1?.accent, DEFAULT_SETTINGS.accent),
    language: oneOf(LANGUAGES, v1?.language, DEFAULT_SETTINGS.language),
    onboarded: v1?.onboarded === true,
  };
}

/**
 * v1 → v2 (SPEC §9.2). Pure, so the Dexie upgrade and v1 backup imports share it. Broken v1 data
 * is repaired rather than dropped where possible: duplicate subject names merge, lessons on
 * missing periods or subjects go, an impossible due date falls back to the day it was created.
 */
export function migrateV1toV2(v1: V1Data, options: { newId?: () => ID; now?: number } = {}): Omit<AppData, 'attachments'> {
  const newId = options.newId ?? uid;
  const now = options.now ?? Date.now();

  // Subjects: colour name → hue; names stay unique by fold().
  const subjects: Subject[] = [];
  const subjectAlias = new Map<string, ID>();
  for (const s of [...v1.subjects].sort((a, b) => millis(a.createdAt, 0) - millis(b.createdAt, 0))) {
    const name = text(s.name).trim().slice(0, 40) || 'Subject';
    const same = subjects.find((x) => fold(x.name) === fold(name));
    if (same) {
      subjectAlias.set(s.id, same.id);
      continue;
    }
    const createdAt = millis(s.createdAt, 0);
    subjects.push({ id: s.id, name, short: null, hue: hueOfPreset(text(s.color)), teacher: null, createdAt, updatedAt: createdAt });
    subjectAlias.set(s.id, s.id);
  }

  // An impossible due date falls back to the day the task was created, then to today.
  const tasksDue = v1.tasks.map((t) => (isDateKey(t.due) ? t.due : dayOf(millis(t.createdAt, now))));

  // Timetable: "main" becomes a dated, open-ended timetable with period ids.
  const timetables: Timetable[] = [];
  const lessonAt = new Map<string, Lesson>();
  let periodStarts: string[] = [];
  const tt = v1.timetable;
  if (tt) {
    const updatedAt = millis(tt.updatedAt, now);
    const updated = dayOf(updatedAt);
    const earliestDue = tasksDue.reduce<DateKey | null>((min, d) => (!min || d < min ? d : min), null);
    const validFrom = earliestDue && earliestDue < mondayOf(updated) ? earliestDue : mondayOf(updated);
    const periods = normalizePeriods((Array.isArray(tt.bells) ? tt.bells : []).map((b) => ({ start: text(b?.start), end: text(b?.end) })), newId);
    periodStarts = periods.map((p) => p.start);
    const days = [...new Set((Array.isArray(tt.days) ? tt.days : []).filter((d): d is Weekday => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
    const lessons: Lesson[] = [];
    for (const l of Array.isArray(tt.lessons) ? tt.lessons : []) {
      const period = periods[l.period];
      const subjectId = subjectAlias.get(l.subjectId);
      const key = `${l.day}:${l.period}`;
      if (!period || !subjectId || lessonAt.has(key) || !Number.isInteger(l.day) || l.day < 1 || l.day > 7) continue;
      const lesson: Lesson = {
        id: newId(),
        subjectId,
        day: l.day as Weekday,
        week: 0,
        periodId: period.id,
        span: 1,
        time: null,
        room: text(l.room).trim() || null,
      };
      lessons.push(lesson);
      lessonAt.set(key, lesson);
    }
    timetables.push({
      id: newId(),
      name: 'Timetable',
      validFrom,
      validTo: null,
      days: days.length ? days : [1, 2, 3, 4, 5],
      periods,
      rotation: { weeks: 1, anchor: mondayOf(validFrom), anchorIndex: 0, skipHolidayWeeks: false },
      lessons,
      createdAt: updatedAt,
      updatedAt,
    });
  }

  const tasks: Task[] = v1.tasks.map((t, i) => {
    const date = tasksDue[i] as DateKey;
    const lesson = t.period != null ? lessonAt.get(`${weekdayOf(date)}:${t.period}`) : undefined;
    const start = t.period != null ? periodStarts[t.period] : undefined;
    const kind: TaskKind = oneOf(TASK_KINDS, t.kind, 'homework');
    const createdAt = millis(t.createdAt, now);
    const base = {
      id: t.id,
      title: text(t.title),
      subjectId: t.subjectId ? (subjectAlias.get(t.subjectId) ?? null) : null,
      due: { date, lessonId: lesson?.id ?? null, time: start && isHHmm(start) ? start : null },
      notes: text(t.notes),
      subtasks: [],
      attachmentIds: [],
      reminders: null,
      estimateMin: null,
      doneAt: typeof t.doneAt === 'number' && Number.isFinite(t.doneAt) ? t.doneAt : null,
      createdAt,
      updatedAt: millis(t.updatedAt, createdAt),
    };
    if (kind === 'test') return { ...base, kind, topics: [], plan: null, result: null };
    if (kind === 'assignment') return { ...base, kind, plan: null };
    return { ...base, kind };
  });

  return { settings: migrateSettings(v1.settings), subjects, timetables, holidays: [], tasks };
}
