import {
  ACCENTS,
  DEFAULT_SETTINGS,
  LANGUAGES,
  SUBJECT_COLORS,
  TASK_KINDS,
  THEMES,
  type Settings,
  type Subject,
  type Task,
  type Timetable,
} from '@/domain/types';
import { db } from './db';
import { loadSettings, saveSettings } from './repo';

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'term';
  version: number;
  exportedAt: string;
  settings: Settings;
  subjects: Subject[];
  timetable: Timetable | null;
  tasks: Task[];
}

export async function exportBackup(): Promise<Backup> {
  const [settings, subjects, timetable, tasks] = await Promise.all([
    loadSettings().then((s) => s ?? DEFAULT_SETTINGS),
    db.subjects.toArray(),
    db.timetables.get('main'),
    db.tasks.toArray(),
  ]);
  return { app: 'term', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), settings, subjects, timetable: timetable ?? null, tasks };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => isStr(v) && (list as readonly string[]).includes(v);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;

function isSubject(v: unknown): v is Subject {
  return isObj(v) && isStr(v.id) && isStr(v.name) && oneOf(SUBJECT_COLORS, v.color) && isNum(v.createdAt);
}

function isTask(v: unknown): v is Task {
  return (
    isObj(v) &&
    isStr(v.id) &&
    oneOf(TASK_KINDS, v.kind) &&
    isStr(v.title) &&
    (v.subjectId === null || isStr(v.subjectId)) &&
    isStr(v.due) &&
    DATE_KEY.test(v.due) &&
    (v.period === null || isNum(v.period)) &&
    isStr(v.notes) &&
    (v.doneAt === null || isNum(v.doneAt)) &&
    isNum(v.createdAt) &&
    isNum(v.updatedAt)
  );
}

function isTimetable(v: unknown): v is Timetable {
  return (
    isObj(v) &&
    v.id === 'main' &&
    Array.isArray(v.days) &&
    v.days.every((d) => isNum(d) && d >= 1 && d <= 7) &&
    Array.isArray(v.bells) &&
    v.bells.every((b) => isObj(b) && isStr(b.start) && HM.test(b.start) && isStr(b.end) && HM.test(b.end)) &&
    Array.isArray(v.lessons) &&
    v.lessons.every((l) => isObj(l) && isNum(l.day) && isNum(l.period) && isStr(l.subjectId))
  );
}

function isSettings(v: unknown): v is Settings {
  return isObj(v) && oneOf(THEMES, v.theme) && oneOf(ACCENTS, v.accent) && oneOf(LANGUAGES, v.language) && typeof v.onboarded === 'boolean';
}

/** Validate untrusted JSON. Throws with a short reason when the file is not a TERM backup. */
export function parseBackup(json: unknown): Backup {
  if (!isObj(json) || json.app !== 'term') throw new Error('not-a-backup');
  if (!isNum(json.version) || json.version > BACKUP_VERSION) throw new Error('newer-version');
  if (!isSettings(json.settings)) throw new Error('invalid');
  if (!Array.isArray(json.subjects) || !json.subjects.every(isSubject)) throw new Error('invalid');
  if (!Array.isArray(json.tasks) || !json.tasks.every(isTask)) throw new Error('invalid');
  if (json.timetable !== null && !isTimetable(json.timetable)) throw new Error('invalid');
  return json as unknown as Backup;
}

/** Replace everything with the backup's contents, atomically. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', [db.subjects, db.tasks, db.timetables, db.settings], async () => {
    await Promise.all([db.subjects.clear(), db.tasks.clear(), db.timetables.clear()]);
    await db.subjects.bulkPut(backup.subjects);
    await db.tasks.bulkPut(backup.tasks);
    if (backup.timetable) await db.timetables.put(backup.timetable);
    await saveSettings(backup.settings);
  });
}

export async function eraseEverything(): Promise<void> {
  await db.transaction('rw', [db.subjects, db.tasks, db.timetables, db.settings], async () => {
    await Promise.all([db.subjects.clear(), db.tasks.clear(), db.timetables.clear(), db.settings.clear()]);
  });
}
