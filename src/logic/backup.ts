import { DEFAULT_SETTINGS } from './constants';
import { migrateV1toV2, type V1Data } from './migrate';
import {
  InvalidDataError,
  checkInvariants,
  sanitizeHoliday,
  sanitizeSettings,
  sanitizeSubject,
  sanitizeTask,
  sanitizeTimetable,
} from './validate';
import type { AppData, Attachment, ID } from './types';

/**
 * Backups (F-12): one JSON file with everything, attachments base64-inlined. Version 2 is
 * written; versions 1 and 2 are read (v1 goes through the same migration as the database).
 */

export const BACKUP_VERSION = 2;

/** An attachment as it travels in a backup: Blobs become base64 strings. */
export interface EncodedAttachment extends Omit<Attachment, 'blob' | 'thumb'> {
  data: string;
  thumb: string | null;
}

export type BackupData = Omit<AppData, 'attachments'> & { attachments: EncodedAttachment[] };

export interface Backup extends BackupData {
  app: 'term';
  version: number;
  exportedAt: string;
}

export type BackupErrorCode = 'not-a-backup' | 'newer-version' | 'invalid';

export class BackupError extends Error {
  constructor(
    public readonly code: BackupErrorCode,
    public readonly details: string[] = [],
  ) {
    super(code);
    this.name = 'BackupError';
  }
}

export function createBackup(data: BackupData, now: Date): Backup {
  return { app: 'term', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

/** What the restore sheet shows side by side (DESIGN §4.13). */
export function summarize(data: Pick<BackupData, 'timetables' | 'subjects' | 'tasks' | 'attachments' | 'holidays'>) {
  return {
    timetables: data.timetables.length,
    subjects: data.subjects.length,
    tasks: data.tasks.length,
    holidays: data.holidays.length,
    files: data.attachments.length,
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function sanitizeAttachment(v: unknown): EncodedAttachment {
  if (!isObj(v)) throw new InvalidDataError('attachment');
  const { id, taskId, name, mime, kind, size, createdAt, updatedAt, data, thumb } = v;
  if (typeof id !== 'string' || typeof taskId !== 'string' || typeof name !== 'string' || typeof mime !== 'string') {
    throw new InvalidDataError('attachment');
  }
  if (kind !== 'image' && kind !== 'pdf' && kind !== 'file') throw new InvalidDataError('attachment.kind');
  if (typeof size !== 'number' || typeof createdAt !== 'number') throw new InvalidDataError('attachment.size');
  if (typeof data !== 'string' || !BASE64.test(data)) throw new InvalidDataError('attachment.data');
  if (thumb != null && (typeof thumb !== 'string' || !BASE64.test(thumb))) throw new InvalidDataError('attachment.thumb');
  return {
    id,
    taskId,
    name,
    mime,
    kind,
    size,
    createdAt,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : createdAt,
    data,
    thumb: thumb ?? null,
  };
}

function parseV1(json: Obj, newId?: () => ID): BackupData {
  const list = (v: unknown, where: string) => {
    if (!Array.isArray(v)) throw new InvalidDataError(where);
    return v;
  };
  const subjects = list(json.subjects, 'subjects').map((s) => {
    if (!isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.createdAt !== 'number') {
      throw new InvalidDataError('subject');
    }
    return { id: s.id, name: s.name, color: typeof s.color === 'string' ? s.color : 'stone', createdAt: s.createdAt };
  });
  const tasks = list(json.tasks, 'tasks').map((t) => {
    if (!isObj(t) || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.due !== 'string') {
      throw new InvalidDataError('task');
    }
    return {
      id: t.id,
      kind: String(t.kind),
      title: t.title,
      subjectId: typeof t.subjectId === 'string' ? t.subjectId : null,
      due: t.due,
      period: typeof t.period === 'number' ? t.period : null,
      notes: typeof t.notes === 'string' ? t.notes : '',
      doneAt: typeof t.doneAt === 'number' ? t.doneAt : null,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : 0,
      updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : 0,
    };
  });
  let timetable: V1Data['timetable'] = null;
  if (json.timetable != null) {
    const tt = json.timetable;
    if (!isObj(tt) || !Array.isArray(tt.bells) || !Array.isArray(tt.lessons) || !Array.isArray(tt.days)) {
      throw new InvalidDataError('timetable');
    }
    timetable = {
      id: 'main',
      days: tt.days.filter((d): d is number => typeof d === 'number'),
      bells: tt.bells.map((b) => (isObj(b) ? { start: String(b.start), end: String(b.end) } : { start: '', end: '' })),
      lessons: tt.lessons.flatMap((l) =>
        isObj(l) && typeof l.day === 'number' && typeof l.period === 'number' && typeof l.subjectId === 'string'
          ? [{ day: l.day, period: l.period, subjectId: l.subjectId, ...(typeof l.room === 'string' ? { room: l.room } : {}) }]
          : [],
      ),
      updatedAt: typeof tt.updatedAt === 'number' ? tt.updatedAt : 0,
    };
  }
  if (!isObj(json.settings)) throw new InvalidDataError('settings');
  const settings = json.settings as unknown as V1Data['settings'];
  const migrated = migrateV1toV2({ settings, subjects, timetable, tasks }, newId ? { newId } : {});
  return { ...migrated, attachments: [] };
}

function parseV2(json: Obj): BackupData {
  const list = (v: unknown, where: string) => {
    if (!Array.isArray(v)) throw new InvalidDataError(where);
    return v;
  };
  return {
    settings: sanitizeSettings(json.settings, DEFAULT_SETTINGS),
    subjects: list(json.subjects, 'subjects').map(sanitizeSubject),
    timetables: list(json.timetables, 'timetables').map(sanitizeTimetable),
    holidays: list(json.holidays ?? [], 'holidays').map(sanitizeHoliday),
    tasks: list(json.tasks, 'tasks').map(sanitizeTask),
    attachments: list(json.attachments ?? [], 'attachments').map(sanitizeAttachment),
  };
}

/**
 * Validate an untrusted backup. Throws a BackupError: `not-a-backup`, `newer-version` (E-32) or
 * `invalid` with the reasons. Unknown fields are dropped, never kept.
 */
export function parseBackup(json: unknown, options: { newId?: () => ID } = {}): { data: BackupData; version: 1 | 2 } {
  if (!isObj(json) || json.app !== 'term') throw new BackupError('not-a-backup');
  const version = json.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new BackupError('invalid', ['version']);
  if (version > BACKUP_VERSION) throw new BackupError('newer-version');
  let data: BackupData;
  try {
    data = version === 1 ? parseV1(json, options.newId) : parseV2(json);
  } catch (err) {
    if (err instanceof InvalidDataError) throw new BackupError('invalid', [err.where]);
    throw err;
  }
  const problems = checkInvariants({ ...data, attachments: data.attachments as unknown as Attachment[] });
  if (problems.length) throw new BackupError('invalid', problems);
  return { data, version: version as 1 | 2 };
}
