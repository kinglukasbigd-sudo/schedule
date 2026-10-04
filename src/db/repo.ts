import type { DraftTimetable, Subject as SubjectView, SubjectColor, Task as TaskView, Timetable as TimetableView } from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/logic/constants';
import type { Schedule, Settings } from '@/logic/types';
import * as actions from '@/state/actions';
import { useData } from '@/state/data';
import { db } from './db';
import {
  currentTimetable,
  hueOfColor,
  newSubjectsFor,
  subjectView,
  taskFromInput,
  taskView,
  timetableFromDraft,
  todayKey,
  updatedTask,
  viewWeek,
  type TaskInput,
} from './legacy';

/**
 * The data API the v1 screens use, in their own shapes, on top of the v2 data store (D-045).
 * New screens use `@/state/actions` and `@/logic` directly.
 */

export type { TaskInput };
/** What undoes a deletion; opaque to the screens. */
export type SubjectSnapshot = actions.Undo;
export type TaskSnapshot = actions.Undo;

const data = () => useData.getState();
const schedule = (): Schedule => ({ timetables: data().timetables, holidays: data().holidays });

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

export async function createSubject(name: string, color?: SubjectColor): Promise<SubjectView> {
  return subjectView(actions.ensureSubject(name, color !== undefined ? hueOfColor(color) : undefined));
}

export async function updateSubject(id: string, patch: Partial<Pick<SubjectView, 'name' | 'color'>>): Promise<void> {
  actions.updateSubject(id, {
    ...(patch.name != null ? { name: patch.name } : {}),
    ...(patch.color != null ? { hue: hueOfColor(patch.color) } : {}),
  });
}

/** Delete a subject, clearing its lessons and unlinking its tasks. Returns what is needed to undo. */
export async function deleteSubject(id: string): Promise<SubjectSnapshot | null> {
  return actions.deleteSubject(id);
}

export async function restoreSubject(snapshot: SubjectSnapshot): Promise<void> {
  await actions.undo(snapshot);
}

// ── Timetable ───────────────────────────────────────────────────────────────

/** Turn an imported or edited draft into subjects + the current timetable, reusing what exists. */
export async function applyDraft(draft: DraftTimetable): Promise<void> {
  const now = Date.now();
  const today = todayKey();
  const { timetables, holidays } = data();
  const cells = draft.cells.filter((c) => draft.days.includes(c.day) && c.period < draft.bells.length && c.subject.trim());
  const created = newSubjectsFor(
    cells.map((c) => c.subject),
    data().subjects,
    now,
  );
  const existing = currentTimetable(timetables, today);
  const timetable = timetableFromDraft({ ...draft, cells }, existing, {
    subjects: [...data().subjects, ...created],
    others: timetables.filter((t) => t.id !== existing?.id),
    week: existing ? viewWeek(existing, holidays, today) : 0,
    today,
    now,
  });
  await data().apply({ subjects: { put: created }, timetables: { put: [timetable] } });
}

/** The saved timetable as an editable draft (subjects by name). */
export function toDraft(tt: TimetableView, subjects: Map<string, SubjectView>): DraftTimetable {
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

export async function addTask(input: TaskInput): Promise<TaskView> {
  const task = taskFromInput(input, schedule(), Date.now());
  actions.saveTask(task);
  return taskView(task, data().timetables);
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  const task = data().tasks.find((t) => t.id === id);
  if (task) actions.saveTask(updatedTask(task, patch, schedule(), Date.now()));
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  actions.setTaskDone(id, done);
}

export async function deleteTask(id: string): Promise<TaskSnapshot | null> {
  return actions.deleteTask(id);
}

export async function restoreTask(snapshot: TaskSnapshot): Promise<void> {
  await actions.undo(snapshot);
}
