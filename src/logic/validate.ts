import { fold } from '@/lib/text';
import { MAX_PERIODS, MAX_ROTATION, MAX_SPAN } from './constants';
import { isDateKey, isHHmm, minutesOf, weekdayOf } from './time';
import {
  ACCENTS,
  LANGUAGES,
  SESSION_MINUTES,
  TASK_KINDS,
  THEMES,
  type AppData,
  type Lesson,
  type Period,
  type ReminderRule,
  type Settings,
  type StudyPlan,
  type Subject,
  type Subtask,
  type Task,
  type TaskReminder,
  type TestResult,
  type Timetable,
  type Holiday,
  type Weekday,
} from './types';

/**
 * Two layers of checking for data from outside (backups, old databases):
 * `sanitize*` rebuilds each entity from known fields only — unknown fields are dropped, wrong
 * types throw (E-32) — and `checkInvariants` lists every SPEC §3.4 rule the data breaks.
 */

export class InvalidDataError extends Error {
  constructor(public readonly where: string) {
    super(`invalid: ${where}`);
    this.name = 'InvalidDataError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (where: string): never => {
  throw new InvalidDataError(where);
};
const obj = (v: unknown, where: string): Obj => (isObj(v) ? v : fail(where));
const str = (v: unknown, where: string): string => (typeof v === 'string' ? v : fail(where));
const num = (v: unknown, where: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(where));
const bool = (v: unknown, where: string): boolean => (typeof v === 'boolean' ? v : fail(where));
const nullable = <T>(v: unknown, read: (v: unknown) => T): T | null => (v == null ? null : read(v));
const arr = (v: unknown, where: string): unknown[] => (Array.isArray(v) ? v : fail(where));
const oneOf = <T extends string | number>(list: readonly T[], v: unknown, where: string): T =>
  (list as readonly unknown[]).includes(v) ? (v as T) : fail(where);
const date = (v: unknown, where: string) => (isDateKey(v) ? v : fail(where));
const time = (v: unknown, where: string) => (isHHmm(v) ? v : fail(where));
const weekday = (v: unknown, where: string) => oneOf<Weekday>([1, 2, 3, 4, 5, 6, 7], v, where);
const stored = (o: Obj, where: string) => ({
  id: str(o.id, `${where}.id`),
  createdAt: num(o.createdAt, `${where}.createdAt`),
  updatedAt: num(o.updatedAt ?? o.createdAt, `${where}.updatedAt`),
});

export function sanitizeSubject(v: unknown): Subject {
  const o = obj(v, 'subject');
  return {
    ...stored(o, 'subject'),
    name: str(o.name, 'subject.name'),
    short: nullable(o.short, (x) => str(x, 'subject.short')),
    hue: nullable(o.hue, (x) => num(x, 'subject.hue')),
    teacher: nullable(o.teacher, (x) => str(x, 'subject.teacher')),
  };
}

function sanitizePeriod(v: unknown): Period {
  const o = obj(v, 'period');
  return {
    id: str(o.id, 'period.id'),
    label: nullable(o.label, (x) => str(x, 'period.label')),
    start: time(o.start, 'period.start'),
    end: time(o.end, 'period.end'),
  };
}

function sanitizeLesson(v: unknown): Lesson {
  const o = obj(v, 'lesson');
  const t = nullable(o.time, (x) => obj(x, 'lesson.time'));
  return {
    id: str(o.id, 'lesson.id'),
    subjectId: str(o.subjectId, 'lesson.subjectId'),
    day: weekday(o.day, 'lesson.day'),
    week: num(o.week, 'lesson.week'),
    periodId: str(o.periodId, 'lesson.periodId'),
    span: num(o.span, 'lesson.span'),
    time: t ? { start: time(t.start, 'lesson.time.start'), end: time(t.end, 'lesson.time.end') } : null,
    room: nullable(o.room, (x) => str(x, 'lesson.room')),
  };
}

export function sanitizeTimetable(v: unknown): Timetable {
  const o = obj(v, 'timetable');
  const r = obj(o.rotation, 'timetable.rotation');
  return {
    ...stored(o, 'timetable'),
    name: str(o.name, 'timetable.name'),
    validFrom: date(o.validFrom, 'timetable.validFrom'),
    validTo: nullable(o.validTo, (x) => date(x, 'timetable.validTo')),
    days: arr(o.days, 'timetable.days').map((d) => weekday(d, 'timetable.days')),
    periods: arr(o.periods, 'timetable.periods').map(sanitizePeriod),
    rotation: {
      weeks: oneOf([1, 2, 3, 4] as const, r.weeks, 'rotation.weeks'),
      anchor: date(r.anchor, 'rotation.anchor'),
      anchorIndex: num(r.anchorIndex, 'rotation.anchorIndex'),
      skipHolidayWeeks: bool(r.skipHolidayWeeks, 'rotation.skipHolidayWeeks'),
    },
    lessons: arr(o.lessons, 'timetable.lessons').map(sanitizeLesson),
  };
}

export function sanitizeHoliday(v: unknown): Holiday {
  const o = obj(v, 'holiday');
  return { ...stored(o, 'holiday'), name: str(o.name, 'holiday.name'), start: date(o.start, 'holiday.start'), end: date(o.end, 'holiday.end') };
}

function sanitizeSubtask(v: unknown): Subtask {
  const o = obj(v, 'subtask');
  return {
    id: str(o.id, 'subtask.id'),
    title: str(o.title, 'subtask.title'),
    done: bool(o.done, 'subtask.done'),
    plannedFor: nullable(o.plannedFor, (x) => date(x, 'subtask.plannedFor')),
    minutes: nullable(o.minutes, (x) => num(x, 'subtask.minutes')),
    origin: oneOf(['user', 'plan'] as const, o.origin, 'subtask.origin'),
  };
}

function sanitizePlan(v: unknown): StudyPlan {
  const o = obj(v, 'plan');
  return {
    generatedAt: num(o.generatedAt, 'plan.generatedAt'),
    sessionMinutes: oneOf(SESSION_MINUTES, o.sessionMinutes, 'plan.sessionMinutes'),
    sessions: num(o.sessions, 'plan.sessions'),
  };
}

function sanitizeResult(v: unknown): TestResult {
  const o = obj(v, 'result');
  return {
    grade: nullable(o.grade, (x) => str(x, 'result.grade')),
    score: nullable(o.score, (x) => num(x, 'result.score')),
    outOf: nullable(o.outOf, (x) => num(x, 'result.outOf')),
    note: typeof o.note === 'string' ? o.note : '',
    recordedAt: num(o.recordedAt, 'result.recordedAt'),
  };
}

export function sanitizeTask(v: unknown): Task {
  const o = obj(v, 'task');
  const due = obj(o.due, 'task.due');
  const kind = oneOf(TASK_KINDS, o.kind, 'task.kind');
  const base = {
    ...stored(o, 'task'),
    title: str(o.title, 'task.title'),
    subjectId: nullable(o.subjectId, (x) => str(x, 'task.subjectId')),
    due: {
      date: date(due.date, 'task.due.date'),
      lessonId: nullable(due.lessonId, (x) => str(x, 'task.due.lessonId')),
      time: nullable(due.time, (x) => time(x, 'task.due.time')),
    },
    notes: typeof o.notes === 'string' ? o.notes : '',
    subtasks: arr(o.subtasks ?? [], 'task.subtasks').map(sanitizeSubtask),
    attachmentIds: arr(o.attachmentIds ?? [], 'task.attachmentIds').map((x) => str(x, 'task.attachmentIds')),
    reminders: nullable(o.reminders, (x) =>
      arr(x, 'task.reminders').map((r): TaskReminder => {
        const ro = obj(r, 'task.reminder');
        return { daysBefore: num(ro.daysBefore, 'reminder.daysBefore'), at: time(ro.at, 'reminder.at') };
      }),
    ),
    estimateMin: nullable(o.estimateMin, (x) => num(x, 'task.estimateMin')),
    doneAt: nullable(o.doneAt, (x) => num(x, 'task.doneAt')),
  };
  const plan = nullable(o.plan, sanitizePlan);
  if (kind === 'test') {
    return {
      ...base,
      kind,
      topics: arr(o.topics ?? [], 'task.topics').map((x) => str(x, 'task.topics')),
      plan,
      result: nullable(o.result, sanitizeResult),
    };
  }
  if (kind === 'assignment') return { ...base, kind, plan };
  return { ...base, kind };
}

function sanitizeReminderRule(v: unknown): ReminderRule {
  const o = obj(v, 'reminder');
  const id = str(o.id, 'reminder.id');
  const enabled = bool(o.enabled, 'reminder.enabled');
  const type = oneOf(['before-due', 'study-session', 'digest'] as const, o.type, 'reminder.type');
  if (type === 'study-session') return { id, type, enabled };
  if (type === 'digest') return { id, type, enabled, at: time(o.at, 'reminder.at') };
  return {
    id,
    type,
    enabled,
    kinds: arr(o.kinds, 'reminder.kinds').map((k) => oneOf(TASK_KINDS, k, 'reminder.kinds')),
    daysBefore: num(o.daysBefore, 'reminder.daysBefore'),
    at: time(o.at, 'reminder.at'),
  };
}

export function sanitizeSettings(v: unknown, defaults: Settings): Settings {
  const o = obj(v, 'settings');
  const n = isObj(o.notifications) ? o.notifications : {};
  const s = isObj(o.study) ? o.study : {};
  return {
    theme: oneOf(THEMES, o.theme, 'settings.theme'),
    accent: oneOf(ACCENTS, o.accent, 'settings.accent'),
    language: oneOf(LANGUAGES, o.language, 'settings.language'),
    onboarded: bool(o.onboarded, 'settings.onboarded'),
    notifications: {
      enabled: typeof n.enabled === 'boolean' ? n.enabled : defaults.notifications.enabled,
      scheduledInZone: typeof n.scheduledInZone === 'string' ? n.scheduledInZone : null,
    },
    reminders: Array.isArray(o.reminders) ? o.reminders.map(sanitizeReminderRule) : defaults.reminders,
    study: {
      maxMinutesPerDay: typeof s.maxMinutesPerDay === 'number' ? s.maxMinutesPerDay : defaults.study.maxMinutesPerDay,
      sessionMinutes: (SESSION_MINUTES as readonly unknown[]).includes(s.sessionMinutes)
        ? (s.sessionMinutes as Settings['study']['sessionMinutes'])
        : defaults.study.sessionMinutes,
      preferredTime: isHHmm(s.preferredTime) ? s.preferredTime : defaults.study.preferredTime,
      weekends: typeof s.weekends === 'boolean' ? s.weekends : defaults.study.weekends,
    },
    lastBackupAt: typeof o.lastBackupAt === 'number' ? o.lastBackupAt : null,
  };
}

// ── Invariants (SPEC §3.4) ───────────────────────────────────────────────────

/** Every broken invariant, as a short readable reason. Empty means the data is consistent. */
export function checkInvariants(data: Pick<AppData, 'subjects' | 'timetables' | 'holidays' | 'tasks' | 'attachments'>): string[] {
  const problems: string[] = [];
  const subjectIds = new Set(data.subjects.map((s) => s.id));

  // Ids are keys: a duplicate would silently overwrite a row on import.
  const unique = (table: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${table}: id ${id} is used twice`);
      seen.add(id);
    }
  };
  unique('subjects', data.subjects.map((s) => s.id));
  unique('timetables', data.timetables.map((t) => t.id));
  unique('holidays', data.holidays.map((h) => h.id));
  unique('tasks', data.tasks.map((t) => t.id));
  unique('attachments', data.attachments.map((a) => a.id));
  unique('lessons', data.timetables.flatMap((t) => t.lessons.map((l) => l.id)));
  for (const t of data.timetables) unique(`timetable ${t.id} periods`, t.periods.map((p) => p.id));
  for (const s of data.subjects) {
    if (!s.name.trim()) problems.push(`subject ${s.id}: blank name`);
    if (s.hue != null && (!Number.isInteger(s.hue) || s.hue < 0 || s.hue > 359)) problems.push(`subject ${s.id}: hue ${s.hue}`);
  }

  // 1. Timetable ranges don't overlap; validTo ≥ validFrom.
  const sorted = [...data.timetables].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  sorted.forEach((t, i) => {
    if (t.validTo != null && t.validTo < t.validFrom) problems.push(`timetable ${t.id}: ends before it starts`);
    const next = sorted[i + 1];
    if (next && (t.validTo == null || t.validTo >= next.validFrom)) problems.push(`timetables ${t.id} and ${next.id} overlap`);
  });

  for (const t of data.timetables) {
    // 2. Periods ordered, non-overlapping, end > start, 1–14.
    if (t.periods.length < 1 || t.periods.length > MAX_PERIODS) problems.push(`timetable ${t.id}: ${t.periods.length} periods`);
    t.periods.forEach((p, i) => {
      if (minutesOf(p.end) <= minutesOf(p.start)) problems.push(`period ${p.id}: ends before it starts`);
      const prev = t.periods[i - 1];
      if (prev && minutesOf(p.start) < minutesOf(prev.end)) problems.push(`period ${p.id}: overlaps the one before`);
    });
    if (t.days.length === 0) problems.push(`timetable ${t.id}: no school days`);
    // 4. Rotation.
    const { weeks, anchor, anchorIndex } = t.rotation;
    if (weeks < 1 || weeks > MAX_ROTATION) problems.push(`timetable ${t.id}: rotation of ${weeks} weeks`);
    if (weekdayOf(anchor) !== 1) problems.push(`timetable ${t.id}: rotation anchor is not a Monday`);
    if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= weeks) problems.push(`timetable ${t.id}: anchor index ${anchorIndex}`);
    // 3. One lesson per slot, within the period list; 5. own times valid; 6. subjects exist.
    const index = new Map(t.periods.map((p, i) => [p.id, i]));
    const taken = new Set<string>();
    for (const l of t.lessons) {
      const at = index.get(l.periodId);
      if (at == null) {
        problems.push(`lesson ${l.id}: unknown period`);
        continue;
      }
      if (!Number.isInteger(l.span) || l.span < 1 || l.span > MAX_SPAN || at + l.span > t.periods.length) {
        problems.push(`lesson ${l.id}: span ${l.span} runs past the periods`);
      }
      if (!Number.isInteger(l.week) || l.week < 0 || l.week >= weeks) problems.push(`lesson ${l.id}: week ${l.week}`);
      for (let p = at; p < at + Math.max(1, Math.min(l.span, MAX_SPAN)); p++) {
        const slot = `${l.week}:${l.day}:${p}`;
        if (taken.has(slot)) problems.push(`lesson ${l.id}: slot already taken`);
        taken.add(slot);
      }
      if (l.time && minutesOf(l.time.end) <= minutesOf(l.time.start)) problems.push(`lesson ${l.id}: own time ends before it starts`);
      if (!subjectIds.has(l.subjectId)) problems.push(`lesson ${l.id}: unknown subject`);
    }
  }

  for (const h of data.holidays) if (h.end < h.start) problems.push(`holiday ${h.id}: ends before it starts`);

  // 7. Attachments and tasks agree; 8. result/plan only where allowed; 6. subjects exist.
  const attachments = new Map(data.attachments.map((a) => [a.id, a]));
  for (const task of data.tasks) {
    if (task.subjectId != null && !subjectIds.has(task.subjectId)) problems.push(`task ${task.id}: unknown subject`);
    for (const id of task.attachmentIds) if (attachments.get(id)?.taskId !== task.id) problems.push(`task ${task.id}: attachment ${id} missing`);
    const o = task as unknown as Obj;
    if (task.kind !== 'test' && o.result != null) problems.push(`task ${task.id}: result on a ${task.kind}`);
    if (task.kind === 'homework' && o.plan != null) problems.push(`task ${task.id}: plan on homework`);
  }
  for (const a of data.attachments) {
    const owner = data.tasks.find((t) => t.id === a.taskId);
    if (!owner?.attachmentIds.includes(a.id)) problems.push(`attachment ${a.id}: no task lists it`);
  }

  // 9. Subject names unique by fold().
  const names = new Set<string>();
  for (const s of data.subjects) {
    const key = fold(s.name.trim());
    if (names.has(key)) problems.push(`subject ${s.id}: name "${s.name}" is taken`);
    names.add(key);
  }
  return problems;
}
