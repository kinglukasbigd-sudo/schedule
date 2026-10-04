import { describe, expect, it } from 'vitest';
import { SUBJECTS, at, holiday, schedule, subject, timetable } from '@/test/builders';
import { parseQuickAdd, resolveQuickAddDue, type QuickAdd } from './quickAdd';
import type { Language, Subject } from './types';

const monday = at('2026-10-05 15:00');
const parse = (text: string, now = monday, locale: Language = 'en', subjects: Subject[] = SUBJECTS) =>
  parseQuickAdd(text, subjects, now, locale);
const dateOf = (text: string, now = monday, locale: Language = 'en') => parse(text, now, locale).when?.date ?? null;

describe('parseQuickAdd — English', () => {
  it('reads kind, subject and weekday, stripping only the date', () => {
    expect(parse('Math test friday')).toEqual<QuickAdd>({
      kind: 'test',
      subjectId: 'math',
      when: { date: '2026-10-09' as never, source: 'weekday' },
      time: null,
      title: 'Math test',
    });
    expect(parse('bio worksheet tomorrow')).toMatchObject({ kind: 'homework', subjectId: 'bio', title: 'bio worksheet' });
    expect(parse('english essay tomorrow').kind).toBe('assignment');
    expect(parse('PE kit').subjectId).toBe('pe');
    expect(parse('physical education test').subjectId).toBe('pe');
  });

  it('understands nothing in plain text', () => {
    expect(parse('read chapter 3')).toEqual({ kind: null, subjectId: null, when: null, time: null, title: 'read chapter 3' });
    expect(parse('do the reading so it is done')).toMatchObject({ when: null, kind: null });
    expect(parse('')).toEqual({ kind: null, subjectId: null, when: null, time: null, title: '' });
    expect(parse('  ,.  ').title).toBe('');
  });

  it('does not read "ex", "HA" or "final" as kinds (D-033)', () => {
    expect(parse('math ex 4-7').kind).toBeNull();
    expect(parse('HA seite 12').kind).toBeNull();
    expect(parse('final draft of essay').kind).toBe('assignment');
    expect(parse('finals monday').kind).toBe('test');
  });

  it('takes the first kind word in the text', () => {
    expect(parse('essay for the test').kind).toBe('assignment');
    expect(parse('test about the essay').kind).toBe('test');
  });

  it('uses the next weekday, never today', () => {
    expect(dateOf('monday')).toBe('2026-10-12');
    expect(dateOf('tuesday')).toBe('2026-10-06');
    expect(dateOf('next friday')).toBe('2026-10-09');
    expect(dateOf('this sunday')).toBe('2026-10-11');
    expect(dateOf('quiz wed')).toBe('2026-10-07');
  });

  it('treats capitalised short words as acronyms, not weekdays', () => {
    expect(parse('SAT prep saturday')).toMatchObject({ when: { date: '2026-10-10' }, title: 'SAT prep' });
    expect(dateOf('SAT prep')).toBeNull();
    expect(dateOf('quiz sat')).toBe('2026-10-10');
  });

  it('reads relative days', () => {
    expect(dateOf('today')).toBe('2026-10-05');
    expect(dateOf('tonight')).toBe('2026-10-05');
    expect(dateOf('tmrw')).toBe('2026-10-06');
    expect(parse('homework the day after tomorrow')).toMatchObject({ when: { date: '2026-10-07' }, title: 'homework' });
  });

  it('reads "in N days", with digits or words', () => {
    expect(parse('essay in 3 days')).toMatchObject({ when: { date: '2026-10-08', source: 'in-days' }, title: 'essay' });
    expect(dateOf('in two days')).toBe('2026-10-07');
    expect(dateOf('in a day')).toBe('2026-10-06');
    expect(dateOf('in 3 weeks')).toBeNull();
    expect(dateOf('in 3 apples')).toBeNull();
  });

  it('reads "next week" as next Monday’s week', () => {
    expect(parse('bio test next week')).toMatchObject({ when: { date: '2026-10-12', source: 'next-week' }, title: 'bio test' });
  });

  it('reads day-first numeric dates near today only (E-24)', () => {
    expect(dateOf('due 12.10')).toBe('2026-10-12');
    expect(dateOf('due 12/10')).toBe('2026-10-12');
    expect(dateOf('due 3/1')).toBe('2027-01-03');
    expect(dateOf('12.10.2026')).toBe('2026-10-12');
    expect(dateOf('5.10')).toBe('2026-10-05'); // today is fine
    expect(dateOf('ex 4.7')).toBeNull(); // an exercise, not July
    expect(dateOf('4.10')).toBeNull(); // yesterday, and next year is too far
    expect(dateOf('31.02')).toBeNull();
    expect(dateOf('12.10.2025')).toBeNull(); // never a past date
    expect(dateOf('version 1.2.3')).toBeNull();
    expect(dateOf('10:30')).toBeNull();
    expect(dateOf('10.30')).toBeNull();
    expect(parse('Read ch. 3 by 12.10').title).toBe('Read ch. 3');
  });

  it('reads month names in both orders, a year ahead at most (D-043)', () => {
    expect(parse('essay 12 nov')).toMatchObject({ when: { date: '2026-11-12', source: 'month' }, title: 'essay' });
    expect(dateOf('12th of November')).toBe('2026-11-12');
    expect(dateOf('Nov 12')).toBe('2026-11-12');
    expect(dateOf('november 12th')).toBe('2026-11-12');
    expect(dateOf('1 may')).toBe('2027-05-01');
    expect(dateOf('3 sep')).toBe('2027-09-03'); // passed this year → next year
    expect(dateOf('12 November 2027')).toBe('2027-11-12');
    expect(dateOf('Dec 1 2026')).toBe('2026-12-01');
    expect(dateOf('12 nov 2025')).toBeNull();
    expect(dateOf('31 nov')).toBeNull();
    expect(dateOf('you may hand it in')).toBeNull();
    expect(dateOf('chapter 40 of march')).toBeNull();
  });

  it('crosses the year boundary', () => {
    const newYearsEve = at('2026-12-31 18:00');
    expect(dateOf('tomorrow', newYearsEve)).toBe('2027-01-01');
    expect(dateOf('friday', newYearsEve)).toBe('2027-01-01');
    expect(dateOf('5 jan', newYearsEve)).toBe('2027-01-05');
    expect(dateOf('5.1', newYearsEve)).toBe('2027-01-05');
    expect(dateOf('next week', newYearsEve)).toBe('2027-01-04');
  });

  it('reads times and strips them from the title', () => {
    expect(parse('essay at 10')).toMatchObject({ time: '10:00', title: 'essay', when: null });
    expect(parse('at 10:30').time).toBe('10:30');
    expect(parse('at 3').time).toBe('15:00'); // nobody hands in work at 3 a.m.
    expect(parse('at 3 am').time).toBe('03:00');
    expect(parse('at 12 pm').time).toBe('12:00');
    expect(parse('at 12 am').time).toBe('00:00');
    expect(parse('at 7').time).toBe('07:00');
    expect(parse('presentation 14:30 friday')).toMatchObject({ time: '14:30', when: { date: '2026-10-09' }, title: 'presentation' });
    expect(parse('meet 3pm').time).toBe('15:00');
    expect(parse('meet 9 a.m.').time).toBe('09:00');
    expect(parse('class 10h').time).toBe('10:00');
    expect(parse('revise 2h').time).toBeNull(); // a duration
    expect(parse('at 25').time).toBeNull();
    expect(parse('at 10:75').time).toBeNull();
    expect(parse('at 13 pm').time).toBeNull();
  });

  it('applies the night-owl rule until 04:00 (R-12, E-17)', () => {
    const late = at('2026-10-06 01:00'); // Tuesday, still Monday night
    expect(dateOf('tomorrow', late)).toBe('2026-10-06');
    expect(dateOf('tuesday', late)).toBe('2026-10-06');
    expect(dateOf('wednesday', late)).toBe('2026-10-07');
    expect(dateOf('day after tomorrow', late)).toBe('2026-10-07');
    expect(dateOf('today', late)).toBe('2026-10-06');
    expect(dateOf('in 1 day', late)).toBe('2026-10-07');
    const morning = at('2026-10-06 04:00');
    expect(dateOf('tomorrow', morning)).toBe('2026-10-07');
    expect(dateOf('tuesday', morning)).toBe('2026-10-13');
  });
});

describe('parseQuickAdd — Macedonian', () => {
  const mk = [subject('m', 'Математика'), subject('a', 'Англиски')];
  const p = (text: string, now = monday) => parseQuickAdd(text, mk, now, 'mk');

  it('reads kinds, subjects, days and strips "во петок"', () => {
    expect(p('Контролна по математика во петок')).toEqual({
      kind: 'test',
      subjectId: 'm',
      when: { date: '2026-10-09', source: 'weekday' },
      time: null,
      title: 'Контролна по математика',
    });
    expect(p('домашна по англиски утре')).toMatchObject({ kind: 'homework', subjectId: 'a', when: { date: '2026-10-06' }, title: 'домашна по англиски' });
    expect(p('есеј задутре').when?.date).toBe('2026-10-07');
  });

  it('tells "следната недела" (next week) from "недела" (Sunday)', () => {
    expect(p('тест следната недела').when).toEqual({ date: '2026-10-12', source: 'next-week' });
    expect(p('тест во недела').when).toEqual({ date: '2026-10-11', source: 'weekday' });
  });

  it('reads "за N дена", month names and "во 9 часот"', () => {
    expect(p('реферат за 3 дена').when?.date).toBe('2026-10-08');
    expect(p('реферат за два дена').when?.date).toBe('2026-10-07');
    expect(p('тест 12 ноември').when?.date).toBe('2026-11-12');
    expect(p('тест 12-ти ноември').when?.date).toBe('2026-11-12');
    expect(p('тест во 9 часот')).toMatchObject({ time: '09:00', title: 'тест' });
    expect(p('задача пет').when).toBeNull(); // "пет" is five, not Friday
  });
});

describe('parseQuickAdd — German', () => {
  const p = (text: string, now = monday) => parseQuickAdd(text, SUBJECTS, now, 'de');

  it('reads compounds and umlauts', () => {
    expect(p('Deutsch Aufsatz Mittwoch')).toMatchObject({ kind: 'assignment', subjectId: 'de', when: { date: '2026-10-07' } });
    expect(p('Mathearbeit übermorgen')).toMatchObject({ kind: 'test', subjectId: 'math', when: { date: '2026-10-07' } });
    expect(p('Prüfung').kind).toBe('test');
    expect(p('Prufung').kind).toBe('test');
    expect(p('Vokabeltest').kind).toBe('test');
    expect(p('Facharbeit').kind).toBe('assignment');
    expect(p('Gruppenarbeit Bio').kind).toBe('assignment');
    expect(p('Hausaufgaben Bio').kind).toBe('homework');
  });

  it('reads German dates and strips their prepositions', () => {
    expect(p('Aufsatz am 12.10.')).toMatchObject({ when: { date: '2026-10-12' }, title: 'Aufsatz' });
    expect(p('Referat bis zum 12.10')).toMatchObject({ title: 'Referat' });
    expect(p('Aufsatz bis übermorgen').title).toBe('Aufsatz');
    expect(p('Test nächste Woche').when).toEqual({ date: '2026-10-12', source: 'next-week' });
    expect(p('Referat in 3 Tagen').when?.date).toBe('2026-10-08');
    expect(p('Referat in drei Tagen').when?.date).toBe('2026-10-08');
    expect(p('Klausur 12. November').when?.date).toBe('2026-11-12');
    expect(p('Klausur 3. März').when?.date).toBe('2027-03-03');
    expect(p('Test um 10 Uhr')).toMatchObject({ time: '10:00', title: 'Test' });
    expect(p('Test 9 Uhr').time).toBe('09:00');
    expect(p('Test um 10.30').time).toBe('10:30');
  });

  it('reads two-letter weekdays only in German and only capitalised', () => {
    expect(p('Mathe Test Fr').when?.date).toBe('2026-10-09');
    expect(p('Mathe Test Do').when?.date).toBe('2026-10-08');
    expect(p('wir do das').when).toBeNull();
    expect(parse('Math test Fr').when).toBeNull();
  });
});

describe('parseQuickAdd — subjects', () => {
  const both = [subject('m1', 'Math'), subject('m2', 'Mathematics'), subject('h', 'History')];
  it('prefers the longest match, whole names over prefixes', () => {
    expect(parse('math homework', monday, 'en', both).subjectId).toBe('m1');
    expect(parse('mathematics homework', monday, 'en', both).subjectId).toBe('m2');
    expect(parse('maths homework', monday, 'en', [subject('m2', 'Mathematics')]).subjectId).toBe('m2');
    expect(parse('hist essay', monday, 'en', both).subjectId).toBe('h');
  });
  it('never matches on fewer than three letters or on the date phrase', () => {
    expect(parse('hi there', monday, 'en', both).subjectId).toBeNull();
    expect(parse('essay friday', monday, 'en', [subject('f', 'Friday Club')]).subjectId).toBeNull();
    expect(parse('📚 bio test tomorrow').subjectId).toBe('bio');
  });
});

describe('resolveQuickAddDue (F-7, R-12)', () => {
  const s = schedule();
  const due = (text: string, now = monday, sched = s) => resolveQuickAddDue(parse(text, now), now, sched);

  it('attaches a typed date to the subject’s lesson that day', () => {
    const r = due('Math test friday');
    expect(r.source).toBe('typed');
    expect(r.due).toMatchObject({ date: '2026-10-09', time: '09:40' });
    expect(r.due.lessonId).toBeTruthy();
  });

  it('lets a typed time win over the lesson', () => {
    expect(due('Math test friday at 12').due).toEqual({ date: '2026-10-09', lessonId: null, time: '12:00' });
  });

  it('defaults to the subject’s next lesson, skipping the rest of today', () => {
    const r = due('math homework', at('2026-10-05 09:10'));
    expect(r).toMatchObject({ source: 'next-lesson', due: { date: '2026-10-06', time: '08:50' } });
  });

  it('falls back to tomorrow, end of day', () => {
    expect(due('read a book')).toEqual({ due: { date: '2026-10-06', lessonId: null, time: null }, source: 'default' });
    const noLessons = resolveQuickAddDue({ subjectId: 'ghost', when: null, time: null }, monday, s);
    expect(noLessons.source).toBe('no-lesson');
  });

  it('puts a lone time today if it is still ahead, else tomorrow', () => {
    expect(due('call at 16').due).toEqual({ date: '2026-10-05', lessonId: null, time: '16:00' });
    expect(due('call at 10').due).toEqual({ date: '2026-10-06', lessonId: null, time: '10:00' });
  });

  it('puts "next week" at the subject’s first lesson that week, else Monday', () => {
    expect(due('bio test next week').due).toMatchObject({ date: '2026-10-12', time: '09:40' });
    expect(due('test next week').due).toEqual({ date: '2026-10-12', lessonId: null, time: null });
    expect(due('bio test next week at 10').due).toEqual({ date: '2026-10-12', lessonId: null, time: '10:00' });
    const breakWeek = schedule([timetable()], [holiday('Break', '2026-10-12', '2026-10-16')]);
    expect(due('bio test next week', monday, breakWeek).due).toEqual({ date: '2026-10-12', lessonId: null, time: null });
  });
});
