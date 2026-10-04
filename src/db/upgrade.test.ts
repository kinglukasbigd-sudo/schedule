import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { checkInvariants } from '@/logic/validate';
import { v1Fixture } from '@/test/v1fixture';
import { TermDB } from './db';

/** Write a database exactly as the v1 app did (schema version 1). */
async function seedV1(name: string, data = v1Fixture()) {
  const v1 = new Dexie(name);
  v1.version(1).stores({ subjects: 'id, name', tasks: 'id, due, subjectId, doneAt', timetables: 'id', settings: 'id' });
  await v1.open();
  await v1.table('subjects').bulkAdd(data.subjects);
  await v1.table('tasks').bulkAdd(data.tasks);
  if (data.timetable) await v1.table('timetables').add(data.timetable);
  if (data.settings) await v1.table('settings').add({ id: 'main', ...data.settings });
  v1.close();
}

describe('Dexie upgrade v1 → v2 (SPEC §9.2)', () => {
  it('migrates a real v1 database in place, satisfying every invariant', async () => {
    await seedV1('upgrade-full');
    const db = new TermDB('upgrade-full');
    await db.open();
    expect(db.verno).toBe(2);
    const [subjects, timetables, tasks, holidays, attachments, settings] = await Promise.all([
      db.subjects.toArray(),
      db.timetables.toArray(),
      db.tasks.toArray(),
      db.holidays.toArray(),
      db.attachments.toArray(),
      db.settings.get('main'),
    ]);
    expect(checkInvariants({ subjects, timetables, tasks, holidays, attachments })).toEqual([]);
    expect(subjects.map((s) => s.name)).toEqual(['Art', 'Biology', 'English', 'Mathematics']);
    expect(timetables).toHaveLength(1);
    expect(timetables[0]?.id).not.toBe('main');
    expect(tasks).toHaveLength(5);
    expect(tasks.find((t) => t.id === 't1')?.due.lessonId).toBe(timetables[0]?.lessons.find((l) => l.subjectId === 'math')?.id);
    expect(settings).toMatchObject({ id: 'main', theme: 'dark', accent: 'green', language: 'de', onboarded: true, study: { maxMinutesPerDay: 90 } });
    db.close();
  });

  it('indexes tasks by due date after the upgrade', async () => {
    await seedV1('upgrade-index');
    const db = new TermDB('upgrade-index');
    expect((await db.tasks.where('due.date').equals('2026-10-05').toArray()).map((t) => t.id)).toEqual(['t1']);
    expect(await db.tasks.where('kind').equals('test').count()).toBe(1);
    db.close();
  });

  it('upgrades only once', async () => {
    await seedV1('upgrade-once');
    const first = new TermDB('upgrade-once');
    const ids = (await first.timetables.toArray()).map((t) => t.id);
    first.close();
    const again = new TermDB('upgrade-once');
    expect((await again.timetables.toArray()).map((t) => t.id)).toEqual(ids);
    again.close();
  });

  it('upgrades an empty v1 database, and one that never got past onboarding', async () => {
    await seedV1('upgrade-empty', { settings: null, subjects: [], timetable: null, tasks: [] });
    const db = new TermDB('upgrade-empty');
    expect(await db.tasks.count()).toBe(0);
    expect(await db.settings.get('main')).toBeUndefined();
    db.close();
  });

  it('creates a fresh v2 database directly', async () => {
    const db = new TermDB('fresh');
    await db.open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['attachments', 'holidays', 'settings', 'subjects', 'tasks', 'timetables']);
    db.close();
  });
});
