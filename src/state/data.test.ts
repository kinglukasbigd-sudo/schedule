import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { demoData } from '@/logic/demo';
import { k, subject, task, timetable } from '@/test/builders';
import * as actions from './actions';
import { planStudy } from './plan';
import { onDataError, useData } from './data';
import { useSettings } from './settings';

const store = () => useData.getState();

beforeEach(async () => {
  await store().eraseAll();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('data store', () => {
  it('loads what the database holds', async () => {
    await db.subjects.put(subject('s', 'Art'));
    useData.setState({ ready: false, subjects: [] });
    await store().load();
    expect(store().ready).toBe(true);
    expect(store().subjects.map((s) => s.name)).toEqual(['Art']);
  });

  it('updates state in the same tick, before the write finishes (optimistic)', async () => {
    const done = store().apply({ subjects: { put: [subject('s', 'Art')] } });
    expect(store().subjects).toHaveLength(1);
    expect(await done).toBe(true);
    expect(await db.subjects.count()).toBe(1);
    expect(await store().apply({})).toBe(true);
  });

  it('reverts to what is stored and reports when a write fails (E-19)', async () => {
    await store().apply({ subjects: { put: [subject('s', 'Art')] } });
    const errors: unknown[] = [];
    const stop = onDataError((e) => errors.push(e));
    vi.spyOn(db.subjects, 'bulkPut').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    const ok = await store().apply({ subjects: { put: [subject('t', 'Biology')] } });
    expect(ok).toBe(false);
    expect(store().subjects.map((s) => s.name)).toEqual(['Art']);
    expect(errors).toHaveLength(1);
    stop();
  });

  it('writes a change to several tables atomically', async () => {
    vi.spyOn(db.tasks, 'bulkPut').mockRejectedValueOnce(new Error('disk'));
    const stop = onDataError(() => undefined);
    await store().apply({ subjects: { put: [subject('s', 'Art')] }, tasks: { put: [task({ due: '2026-10-05' })] } });
    expect(await db.subjects.count()).toBe(0);
    expect(store().subjects).toEqual([]);
    stop();
  });

  it('replaces everything at once, settings included, and erases back to a first run', async () => {
    await store().replaceAll(demoData(new Date(2026, 9, 8, 9, 50)));
    expect(store().subjects.length).toBeGreaterThan(5);
    expect(await db.timetables.count()).toBe(1);
    expect(useSettings.getState().settings.onboarded).toBe(true);
    await store().eraseAll();
    expect(store().tasks).toEqual([]);
    expect(await db.settings.count()).toBe(0);
    expect(useSettings.getState().settings.onboarded).toBe(false);
  });
});

describe('data store, adversarially', () => {
  it('still starts when the database can’t be opened (private mode, storage blocked)', async () => {
    const errors: unknown[] = [];
    const stop = onDataError((e) => errors.push(e));
    vi.spyOn(db.subjects, 'toArray').mockRejectedValueOnce(new DOMException('blocked', 'InvalidStateError'));
    useData.setState({ ready: false });
    await expect(store().load()).resolves.toBeUndefined();
    expect(store().ready).toBe(true);
    expect(store().subjects).toEqual([]);
    expect(errors).toHaveLength(1);
    stop();
  });

  it('settles after many writes without piling up results', async () => {
    for (let i = 0; i < 200; i++) void store().apply({ subjects: { put: [subject(`s${i}`, `S ${i}`)] } });
    await expect(store().settled()).resolves.toBeUndefined();
    expect(await db.subjects.count()).toBe(200);
  });
});

describe('actions', () => {
  it('ensureSubject reuses names and assigns the next free preset', () => {
    const art = actions.ensureSubject('Art');
    expect(art.hue).toBe(5);
    expect(actions.ensureSubject(' art ')).toBe(art);
    expect(actions.ensureSubject('Biology').hue).toBe(35);
    expect(actions.ensureSubject('Neutral', null).hue).toBeNull();
    expect(() => actions.ensureSubject('   ')).toThrow(RangeError);
  });

  it('updateSubject refuses empty and duplicate names, and unknown ids', () => {
    const art = actions.ensureSubject('Art');
    actions.ensureSubject('Music');
    expect(actions.updateSubject(art.id, { name: ' ' })).toBeNull();
    expect(actions.updateSubject(art.id, { name: 'MUSIC' })).toBeNull();
    expect(actions.updateSubject('nobody', { hue: 3 })).toBeNull();
    expect(actions.updateSubject(art.id, { hue: 360 })).toBeNull();
    expect(actions.updateSubject(art.id, { hue: 12.5 })).toBeNull();
    expect(actions.updateSubject(art.id, { teacher: 'Ms. K', name: 'Fine art ' })).not.toBeNull();
    expect(store().subjects.find((s) => s.id === art.id)).toMatchObject({ name: 'Fine art', teacher: 'Ms. K' });
  });

  it('saveTimetable trims an overlapping neighbour, and undo puts it back (R-2)', async () => {
    const autumn = timetable({ id: 'autumn', validFrom: k('2026-09-01') });
    actions.saveTimetable(autumn);
    const spring = timetable({ id: 'spring', validFrom: k('2027-02-01') });
    const u = actions.saveTimetable(spring);
    expect(store().timetables.find((t) => t.id === 'autumn')?.validTo).toBe('2027-01-31');
    await actions.undo(u);
    expect(store().timetables.map((t) => [t.id, t.validTo])).toEqual([['autumn', null]]);
    actions.deleteTimetable('autumn');
    expect(store().timetables).toEqual([]);
  });

  it('saves holidays with their dates in order, and deletes them', () => {
    actions.saveHoliday({ id: 'h', name: 'Break', start: k('2026-10-30'), end: k('2026-10-26'), createdAt: 1, updatedAt: 1 });
    expect(store().holidays[0]).toMatchObject({ start: '2026-10-26', end: '2026-10-30' });
    actions.deleteHoliday('h');
    expect(store().holidays).toEqual([]);
  });

  it('completes and deletes tasks with undo; unknown ids do nothing', async () => {
    const t = task({ id: 'x', due: '2026-10-05' });
    actions.saveTask(t);
    const done = actions.setTaskDone('x', true);
    expect(store().tasks[0]?.doneAt).not.toBeNull();
    await actions.undo(done as actions.Undo);
    expect(store().tasks[0]?.doneAt).toBeNull();
    expect(actions.setTaskDone('nope', true)).toBeNull();
    expect(await actions.deleteTask('nope')).toBeNull();
    const removed = await actions.deleteTask('x');
    expect(store().tasks).toEqual([]);
    await actions.undo(removed as actions.Undo);
    expect(store().tasks).toHaveLength(1);
  });

  it('plans and re-plans studying for a test, never for homework', () => {
    const now = new Date(2026, 9, 5, 15, 0);
    const slots = { now, study: { maxMinutesPerDay: 90, sessionMinutes: 25 as const, weekends: true } };
    actions.saveTask(task({ id: 'hw', due: '2026-10-07' }));
    expect(planStudy('hw', slots)).toBeNull();
    expect(planStudy('ghost', slots)).toBeNull();
    actions.saveTask(task({ id: 'test', kind: 'test', due: '2026-10-23', topics: ['Mitosis'] } as never));
    planStudy('test', slots);
    const planned = store().tasks.find((t) => t.id === 'test');
    expect(planned?.subtasks).toHaveLength(5);
    expect((planned as { plan: unknown }).plan).toMatchObject({ sessions: 5 });
    planStudy('test', { ...slots, now: new Date(2026, 9, 14, 16, 0) });
    const again = store().tasks.find((t) => t.id === 'test');
    expect(again?.subtasks.every((s) => (s.plannedFor as string) >= '2026-10-14')).toBe(true);
  });
});
