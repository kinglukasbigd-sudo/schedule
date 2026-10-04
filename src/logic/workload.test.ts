import { describe, expect, it } from 'vitest';
import { at, k, schedule, t, task, timetable } from '@/test/builders';
import { allocateLoad, estimateOf, loadLevel, needsWork, workloadScore, type LoadOptions } from './workload';
import type { Subtask } from './types';

const now = at('2026-10-05 15:00'); // Monday
const opts = { now, maxMinutesPerDay: 90 };
const minutesByDate = (tasks: Parameters<typeof allocateLoad>[0], o: LoadOptions = opts) =>
  Object.fromEntries([...allocateLoad(tasks, o)].map(([d, v]) => [d, v.minutes]));

const step = (partial: Partial<Subtask>): Subtask => ({
  id: 's',
  title: 'Study',
  done: false,
  plannedFor: null,
  minutes: null,
  origin: 'plan',
  ...partial,
});

describe('loadLevel', () => {
  it('is 0 for nothing, 1–3 below the cap and 4 at or above it', () => {
    expect([0, 1, 29, 30, 59, 60, 89, 90, 500].map((m) => loadLevel(m, 90))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(loadLevel(-5, 90)).toBe(0);
    expect(loadLevel(10, 0)).toBe(4); // a zero cap never divides by zero
  });
});

describe('allocateLoad (R-10)', () => {
  it('puts homework on the evening before it is due', () => {
    expect(minutesByDate([task({ due: '2026-10-07' })])).toEqual({ '2026-10-06': 30 });
  });

  it('puts homework due today, or overdue, on today', () => {
    expect(minutesByDate([task({ due: '2026-10-05' })])).toEqual({ '2026-10-05': 30 });
    expect(minutesByDate([task({ due: '2026-09-30' })])).toEqual({ '2026-10-05': 30 });
  });

  it('spreads unplanned tests over their lead days plus one', () => {
    expect(minutesByDate([task({ kind: 'test', due: '2026-10-09' })])).toEqual({
      '2026-10-06': 40,
      '2026-10-07': 40,
      '2026-10-08': 40,
    });
    expect(minutesByDate([task({ kind: 'assignment', due: '2026-10-12' })])).toEqual({
      '2026-10-08': 60,
      '2026-10-09': 60,
      '2026-10-10': 60,
      '2026-10-11': 60,
    });
  });

  it('only uses days from today on, and today when none are left', () => {
    expect(minutesByDate([task({ kind: 'test', due: '2026-10-07' })])).toEqual({ '2026-10-05': 60, '2026-10-06': 60 });
    expect(minutesByDate([task({ kind: 'test', due: '2026-10-06', estimateMin: 45 })])).toEqual({ '2026-10-05': 45 });
    expect(minutesByDate([task({ kind: 'assignment', due: '2026-10-01' })])).toEqual({ '2026-10-05': 240 });
  });

  it('splits uneven minutes with the leftover nearest the due date', () => {
    expect(minutesByDate([task({ kind: 'test', due: '2026-10-09', estimateMin: 100 })])).toEqual({
      '2026-10-06': 33,
      '2026-10-07': 33,
      '2026-10-08': 34,
    });
  });

  it('counts planned steps on their day, missed ones today, done ones not at all', () => {
    const planned = task({
      kind: 'test',
      due: '2026-10-16',
      estimateMin: 120,
      subtasks: [
        step({ id: 'a', plannedFor: k('2026-10-01'), minutes: 25 }), // missed → today
        step({ id: 'b', plannedFor: k('2026-10-08'), minutes: 25 }),
        step({ id: 'c', plannedFor: k('2026-10-03'), minutes: 25, done: true }),
        step({ id: 'd', plannedFor: null, minutes: null, origin: 'user' }),
      ],
    });
    // 120 − 75 planned = 45 left, spread over 13–15 Oct.
    expect(minutesByDate([planned])).toEqual({
      '2026-10-05': 25,
      '2026-10-08': 25,
      '2026-10-13': 15,
      '2026-10-14': 15,
      '2026-10-15': 15,
    });
  });

  it('adds nothing more when the plan covers the estimate', () => {
    const covered = task({
      kind: 'test',
      due: '2026-10-16',
      estimateMin: 50,
      subtasks: [step({ id: 'a', plannedFor: k('2026-10-12'), minutes: 25 }), step({ id: 'b', plannedFor: k('2026-10-14'), minutes: 25 })],
    });
    expect(minutesByDate([covered])).toEqual({ '2026-10-12': 25, '2026-10-14': 25 });
  });

  it('ignores done tasks and tests that were already written', () => {
    expect(minutesByDate([task({ due: '2026-10-07', doneAt: 1 })])).toEqual({});
    expect(minutesByDate([task({ kind: 'test', due: '2026-10-02', estimateMin: 60 })])).toEqual({});
    const tt = timetable();
    const s = schedule([tt]);
    const morningTest = task({
      kind: 'test',
      due: { date: k('2026-10-05'), lessonId: tt.lessons[0]?.id ?? null, time: t('08:00') },
    });
    expect(needsWork(morningTest, now, s)).toBe(false);
    expect(needsWork(morningTest, at('2026-10-05 07:00'), s)).toBe(true);
    expect(minutesByDate([morningTest], { ...opts, schedule: s })).toEqual({});
  });

  it('uses the estimate when set, else the default for the kind', () => {
    expect(estimateOf({ kind: 'homework', estimateMin: null })).toBe(30);
    expect(estimateOf({ kind: 'test', estimateMin: 15 })).toBe(15);
  });
});

describe('workloadScore', () => {
  const tasks = [
    task({ due: '2026-10-07' }),
    task({ due: '2026-10-07', estimateMin: 45 }),
    task({ kind: 'test', due: '2026-10-09' }),
  ];

  it('scores each day of the week, Monday first by default', () => {
    const week = workloadScore(k('2026-10-07'), tasks, opts);
    expect(week.map((d) => d.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(week[1]).toEqual({ date: '2026-10-06', minutes: 115, count: 3, level: 4, testDue: false });
    expect(week[2]).toMatchObject({ minutes: 40, count: 1, level: 2 });
    expect(week[4]).toMatchObject({ minutes: 0, level: 0, testDue: true });
  });

  it('starts the week on Sunday when asked', () => {
    const week = workloadScore(k('2026-10-07'), tasks, { ...opts, weekStartsOn: 0 });
    expect(week[0]?.date).toBe('2026-10-04');
    expect(week[6]?.date).toBe('2026-10-10');
  });

  it('scores an explicit list of dates, with past days empty', () => {
    const days = workloadScore([k('2026-10-01'), k('2026-10-06')], tasks, opts);
    expect(days.map((d) => d.minutes)).toEqual([0, 115]);
  });

  it('is empty for no tasks', () => {
    expect(workloadScore(k('2026-10-05'), [], opts).every((d) => d.minutes === 0 && !d.testDue)).toBe(true);
  });
});
