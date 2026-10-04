import { describe, expect, it } from 'vitest';
import { appData, holiday, k, lesson, subject, t, task, timetable } from '@/test/builders';
import { DEFAULT_SETTINGS } from './constants';
import { InvalidDataError, checkInvariants, sanitizeSettings, sanitizeSubject, sanitizeTask, sanitizeTimetable } from './validate';
import type { AppData, Attachment } from './types';

const problems = (partial: Partial<AppData>) => checkInvariants(appData(partial));

describe('checkInvariants (SPEC §3.4)', () => {
  it('accepts consistent data', () => {
    expect(problems({})).toEqual([]);
  });

  it('1. rejects overlapping timetables and reversed ranges', () => {
    const a = timetable({ id: 'a', validFrom: k('2026-09-01'), validTo: k('2026-12-31') });
    const b = timetable({ id: 'b', validFrom: k('2026-12-01'), validTo: null });
    expect(problems({ timetables: [a, b] })).toContain('timetables a and b overlap');
    const open = timetable({ id: 'open', validTo: null });
    expect(problems({ timetables: [open, timetable({ id: 'later', validFrom: k('2027-01-01') })] })).toContain('timetables open and later overlap');
    expect(problems({ timetables: [timetable({ validFrom: k('2026-10-05'), validTo: k('2026-10-01') })] })).toContain('timetable tt1: ends before it starts');
  });

  it('2. rejects unordered, overlapping, empty or too many periods', () => {
    const tt = timetable();
    const swapped = [{ ...tt.periods[0], start: t('09:00'), end: t('08:00') }, ...tt.periods.slice(1)] as typeof tt.periods;
    expect(problems({ timetables: [timetable({ periods: swapped })] }).join()).toMatch(/ends before it starts/);
    const overlap = [tt.periods[0], { ...tt.periods[1], start: t('08:30') }, ...tt.periods.slice(2)] as typeof tt.periods;
    expect(problems({ timetables: [timetable({ periods: overlap })] }).join()).toMatch(/overlaps the one before/);
    expect(problems({ timetables: [timetable({ periods: [], lessons: [] })] })).toContain('timetable tt1: 0 periods');
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `x${i}`, label: null, start: t(`${String(i + 6).padStart(2, '0')}:00`), end: t(`${String(i + 6).padStart(2, '0')}:30`) }));
    expect(problems({ timetables: [timetable({ periods: many, lessons: [] })] })).toContain('timetable tt1: 15 periods');
    expect(problems({ timetables: [timetable({ days: [] })] })).toContain('timetable tt1: no school days');
  });

  it('3. rejects two lessons in one slot, spans past the end and unknown periods', () => {
    const clash = timetable({
      lessons: [lesson({ id: 'a', subjectId: 'math', day: 1, periodId: 'p1', span: 2 }), lesson({ id: 'b', subjectId: 'eng', day: 1, periodId: 'p2' })],
    });
    expect(problems({ timetables: [clash] })).toContain('lesson b: slot already taken');
    const long = timetable({ lessons: [lesson({ id: 'c', subjectId: 'math', day: 1, periodId: 'p6', span: 3 })] });
    expect(problems({ timetables: [long] })).toContain('lesson c: span 3 runs past the periods');
    const lost = timetable({ lessons: [lesson({ id: 'd', subjectId: 'math', day: 1, periodId: 'nope' })] });
    expect(problems({ timetables: [lost] })).toContain('lesson d: unknown period');
    // The same slot in different rotation weeks is fine.
    const ab = timetable({
      rotation: { weeks: 2, anchor: k('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: false },
      lessons: [lesson({ subjectId: 'math', day: 1, periodId: 'p1', week: 0 }), lesson({ subjectId: 'eng', day: 1, periodId: 'p1', week: 1 })],
    });
    expect(problems({ timetables: [ab] })).toEqual([]);
  });

  it('4. checks the rotation', () => {
    const bad = timetable({
      rotation: { weeks: 2, anchor: k('2026-10-07'), anchorIndex: 2, skipHolidayWeeks: false },
      lessons: [lesson({ id: 'w', subjectId: 'math', day: 1, periodId: 'p1', week: 3 })],
    });
    expect(problems({ timetables: [bad] })).toEqual(
      expect.arrayContaining(['timetable tt1: rotation anchor is not a Monday', 'timetable tt1: anchor index 2', 'lesson w: week 3']),
    );
    expect(problems({ timetables: [timetable({ rotation: { weeks: 5 as never, anchor: k('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: false } })] })).toContain(
      'timetable tt1: rotation of 5 weeks',
    );
  });

  it('5. checks lesson time overrides; 6. subjects exist', () => {
    const own = timetable({ lessons: [lesson({ id: 'o', subjectId: 'ghost', day: 1, periodId: 'p1', time: { start: t('09:00'), end: t('08:00') } })] });
    expect(problems({ timetables: [own] })).toEqual(['lesson o: own time ends before it starts', 'lesson o: unknown subject']);
    expect(problems({ tasks: [task({ id: 'x', due: '2026-10-05', subjectId: 'ghost' })] })).toEqual(['task x: unknown subject']);
  });

  it('7. attachments and tasks agree; 8. results and plans only where allowed', () => {
    const file = { id: 'f', taskId: 'other' } as Attachment;
    expect(problems({ tasks: [task({ id: 'x', due: '2026-10-05', attachmentIds: ['f'] })], attachments: [file] })).toEqual([
      'task x: attachment f missing',
      'attachment f: no task lists it',
    ]);
    const hw = { ...task({ id: 'h', due: '2026-10-05' }), plan: { generatedAt: 1, sessionMinutes: 25, sessions: 1 } } as never;
    const essay = { ...task({ id: 'e', kind: 'assignment', due: '2026-10-05' }), result: { grade: 'A' } } as never;
    expect(problems({ tasks: [hw, essay] })).toEqual(['task h: plan on homework', 'task e: result on a assignment']);
  });

  it('9. subject names are unique ignoring case and diacritics; holidays run forwards', () => {
    expect(problems({ subjects: [subject('a', 'Französisch'), subject('b', 'franzosisch ')], timetables: [] })).toEqual([
      'subject b: name "franzosisch " is taken',
    ]);
    expect(problems({ holidays: [{ ...holiday('x', '2026-10-05'), end: k('2026-10-01') }] })).toEqual([
      'holiday h-x-2026-10-05: ends before it starts',
    ]);
  });
});

describe('sanitizers', () => {
  it('drop unknown fields and fill optional ones', () => {
    const s = sanitizeSubject({ id: 's', name: 'Art', hue: 5, createdAt: 1, sneaky: '<script>' });
    expect(s).toEqual({ id: 's', name: 'Art', short: null, hue: 5, teacher: null, createdAt: 1, updatedAt: 1 });
    const tk = sanitizeTask({ id: 't', kind: 'test', title: '', subjectId: null, due: { date: '2026-10-05' }, createdAt: 1, updatedAt: 1, extra: 1 });
    expect(tk).toMatchObject({ kind: 'test', topics: [], plan: null, result: null, subtasks: [], notes: '' });
    expect('extra' in tk).toBe(false);
  });

  it('throw on wrong types, with where it went wrong', () => {
    expect(() => sanitizeTask({ id: 't', kind: 'chore' })).toThrow(InvalidDataError);
    expect(() => sanitizeTask({ id: 't', kind: 'homework', title: 'x', due: { date: '2026-02-30' }, createdAt: 1 })).toThrow('task.due.date');
    expect(() => sanitizeTimetable({ ...timetable(), days: [8] })).toThrow('timetable.days');
    expect(() => sanitizeTimetable({ ...timetable(), periods: [{ id: 'p', start: '8:00', end: '09:00' }] })).toThrow('period.start');
    expect(() => sanitizeSubject('Art')).toThrow('subject');
  });

  it('keep settings, falling back to defaults for anything missing', () => {
    const s = sanitizeSettings({ theme: 'dark', accent: 'red', language: 'mk', onboarded: true, study: { maxMinutesPerDay: 60, sessionMinutes: 33 } }, DEFAULT_SETTINGS);
    expect(s.study).toEqual({ ...DEFAULT_SETTINGS.study, maxMinutesPerDay: 60 });
    expect(s.reminders).toEqual(DEFAULT_SETTINGS.reminders);
    expect(() => sanitizeSettings({ theme: 'neon' }, DEFAULT_SETTINGS)).toThrow('settings.theme');
    const rules = sanitizeSettings({ ...s, reminders: [{ id: 'd', type: 'digest', enabled: true, at: '20:00' }, { id: 's', type: 'study-session', enabled: false }] }, DEFAULT_SETTINGS);
    expect(rules.reminders).toHaveLength(2);
    expect(() => sanitizeSettings({ ...s, reminders: [{ id: 'x', type: 'before-due', enabled: true, kinds: ['chore'], daysBefore: 1, at: '18:00' }] }, DEFAULT_SETTINGS)).toThrow(
      'reminder.kinds',
    );
  });
});
