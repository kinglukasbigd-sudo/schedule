import { fold } from '@/lib/text';
import { assignColors, pickColor } from '@/domain/subjects';
import { uid } from '@/lib/id';
import {
  DEFAULT_SETTINGS,
  type DraftTimetable,
  type Lesson,
  type Settings,
  type Subject,
  type SubjectColor,
  type Task,
  type TaskKind,
  type Timetable,
} from '@/domain/types';
import { db } from './db';

// ── Settings ────────────────────────────────────────────────────────────────

/** Stored settings, or null on first run. */
export async function loadSettings(): Promise<Settings | null> {
  const row = await db.settings.get('main');
  if (!row) return null;
  const { id: _id, ...settings } = row;
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put({ id: 'main', ...settings });
}

// ── Subjects ────────────────────────────────────────────────────────────────

export async function createSubject(name: string, color?: SubjectColor): Promise<Subject> {
  const trimmed = name.trim();
  const all = await db.subjects.toArray();
  const existing = all.find((s) => fold(s.name) === fold(trimmed));
  if (existing) return existing;
  const subject: Subject = { id: uid(), name: trimmed, color: color ?? pickColor(all), createdAt: Date.now() };
  await db.subjects.add(subject);
  return subject;
}

export async function updateSubject(id: string, patch: Partial<Pick<Subject, 'name' | 'color'>>): Promise<void> {
  await db.subjects.update(id, patch);
}

export interface SubjectSnapshot {
  subject: Subject;
  lessons: Lesson[];
  taskIds: string[];
}

/** Delete a subject, clearing its lessons and unlinking its tasks. Returns what is needed to undo. */
export async function deleteSubject(id: string): Promise<SubjectSnapshot | null> {
  return db.transaction('rw', db.subjects, db.timetables, db.tasks, async () => {
    const subject = await db.subjects.get(id);
    if (!subject) return null;
    const tt = await db.timetables.get('main');
    const lessons = tt?.lessons.filter((l) => l.subjectId === id) ?? [];
    if (tt) await db.timetables.put({ ...tt, lessons: tt.lessons.filter((l) => l.subjectId !== id), updatedAt: Date.now() });
    const tasks = await db.tasks.where('subjectId').equals(id).toArray();
    await db.tasks.bulkPut(tasks.map((t) => ({ ...t, subjectId: null, updatedAt: Date.now() })));
    await db.subjects.delete(id);
    return { subject, lessons, taskIds: tasks.map((t) => t.id) };
  });
}

export async function restoreSubject(snapshot: SubjectSnapshot): Promise<void> {
  await db.transaction('rw', db.subjects, db.timetables, db.tasks, async () => {
    await db.subjects.put(snapshot.subject);
    const tt = await db.timetables.get('main');
    if (tt) {
      const taken = new Set(tt.lessons.map((l) => `${l.day}:${l.period}`));
      const back = snapshot.lessons.filter((l) => !taken.has(`${l.day}:${l.period}`));
      await db.timetables.put({ ...tt, lessons: [...tt.lessons, ...back], updatedAt: Date.now() });
    }
    const tasks = await db.tasks.bulkGet(snapshot.taskIds);
    await db.tasks.bulkPut(
      tasks.filter((t): t is Task => !!t).map((t) => ({ ...t, subjectId: snapshot.subject.id })),
    );
  });
}

// ── Timetable ───────────────────────────────────────────────────────────────

export async function saveTimetable(tt: Omit<Timetable, 'id' | 'updatedAt'>): Promise<void> {
  await db.timetables.put({ ...tt, id: 'main', updatedAt: Date.now() });
}

/** Turn an imported draft into real subjects + timetable, reusing subjects that already exist. */
export async function applyDraft(draft: DraftTimetable): Promise<void> {
  await db.transaction('rw', db.subjects, db.timetables, async () => {
    const all = await db.subjects.toArray();
    const byName = new Map(all.map((s) => [fold(s.name), s]));
    const colors = assignColors(
      draft.cells.map((c) => c.subject),
      all,
    );
    const lessons: Lesson[] = [];
    // Cells on hidden days or removed periods are dropped rather than kept invisibly.
    const cells = draft.cells.filter((c) => draft.days.includes(c.day) && c.period < draft.bells.length && c.subject.trim());
    for (const cell of cells) {
      const key = fold(cell.subject);
      let subject = byName.get(key);
      if (!subject) {
        subject = { id: uid(), name: cell.subject.trim(), color: colors.get(key) ?? pickColor(all), createdAt: Date.now() };
        byName.set(key, subject);
        await db.subjects.add(subject);
      }
      lessons.push({ day: cell.day, period: cell.period, subjectId: subject.id, ...(cell.room ? { room: cell.room } : {}) });
    }
    await db.timetables.put({ id: 'main', days: draft.days, bells: draft.bells, lessons, updatedAt: Date.now() });
  });
}

/** The saved timetable as an editable draft (subjects by name). */
export function toDraft(tt: Timetable, subjects: Map<string, Subject>): DraftTimetable {
  return {
    days: [...tt.days],
    bells: tt.bells.map((b) => ({ ...b })),
    cells: tt.lessons.flatMap((l) => {
      const s = subjects.get(l.subjectId);
      return s ? [{ day: l.day, period: l.period, subject: s.name, ...(l.room ? { room: l.room } : {}) }] : [];
    }),
  };
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskInput {
  kind: TaskKind;
  title: string;
  subjectId: string | null;
  due: string;
  period: number | null;
  notes?: string;
}

export async function addTask(input: TaskInput): Promise<Task> {
  const now = Date.now();
  const task: Task = { id: uid(), notes: '', ...input, title: input.title.trim(), doneAt: null, createdAt: now, updatedAt: now };
  await db.tasks.add(task);
  return task;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  await db.tasks.update(id, { ...patch, ...(patch.title != null ? { title: patch.title.trim() } : {}), updatedAt: Date.now() });
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  await db.tasks.update(id, { doneAt: done ? Date.now() : null, updatedAt: Date.now() });
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  const task = await db.tasks.get(id);
  await db.tasks.delete(id);
  return task;
}

export async function restoreTask(task: Task): Promise<void> {
  await db.tasks.put(task);
}

