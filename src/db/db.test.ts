import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type DraftTimetable } from '@/domain/types';
import { eraseEverything, exportBackup, parseBackup, restoreBackup } from './backup';
import { db } from './db';
import { addTask, applyDraft, createSubject, deleteSubject, restoreSubject, saveSettings, toDraft } from './repo';

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

beforeEach(async () => {
  await eraseEverything();
});

describe('applyDraft', () => {
  it('creates subjects once (case-insensitive), with distinct colours, and drops hidden cells', async () => {
    await applyDraft(draft);
    const subjects = await db.subjects.toArray();
    expect(subjects.map((s) => s.name).sort()).toEqual(['English', 'Math']);
    expect(new Set(subjects.map((s) => s.color)).size).toBe(2);
    const tt = await db.timetables.get('main');
    expect(tt?.lessons).toHaveLength(3);
    expect(tt?.lessons.find((l) => l.day === 1 && l.period === 0)?.room).toBe('12');
  });

  it('reuses existing subjects and round-trips through toDraft', async () => {
    const math = await createSubject('Math', 'coral');
    await applyDraft(draft);
    expect((await db.subjects.get(math.id))?.color).toBe('coral');
    const tt = await db.timetables.get('main');
    const subjects = new Map((await db.subjects.toArray()).map((s) => [s.id, s]));
    const back = toDraft(must(tt), subjects);
    expect(back.cells.filter((c) => c.subject === 'Math')).toHaveLength(2);
  });
});

describe('deleteSubject', () => {
  it('removes lessons, unlinks tasks, and can be undone', async () => {
    await applyDraft(draft);
    const english = must((await db.subjects.toArray()).find((s) => s.name === 'English'));
    const task = await addTask({ kind: 'homework', title: 'Essay', subjectId: english.id, due: '2026-10-06', period: null });
    const snapshot = await deleteSubject(english.id);
    expect(await db.subjects.get(english.id)).toBeUndefined();
    expect((await db.tasks.get(task.id))?.subjectId).toBeNull();
    expect((await db.timetables.get('main'))?.lessons).toHaveLength(2);

    await restoreSubject(must(snapshot));
    expect((await db.tasks.get(task.id))?.subjectId).toBe(english.id);
    expect((await db.timetables.get('main'))?.lessons).toHaveLength(3);
  });
});

describe('backup', () => {
  it('exports, validates and restores everything', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, accent: 'green', onboarded: true });
    await applyDraft(draft);
    await addTask({ kind: 'test', title: 'Quiz', subjectId: null, due: '2026-10-09', period: 0 });
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportBackup())));

    await eraseEverything();
    expect(await db.tasks.count()).toBe(0);

    await restoreBackup(backup);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.subjects.count()).toBe(2);
    expect((await db.settings.get('main'))?.accent).toBe('green');
  });

  it('rejects files that are not TERM backups', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow('not-a-backup');
    expect(() => parseBackup({ app: 'term', version: 99 })).toThrow('newer-version');
    expect(() =>
      parseBackup({ app: 'term', version: 1, settings: DEFAULT_SETTINGS, subjects: [{ id: 1 }], tasks: [], timetable: null }),
    ).toThrow('invalid');
  });
});
