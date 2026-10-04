import { DEFAULT_SETTINGS } from './constants';
import { generateStudyPlan } from './studyPlan';
import { addDays, diffDays, mondayOf, toDateKey } from './time';
import type { AppData, DateKey, HHmm, ID, Lesson, Subject, Task, Test, Timetable, Weekday } from './types';

/**
 * Demo data: DESIGN's scenario (Thursday 8 October 2026, Week A, a teacher-training day on
 * Monday 5 October, autumn break 26–30 October), moved by whole weeks so it lands around `now`.
 * Deterministic for a given week, so screenshots and tests can rely on it.
 */
export function demoData(now: Date): Omit<AppData, 'attachments'> {
  const shift = Math.round(diffDays(mondayOf(toDateKey(now)), '2026-10-05' as DateKey) / 7) * 7;
  const d = (key: string) => addDays(key as DateKey, shift);
  const created = now.getTime();
  const stamp = { createdAt: created, updatedAt: created };
  const hm = (t: string) => t as HHmm;

  const names: [ID, string, number | null, string | null][] = [
    ['math', 'Mathematics', 235, 'Mr. Trajkovski'],
    ['eng', 'English', 5, null],
    ['chem', 'Chemistry', 190, null],
    ['bio', 'Biology', 160, 'Ms. Petrova'],
    ['ger', 'German', 300, null],
    ['hist', 'History', 35, null],
    ['geo', 'Geography', 125, null],
    ['pe', 'Physical Education', 75, null],
    ['art', 'Art', 335, null],
  ];
  const subjects: Subject[] = names.map(([id, name, hue, teacher]) => ({ id, name, short: null, hue, teacher, ...stamp }));

  const times = ['08:00', '08:50', '09:45', '10:35', '11:25', '12:15', '13:05'];
  const periods = times.map((start, i) => {
    const [h, m] = start.split(':').map(Number) as [number, number];
    const end = h * 60 + m + 45;
    return { id: `p${i + 1}`, label: null, start: hm(start), end: hm(`${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`) };
  });

  // Week A / Week B, one row per weekday: subject per period ('' = free, '+' = continues the lesson above).
  const weeks: Record<number, Partial<Record<Weekday, string[]>>> = {
    0: {
      1: ['math', 'eng', 'ger', 'hist', 'pe', '+'],
      2: ['ger', 'math', 'geo', 'eng', 'art', '+'],
      3: ['ger', 'bio', 'math', 'chem', 'hist'],
      4: ['math', 'eng', 'chem', '', 'bio', '+'],
      5: ['hist', 'geo', 'math', 'ger', 'eng'],
    },
    1: {
      1: ['math', 'ger', 'eng', 'geo', 'pe', '+'],
      2: ['eng', 'math', 'bio', 'ger', 'chem'],
      3: ['ger', 'bio', 'math', 'hist', 'art', '+'],
      4: ['math', 'chem', 'eng', 'geo', 'bio'],
      5: ['hist', 'eng', 'math', 'ger', ''],
    },
  };
  const lessons: Lesson[] = [];
  for (const [week, days] of Object.entries(weeks)) {
    for (const [day, row] of Object.entries(days)) {
      row?.forEach((subjectId, i) => {
        if (!subjectId || subjectId === '+') return;
        const span = row[i + 1] === '+' ? 2 : 1;
        lessons.push({
          id: `L${week}-${day}-${i + 1}`,
          subjectId,
          day: Number(day) as Weekday,
          week: Number(week),
          periodId: `p${i + 1}`,
          span,
          time: null,
          room: subjectId === 'chem' ? 'R12' : subjectId === 'math' ? 'R4' : subjectId === 'pe' ? 'Gym' : null,
        });
      });
    }
  }
  const timetable: Timetable = {
    id: 'autumn',
    name: 'Autumn term',
    validFrom: d('2026-09-01'),
    validTo: d('2027-01-31'),
    days: [1, 2, 3, 4, 5],
    periods,
    rotation: { weeks: 2, anchor: d('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: true },
    lessons,
    ...stamp,
  };

  const holidays = [
    { id: 'training', name: 'Teacher training', start: d('2026-10-05'), end: d('2026-10-05'), ...stamp },
    { id: 'autumn-break', name: 'Autumn break', start: d('2026-10-26'), end: d('2026-10-30'), ...stamp },
    { id: 'winter-break', name: 'Winter break', start: d('2026-12-24'), end: d('2027-01-06'), ...stamp },
  ];

  const at = (date: string, lessonId: ID | null, time: string | null) => ({ date: d(date), lessonId, time: time ? hm(time) : null });
  const base = { notes: '', subtasks: [], attachmentIds: [], reminders: null, estimateMin: null, doneAt: null, ...stamp };
  const bioTest: Test = {
    ...base,
    id: 'bio-test',
    kind: 'test',
    title: 'Bio test on cell division',
    subjectId: 'bio',
    due: at('2026-10-15', 'L1-4-5', '11:25'),
    topics: ['Mitosis', 'Meiosis', 'Cell cycle'],
    plan: null,
    result: null,
  };
  const tasks: Task[] = [
    { ...base, id: 'vocab', kind: 'homework', title: 'Vocab list 3', subjectId: 'ger', due: at('2026-10-07', 'L0-3-1', '08:00') },
    { ...base, id: 'worksheet', kind: 'homework', title: 'Worksheet p. 12', subjectId: 'bio', due: at('2026-10-08', 'L0-4-5', '11:25') },
    { ...base, id: 'ex-4-7', kind: 'homework', title: 'Ex. 4–7', subjectId: 'math', due: at('2026-10-09', 'L0-5-3', '09:45') },
    { ...base, id: 'geo-test', kind: 'test', title: '', subjectId: 'geo', due: at('2026-10-13', null, null), topics: [], plan: null, result: null },
    bioTest,
    { ...base, id: 'essay', kind: 'assignment', title: 'History essay', subjectId: 'hist', due: at('2026-10-16', 'L1-5-1', '08:00'), plan: null, estimateMin: 180 },
    {
      ...base,
      id: 'old-test',
      kind: 'test',
      title: 'Algebra',
      subjectId: 'math',
      due: at('2026-09-24', null, '08:00'),
      topics: [],
      plan: null,
      result: { grade: '5', score: 46, outOf: 50, note: '', recordedAt: created },
      doneAt: created,
    },
  ];
  // The Biology test comes with a study plan, made the way the app makes one.
  let n = 0;
  const planNow = new Date(new Date(now).setHours(12, 0, 0, 0));
  const plan = generateStudyPlan(bioTest, { now: planNow, study: DEFAULT_SETTINGS.study }, tasks, { newId: () => `plan-${++n}` });
  tasks[tasks.indexOf(bioTest)] = { ...bioTest, subtasks: plan.subtasks, plan: plan.plan };

  return {
    settings: { ...DEFAULT_SETTINGS, onboarded: true },
    subjects,
    timetables: [timetable],
    holidays,
    tasks,
  };
}

