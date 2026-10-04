import Dexie, { type Table, type Transaction } from 'dexie';
import { migrateV1toV2, type V1Data } from '@/logic/migrate';
import type { Attachment, Holiday, Settings, Subject, Task, Timetable } from '@/logic/types';

export interface SettingsRow extends Settings {
  id: 'main';
}

/** The v1 → v2 upgrade (SPEC §9.2): read every v1 row, migrate as one value, write v2 rows. */
export async function upgradeV1toV2(tx: Transaction): Promise<void> {
  const v1: V1Data = {
    settings: (await tx.table('settings').get('main')) ?? null,
    subjects: await tx.table('subjects').toArray(),
    timetable: (await tx.table('timetables').get('main')) ?? null,
    tasks: await tx.table('tasks').toArray(),
  };
  const v2 = migrateV1toV2(v1);
  await Promise.all(['subjects', 'timetables', 'tasks', 'settings'].map((t) => tx.table(t).clear()));
  await tx.table('subjects').bulkAdd(v2.subjects);
  await tx.table('timetables').bulkAdd(v2.timetables);
  await tx.table('tasks').bulkAdd(v2.tasks);
  // A v1 database that never finished onboarding has no settings row: keep it that way.
  if (v1.settings) await tx.table('settings').put({ id: 'main', ...v2.settings });
}

/**
 * The whole app lives in one IndexedDB database. No server, no account. Every schema version
 * stays declared so Dexie can upgrade any old database step by step; add a version, never edit one.
 */
export class TermDB extends Dexie {
  subjects!: Table<Subject, string>;
  timetables!: Table<Timetable, string>;
  holidays!: Table<Holiday, string>;
  tasks!: Table<Task, string>;
  attachments!: Table<Attachment, string>;
  settings!: Table<SettingsRow, string>;

  constructor(name = 'term') {
    super(name);
    // v1: one timetable ("main"), period indexes, named colours.
    this.version(1).stores({
      subjects: 'id, name',
      tasks: 'id, due, subjectId, doneAt',
      timetables: 'id',
      settings: 'id',
    });
    // v2 (SPEC §3.3): dated timetables, holidays, attachments, structured tasks.
    this.version(2)
      .stores({
        subjects: 'id, name',
        timetables: 'id, validFrom',
        holidays: 'id, start, end',
        tasks: 'id, due.date, subjectId, doneAt, kind',
        attachments: 'id, taskId',
        settings: 'id',
      })
      .upgrade(upgradeV1toV2);
  }
}

export const db = new TermDB();
