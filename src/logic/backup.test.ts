import { describe, expect, it } from 'vitest';
import { appData, holiday, k, task } from '@/test/builders';
import { v1Fixture } from '@/test/v1fixture';
import { BACKUP_VERSION, BackupError, createBackup, parseBackup, summarize, type BackupData } from './backup';

const now = new Date('2026-10-05T10:00:00Z');
const data = (): BackupData => ({
  ...appData({ holidays: [holiday('Autumn break', '2026-10-26', '2026-10-30')] }),
  tasks: [task({ id: 'x', due: '2026-10-07', attachmentIds: ['f1'] })],
  attachments: [{ id: 'f1', taskId: 'x', name: 'sheet.jpg', mime: 'image/jpeg', kind: 'image', size: 3, createdAt: 1, updatedAt: 1, data: 'AAEC', thumb: null }],
});

const roundTrip = (b: unknown) => parseBackup(JSON.parse(JSON.stringify(b)));

describe('backups (F-12)', () => {
  it('round-trips everything losslessly, attachments included', () => {
    const original = data();
    const backup = createBackup(original, now);
    expect(backup).toMatchObject({ app: 'term', version: BACKUP_VERSION, exportedAt: '2026-10-05T10:00:00.000Z' });
    const { data: back, version } = roundTrip(backup);
    expect(version).toBe(2);
    expect(back).toEqual(original);
  });

  it('summarises what a backup holds', () => {
    expect(summarize(data())).toEqual({ timetables: 1, subjects: 6, tasks: 1, holidays: 1, files: 1 });
  });

  it('reads v1 backups through the database migration', () => {
    const v1 = { app: 'term', version: 1, exportedAt: 'x', ...v1Fixture() };
    const { data: back, version } = roundTrip(v1);
    expect(version).toBe(1);
    expect(back.timetables).toHaveLength(1);
    expect(back.subjects.map((s) => s.name)).toEqual(['Mathematics', 'English', 'Biology', 'Art']);
    expect(back.tasks.find((t) => t.id === 't2')?.subjectId).toBe('eng');
    expect(back.settings.language).toBe('de');
    expect(back.attachments).toEqual([]);
  });

  it('reads a v1 backup without a timetable and with sloppy fields', () => {
    const v1 = {
      app: 'term',
      version: 1,
      settings: { theme: 'light', accent: 'blue', language: 'en', onboarded: false },
      subjects: [{ id: 's', name: 'Art', createdAt: 1 }],
      tasks: [{ id: 't', title: 'Draw', due: '2026-10-05', kind: 'homework' }],
      timetable: null,
    };
    const { data: back } = roundTrip(v1);
    expect(back.subjects[0]?.hue).toBeNull();
    expect(back.tasks[0]).toMatchObject({ notes: '', doneAt: null, subjectId: null });
  });

  it('rejects files that are not TERM backups', () => {
    for (const bad of [null, 'x', [], { app: 'other' }]) expect(() => parseBackup(bad)).toThrow(BackupError);
    expect(() => parseBackup({ app: 'term' })).toThrow('invalid');
    expect(() => parseBackup({ app: 'term', version: 1.5 })).toThrow('invalid');
  });

  it('rejects backups from a newer TERM (E-32)', () => {
    try {
      parseBackup({ ...createBackup(data(), now), version: 3 });
      expect.unreachable();
    } catch (err) {
      expect((err as BackupError).code).toBe('newer-version');
    }
  });

  it('drops unknown fields instead of keeping them', () => {
    const b = createBackup(data(), now) as unknown as Record<string, unknown>;
    const withExtras = {
      ...b,
      futureTable: [1, 2],
      subjects: (b.subjects as object[]).map((s) => ({ ...s, glitter: true })),
    };
    const { data: back } = roundTrip(withExtras);
    expect('futureTable' in back).toBe(false);
    expect(back.subjects.every((s) => !('glitter' in s))).toBe(true);
  });

  it('rejects broken entities and broken invariants, saying why', () => {
    const b = createBackup(data(), now);
    const expectInvalid = (value: unknown, detail: RegExp) => {
      try {
        roundTrip(value);
        expect.unreachable();
      } catch (err) {
        expect((err as BackupError).code).toBe('invalid');
        expect((err as BackupError).details.join()).toMatch(detail);
      }
    };
    expectInvalid({ ...b, tasks: [{ ...b.tasks[0], due: { date: 'soon' } }] }, /task.due.date/);
    expectInvalid({ ...b, attachments: [{ ...b.attachments[0], data: 'not base64!' }] }, /attachment.data/);
    expectInvalid({ ...b, attachments: [{ ...b.attachments[0], kind: 'video' }] }, /attachment.kind/);
    expectInvalid({ ...b, attachments: [] }, /attachment f1 missing/);
    expectInvalid({ ...b, timetables: [b.timetables[0], { ...b.timetables[0], id: 'tt2' }] }, /overlap/);
    expectInvalid({ ...b, subjects: 'all of them' }, /subjects/);
    expectInvalid({ app: 'term', version: 1, subjects: [], tasks: [], timetable: 'x', settings: {} }, /timetable/);
    expectInvalid({ app: 'term', version: 1, subjects: [{ id: 1 }], tasks: [], settings: {} }, /subject/);
    expectInvalid({ app: 'term', version: 1, subjects: [], tasks: [{}], settings: {} }, /task/);
    expectInvalid({ app: 'term', version: 1, subjects: [], tasks: [], timetable: null }, /settings/);
    expectInvalid({ app: 'term', version: 1, subjects: [], tasks: 'none', settings: {} }, /tasks/);
  });

  it('keeps optional v2 collections optional', () => {
    const b = createBackup(data(), now) as unknown as Record<string, unknown>;
    const { holidays: _h, ...noHolidays } = b;
    const { data: back } = roundTrip({ ...noHolidays, tasks: [task({ id: 'y', due: k('2026-10-05') })], attachments: undefined });
    expect(back.holidays).toEqual([]);
    expect(back.attachments).toEqual([]);
  });
});

describe('backups of everything the model can hold', () => {
  it('round-trips plans, results, planned steps, reminder overrides and holidays', async () => {
    const { demoData } = await import('./demo');
    const demo = demoData(new Date(2026, 9, 8, 9, 50));
    const withReminders = demo.tasks.map((t, i) => (i === 0 ? { ...t, reminders: [{ daysBefore: 1, at: '18:00' as never }], estimateMin: 20 } : t));
    const full: BackupData = { ...demo, tasks: withReminders, attachments: [] };
    const { data: back } = roundTrip(createBackup(full, now));
    expect(back).toEqual(full);
    expect(back.tasks.some((t) => t.kind === 'test' && t.result != null)).toBe(true);
    expect(back.tasks.some((t) => t.subtasks.some((s) => s.origin === 'plan'))).toBe(true);
  });
});
