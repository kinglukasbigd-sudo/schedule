import { beforeEach, describe, expect, it } from 'vitest';
import type { DraftTimetable } from '@/domain/types';
import { DEFAULT_SETTINGS } from '@/logic/constants';
import { useData } from '@/state/data';
import { useSettings } from '@/state/settings';
import { eraseEverything, exportBackup, parseBackup, restoreBackup } from './backup';
import { db } from './db';
import { addTask, applyDraft, createSubject, deleteSubject, deleteTask, restoreSubject, restoreTask, saveSettings, setTaskDone, toDraft, updateSubject, updateTask } from './repo';
import { currentTimetable, subjectView, timetableView } from './legacy';

/** The v1 screens' data API, now backed by the v2 store and schema. */

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('expected a value');
  return value;
}

const draft: DraftTimetable = {
  days: [1, 2],
  bells: [
    { start: '08:00', end: '08:45' },
    { start: '08:50', end: '09:35' },
  ],
  cells: [
    { day: 1, period: 0, subject: 'Math', room: '12' },
    { day: 1, period: 1, subject: 'English' },
    { day: 2, period: 0, subject: 'math' },
    { day: 3, period: 0, subject: 'Hidden day' },
  ],
};

const store = () => useData.getState();
const timetable = () => must(currentTimetable(store().timetables, '2026-10-05' as never));

beforeEach(async () => {
  await eraseEverything();
});

describe('applyDraft', () => {
  it('creates subjects once (case-insensitive), with distinct hues, and drops hidden cells', async () => {
    await applyDraft(draft);
    expect(store().subjects.map((s) => s.name).sort()).toEqual(['English', 'Math']);
    expect(new Set(store().subjects.map((s) => s.hue)).size).toBe(2);
    expect(await db.subjects.count()).toBe(2);
    const stored = must((await db.timetables.toArray())[0]);
    expect(stored.lessons).toHaveLength(3);
    expect(stored.lessons.find((l) => l.day === 1 && l.periodId === stored.periods[0]?.id)?.room).toBe('12');
    expect(stored.rotation.weeks).toBe(1);
  });

  it('reuses existing subjects and round-trips through toDraft', async () => {
    const math = await createSubject('Math', 'coral');
    await applyDraft(draft);
    expect(store().subjects.find((s) => s.id === math.id)?.hue).toBe(35);
    const view = timetableView(timetable(), 0);
    const back = toDraft(view, new Map(store().subjects.map((s) => [s.id, subjectView(s)])));
    expect(back.cells.filter((c) => c.subject === 'Math')).toHaveLength(2);
  });

  it('keeps lesson and period ids through an edit, so linked tasks keep their lesson (R-4)', async () => {
    await applyDraft(draft);
    const before = timetable();
    await addTask({ kind: 'homework', title: 'Ex. 1', subjectId: before.lessons[0]?.subjectId ?? null, due: '2026-10-05', period: 0 });
    await applyDraft({ ...draft, bells: [{ start: '07:50', end: '08:35' }, ...draft.bells.slice(1)] });
    const after = timetable();
    expect(after.id).toBe(before.id);
    expect(after.periods.map((p) => p.id)).toEqual(before.periods.map((p) => p.id));
    expect(after.lessons.map((l) => l.id).sort()).toEqual(before.lessons.map((l) => l.id).sort());
    expect(store().tasks[0]?.due.lessonId).toBe(before.lessons.find((l) => l.day === 1 && l.periodId === before.periods[0]?.id)?.id);
  });
});

describe('subjects', () => {
  it('renames and recolours, refusing a name another subject has', async () => {
    const art = await createSubject('Art');
    await createSubject('Music');
    await updateSubject(art.id, { name: 'Drawing', color: 'lime' });
    expect(store().subjects.find((s) => s.id === art.id)).toMatchObject({ name: 'Drawing', hue: 125 });
    await updateSubject(art.id, { name: 'music' });
    expect(store().subjects.find((s) => s.id === art.id)?.name).toBe('Drawing');
    expect(await createSubject('drawing')).toMatchObject({ id: art.id });
  });

  it('deletes lessons and unlinks tasks, and undo restores both (E-20)', async () => {
    await applyDraft(draft);
    const english = must(store().subjects.find((s) => s.name === 'English'));
    const task = await addTask({ kind: 'homework', title: 'Essay', subjectId: english.id, due: '2026-10-06', period: null });
    const snapshot = await deleteSubject(english.id);
    expect(store().subjects.find((s) => s.id === english.id)).toBeUndefined();
    expect(store().tasks.find((t) => t.id === task.id)?.subjectId).toBeNull();
    expect(timetable().lessons).toHaveLength(2);
    await restoreSubject(must(snapshot));
    expect(store().tasks.find((t) => t.id === task.id)?.subjectId).toBe(english.id);
    expect(timetable().lessons).toHaveLength(3);
    expect((await db.tasks.get(task.id))?.subjectId).toBe(english.id);
    expect(await deleteSubject('nobody')).toBeNull();
  });
});

describe('tasks', () => {
  it('adds, updates, completes, deletes and restores', async () => {
    await applyDraft(draft);
    const math = must(store().subjects.find((s) => s.name === 'Math'));
    const view = await addTask({ kind: 'test', title: ' Quiz ', subjectId: math.id, due: '2026-10-05', period: 0 });
    expect(view).toMatchObject({ title: 'Quiz', due: '2026-10-05', period: 0, kind: 'test' });
    const stored = must(store().tasks[0]);
    expect(stored.due).toMatchObject({ date: '2026-10-05', time: '08:00' });
    expect(stored.due.lessonId).toBeTruthy();

    await updateTask(view.id, { kind: 'homework', due: '2026-10-06', period: null, title: 'Quiz prep' });
    expect(store().tasks[0]).toMatchObject({ kind: 'homework', title: 'Quiz prep', due: { date: '2026-10-06', lessonId: null, time: null } });
    expect('topics' in must(store().tasks[0])).toBe(false);

    await setTaskDone(view.id, true);
    expect(store().tasks[0]?.doneAt).toEqual(expect.any(Number));
    await setTaskDone(view.id, false);
    expect(store().tasks[0]?.doneAt).toBeNull();

    const snapshot = await deleteTask(view.id);
    expect(store().tasks).toHaveLength(0);
    await restoreTask(must(snapshot));
    expect(store().tasks).toHaveLength(1);
    expect(await db.tasks.count()).toBe(1);
  });

  it('keeps a due date that has no lesson in its period as the period time', async () => {
    await applyDraft(draft);
    const view = await addTask({ kind: 'homework', title: 'x', subjectId: null, due: '2026-10-06', period: 1 });
    expect(store().tasks[0]?.due).toEqual({ date: '2026-10-06', lessonId: null, time: '08:50' });
    expect(view.period).toBe(1);
  });
});

describe('backup', () => {
  it('exports, validates and restores everything', async () => {
    await useSettings.getState().update({ accent: 'green', onboarded: true });
    await applyDraft(draft);
    await addTask({ kind: 'test', title: 'Quiz', subjectId: null, due: '2026-10-09', period: 0 });
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup())));

    await eraseEverything();
    expect(await db.tasks.count()).toBe(0);
    expect(store().tasks).toEqual([]);
    expect(useSettings.getState().settings.onboarded).toBe(false);

    await restoreBackup(backup);
    expect(await db.tasks.count()).toBe(1);
    expect(store().subjects).toHaveLength(2);
    expect((await db.settings.get('main'))?.accent).toBe('green');
    expect(useSettings.getState().settings.accent).toBe('green');
  });

  it('restores a v1 backup', async () => {
    const v1 = {
      app: 'term',
      version: 1,
      settings: { ...DEFAULT_SETTINGS, onboarded: true },
      subjects: [{ id: 's', name: 'Art', color: 'mint', createdAt: 1 }],
      tasks: [{ id: 't', kind: 'homework', title: 'Draw', subjectId: 's', due: '2026-10-05', period: 0, notes: '', doneAt: null, createdAt: 1, updatedAt: 1 }],
      timetable: { id: 'main', days: [1], bells: [{ start: '08:00', end: '08:45' }], lessons: [{ day: 1, period: 0, subjectId: 's' }], updatedAt: 1 },
    };
    await restoreBackup(parseBackup(v1));
    expect(store().subjects[0]?.hue).toBe(160);
    expect(store().tasks[0]?.due.lessonId).toBe(store().timetables[0]?.lessons[0]?.id);
  });

  it('rejects files that are not TERM backups', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow('not-a-backup');
    expect(() => parseBackup({ app: 'term', version: 99 })).toThrow('newer-version');
    expect(() => parseBackup({ app: 'term', version: 1, settings: DEFAULT_SETTINGS, subjects: [{ id: 1 }], tasks: [], timetable: null })).toThrow(
      'invalid',
    );
  });

  it('still reads settings saved directly', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, language: 'mk' });
    expect((await db.settings.get('main'))?.language).toBe('mk');
  });
});
