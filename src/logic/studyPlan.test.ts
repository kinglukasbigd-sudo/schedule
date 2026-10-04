import { describe, expect, it } from 'vitest';
import { at, k, task } from '@/test/builders';
import { inZone } from '@/test/zones';
import { englishSessionTitle, generateStudyPlan, replan, studyWindow, type FreeSlots } from './studyPlan';
import type { Assignment, Subtask, Test } from './types';

const now = at('2026-10-05 15:00'); // Monday
const study = { maxMinutesPerDay: 90, sessionMinutes: 25 as const, weekends: true };
const slots: FreeSlots = { now, study };
let n = 0;
const ids = { newId: () => `s${++n}` };

const testDue = (date: string, extra: Partial<Test> = {}) => task({ kind: 'test', due: date, ...extra }) as Test;
const plan = (t: Test | Assignment, s: Partial<FreeSlots> = {}, others = [] as Parameters<typeof generateStudyPlan>[2]) =>
  generateStudyPlan(t, { ...slots, ...s }, others, ids);
const summary = (steps: Subtask[]) => steps.map((s) => `${s.plannedFor} ${s.title}`);

describe('studyWindow', () => {
  it('runs from today or two weeks before, to the day before, minus weekends if off', () => {
    expect(studyWindow(k('2026-10-23'), k('2026-10-05'), true)).toHaveLength(14);
    expect(studyWindow(k('2026-10-09'), k('2026-10-05'), true)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(studyWindow(k('2026-10-13'), k('2026-10-05'), false)).not.toContain('2026-10-10');
    expect(studyWindow(k('2026-10-05'), k('2026-10-05'), true)).toEqual([]);
  });
});

describe('generateStudyPlan (R-11)', () => {
  it('spaces sessions back from the due date at expanding intervals', () => {
    const { subtasks, plan: p } = plan(testDue('2026-10-23'));
    // 120 min / 25 → 5 sessions at 1, 2, 4, 7 and 11 days before.
    expect(summary(subtasks)).toEqual([
      '2026-10-12 Study 1/5',
      '2026-10-16 Study 2/5',
      '2026-10-19 Study 3/5',
      '2026-10-21 Study 4/5',
      '2026-10-22 Full review',
    ]);
    expect(subtasks.every((s) => s.minutes === 25 && s.origin === 'plan' && !s.done)).toBe(true);
    expect(p).toEqual({ generatedAt: now.getTime(), sessionMinutes: 25, sessions: 5 });
  });

  it('titles sessions round-robin from the topics, the last is always a full review', () => {
    const { subtasks } = plan(testDue('2026-10-23', { topics: ['Mitosis', ' ', 'Meiosis'] }));
    expect(subtasks.map((s) => s.title)).toEqual(['Study: Mitosis', 'Study: Meiosis', 'Study: Mitosis', 'Study: Meiosis', 'Full review']);
  });

  it('names assignment sessions as work', () => {
    const essay = task({ kind: 'assignment', title: 'History essay', due: '2026-10-23', estimateMin: 75 }) as Assignment;
    expect(plan(essay).subtasks.map((s) => s.title)).toEqual(['Work on History essay 1/3', 'Work on History essay 2/3', 'Finish & check']);
  });

  it('moves a session off a full day to its least-loaded free neighbour', () => {
    // 80 min of homework due on the 22nd lands on the 21st; 80 + 25 > 90.
    const busy = [task({ due: '2026-10-22', estimateMin: 80 })];
    const { subtasks } = plan(testDue('2026-10-23'), {}, busy);
    expect(subtasks.map((s) => s.plannedFor)).toEqual(['2026-10-12', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-22']);
  });

  it('keeps the target when no neighbour has room', () => {
    const busy = ['2026-10-21', '2026-10-22', '2026-10-23'].map((d) => task({ due: d, estimateMin: 80 }));
    const { subtasks } = plan(testDue('2026-10-23', { estimateMin: 25 }), {}, busy);
    expect(subtasks.map((s) => s.plannedFor)).toEqual(['2026-10-22']);
  });

  it('skips weekends when the student doesn’t study then', () => {
    const { subtasks } = plan(testDue('2026-10-19'), { study: { ...study, weekends: false } });
    expect(subtasks.every((s) => ![6, 7].includes(new Date(`${s.plannedFor}T12:00`).getDay() || 7))).toBe(true);
    expect(subtasks).toHaveLength(5);
  });

  it('respects a chosen count and length, within the window and the 12-session cap', () => {
    expect(plan(testDue('2026-10-23'), { sessions: 2, sessionMinutes: 60 }).subtasks.map((s) => [s.plannedFor, s.minutes])).toEqual([
      ['2026-10-21', 60],
      ['2026-10-22', 60],
    ]);
    expect(plan(testDue('2026-10-09'), { sessions: 10 }).subtasks).toHaveLength(4);
    expect(plan(testDue('2026-10-23'), { sessions: 40 }).subtasks).toHaveLength(12);
    expect(plan(testDue('2026-10-23'), { sessions: 0 }).subtasks).toHaveLength(1);
  });

  it('plans one quick review today when it’s too late for spacing (E-40)', () => {
    expect(summary(plan(testDue('2026-10-06')).subtasks)).toEqual(['2026-10-05 Quick review']);
    expect(summary(plan(testDue('2026-10-05')).subtasks)).toEqual(['2026-10-05 Quick review']);
    // Saturday, no weekend studying, test on Monday: the window is empty.
    const saturday = at('2026-10-10 10:00');
    expect(summary(plan(testDue('2026-10-12'), { now: saturday, study: { ...study, weekends: false } }).subtasks)).toEqual([
      '2026-10-10 Quick review',
    ]);
  });

  it('plans nothing for a date that has passed', () => {
    expect(plan(testDue('2026-10-01'))).toEqual({ subtasks: [], plan: { generatedAt: now.getTime(), sessionMinutes: 25, sessions: 0 } });
  });

  it('ignores the task’s own load and is deterministic', () => {
    const own = testDue('2026-10-23');
    const others = [task({ due: '2026-10-22', estimateMin: 80 }), own];
    const a = plan(own, {}, others).subtasks.map((s) => s.plannedFor);
    const b = plan(own, {}, [...others].reverse()).subtasks.map((s) => s.plannedFor);
    expect(a).toEqual(b);
    expect(a).toContain('2026-10-20');
  });

  it('crosses the year boundary', () => {
    const { subtasks } = plan(testDue('2027-01-05'), { now: at('2026-12-20 12:00') });
    expect(subtasks.map((s) => s.plannedFor)).toEqual(['2026-12-25', '2026-12-29', '2027-01-01', '2027-01-03', '2027-01-04']);
  });

  it('uses the stored session length when there is one', () => {
    const t = testDue('2026-10-23', { plan: { generatedAt: 1, sessionMinutes: 45, sessions: 3 } });
    expect(plan(t).subtasks[0]?.minutes).toBe(45);
  });

  it('formats every title type in English', () => {
    expect(englishSessionTitle({ type: 'quick-review' })).toBe('Quick review');
  });
});

describe('plans across a DST change', () => {
  inZone('Europe/Berlin');
  it('counts calendar days, not 24-hour blocks', () => {
    const { subtasks } = generateStudyPlan(testDue('2026-10-27'), { now: at('2026-10-20 18:00'), study }, [], ids);
    expect(subtasks.map((s) => s.plannedFor)).toEqual(['2026-10-20', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26']);
  });
});

describe('replan (R-11.6)', () => {
  it('keeps finished sessions and own steps, replacing only unfinished planned ones', () => {
    const first = plan(testDue('2026-10-23'));
    const done = first.subtasks.map((s, i) => (i === 0 ? { ...s, done: true } : s));
    const own: Subtask = { id: 'mine', title: 'Ask about chapter 3', done: false, plannedFor: null, minutes: null, origin: 'user' };
    const t = testDue('2026-10-23', { subtasks: [...done, own], plan: first.plan });
    const later = at('2026-10-14 16:00');
    const again = replan(t, { now: later, study }, [], ids);
    expect(again.subtasks.filter((s) => s.done).map((s) => s.plannedFor)).toEqual(['2026-10-12']);
    expect(again.subtasks).toContainEqual(own);
    const fresh = again.subtasks.filter((s) => s.origin === 'plan' && !s.done);
    expect(fresh).toHaveLength(4);
    expect(fresh.every((s) => (s.plannedFor as string) >= '2026-10-14')).toBe(true);
    expect(again.plan).toMatchObject({ sessions: 5, sessionMinutes: 25 });
  });

  it('plans from scratch when nothing was stored', () => {
    expect(replan(testDue('2026-10-23'), slots, [], ids).subtasks).toHaveLength(5);
  });
});
