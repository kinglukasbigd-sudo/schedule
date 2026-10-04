import { describe, expect, it } from 'vitest';
import { v1Fixture } from '@/test/v1fixture';
import { DEFAULT_SETTINGS } from './constants';
import { migrateSettings, migrateV1toV2 } from './migrate';
import { occurrencesOn } from './schedule';
import { checkInvariants } from './validate';
import type { Test } from './types';

let n = 0;
const newId = () => `id${++n}`;

describe('migrateV1toV2 (SPEC §9.2)', () => {
  const v2 = migrateV1toV2(v1Fixture(), { newId });
  const tt = v2.timetables[0];
  if (!tt) throw new Error('no timetable');

  it('produces data that satisfies every invariant', () => {
    expect(checkInvariants({ ...v2, attachments: [] })).toEqual([]);
  });

  it('turns colour names into hues and merges duplicate names', () => {
    expect(v2.subjects.map((s) => [s.id, s.name, s.hue])).toEqual([
      ['math', 'Mathematics', 235],
      ['eng', 'English', 5],
      ['bio', 'Biology', null],
      ['art', 'Art', null],
    ]);
    expect(v2.subjects.every((s) => s.short === null && s.teacher === null && s.updatedAt === s.createdAt)).toBe(true);
  });

  it('dates the timetable from the Monday it was last updated, or the earliest due date', () => {
    // Updated Thursday 1 October; the essay was due 21 September, which is earlier.
    expect(tt.validFrom).toBe('2026-09-21');
    expect(tt.validTo).toBeNull();
    expect(tt.name).toBe('Timetable');
    expect(tt.id).not.toBe('main');
    expect(tt.rotation).toEqual({ weeks: 1, anchor: '2026-09-21', anchorIndex: 0, skipHolidayWeeks: false });
    expect(tt.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('turns bells into periods with ids, repairing broken times', () => {
    expect(tt.periods.map((p) => `${p.start}–${p.end}`)).toEqual(['08:00–08:45', '08:50–09:35', '09:40–10:25', '10:45–11:30']);
    expect(new Set(tt.periods.map((p) => p.id)).size).toBe(4);
    expect(tt.periods.every((p) => p.label === null)).toBe(true);
  });

  it('keeps one lesson per slot with existing periods and subjects, never merging doubles', () => {
    const summary = tt.lessons.map((l) => `${l.day}:${tt.periods.findIndex((p) => p.id === l.periodId)} ${l.subjectId} ${l.room}`);
    expect(summary).toEqual(['1:0 math R4', '1:1 eng null', '2:0 bio null', '4:3 art null']);
    expect(tt.lessons.every((l) => l.week === 0 && l.span === 1 && l.time === null)).toBe(true);
  });

  it('links tasks to the lesson in their old period, keeping the bell time as a snapshot', () => {
    const [t1, t2, t3, t4, t5] = v2.tasks;
    const mondayMath = tt.lessons[0];
    expect(t1?.due).toEqual({ date: '2026-10-05', lessonId: mondayMath?.id, time: '08:00' });
    expect(t2).toMatchObject({ kind: 'test', subjectId: 'eng', due: { date: '2026-10-06', lessonId: null, time: '08:50' } });
    expect((t2 as Test).topics).toEqual([]);
    expect((t2 as Test).result).toBeNull();
    expect(t3).toMatchObject({ kind: 'assignment', plan: null, doneAt: 99, due: { lessonId: null, time: null } });
    expect(t4).toMatchObject({ subjectId: null, due: { date: '2026-10-07', lessonId: null, time: '08:00' } });
    expect(t5).toMatchObject({ kind: 'homework', due: { date: '2026-10-01', time: '10:45' } });
    expect(v2.tasks.every((t) => t.subtasks.length === 0 && t.attachmentIds.length === 0 && t.reminders === null && t.estimateMin === null)).toBe(true);
    expect(t1?.notes).toBe('p. 12');
  });

  it('keeps the due moment of linked tasks', () => {
    const t1 = v2.tasks[0];
    const occ = occurrencesOn(t1?.due.date as never, { timetables: v2.timetables, holidays: [] }).find((o) => o.lesson.id === t1?.due.lessonId);
    expect(occ?.startTime).toBe('08:00');
  });

  it('keeps settings and adds the new ones with defaults', () => {
    expect(v2.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark', accent: 'green', language: 'de', onboarded: true });
    expect(v2.holidays).toEqual([]);
  });

  it('handles an empty v1 database and missing or broken settings', () => {
    expect(migrateV1toV2({ settings: null, subjects: [], timetable: null, tasks: [] })).toEqual({
      settings: DEFAULT_SETTINGS,
      subjects: [],
      timetables: [],
      holidays: [],
      tasks: [],
    });
    expect(migrateSettings({ theme: 'neon', accent: 'blue', language: 'fr', onboarded: true })).toMatchObject({
      theme: 'system',
      language: 'en',
      onboarded: true,
    });
  });

  it('falls back to Mon–Fri when a timetable has no valid days, and names unnamed subjects', () => {
    const data = v1Fixture();
    data.timetable = { ...(data.timetable as NonNullable<typeof data.timetable>), days: [0, 8] };
    data.subjects.push({ id: 'blank', name: '   ', color: 'sky', createdAt: 20 });
    const out = migrateV1toV2(data, { newId });
    expect(out.timetables[0]?.days).toEqual([1, 2, 3, 4, 5]);
    expect(out.subjects.find((s) => s.id === 'blank')?.name).toBe('Subject');
  });

  it('uses the Monday of the last update when no task is earlier', () => {
    const data = v1Fixture();
    data.tasks = data.tasks.filter((t) => t.id === 't1');
    expect(migrateV1toV2(data, { newId }).timetables[0]?.validFrom).toBe('2026-09-28');
  });
});
