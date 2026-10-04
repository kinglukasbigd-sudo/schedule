import { create } from 'zustand';
import { db } from '@/db/db';
import type { AppData, Attachment } from '@/logic/types';
import { useSettings } from './settings';
import { EMPTY_COLLECTIONS, TABLES, applyChange, invertChange, tablesOf, type Change, type Collections } from './changes';

/**
 * The data store: subjects, timetables, holidays and tasks in memory, persisted in Dexie.
 * Updates are optimistic (SPEC §3.3): the state changes in the same frame, the write follows in
 * one transaction, and a failed write reloads the affected tables and reports the error.
 * Attachments stay in the database (Blobs don't belong in memory) and settings have their own store.
 */

type ErrorListener = (error: unknown) => void;
const errorListeners = new Set<ErrorListener>();

/** Called when a write fails after the UI already showed it (E-19). Returns an unsubscribe. */
export function onDataError(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

interface DataState extends Collections {
  ready: boolean;
  /** Read everything from the database (upgrading an old one first). */
  load: () => Promise<void>;
  /** Apply a change now and persist it. Resolves false (and reports) when the write fails. */
  apply: (change: Change) => Promise<boolean>;
  /** Apply a change and return the change that undoes it. */
  applyWithUndo: (change: Change) => { undo: Change; done: Promise<boolean> };
  /** Replace all data at once: restore a backup, load demo data (DESIGN §5.3). */
  replaceAll: (data: Omit<AppData, 'attachments'> & { attachments?: Attachment[] }) => Promise<void>;
  /** Erase everything, settings included: the app starts over at Welcome. */
  eraseAll: () => Promise<void>;
}

async function readAll(): Promise<Collections> {
  const [subjects, timetables, holidays, tasks] = await Promise.all([
    db.subjects.toArray(),
    db.timetables.toArray(),
    db.holidays.toArray(),
    db.tasks.toArray(),
  ]);
  return { subjects, timetables, holidays, tasks };
}

export const useData = create<DataState>((set, get) => ({
  ...EMPTY_COLLECTIONS,
  ready: false,

  load: async () => {
    set({ ...(await readAll()), ready: true });
  },

  apply: async (change) => {
    const tables = tablesOf(change);
    if (tables.length === 0) return true;
    set(applyChange(get(), change));
    try {
      await db.transaction('rw', tables.map((t) => db[t]), async () => {
        for (const t of tables) {
          const { put = [], delete: del = [] } = change[t] ?? {};
          if (del.length) await db[t].bulkDelete(del);
          if (put.length) await (db[t] as typeof db.tasks).bulkPut(put as never);
        }
      });
      return true;
    } catch (error) {
      // The database is the source of truth: show what is really stored.
      const stored = await readAll().catch(() => null);
      if (stored) set(Object.fromEntries(tables.map((t) => [t, stored[t]])));
      for (const listener of errorListeners) listener(error);
      return false;
    }
  },

  applyWithUndo: (change) => {
    const undo = invertChange(get(), change);
    return { undo, done: get().apply(change) };
  },

  replaceAll: async (data) => {
    await db.transaction('rw', [...TABLES.map((t) => db[t]), db.attachments, db.settings], async () => {
      await Promise.all([...TABLES.map((t) => db[t].clear()), db.attachments.clear(), db.settings.clear()]);
      await db.subjects.bulkPut(data.subjects);
      await db.timetables.bulkPut(data.timetables);
      await db.holidays.bulkPut(data.holidays);
      await db.tasks.bulkPut(data.tasks);
      await db.attachments.bulkPut(data.attachments ?? []);
      await db.settings.put({ id: 'main', ...data.settings });
    });
    set({ subjects: data.subjects, timetables: data.timetables, holidays: data.holidays, tasks: data.tasks, ready: true });
    await useSettings.getState().hydrate();
  },

  eraseAll: async () => {
    await db.transaction('rw', [...TABLES.map((t) => db[t]), db.attachments, db.settings], async () => {
      await Promise.all([...TABLES.map((t) => db[t].clear()), db.attachments.clear(), db.settings.clear()]);
    });
    set({ ...EMPTY_COLLECTIONS, ready: true });
    await useSettings.getState().hydrate();
  },
}));
