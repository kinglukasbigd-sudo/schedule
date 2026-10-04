import type { Holiday, ID, Subject, Task, Timetable } from '@/logic/types';

/**
 * Every write to the data store is a change set: rows to put and ids to delete, per table.
 * Pure helpers here apply a change to in-memory collections and compute its inverse (undo).
 */

export const TABLES = ['subjects', 'timetables', 'holidays', 'tasks'] as const;
export type TableName = (typeof TABLES)[number];

export interface Rows {
  subjects: Subject;
  timetables: Timetable;
  holidays: Holiday;
  tasks: Task;
}

export type Collections = { [T in TableName]: Rows[T][] };
export type Change = { [T in TableName]?: { put?: Rows[T][]; delete?: ID[] } };

export const EMPTY_COLLECTIONS: Collections = { subjects: [], timetables: [], holidays: [], tasks: [] };

export function tablesOf(change: Change): TableName[] {
  return TABLES.filter((t) => (change[t]?.put?.length ?? 0) + (change[t]?.delete?.length ?? 0) > 0);
}

function applyTo<T extends { id: ID }>(rows: T[], put: readonly T[] = [], del: readonly ID[] = []): T[] {
  if (put.length === 0 && del.length === 0) return rows;
  const gone = new Set(del);
  const incoming = new Map(put.map((r) => [r.id, r]));
  const out = rows.filter((r) => !gone.has(r.id)).map((r) => incoming.get(r.id) ?? r);
  const present = new Set(out.map((r) => r.id));
  for (const r of put) if (!present.has(r.id) && !gone.has(r.id)) out.push(r);
  return out;
}

/** New collections with the change applied; untouched tables keep their identity. */
export function applyChange(state: Collections, change: Change): Collections {
  const next = { ...state };
  for (const t of tablesOf(change)) {
    (next as Record<TableName, unknown[]>)[t] = applyTo(state[t] as { id: ID }[], change[t]?.put as { id: ID }[], change[t]?.delete);
  }
  return next;
}

/** The change that undoes `change` when applied to the result of applying it to `state`. */
export function invertChange(state: Collections, change: Change): Change {
  const inverse: Change = {};
  for (const t of tablesOf(change)) {
    const before = new Map((state[t] as { id: ID }[]).map((r) => [r.id, r]));
    const put: { id: ID }[] = [];
    const del: ID[] = [];
    const touched = new Set<ID>();
    for (const row of (change[t]?.put ?? []) as { id: ID }[]) {
      touched.add(row.id);
      const prev = before.get(row.id);
      if (prev) put.push(prev);
      else del.push(row.id);
    }
    for (const id of change[t]?.delete ?? []) {
      const prev = before.get(id);
      if (prev && !touched.has(id)) put.push(prev);
    }
    (inverse as Record<TableName, unknown>)[t] = { put, delete: del };
  }
  return inverse;
}
