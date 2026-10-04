import { db } from '@/db/db';
import { uid } from '@/lib/id';
import { pickHue, sameSubjectName } from '@/logic/subjects';
import { placeTimetable } from '@/logic/timetable';
import type { Attachment, Holiday, ID, Subject, Task, Timetable } from '@/logic/types';
import type { Change } from './changes';
import { useData } from './data';

/**
 * Domain actions on the data store. Each applies its change optimistically and returns what
 * undoes it (DESIGN §5.3); pass that to `undo`. Rules live in `@/logic`; this file only decides
 * which rows change.
 */

export interface Undo {
  change: Change;
  /** Attachments removed with a task, kept in memory for the undo window (invariant 7). */
  attachments?: Attachment[];
}

/** An applied change: undo it with `undo`, await `done` when the write must have landed. */
export interface Applied extends Undo {
  done: Promise<boolean>;
}

const state = () => useData.getState();
const now = () => Date.now();

function run(change: Change): Applied {
  const { undo, done } = state().applyWithUndo(change);
  return { change: undo, done };
}

export async function undo(u: Undo): Promise<boolean> {
  const ok = await state().apply(u.change);
  if (ok && u.attachments?.length) await db.attachments.bulkPut(u.attachments);
  return ok;
}

// ── Subjects ─────────────────────────────────────────────────────────────────

const validHue = (hue: number | null | undefined) => hue == null || (Number.isInteger(hue) && hue >= 0 && hue <= 359);

/** The subject with this name (ignoring case and diacritics), created with the next free hue if new. */
export function ensureSubject(name: string, hue?: number | null): Subject {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) throw new RangeError('A subject needs a name');
  const existing = state().subjects.find((s) => sameSubjectName(s.name, trimmed));
  if (existing) return existing;
  const t = now();
  const subject: Subject = {
    id: uid(),
    name: trimmed,
    short: null,
    hue: hue !== undefined ? hue : pickHue(state().subjects.map((s) => s.hue)),
    teacher: null,
    createdAt: t,
    updatedAt: t,
  };
  run({ subjects: { put: [subject] } });
  return subject;
}

/** Edit a subject. A new name that another subject already has is refused (invariant 9). */
export function updateSubject(id: ID, patch: Partial<Pick<Subject, 'name' | 'short' | 'hue' | 'teacher'>>): Applied | null {
  const subject = state().subjects.find((s) => s.id === id);
  if (!subject) return null;
  const name = patch.name?.trim().slice(0, 40);
  if (name != null && (!name || state().subjects.some((s) => s.id !== id && sameSubjectName(s.name, name)))) return null;
  if ('hue' in patch && !validHue(patch.hue)) return null;
  return run({ subjects: { put: [{ ...subject, ...patch, ...(name != null ? { name } : {}), updatedAt: now() }] } });
}

/** Delete a subject, its lessons in every timetable, and unlink its tasks (E-20). */
export function deleteSubject(id: ID): Applied | null {
  const { subjects, timetables, tasks } = state();
  if (!subjects.some((s) => s.id === id)) return null;
  const t = now();
  return run({
    subjects: { delete: [id] },
    timetables: {
      put: timetables
        .filter((tt) => tt.lessons.some((l) => l.subjectId === id))
        .map((tt) => ({ ...tt, lessons: tt.lessons.filter((l) => l.subjectId !== id), updatedAt: t })),
    },
    tasks: { put: tasks.filter((task) => task.subjectId === id).map((task) => ({ ...task, subjectId: null, updatedAt: t })) },
  });
}

// ── Timetables and holidays ──────────────────────────────────────────────────

/** Save a timetable, trimming or replacing neighbours its dates overlap (R-2). */
export function saveTimetable(timetable: Timetable): Applied {
  const others = state().timetables.filter((t) => t.id !== timetable.id);
  const { kept, removed } = placeTimetable(others, timetable.validFrom, timetable.validTo);
  const changed = kept.filter((t) => !others.includes(t));
  return run({ timetables: { put: [...changed, { ...timetable, updatedAt: now() }], delete: removed } });
}

export function deleteTimetable(id: ID): Applied {
  return run({ timetables: { delete: [id] } });
}

export function saveHoliday(holiday: Holiday): Applied {
  const [start, end] = holiday.end < holiday.start ? [holiday.end, holiday.start] : [holiday.start, holiday.end];
  return run({ holidays: { put: [{ ...holiday, start, end, updatedAt: now() }] } });
}

export function deleteHoliday(id: ID): Applied {
  return run({ holidays: { delete: [id] } });
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export function saveTask(task: Task): Applied {
  return run({ tasks: { put: [{ ...task, updatedAt: now() }] } });
}

export function setTaskDone(id: ID, done: boolean): Applied | null {
  const task = state().tasks.find((t) => t.id === id);
  if (!task) return null;
  const t = now();
  return run({ tasks: { put: [{ ...task, doneAt: done ? t : null, updatedAt: t }] } });
}

/** Delete a task and its attachments; undo brings both back. */
export async function deleteTask(id: ID): Promise<Applied | null> {
  if (!state().tasks.some((t) => t.id === id)) return null;
  const result = run({ tasks: { delete: [id] } });
  const attachments = await db.attachments.where('taskId').equals(id).toArray();
  if (attachments.length) await db.attachments.bulkDelete(attachments.map((a) => a.id));
  return { ...result, attachments };
}
