import { describe, expect, it } from 'vitest';
import { demoData } from './demo';
import { isOverdue } from './due';
import { occurrencesOn, resolveWeekType } from './schedule';
import { toDateKey } from './time';
import { checkInvariants } from './validate';
import type { DateKey } from './types';

describe('demoData', () => {
  const thursday = new Date(2026, 9, 8, 9, 50);
  const data = demoData(thursday);
  const schedule = { timetables: data.timetables, holidays: data.holidays };

  it('is consistent data', () => {
    expect(checkInvariants({ ...data, attachments: [] })).toEqual([]);
    expect(data.settings.onboarded).toBe(true);
  });

  it('is DESIGN’s scenario on Thursday 8 October 2026 (D-032)', () => {
    const today = toDateKey(thursday);
    expect(resolveWeekType(today, data.timetables[0] as never, data.holidays).label).toBe('A');
    expect(occurrencesOn(today, schedule).map((o) => `${o.startTime} ${o.lesson.subjectId}`)).toEqual([
      '08:00 math',
      '08:50 eng',
      '09:45 chem',
      '11:25 bio',
    ]);
    expect(occurrencesOn('2026-10-05' as DateKey, schedule)).toEqual([]); // teacher training
    expect(occurrencesOn('2026-10-27' as DateKey, schedule)).toEqual([]); // autumn break
    const vocab = data.tasks.find((t) => t.id === 'vocab');
    expect(vocab && isOverdue(vocab, thursday, schedule)).toBe(true);
    const bio = data.tasks.find((t) => t.id === 'bio-test');
    expect(bio?.subtasks.length).toBeGreaterThan(0);
    expect(bio?.subtasks.every((s) => s.origin === 'plan' && (s.plannedFor as string) < '2026-10-15')).toBe(true);
  });

  it('moves by whole weeks, keeping weekdays and Week A', () => {
    const later = demoData(new Date(2027, 2, 4, 10, 0)); // a Thursday 21 weeks later
    expect(later.holidays[0]?.start).toBe('2027-03-01');
    expect(later.tasks.find((t) => t.id === 'worksheet')?.due.date).toBe('2027-03-04');
    expect(resolveWeekType('2027-03-04' as DateKey, later.timetables[0] as never, later.holidays).label).toBe('A');
    expect(checkInvariants({ ...later, attachments: [] })).toEqual([]);
  });
});
