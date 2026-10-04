import { describe, expect, it } from 'vitest';
import { SUBJECTS, appData, at, k, schedule, subject, task } from '@/test/builders';
import { importIcs } from './ics';
import { parseQuickAdd, resolveQuickAddDue } from './quickAdd';
import { replan } from './studyPlan';
import type { Test } from './types';
import { checkInvariants } from './validate';

/** Self-review: inputs chosen to break each function. Every case here failed once. */

const monday = at('2026-10-05 15:00');
const parse = (text: string, locale: 'en' | 'de' | 'mk' = 'en') => parseQuickAdd(text, SUBJECTS, monday, locale);

describe('quick add, adversarially', () => {
  it('does not read the verbs "may" and "march" as months', () => {
    expect(parse('question 5 may be hard').when).toBeNull();
    expect(parse('we march 3 laps').when).toBeNull();
    expect(parse('essay due 5 May').when?.date).toBe('2027-05-05');
    expect(parse('essay due the 5th of may').when?.date).toBe('2027-05-05');
    expect(parse('test March 3').when?.date).toBe('2027-03-03');
  });

  it('takes an abbreviation’s dot with it', () => {
    expect(parse('Mathe Test am Fr.', 'de').title).toBe('Mathe Test');
    expect(parse('Essay 12. Nov.').title).toBe('Essay');
    expect(parse('Essay 12 Nov. Bring paper').title).toBe('Essay Bring paper');
  });

  it('reads "friday next week" as that Friday, in any order and language', () => {
    expect(parse('test friday next week').when).toEqual({ date: '2026-10-16', source: 'weekday' });
    expect(parse('test next week friday').when).toEqual({ date: '2026-10-16', source: 'weekday' });
    expect(parse('Test am Freitag nächste Woche', 'de').when?.date).toBe('2026-10-16');
    expect(parse('тест во петок следната недела', 'mk').when?.date).toBe('2026-10-16');
    expect(parse('test friday next week').title).toBe('test');
    // Weeks start on Monday: from a Sunday, next week starts tomorrow.
    expect(parseQuickAdd('test friday next week', SUBJECTS, at('2026-10-04 12:00'), 'en').when?.date).toBe('2026-10-09');
  });

  it('never attaches to a lesson that has already started today', () => {
    // Monday: Math in periods 1 (08:00) and 6 (12:25). At 15:00 both have passed.
    expect(resolveQuickAddDue(parse('math homework today'), monday, schedule()).due).toEqual({
      date: '2026-10-05',
      lessonId: null,
      time: null,
    });
    // At 10:00 period 6 is still ahead.
    const morning = at('2026-10-05 10:00');
    expect(resolveQuickAddDue(parseQuickAdd('math homework today', SUBJECTS, morning, 'en'), morning, schedule()).due).toMatchObject({
      date: '2026-10-05',
      time: '12:25',
    });
  });
});

describe('re-plan, adversarially', () => {
  it('adds nothing once every planned session is done', () => {
    const done = [1, 2, 3].map((i) => ({ id: `s${i}`, title: `Study ${i}/3`, done: true, plannedFor: k(`2026-10-0${i + 1}`), minutes: 25, origin: 'plan' as const }));
    const test = task({ kind: 'test', due: '2026-10-23', subtasks: done, plan: { generatedAt: 1, sessionMinutes: 25, sessions: 3 } } as never) as Test;
    const again = replan(test, { now: monday, study: { maxMinutesPerDay: 90, sessionMinutes: 25, weekends: true } }, []);
    expect(again.subtasks).toEqual(done);
  });
});

describe('invariants, adversarially', () => {
  it('reject duplicate ids, which IndexedDB would silently collapse', () => {
    const t = task({ id: 'same', due: '2026-10-05' });
    expect(checkInvariants(appData({ tasks: [t, { ...t, title: 'Other' }] }))).toContain('tasks: id same is used twice');
    expect(checkInvariants(appData({ subjects: [...SUBJECTS, { ...subject('math', 'Maths 2') }] }))).toContain('subjects: id math is used twice');
  });

  it('reject subject names that are blank and hues off the wheel', () => {
    expect(checkInvariants(appData({ subjects: [...SUBJECTS, subject('x', '  ')] }))).toContain('subject x: blank name');
    expect(checkInvariants(appData({ subjects: [...SUBJECTS, subject('y', 'Odd', 400)] }))).toContain('subject y: hue 400');
  });
});

describe('ics import, adversarially', () => {
  it('reads DURATION when there is no DTEND', () => {
    const ics = ['BEGIN:VEVENT', 'DTSTART:20260907T080000', 'DURATION:PT1H30M', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Lab', 'END:VEVENT'].join('\r\n');
    expect(importIcs(ics).draft?.periods).toEqual([{ start: '08:00', end: '09:30' }]);
    const allDay = ['BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261026', 'DURATION:P5D', 'SUMMARY:Break', 'END:VEVENT'].join('\r\n');
    expect(importIcs(allDay).holidays[0]).toMatchObject({ start: '2026-10-26', end: '2026-10-30' });
  });
});

describe('migration, adversarially', () => {
  it('survives corrupt v1 rows instead of aborting the upgrade', async () => {
    const { migrateV1toV2 } = await import('./migrate');
    const { checkInvariants: check } = await import('./validate');
    const corrupt = {
      settings: { theme: 7, accent: null, language: 'en', onboarded: 'yes' },
      subjects: [{ id: 's', name: 42, color: null, createdAt: undefined }, { id: 't', name: null, color: 'sky', createdAt: 2 }],
      timetable: { id: 'main', days: [1], bells: [{ start: 8, end: null }], lessons: [{ day: 1, period: 0, subjectId: 's', room: 5 }], updatedAt: 'later' },
      tasks: [{ id: 'x', kind: 'homework', title: null, subjectId: 's', due: null, period: 0, notes: undefined, doneAt: 'no', createdAt: null, updatedAt: null }],
    } as never;
    const out = migrateV1toV2(corrupt);
    expect(check({ ...out, attachments: [] })).toEqual([]);
    expect(out.subjects.map((x) => x.name)).toEqual(['42', 'Subject']);
    expect(out.tasks[0]).toMatchObject({ title: '', notes: '', doneAt: null });
    expect(out.tasks[0]?.due.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out.timetables[0]?.lessons[0]?.room).toBe('5');
    expect(out.timetables[0]?.periods.map((p) => `${p.start}–${p.end}`)).toEqual(['08:00–08:45']);
  });
});
