import { describe, expect, it } from 'vitest';
import { assignColors, pickColor } from '@/domain/subjects';
import { holiday, k, lesson, schedule, subject, t, task, timetable } from '@/test/builders';
import {
  currentTimetable,
  dueFromView,
  newSubjectsFor,
  subjectView,
  taskFromInput,
  taskView,
  timetableFromDraft,
  timetableView,
  updatedTask,
  viewWeek,
  withKind,
} from './legacy';

const tt = timetable();
const s = schedule([tt]);

describe('v1 views of v2 data', () => {
  it('shows subjects with the nearest preset colour', () => {
    expect(subjectView(subject('a', 'Art', 125))).toEqual({ id: 'a', name: 'Art', color: 'lime', createdAt: 1 });
    expect(subjectView(subject('a', 'Art', null)).color).toBe('stone');
  });

  it('picks the timetable covering today, else the next, else the latest', () => {
    const a = timetable({ id: 'a', validFrom: k('2026-09-01'), validTo: k('2026-12-31') });
    const b = timetable({ id: 'b', validFrom: k('2027-02-01') });
    expect(currentTimetable([a, b], k('2026-10-05'))?.id).toBe('a');
    expect(currentTimetable([a, b], k('2027-01-15'))?.id).toBe('b');
    expect(currentTimetable([a], k('2027-01-15'))?.id).toBe('a');
    expect(currentTimetable([], k('2027-01-15'))).toBeUndefined();
  });

  it('shows one rotation week with bells by index, a double lesson in both periods', () => {
    const ab = timetable({
      rotation: { weeks: 2, anchor: k('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: true },
      lessons: [
        lesson({ subjectId: 'bio', day: 1, periodId: 'p3', span: 2, room: 'Lab' }),
        lesson({ subjectId: 'eng', day: 1, periodId: 'p1', week: 1 }),
        lesson({ subjectId: 'x', day: 1, periodId: 'gone' }),
      ],
    });
    expect(viewWeek(ab, [], k('2026-10-12'))).toBe(1);
    expect(viewWeek(ab, [holiday('Break', '2026-10-12', '2026-10-16')], k('2026-10-19'))).toBe(1);
    const view = timetableView(ab, 0);
    expect(view.bells[0]).toEqual({ start: '08:00', end: '08:45' });
    expect(view.lessons).toEqual([
      { day: 1, period: 2, subjectId: 'bio', room: 'Lab' },
      { day: 1, period: 3, subjectId: 'bio', room: 'Lab' },
    ]);
    expect(timetableView(ab, 1).lessons).toEqual([{ day: 1, period: 0, subjectId: 'eng' }]);
  });

  it('shows a task’s period from its lesson, else from its time', () => {
    const mathMonday = tt.lessons.find((l) => l.day === 1 && l.periodId === 'p6');
    expect(taskView(task({ due: { date: k('2026-10-05'), lessonId: mathMonday?.id ?? null, time: t('12:25') } }), [tt]).period).toBe(5);
    expect(taskView(task({ due: { date: k('2026-10-05'), lessonId: null, time: t('08:50') } }), [tt]).period).toBe(1);
    expect(taskView(task({ due: { date: k('2026-10-05'), lessonId: null, time: t('08:51') } }), [tt]).period).toBeNull();
    expect(taskView(task({ due: '2026-10-05' }), []).period).toBeNull();
  });
});

describe('v1 inputs to v2 data', () => {
  it('turns (date, period) into a lesson due, or the period’s time', () => {
    expect(dueFromView('2026-10-05', 0, s)).toMatchObject({ date: '2026-10-05', time: '08:00', lessonId: expect.any(String) });
    expect(dueFromView('2026-10-06', 5, s)).toEqual({ date: '2026-10-06', lessonId: null, time: '12:25' });
    expect(dueFromView('2026-10-05', null, s)).toEqual({ date: '2026-10-05', lessonId: null, time: null });
    expect(dueFromView('2026-10-10', 9, s)).toEqual({ date: '2026-10-10', lessonId: null, time: null });
    expect(() => dueFromView('soon', 0, s)).toThrow();
  });

  it('drops what a new kind doesn’t support (F-5)', () => {
    const test = task({ kind: 'test', due: '2026-10-05', topics: ['a'], plan: { generatedAt: 1, sessionMinutes: 25, sessions: 2 } } as never);
    const essay = withKind(test, 'assignment');
    expect(essay).toMatchObject({ kind: 'assignment', plan: { sessions: 2 } });
    expect('topics' in essay).toBe(false);
    expect(withKind(essay, 'homework')).not.toHaveProperty('plan');
    expect(withKind(task({ due: '2026-10-05' }), 'test')).toMatchObject({ topics: [], plan: null, result: null });
    expect(withKind(test, 'test')).toBe(test);
  });

  it('creates and updates tasks from v1 input', () => {
    const created = taskFromInput({ kind: 'assignment', title: ' Essay ', subjectId: null, due: '2026-10-05', period: null }, s, 5, 'id');
    expect(created).toMatchObject({ id: 'id', kind: 'assignment', title: 'Essay', plan: null, notes: '', createdAt: 5 });
    const same = updatedTask(created, { due: '2026-10-05', period: null }, s, 6);
    expect(same.due).toBe(created.due);
    expect(updatedTask(created, { subjectId: 'math', notes: 'n' }, s, 7)).toMatchObject({ subjectId: 'math', notes: 'n', updatedAt: 7 });
    expect(updatedTask(created, { period: 0 }, s, 8).due).toMatchObject({ date: '2026-10-05', time: '08:00' });
  });

  it('creates new subjects for a draft with the next free hues, matching the editor preview', () => {
    const existing = [subject('m', 'Math', 5)];
    const made = newSubjectsFor(['math', 'Biology', ' ', 'biology', 'Chemistry'], existing, 1, () => 'n');
    expect(made.map((x) => [x.name, x.hue])).toEqual([
      ['Biology', 35],
      ['Chemistry', 75],
    ]);
    const preview = assignColors(['Math', 'Biology', 'Chemistry'], [{ name: 'Math', color: 'rose' }]);
    expect([...preview.values()]).toEqual(['rose', 'coral', 'amber']);
    expect(pickColor([{ color: 'rose' }, { color: 'stone' }])).toBe('coral');
  });

  it('saves a draft into a timetable, keeping ids by slot and other weeks’ lessons', () => {
    const ab = timetable({
      rotation: { weeks: 2, anchor: k('2026-10-05'), anchorIndex: 0, skipHolidayWeeks: false },
      lessons: [
        lesson({ id: 'keep-me', subjectId: 'math', day: 1, periodId: 'p1', time: { start: t('07:55'), end: t('08:40') } }),
        lesson({ id: 'other-week', subjectId: 'eng', day: 1, periodId: 'p1', week: 1 }),
        lesson({ id: 'gone', subjectId: 'bio', day: 2, periodId: 'p1' }),
      ],
    });
    const subjects = [subject('math', 'Mathematics'), subject('eng', 'English'), subject('chem', 'Chemistry')];
    const draft = {
      days: [2, 1] as never,
      bells: ab.periods.slice(0, 2).map((p) => ({ start: p.start, end: p.end })),
      cells: [
        { day: 1 as const, period: 0, subject: 'mathematics' },
        { day: 1 as const, period: 0, subject: 'Chemistry' },
        { day: 2 as const, period: 1, subject: 'Chemistry', room: ' R1 ' },
        { day: 2 as const, period: 5, subject: 'English' },
        { day: 3 as const, period: 0, subject: 'English' },
        { day: 2 as const, period: 0, subject: 'Unknown' },
      ],
    };
    const out = timetableFromDraft(draft, ab, { subjects, others: [], week: 0, today: k('2026-10-07'), now: 9, newId: () => 'new' });
    expect(out.id).toBe(ab.id);
    expect(out.days).toEqual([1, 2]);
    expect(out.periods.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(out.lessons.map((l) => [l.id, l.subjectId, l.day, l.periodId, l.week, l.room])).toEqual([
      ['other-week', 'eng', 1, 'p1', 1, null],
      ['keep-me', 'math', 1, 'p1', 0, null],
      ['new', 'chem', 2, 'p2', 0, 'R1'],
    ]);
    expect(out.lessons.find((l) => l.id === 'keep-me')?.time).toEqual({ start: '07:55', end: '08:40' });
    expect(out.updatedAt).toBe(9);
  });

  it('starts a first timetable on Monday of this week, named and open-ended', () => {
    const out = timetableFromDraft({ days: [1], bells: [], cells: [] }, undefined, {
      subjects: [],
      others: [timetable({ name: 'Timetable' })],
      week: 0,
      today: k('2026-10-07'),
      now: 1,
      newId: () => 'id',
    });
    expect(out).toMatchObject({ validFrom: '2026-10-05', validTo: null, name: 'Timetable 2', rotation: { weeks: 1, anchor: '2026-10-05' } });
    expect(out.periods).toHaveLength(1);
  });
});
