import { describe, expect, it } from 'vitest';
import { at, timetable as tt } from '@/test/fixtures';
import {
  currentLesson,
  defaultBells,
  formatHm,
  lessonsOnDate,
  nextBell,
  nextLesson,
  nextLessonOfSubject,
  nextSchoolDay,
  parseHm,
  toDateKey,
} from './schedule';

describe('time helpers', () => {
  it('parses and formats HH:mm', () => {
    expect(parseHm('08:05')).toBe(485);
    expect(parseHm('8.05')).toBe(485);
    expect(parseHm('24:00')).toBeNaN();
    expect(parseHm('nope')).toBeNaN();
    expect(formatHm(485)).toBe('08:05');
  });

  it('builds a default bell schedule with a long break after period 3', () => {
    const bells = defaultBells(4);
    expect(bells).toEqual([
      { start: '08:00', end: '08:45' },
      { start: '08:50', end: '09:35' },
      { start: '09:40', end: '10:25' },
      { start: '10:45', end: '11:30' },
    ]);
    expect(nextBell(bells)).toEqual({ start: '11:35', end: '12:20' });
  });
});

describe('lessons', () => {
  it('lists lessons for a date in period order', () => {
    const monday = lessonsOnDate(tt, at('2026-10-05T12:00'));
    expect(monday.map((l) => l.lesson.subjectId)).toEqual(['math', 'eng', 'bio', 'bio', 'pe']);
    expect(monday[0]?.start).toEqual(at('2026-10-05T08:00'));
  });

  it('has no lessons on weekends', () => {
    expect(lessonsOnDate(tt, at('2026-10-04T10:00'))).toEqual([]);
  });

  it('finds the current and next lesson', () => {
    const now = at('2026-10-05T09:00');
    expect(currentLesson(tt, now)?.lesson.subjectId).toBe('eng');
    expect(nextLesson(tt, now)?.lesson.subjectId).toBe('bio');
    expect(currentLesson(tt, at('2026-10-05T08:47'))).toBeNull(); // in a break
  });

  it('finds the next lesson of a subject strictly after now', () => {
    // Monday 08:10 — maths already started, next one is Tuesday period 2.
    const li = nextLessonOfSubject(tt, 'math', at('2026-10-05T08:10'));
    expect(li?.date).toBe('2026-10-06');
    expect(li?.lesson.period).toBe(1);
  });

  it('wraps over the weekend', () => {
    const li = nextLessonOfSubject(tt, 'bio', at('2026-10-09T12:00')); // Friday afternoon
    expect(li?.date).toBe('2026-10-12');
  });

  it('finds the next school day', () => {
    expect(toDateKey(nextSchoolDay(tt, at('2026-10-09T12:00')) as Date)).toBe('2026-10-12');
  });

  it('copes with no timetable', () => {
    expect(nextLesson(undefined, at('2026-10-05T09:00'))).toBeNull();
    expect(lessonsOnDate(undefined, at('2026-10-05T09:00'))).toEqual([]);
  });
});
