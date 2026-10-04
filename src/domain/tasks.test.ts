import { describe, expect, it } from 'vitest';
import { at, task, timetable as tt } from '@/test/fixtures';
import { bucketOf, comingUp, dueAt, groupOpenTasks, isOverdue, rankNextUp, tasksForLesson } from './tasks';

const now = at('2026-10-05T15:00'); // Monday afternoon

describe('dueAt', () => {
  it('is the lesson start when a period is set', () => {
    expect(dueAt(task({ due: '2026-10-06', period: 1 }), tt)).toEqual(at('2026-10-06T08:50'));
  });
  it('is the end of the day otherwise', () => {
    expect(dueAt(task({ due: '2026-10-06' }), tt)).toEqual(at('2026-10-06T23:59'));
  });
});

describe('overdue', () => {
  it('is overdue once the due moment has passed', () => {
    expect(isOverdue(task({ due: '2026-10-05', period: 0 }), tt, now)).toBe(true);
    expect(isOverdue(task({ due: '2026-10-05' }), tt, now)).toBe(false);
    expect(isOverdue(task({ due: '2026-10-01', doneAt: 1 }), tt, now)).toBe(false);
  });
});

describe('rankNextUp', () => {
  it('puts overdue first, then by effective date with lead time for tests', () => {
    const hwTomorrow = task({ due: '2026-10-06', period: 1, title: 'hw' });
    const testWed = task({ due: '2026-10-07', period: 0, kind: 'test', title: 'test' });
    const overdue = task({ due: '2026-10-02', title: 'late' });
    const essayLater = task({ due: '2026-10-16', kind: 'assignment', title: 'essay' });
    const done = task({ due: '2026-10-05', doneAt: 1, title: 'done' });
    const ranked = rankNextUp([hwTomorrow, essayLater, testWed, overdue, done], tt, now).map((t) => t.title);
    // Test on Wednesday 08:00 minus 2 days = Monday 08:00, ahead of homework due Tuesday.
    expect(ranked).toEqual(['late', 'test', 'hw', 'essay']);
  });

  it('breaks ties by kind (tests first)', () => {
    const hw = task({ due: '2026-10-08', period: 0, kind: 'homework', title: 'hw' });
    const test = task({ due: '2026-10-08', period: 0, kind: 'test', title: 'test' });
    expect(rankNextUp([hw, test], tt, now).map((t) => t.title)).toEqual(['test', 'hw']);
  });
});

describe('grouping', () => {
  it('buckets by day distance', () => {
    expect(bucketOf(task({ due: '2026-10-05' }), tt, now)).toBe('today');
    expect(bucketOf(task({ due: '2026-10-06' }), tt, now)).toBe('tomorrow');
    expect(bucketOf(task({ due: '2026-10-09' }), tt, now)).toBe('week');
    expect(bucketOf(task({ due: '2026-10-20' }), tt, now)).toBe('later');
    expect(bucketOf(task({ due: '2026-10-01' }), tt, now)).toBe('overdue');
  });

  it('only returns non-empty groups in order', () => {
    const groups = groupOpenTasks([task({ due: '2026-10-20' }), task({ due: '2026-10-01' })], tt, now);
    expect(groups.map((g) => g.bucket)).toEqual(['overdue', 'later']);
  });
});

describe('lesson attachment', () => {
  it('attaches period-less tasks to the first lesson of the subject that day', () => {
    const t1 = task({ due: '2026-10-05', subjectId: 'bio' });
    expect(tasksForLesson([t1], '2026-10-05', 'bio', 2, 2)).toHaveLength(1);
    expect(tasksForLesson([t1], '2026-10-05', 'bio', 3, 2)).toHaveLength(0);
  });
});

describe('comingUp', () => {
  it('lists tests and assignments in the next two weeks, not homework or today', () => {
    const items = [
      task({ due: '2026-10-05', kind: 'test', title: 'today' }),
      task({ due: '2026-10-08', kind: 'test', title: 'thu' }),
      task({ due: '2026-10-07', kind: 'homework', title: 'hw' }),
      task({ due: '2026-10-30', kind: 'assignment', title: 'far' }),
      task({ due: '2026-10-12', kind: 'assignment', title: 'mon' }),
    ];
    expect(comingUp(items, now).map((t) => t.title)).toEqual(['thu', 'mon']);
  });
});
