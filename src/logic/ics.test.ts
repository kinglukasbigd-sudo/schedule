import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { at, holiday, k, lesson, lessonsFrom, subject, t, task, timetable } from '@/test/builders';
import { ENGLISH_ICS_LABELS, escapeText, exportIcs, foldLine, importIcs } from './ics';
import { occurrencesOn } from './schedule';
import { addDays, dateRange, toDateKey } from './time';
import type { AppData, Timetable } from './types';

const now = at('2026-10-05 07:00'); // Monday, Week A
const ab: Timetable = timetable({
  id: 'ab',
  validFrom: k('2026-09-01'),
  rotation: { weeks: 2, anchor: k('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: true },
  lessons: [
    ...lessonsFrom({ 1: ['math', 'eng'], 3: ['bio'] }, 0),
    ...lessonsFrom({ 1: ['chem'], 4: ['de'] }, 1),
    // A weekly double lesson in a two-week cycle: one copy per rotation week.
    lesson({ id: 'every', subjectId: 'pe', day: 5, periodId: 'p3', span: 2, room: 'Gym, hall B' }),
    lesson({ id: 'everyB', subjectId: 'pe', day: 5, periodId: 'p3', span: 2, room: 'Gym, hall B', week: 1 }),
  ],
});

const data: Pick<AppData, 'subjects' | 'timetables' | 'holidays' | 'tasks'> = {
  subjects: [subject('math', 'Mathematics'), subject('eng', 'English'), subject('bio', 'Biology'), subject('chem', 'Chem; Lab, \\ "B"'), subject('de', 'Deutsch'), subject('pe', 'PE')],
  timetables: [ab],
  holidays: [holiday('Teacher training', '2026-10-07'), holiday('Autumn break', '2026-10-26', '2026-10-30'), holiday('Day off', '2026-11-25')],
  tasks: [
    task({ id: 'test1', kind: 'test', title: 'Cell division', subjectId: 'bio', due: { date: k('2026-10-14'), lessonId: ab.lessons.find((l) => l.subjectId === 'bio')?.id ?? null, time: t('08:00') }, notes: 'Ch. 3\nand 4' }),
    task({ id: 'essay', kind: 'assignment', title: 'Essay', due: { date: k('2026-10-16'), lessonId: null, time: t('14:00') } }),
    task({ id: 'eod', kind: 'test', title: '', subjectId: 'de', due: '2026-10-20' }),
    task({ id: 'hw', kind: 'homework', title: 'Worksheet', due: '2026-10-08' }),
    task({ id: 'done', kind: 'test', title: 'Old', due: '2026-10-09', doneAt: 1 }),
    task({ id: 'past', kind: 'test', title: 'Past', due: '2026-10-01' }),
  ],
};

const text = exportIcs(data, { now });
const calendar = new ICAL.Component(ICAL.parse(text));
const events = calendar.getAllSubcomponents('vevent');
const uidOf = (e: ICAL.Component) => String(e.getFirstPropertyValue('uid'));

function expand(e: ICAL.Component, until: string): string[] {
  const exp = new ICAL.RecurExpansion({ component: e, dtstart: e.getFirstPropertyValue('dtstart') as ICAL.Time });
  const out: string[] = [];
  for (let next = exp.next(); next && out.length < 500; next = exp.next()) {
    const d = `${next.year}-${String(next.month).padStart(2, '0')}-${String(next.day).padStart(2, '0')}`;
    if (d > until) break;
    out.push(next.isDate ? d : `${d} ${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`);
  }
  return out;
}

describe('exportIcs (R-15)', () => {
  const from = toDateKey(now);
  const until = addDays(from, 26 * 7 - 1);

  it('is a valid RFC 5545 calendar with CRLF line endings and folded lines', () => {
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(calendar.getFirstPropertyValue('prodid')).toBe('-//TERM//School planner//EN');
  });

  it('expands every lesson exactly where the app has it: rotation, holidays, skipped weeks', () => {
    for (const l of ab.lessons) {
      const expected = dateRange(from, until).flatMap((d) =>
        occurrencesOn(d, { timetables: [ab], holidays: data.holidays })
          .filter((o) => o.lesson.id === l.id)
          .map((o) => `${o.date} ${o.startTime}`),
      );
      const own = events.filter((e) => uidOf(e).startsWith(`${l.id}`) && uidOf(e).split('@')[0]?.replace(/-\d{8}$/, '') === l.id);
      const actual = own.flatMap((e) => expand(e, until)).sort();
      expect(actual).toEqual(expected);
    }
  });

  it('splits a series where a skipped holiday week shifts the rotation, using EXDATE for single days', () => {
    const mathA = ab.lessons.find((l) => l.subjectId === 'math') as never as { id: string };
    const series = events.filter((e) => uidOf(e).startsWith(mathA.id));
    expect(series.length).toBe(2);
    expect(uidOf(series[0] as ICAL.Component)).toBe(`${mathA.id}@term`);
    // Biology (Wednesdays, week A) restarts on 11 Nov after the break; the day off on 25 Nov is an EXDATE.
    const bio = ab.lessons.find((l) => l.subjectId === 'bio') as { id: string };
    const bioEvent = events.find((e) => uidOf(e) === `${bio.id}-20261111@term`);
    expect(String(bioEvent?.getFirstPropertyValue('exdate'))).toContain('2026-11-25');
    // The teacher-training day is before the first exported Biology lesson, so it needs none.
    expect(String(events.find((e) => uidOf(e) === `${bio.id}@term`)?.getFirstPropertyValue('exdate'))).toBe('null');
  });

  it('uses floating times: no time zone, no Z', () => {
    expect(text).not.toMatch(/DTSTART;TZID|DTSTART:\d{8}T\d{6}Z/);
    expect(text).toMatch(/DTSTART:20261005T080000\r\n/);
    expect(text).toMatch(/UNTIL=\d{8}T\d{6};?/);
    expect(text).not.toMatch(/UNTIL=\d{8}T\d{6}Z/);
  });

  it('caps open-ended timetables at 26 weeks', () => {
    const last = events.flatMap((e) => expand(e, '2030-01-01')).sort().pop() ?? '';
    expect(last.slice(0, 10) <= until).toBe(true);
    expect(last.slice(0, 10) >= addDays(until, -7)).toBe(true);
  });

  it('ends a series when its timetable ends', () => {
    const short = exportIcs({ ...data, timetables: [{ ...ab, validTo: k('2026-10-16') }], tasks: [], holidays: [] }, { now });
    const evs = new ICAL.Component(ICAL.parse(short)).getAllSubcomponents('vevent');
    expect(evs.flatMap((e) => expand(e, '2030-01-01')).every((d) => d.slice(0, 10) <= '2026-10-16')).toBe(true);
  });

  it('exports open tests and assignments, never homework, done or past tasks', () => {
    const uids = events.map(uidOf);
    expect(uids).toEqual(expect.arrayContaining(['test1@term', 'essay@term', 'eod@term']));
    expect(uids).not.toEqual(expect.arrayContaining(['hw@term']));
    expect(uids.some((u) => u === 'done@term' || u === 'past@term')).toBe(false);
  });

  it('puts a test at its lesson, a timed task for 45 minutes, an end-of-day task all day', () => {
    const ev = (uid: string) => new ICAL.Event(events.find((e) => uidOf(e) === uid) as ICAL.Component);
    const test1 = ev('test1@term');
    expect([test1.startDate.toString(), test1.endDate.toString()]).toEqual(['2026-10-14T08:00:00', '2026-10-14T08:45:00']);
    expect(test1.summary).toBe('Biology test: Cell division');
    expect(test1.description).toBe('Ch. 3\nand 4');
    expect([ev('essay@term').startDate.toString(), ev('essay@term').endDate.toString()]).toEqual(['2026-10-16T14:00:00', '2026-10-16T14:45:00']);
    const eod = ev('eod@term');
    expect(eod.startDate.isDate).toBe(true);
    expect(eod.summary).toBe('Deutsch test');
  });

  it('writes holidays as all-day events with an exclusive end', () => {
    const autumn = new ICAL.Event(events.find((e) => e.getFirstPropertyValue('summary') === 'Autumn break') as ICAL.Component);
    expect([autumn.startDate.toString(), autumn.endDate.toString()]).toEqual(['2026-10-26', '2026-10-31']);
  });

  it('escapes text and keeps room names', () => {
    expect(text).toContain('SUMMARY:Chem\\; Lab\\, \\\\ "B"');
    const gym = events.find((e) => e.getFirstPropertyValue('location'));
    expect(gym?.getFirstPropertyValue('location')).toBe('Gym, hall B');
  });

  it('keeps UIDs unique, and stable when exported again a week later', () => {
    const uids = events.map(uidOf);
    expect(new Set(uids).size).toBe(uids.length);
    const later = new ICAL.Component(ICAL.parse(exportIcs(data, { now: at('2026-10-12 07:00') }))).getAllSubcomponents('vevent').map(uidOf);
    const lessonUids = (list: string[]) => list.filter((u) => ab.lessons.some((l) => u.startsWith(l.id))).sort();
    expect(lessonUids(later)).toEqual(lessonUids(uids));
  });

  it('labels tasks in English by default', () => {
    expect(ENGLISH_ICS_LABELS.task(task({ kind: 'assignment', title: '', due: '2026-10-05' }), undefined)).toBe('Assignment');
    expect(ENGLISH_ICS_LABELS.task(task({ kind: 'test', title: 'Quiz', due: '2026-10-05' }), undefined)).toBe('Quiz');
  });

  it('exports an empty but valid calendar when there is nothing', () => {
    const empty = exportIcs({ subjects: [], timetables: [], holidays: [], tasks: [] }, { now, weeks: 1 });
    expect(new ICAL.Component(ICAL.parse(empty)).getAllSubcomponents('vevent')).toHaveLength(0);
  });
});

describe('foldLine and escapeText', () => {
  it('folds at 75 octets without splitting a multi-byte character', () => {
    const line = `SUMMARY:${'Математика '.repeat(10)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    expect(foldLine('SHORT:x')).toBe('SHORT:x');
  });

  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });
});

describe('importIcs (F-12)', () => {
  it('reads back its own export: holidays and a draft timetable', () => {
    const { holidays, draft } = importIcs(text);
    // Every all-day event is a candidate; only breaks are pre-ticked (the end-of-day test is not).
    expect(holidays.map((h) => [h.name, h.start, h.end, h.suggested])).toEqual([
      ['Teacher training', '2026-10-07', '2026-10-07', false],
      ['Deutsch test', '2026-10-20', '2026-10-20', false],
      ['Autumn break', '2026-10-26', '2026-10-30', true],
      ['Day off', '2026-11-25', '2026-11-25', true],
    ]);
    expect(draft?.weeks).toBe(2);
    expect(draft?.days).toEqual([1, 3, 4, 5]);
    // A double lesson is one long event in a calendar file; the student splits it in review.
    expect(draft?.periods.map((p) => `${p.start}–${p.end}`)).toEqual(['08:00–08:45', '08:50–09:35', '09:40–11:30']);
    const pe = draft?.cells.filter((c) => c.subject === 'PE');
    expect(pe?.map((c) => [c.week, c.period, c.span])).toEqual([
      [0, 2, 1],
      [1, 2, 1],
    ]);
    expect(pe?.[0]?.room).toBe('Gym, hall B');
    expect(draft?.cells.find((c) => c.subject === 'Mathematics')?.week).toBe(0);
    expect(draft?.cells.find((c) => c.subject.startsWith('Chem'))?.week).toBe(1);
  });

  it('reads calendars from other apps: TZID, UTC, folded lines, BYDAY lists', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Berlin',
      'BEGIN:STANDARD',
      'DTSTART:19701025T030000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'DTSTART;TZID=Europe/Berlin:20260907T080000',
      'DTEND;TZID=Europe/Berlin:20260907T093500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
      'SUMMARY:Mathe',
      'LOCATION:R 12',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20260908T064500Z',
      'DTEND:20260908T073000Z',
      'RRULE:FREQ=WEEKLY;INTERVAL=2',
      'SUMMARY:Deutsch mit einem sehr langen Namen der umgebrochen wir',
      ' d',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20261221',
      'DTEND;VALUE=DATE:20270107',
      'SUMMARY:Weihnachtsferien',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20261112',
      'SUMMARY:Elternsprechtag',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART:20261001T100000',
      'SUMMARY:One-off event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const { holidays, draft } = importIcs(ics);
    expect(holidays).toEqual([
      { name: 'Elternsprechtag', start: '2026-11-12', end: '2026-11-12', suggested: false },
      { name: 'Weihnachtsferien', start: '2026-12-21', end: '2027-01-06', suggested: true },
    ]);
    expect(draft?.days).toEqual([1, 2, 3]);
    expect(draft?.periods.map((p) => p.start)).toEqual(['08:00', '08:45']);
    const mathe = draft?.cells.filter((c) => c.subject === 'Mathe');
    // Weekly Mathe in a 2-week cycle fills both weeks.
    expect(mathe?.map((c) => [c.week, c.day, c.period, c.span, c.room])).toEqual([
      [0, 1, 0, 2, 'R 12'],
      [1, 1, 0, 2, 'R 12'],
      [0, 3, 0, 2, 'R 12'],
      [1, 3, 0, 2, 'R 12'],
    ]);
    const deutsch = draft?.cells.find((c) => c.subject.startsWith('Deutsch'));
    expect(deutsch).toMatchObject({ day: 2, period: 1, week: 0, subject: 'Deutsch mit einem sehr langen Namen der umgebrochen wird' });
  });

  it('suggests single days named like holidays, and finds nothing in an empty file', () => {
    const ics = 'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261028\r\nSUMMARY:Државен празник\r\nEND:VEVENT\r\n';
    expect(importIcs(ics).holidays[0]?.suggested).toBe(true);
    expect(importIcs('')).toEqual({ holidays: [], draft: null });
    expect(importIcs('BEGIN:VEVENT\nDTSTART:garbage\nEND:VEVENT').holidays).toEqual([]);
  });

  it('skips rules it cannot place: daily, more than 4 weeks, untitled', () => {
    const ev = (rule: string, summary = 'X') => `BEGIN:VEVENT\nDTSTART:20260907T080000\nRRULE:${rule}\nSUMMARY:${summary}\nEND:VEVENT`;
    expect(importIcs(ev('FREQ=DAILY')).draft).toBeNull();
    expect(importIcs(ev('FREQ=WEEKLY;INTERVAL=6')).draft).toBeNull();
    expect(importIcs(ev('FREQ=WEEKLY', '')).draft).toBeNull();
    expect(importIcs(ev('FREQ=WEEKLY')).draft?.periods).toEqual([{ start: '08:00', end: '08:45' }]);
  });
});
