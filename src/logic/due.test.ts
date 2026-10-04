import { describe, expect, it } from 'vitest';
import { at, holiday, k, lesson, schedule, t, task, timetable } from '@/test/builders';
import { dueAtLesson, dueMoment, dueOn, isDone, isOverdue, isWritten, occurrenceOfTask } from './due';
import { occurrencesOn } from './schedule';

const tt = timetable();
const s = schedule([tt]);
const mondayMath = tt.lessons.find((l) => l.day === 1 && l.periodId === 'p1');
if (!mondayMath) throw new Error('fixture');

describe('dueOn', () => {
  it('attaches to the subject’s first lesson that day, with a time snapshot', () => {
    expect(dueOn(k('2026-10-05'), 'math', s)).toEqual({ date: '2026-10-05', lessonId: mondayMath.id, time: '08:00' });
  });
  it('lets an explicit time win and clears the lesson (R-6)', () => {
    expect(dueOn(k('2026-10-05'), 'math', s, t('10:00'))).toEqual({ date: '2026-10-05', lessonId: null, time: '10:00' });
  });
  it('falls back to end of day without a lesson or subject', () => {
    expect(dueOn(k('2026-10-10'), 'math', s)).toEqual({ date: '2026-10-10', lessonId: null, time: null });
    expect(dueOn(k('2026-10-05'), null, s)).toEqual({ date: '2026-10-05', lessonId: null, time: null });
  });
  it('snapshots any occurrence', () => {
    const [occ] = occurrencesOn(k('2026-10-06'), s);
    expect(dueAtLesson(occ as never)).toEqual({ date: '2026-10-06', lessonId: occ?.lesson.id, time: '08:00' });
  });
});

describe('dueMoment (R-6)', () => {
  it('is the lesson’s start when the lesson happens on that date', () => {
    const hw = task({ due: { date: k('2026-10-05'), lessonId: mondayMath.id, time: t('07:00') } });
    expect(dueMoment(hw, s)).toEqual(at('2026-10-05 08:00'));
  });
  it('follows a bell-time change through the lesson link', () => {
    const moved = timetable({ periods: tt.periods.map((p, i) => (i === 0 ? { ...p, start: t('07:45') } : p)), lessons: tt.lessons });
    const hw = task({ due: { date: k('2026-10-05'), lessonId: mondayMath.id, time: t('08:00') } });
    expect(dueMoment(hw, schedule([moved]))).toEqual(at('2026-10-05 07:45'));
  });
  it('falls back to the snapshot when the lesson no longer happens that day', () => {
    const hw = task({ due: { date: k('2026-10-05'), lessonId: mondayMath.id, time: t('08:00') } });
    expect(dueMoment(hw, schedule([tt], [holiday('Day off', '2026-10-05')]))).toEqual(at('2026-10-05 08:00'));
    expect(dueMoment(hw, schedule([timetable({ lessons: [] })]))).toEqual(at('2026-10-05 08:00'));
  });
  it('is 23:59 without lesson or time', () => {
    expect(dueMoment(task({ due: '2026-10-05' }), s)).toEqual(at('2026-10-05 23:59'));
    expect(dueMoment(task({ due: { date: k('2026-10-05'), lessonId: 'gone', time: null } }), s)).toEqual(
      at('2026-10-05 23:59'),
    );
  });
});

describe('overdue and written (F-5, D-022)', () => {
  const now = at('2026-10-06 09:00');
  it('makes homework and assignments overdue once their moment passes', () => {
    expect(isOverdue(task({ due: '2026-10-05' }), now, s)).toBe(true);
    expect(isOverdue(task({ kind: 'assignment', due: '2026-10-05' }), now, s)).toBe(true);
    expect(isOverdue(task({ due: '2026-10-06' }), now, s)).toBe(false);
    expect(isOverdue(task({ due: '2026-10-05', doneAt: 1 }), now, s)).toBe(false);
  });
  it('never makes a test overdue: it is written instead', () => {
    const test = task({ kind: 'test', due: '2026-10-05' });
    expect(isOverdue(test, now, s)).toBe(false);
    expect(isWritten(test, now, s)).toBe(true);
    expect(isWritten({ ...test, doneAt: 5 }, now, s)).toBe(false);
    expect(isWritten(task({ due: '2026-10-05' }), now, s)).toBe(false);
    expect(isWritten(task({ kind: 'test', due: '2026-10-07' }), now, s)).toBe(false);
  });
  it('counts a task due at a lesson as overdue from the lesson’s start', () => {
    const hw = task({ due: { date: k('2026-10-06'), lessonId: tt.lessons.find((l) => l.day === 2)?.id ?? null, time: null } });
    expect(isOverdue(hw, at('2026-10-06 07:59'), s)).toBe(false);
    expect(isOverdue(hw, at('2026-10-06 08:01'), s)).toBe(true);
    expect(isDone(hw)).toBe(false);
  });
});

describe('occurrenceOfTask (R-7)', () => {
  const twice = timetable({
    lessons: [
      lesson({ id: 'm1', subjectId: 'math', day: 1, periodId: 'p1' }),
      lesson({ id: 'e2', subjectId: 'eng', day: 1, periodId: 'p2' }),
      lesson({ id: 'm5', subjectId: 'math', day: 1, periodId: 'p5' }),
    ],
  });
  const s2 = schedule([twice]);
  const on = (time: string | null, lessonId: string | null = null) =>
    occurrenceOfTask({ subjectId: 'math', due: { date: k('2026-10-05'), lessonId, time: time ? t(time) : null } }, s2)?.lesson.id;

  it('uses its own lesson when that resolves', () => {
    expect(on(null, 'm5')).toBe('m5');
  });
  it('without a time, picks the subject’s first lesson that day', () => {
    expect(on(null)).toBe('m1');
    expect(on(null, 'gone')).toBe('m1');
  });
  it('with a time, picks the lesson containing it, else the last one before, else the first', () => {
    expect(on('11:40')).toBe('m5');
    expect(on('10:00')).toBe('m1');
    expect(on('07:00')).toBe('m1');
    expect(on('13:00')).toBe('m5');
  });
  it('belongs nowhere without a subject lesson that day', () => {
    expect(occurrenceOfTask({ subjectId: null, due: { date: k('2026-10-05'), lessonId: null, time: null } }, s2)).toBeNull();
    expect(occurrenceOfTask({ subjectId: 'bio', due: { date: k('2026-10-05'), lessonId: null, time: null } }, s2)).toBeNull();
  });
});
