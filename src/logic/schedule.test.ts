import { describe, expect, it } from 'vitest';
import { at, holiday, k, lesson, lessonsFrom, schedule, t, timetable } from '@/test/builders';
import { inZone } from '@/test/zones';
import {
  coversDate,
  holidayOn,
  isHoliday,
  lessonTimes,
  lessonsOnDay,
  nextLessonOfSubject,
  nextOccurrenceOfLesson,
  nextSchoolDay,
  occurrencesOn,
  resolveWeekType,
  timetableFor,
  timetableOfLesson,
} from './schedule';
import { timeOf } from './time';
import type { Timetable } from './types';

const ab = (partial: Partial<Timetable> = {}): Timetable =>
  timetable({
    rotation: { weeks: 2, anchor: k('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: true },
    lessons: [...lessonsFrom({ 1: ['math'], 3: ['bio'] }, 0), ...lessonsFrom({ 1: ['eng'], 3: ['chem'] }, 1)],
    ...partial,
  });

const autumn = holiday('Autumn break', '2026-10-26', '2026-10-30');

describe('holidays', () => {
  it('finds the holiday covering a date, earliest start first when they overlap', () => {
    const a = holiday('A', '2026-10-26', '2026-10-30');
    const b = holiday('B', '2026-10-20', '2026-10-27');
    expect(holidayOn(k('2026-10-27'), [a, b])?.name).toBe('B');
    expect(holidayOn(k('2026-10-30'), [a, b])?.name).toBe('A');
    expect(holidayOn(k('2026-10-31'), [a, b])).toBeUndefined();
    expect(isHoliday(k('2026-10-26'), [a])).toBe(true);
    expect(isHoliday(k('2026-10-25'), [a])).toBe(false);
  });
});

describe('timetableFor (R-2)', () => {
  const autumnTerm = timetable({ id: 'autumn', validFrom: k('2026-09-01'), validTo: k('2027-01-31') });
  const spring = timetable({ id: 'spring', validFrom: k('2027-02-01'), validTo: null });

  it('picks the timetable whose inclusive range covers the date', () => {
    expect(timetableFor(k('2026-09-01'), [autumnTerm, spring])?.id).toBe('autumn');
    expect(timetableFor(k('2027-01-31'), [autumnTerm, spring])?.id).toBe('autumn');
    expect(timetableFor(k('2027-02-01'), [autumnTerm, spring])?.id).toBe('spring');
    expect(timetableFor(k('2030-01-01'), [autumnTerm, spring])?.id).toBe('spring');
    expect(timetableFor(k('2026-08-31'), [autumnTerm, spring])).toBeUndefined();
    expect(timetableFor(k('2026-10-05'), [])).toBeUndefined();
  });

  it('prefers the later start if ranges overlap despite the invariant', () => {
    const overlap = timetable({ id: 'late', validFrom: k('2026-10-01') });
    expect(timetableFor(k('2026-10-05'), [overlap, autumnTerm])?.id).toBe('late');
    expect(coversDate(autumnTerm, k('2027-02-01'))).toBe(false);
  });
});

describe('resolveWeekType (R-3)', () => {
  it('is always week A for a one-week cycle', () => {
    expect(resolveWeekType(k('2027-05-05'), timetable())).toEqual({ index: 0, label: 'A' });
  });

  it('alternates by ISO week, Sundays belonging to the week before', () => {
    const t2 = ab();
    expect(resolveWeekType(k('2026-10-05'), t2).label).toBe('A');
    expect(resolveWeekType(k('2026-10-11'), t2).label).toBe('A'); // Sunday of the anchor week
    expect(resolveWeekType(k('2026-10-12'), t2).label).toBe('B');
    expect(resolveWeekType(k('2026-10-19'), t2).label).toBe('A');
    expect(resolveWeekType(k('2026-10-04'), t2).label).toBe('B'); // Sunday before: previous week
    expect(resolveWeekType(k('2026-09-28'), t2).label).toBe('B'); // backwards
    expect(resolveWeekType(k('2026-09-21'), t2).label).toBe('A');
  });

  it('honours the anchor index and an anchor that is not a Monday', () => {
    const t2 = ab({ rotation: { weeks: 2, anchor: k('2026-10-07'), anchorIndex: 1, skipHolidayWeeks: false } });
    expect(resolveWeekType(k('2026-10-05'), t2).label).toBe('B');
    expect(resolveWeekType(k('2026-10-12'), t2).label).toBe('A');
  });

  it('cycles through four weeks in both directions', () => {
    const t4 = timetable({ rotation: { weeks: 4, anchor: k('2026-10-05'), anchorIndex: 2, skipHolidayWeeks: false } });
    const labels = [-5, -4, -1, 0, 1, 2, 5].map((w) => resolveWeekType(addWeeks(w), t4).label);
    expect(labels).toEqual(['B', 'C', 'B', 'C', 'D', 'A', 'D']);
  });

  it('keeps counting across New Year and ISO week 53 (E-12)', () => {
    const t2 = ab({ rotation: { weeks: 2, anchor: k('2026-12-21'), anchorIndex: 0, skipHolidayWeeks: false } });
    expect(resolveWeekType(k('2026-12-28'), t2).label).toBe('B'); // ISO week 53 of 2026
    expect(resolveWeekType(k('2027-01-03'), t2).label).toBe('B');
    expect(resolveWeekType(k('2027-01-04'), t2).label).toBe('A');
  });

  it('does not advance through a week that is all holiday (E-9)', () => {
    const t2 = ab();
    expect(resolveWeekType(k('2026-10-19'), t2, [autumn]).label).toBe('A');
    expect(resolveWeekType(k('2026-11-02'), t2, [autumn]).label).toBe('B');
    expect(resolveWeekType(k('2026-11-09'), t2, [autumn]).label).toBe('A');
    // Without skipping, the break week counts.
    const noSkip = ab({ rotation: { ...t2.rotation, skipHolidayWeeks: false } });
    expect(resolveWeekType(k('2026-11-02'), noSkip, [autumn]).label).toBe('A');
  });

  it('skips several holiday weeks, backwards too', () => {
    const t2 = ab({ rotation: { weeks: 2, anchor: k('2026-11-02'), anchorIndex: 0, skipHolidayWeeks: true } });
    const twoWeeks = holiday('Long break', '2026-10-19', '2026-10-30');
    expect(resolveWeekType(k('2026-10-12'), t2, [twoWeeks]).label).toBe('B');
    expect(resolveWeekType(k('2026-10-05'), t2, [twoWeeks]).label).toBe('A');
  });

  it('advances through partial holiday weeks and weekend-only holidays', () => {
    const t2 = ab();
    const partial = holiday('Mon–Thu off', '2026-10-26', '2026-10-29');
    expect(resolveWeekType(k('2026-11-02'), t2, [partial]).label).toBe('A');
    const weekend = holiday('Weekend trip', '2026-10-31', '2026-11-01');
    expect(resolveWeekType(k('2026-11-09'), t2, [weekend]).label).toBe('B');
  });
});

function addWeeks(w: number) {
  const d = new Date(2026, 9, 5 + w * 7);
  return k(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
}

describe('occurrencesOn (R-4)', () => {
  it('lists the day’s lessons in time order with wall-clock instants', () => {
    const occ = occurrencesOn(k('2026-10-05'), schedule());
    expect(occ.map((o) => `${o.startTime} ${o.lesson.subjectId}`)).toEqual([
      '08:00 math',
      '08:50 eng',
      '09:40 bio',
      '10:45 bio',
      '11:35 pe',
      '12:25 math',
    ]);
    expect(occ[0]?.start).toEqual(at('2026-10-05 08:00'));
    expect(occ[0]?.end).toEqual(at('2026-10-05 08:45'));
  });

  it('is empty without a timetable, outside its dates, on non-school days and on holidays', () => {
    expect(occurrencesOn(k('2026-10-05'), schedule([]))).toEqual([]);
    expect(occurrencesOn(k('2026-08-31'), schedule())).toEqual([]);
    expect(occurrencesOn(k('2026-10-10'), schedule())).toEqual([]); // Saturday
    expect(occurrencesOn(k('2026-10-26'), schedule([timetable()], [autumn]))).toEqual([]);
    expect(occurrencesOn(k('2026-10-05'), schedule([timetable({ lessons: [] })]))).toEqual([]);
    expect(occurrencesOn(k('2026-10-05'), schedule([timetable({ days: [2, 3] })]))).toEqual([]);
  });

  it('treats a lesson spanning periods as one occurrence including the break (E-6)', () => {
    const tt = timetable({ lessons: [lesson({ subjectId: 'bio', day: 1, periodId: 'p3', span: 2 })] });
    const [occ] = occurrencesOn(k('2026-10-05'), schedule([tt]));
    expect([occ?.startTime, occ?.endTime]).toEqual(['09:40', '11:30']);
  });

  it('clamps a span that runs past the last period', () => {
    const tt = timetable({ lessons: [lesson({ subjectId: 'bio', day: 1, periodId: 'p6', span: 4 })] });
    expect(occurrencesOn(k('2026-10-05'), schedule([tt]))[0]?.endTime).toBe('14:00');
  });

  it('uses a lesson’s own times and sorts by them (E-7)', () => {
    const tt = timetable({
      lessons: [
        lesson({ subjectId: 'math', day: 5, periodId: 'p1' }),
        lesson({ subjectId: 'pe', day: 5, periodId: 'p2', time: { start: t('07:15'), end: t('07:55') } }),
      ],
    });
    expect(occurrencesOn(k('2026-10-09'), schedule([tt])).map((o) => o.lesson.subjectId)).toEqual(['pe', 'math']);
  });

  it('ignores lessons whose period no longer exists', () => {
    const tt = timetable({ lessons: [lesson({ subjectId: 'math', day: 1, periodId: 'gone' })] });
    expect(occurrencesOn(k('2026-10-05'), schedule([tt]))).toEqual([]);
    expect(lessonTimes(tt.lessons[0] as never, tt)).toBeNull();
  });

  it('shows week A lessons in A weeks and week B lessons in B weeks (E-8)', () => {
    const s = schedule([ab()]);
    expect(occurrencesOn(k('2026-10-05'), s).map((o) => o.lesson.subjectId)).toEqual(['math']);
    expect(occurrencesOn(k('2026-10-12'), s).map((o) => o.lesson.subjectId)).toEqual(['eng']);
  });

  it('uses each day’s own timetable in a week that switches mid-week (E-13)', () => {
    const old = timetable({ id: 'old', validTo: k('2026-10-07') });
    const next = timetable({ id: 'new', validFrom: k('2026-10-08'), lessons: lessonsFrom({ 4: ['bio'] }) });
    const s = schedule([old, next]);
    expect(occurrencesOn(k('2026-10-07'), s)[0]?.timetableId).toBe('old');
    expect(occurrencesOn(k('2026-10-08'), s).map((o) => o.lesson.subjectId)).toEqual(['bio']);
  });

  it('lists a weekday’s lessons in period order', () => {
    expect(lessonsOnDay(timetable(), 2).map((l) => l.subjectId)).toEqual(['eng', 'math', 'de', 'pe']);
    expect(lessonsOnDay(ab(), 1, 1).map((l) => l.subjectId)).toEqual(['eng']);
  });
});

describe('occurrences on a DST change (E-10)', () => {
  inZone('Europe/Berlin');
  it('keeps wall-clock times, and moves a lesson in the gap to the first valid minute', () => {
    const sundaySchool = timetable({
      validFrom: k('2026-01-01'),
      days: [7],
      lessons: [
        lesson({ subjectId: 'math', day: 7, periodId: 'p1' }),
        lesson({ subjectId: 'eng', day: 7, periodId: 'p2', time: { start: t('02:30'), end: t('03:30') } }),
      ],
    });
    const occ = occurrencesOn(k('2026-03-29'), schedule([sundaySchool]));
    expect(occ.map((o) => timeOf(o.start))).toEqual(['03:00', '08:00']);
    expect(occ[1]?.start.toISOString()).toBe('2026-03-29T06:00:00.000Z');
    const autumnSunday = occurrencesOn(k('2026-10-25'), schedule([sundaySchool]));
    expect(autumnSunday[1]?.start.toISOString()).toBe('2026-10-25T07:00:00.000Z');
  });
});

describe('nextOccurrenceOfLesson', () => {
  const tt = timetable();
  const mondayMath = tt.lessons.find((l) => l.day === 1 && l.periodId === 'p1');
  if (!mondayMath) throw new Error('fixture');

  it('finds today’s lesson before it starts, next week’s once it has started', () => {
    expect(nextOccurrenceOfLesson(mondayMath, at('2026-10-05 07:59'), schedule([tt]))?.date).toBe('2026-10-05');
    expect(nextOccurrenceOfLesson(mondayMath, at('2026-10-05 08:00'), schedule([tt]))?.date).toBe('2026-10-12');
    expect(nextOccurrenceOfLesson(mondayMath, at('2026-10-05 08:30'), schedule([tt]))?.date).toBe('2026-10-12');
    expect(nextOccurrenceOfLesson(mondayMath.id, at('2026-10-06 12:00'), schedule([tt]))?.date).toBe('2026-10-12');
  });

  it('skips holidays and respects rotation weeks', () => {
    expect(nextOccurrenceOfLesson(mondayMath, at('2026-10-20 08:00'), schedule([tt], [autumn]))?.date).toBe('2026-11-02');
    const t2 = ab();
    const bMonday = t2.lessons.find((l) => l.week === 1 && l.day === 1);
    expect(nextOccurrenceOfLesson(bMonday as never, at('2026-10-05 09:00'), schedule([t2]))?.date).toBe('2026-10-12');
    expect(nextOccurrenceOfLesson(bMonday as never, at('2026-10-12 09:00'), schedule([t2]))?.date).toBe('2026-10-26');
    // The autumn break week is skipped: B comes back on 2 November.
    expect(nextOccurrenceOfLesson(bMonday as never, at('2026-10-12 09:00'), schedule([t2], [autumn]))?.date).toBe(
      '2026-11-02',
    );
  });

  it('stops at its timetable’s end and at the horizon', () => {
    const ending = timetable({ validTo: k('2026-10-09') });
    const math = ending.lessons.find((l) => l.day === 1 && l.periodId === 'p1') as never;
    expect(nextOccurrenceOfLesson(math, at('2026-10-05 09:00'), schedule([ending]))).toBeNull();
    const later = timetable({ validFrom: k('2027-03-01') });
    const lateMath = later.lessons.find((l) => l.day === 1 && l.periodId === 'p1') as never;
    expect(nextOccurrenceOfLesson(lateMath, at('2026-10-05 09:00'), schedule([later]))).toBeNull();
    expect(nextOccurrenceOfLesson(lateMath, at('2026-10-05 09:00'), schedule([later]), 200)?.date).toBe('2027-03-01');
  });

  it('returns null for a lesson no timetable contains', () => {
    expect(nextOccurrenceOfLesson('nope', at('2026-10-05 09:00'), schedule())).toBeNull();
    expect(timetableOfLesson('nope', [tt])).toBeUndefined();
  });
});

describe('nextLessonOfSubject (R-5)', () => {
  const all = [timetable()];

  it('skips the rest of today once a lesson of the subject has started (E-16)', () => {
    // Monday: Math in periods 1 and 6. At 09:10 period 1 has started → Tuesday period 2.
    const next = nextLessonOfSubject('math', at('2026-10-05 09:10'), all, []);
    expect([next?.date, next?.startTime]).toEqual(['2026-10-06', '08:50']);
  });

  it('keeps today’s lesson before school starts', () => {
    const next = nextLessonOfSubject('math', at('2026-10-05 06:30'), all, []);
    expect([next?.date, next?.startTime]).toEqual(['2026-10-05', '08:00']);
  });

  it('treats a double lesson as one: during it, the next is another day', () => {
    // Biology is a double in periods 3–4 on Monday; at 10:50 it is still running.
    const next = nextLessonOfSubject('bio', at('2026-10-05 10:50'), all, []);
    expect(next?.date).toBe('2026-10-09');
  });

  it('skips holidays and keeps the wall-clock time across a DST change', () => {
    const next = nextLessonOfSubject('chem', at('2026-10-22 09:00'), all, [autumn]);
    expect([next?.date, next?.startTime]).toEqual(['2026-11-04', '08:00']);
    expect(timeOf(next?.start as Date)).toBe('08:00');
  });

  it('crosses the year boundary', () => {
    expect(nextLessonOfSubject('chem', at('2026-12-31 10:00'), all, [])?.date).toBe('2027-01-06');
  });

  it('finds the subject in the next timetable, across a gap (E-13, E-14)', () => {
    const autumnTerm = timetable({ id: 'a', validTo: k('2026-10-09'), lessons: lessonsFrom({ 1: ['math'] }) });
    const spring = timetable({ id: 's', validFrom: k('2026-10-19'), lessons: lessonsFrom({ 2: ['de'] }) });
    expect(nextLessonOfSubject('de', at('2026-10-05 09:00'), [autumnTerm, spring], [])?.date).toBe('2026-10-20');
  });

  it('gives up after the last timetable ends and beyond the horizon (E-4, E-23)', () => {
    const ended = timetable({ validTo: k('2026-10-07') });
    expect(nextLessonOfSubject('pe', at('2026-10-07 12:00'), [ended], [])).toBeNull();
    const summer = holiday('Summer', '2026-10-06', '2027-03-01');
    expect(nextLessonOfSubject('pe', at('2026-10-05 12:00'), all, [summer])).toBeNull();
    expect(nextLessonOfSubject('nobody', at('2026-10-05 12:00'), all, [])).toBeNull();
    expect(nextLessonOfSubject('math', at('2026-10-05 12:00'), [], [])).toBeNull();
  });

  it('finds a lesson 120 days out but not 121', () => {
    const late = (from: string) => timetable({ validFrom: k(from), lessons: lessonsFrom({ 2: ['math'] }) });
    // 2027-02-02 is a Tuesday, 120 days after 2026-10-05.
    expect(nextLessonOfSubject('math', at('2026-10-05 09:00'), [late('2027-02-02')], [])?.date).toBe('2027-02-02');
    expect(nextLessonOfSubject('math', at('2026-10-04 09:00'), [late('2027-02-02')], [])).toBeNull();
  });

  it('only counts week B lessons in B weeks', () => {
    expect(nextLessonOfSubject('chem', at('2026-10-05 09:00'), [ab()], [])?.date).toBe('2026-10-14');
  });
});

describe('nextSchoolDay', () => {
  it('skips weekends and holidays', () => {
    expect(nextSchoolDay(k('2026-10-09'), schedule())).toBe('2026-10-12');
    expect(nextSchoolDay(k('2026-10-23'), schedule([timetable()], [autumn]))).toBe('2026-11-02');
    expect(nextSchoolDay(k('2026-10-23'), schedule([]))).toBeNull();
  });
});
