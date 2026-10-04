import Dexie, { type Table } from 'dexie';
import type { Settings, Subject, Task, Timetable } from '@/domain/types';

export interface SettingsRow extends Settings {
  id: 'main';
}

/** The whole app lives in one IndexedDB database. No server, no account. */
export class TermDB extends Dexie {
  subjects!: Table<Subject, string>;
  tasks!: Table<Task, string>;
  timetables!: Table<Timetable, string>;
  settings!: Table<SettingsRow, string>;

  constructor(name = 'term') {
    super(name);
    this.version(1).stores({
      subjects: 'id, name',
      tasks: 'id, due, subjectId, doneAt',
      timetables: 'id',
      settings: 'id',
    });
  }
}

export const db = new TermDB();
