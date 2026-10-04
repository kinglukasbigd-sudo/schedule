import { describe, expect, it } from 'vitest';
import { DST_ZONES, inZone } from '@/test/zones';
import {
  addDays,
  atTime,
  dateKey,
  dateOf,
  dateRange,
  diffDays,
  hhmm,
  isDateKey,
  isHHmm,
  maxKey,
  minKey,
  minutesOf,
  mondayOf,
  timeOf,
  toDateKey,
  toHHmm,
  weekOf,
  weekStart,
  weekdayOf,
} from './time';

const k = dateKey;

describe('date keys', () => {
  it('validates real calendar dates only', () => {
    expect(isDateKey('2026-10-05')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2027-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-5')).toBe(false);
    expect(isDateKey('')).toBe(false);
    expect(isDateKey(20261005)).toBe(false);
    expect(() => dateKey('31.10.2026')).toThrow(RangeError);
  });

  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays(k('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(k('2027-01-01'), -1)).toBe('2026-12-31');
    expect(addDays(k('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(k('2027-02-28'), 1)).toBe('2027-03-01');
    expect(diffDays(k('2027-01-03'), k('2026-12-28'))).toBe(6);
    expect(diffDays(k('2026-12-28'), k('2027-01-03'))).toBe(-6);
  });

  it('knows ISO weekdays and Monday weeks, including ISO week 53 of 2026', () => {
    expect(weekdayOf(k('2026-10-05'))).toBe(1);
    expect(weekdayOf(k('2026-10-04'))).toBe(7);
    expect(mondayOf(k('2027-01-03'))).toBe('2026-12-28');
    expect(mondayOf(k('2026-12-28'))).toBe('2026-12-28');
  });

  it('starts weeks on Monday by default and on Sunday when asked', () => {
    const sunday = k('2026-10-04');
    expect(weekStart(sunday)).toBe('2026-09-28');
    expect(weekStart(sunday, 0)).toBe('2026-10-04');
    expect(weekStart(k('2026-10-05'), 0)).toBe('2026-10-04');
    expect(weekStart(k('2026-10-10'), 0)).toBe('2026-10-04');
    expect(weekOf(sunday)).toEqual(dateRange(k('2026-09-28'), k('2026-10-04')));
    expect(weekOf(sunday, 0)).toEqual(dateRange(k('2026-10-04'), k('2026-10-10')));
  });

  it('builds ranges and compares keys', () => {
    expect(dateRange(k('2026-10-30'), k('2026-11-02'))).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(dateRange(k('2026-10-02'), k('2026-10-01'))).toEqual([]);
    expect(minKey(k('2026-10-02'), k('2026-10-01'))).toBe('2026-10-01');
    expect(maxKey(k('2026-10-02'), k('2026-10-01'))).toBe('2026-10-02');
  });
});

describe('times', () => {
  it('validates and converts wall-clock times', () => {
    expect(isHHmm('00:00')).toBe(true);
    expect(isHHmm('23:59')).toBe(true);
    expect(isHHmm('24:00')).toBe(false);
    expect(isHHmm('8:00')).toBe(false);
    expect(minutesOf(hhmm('08:05'))).toBe(485);
    expect(toHHmm(485)).toBe('08:05');
    // Clamped to the day.
    expect(toHHmm(-5)).toBe('00:00');
    expect(toHHmm(24 * 60 + 30)).toBe('23:59');
    expect(() => hhmm('25:00')).toThrow(RangeError);
    expect(() => minutesOf('8' as never)).toThrow(RangeError);
  });
});

describe.each(DST_ZONES)('DST-safe calendar arithmetic in %s', (zone) => {
  inZone(zone);

  it('adds days across both transitions without drifting an hour', () => {
    for (const start of ['2026-03-07', '2026-03-28', '2026-04-04', '2026-10-03', '2026-10-24', '2026-10-31']) {
      const key = k(start);
      for (let i = -3; i <= 3; i++) {
        const next = addDays(key, i);
        expect(diffDays(next, key)).toBe(i);
        expect(toDateKey(dateOf(next))).toBe(next);
      }
    }
  });

  it('round-trips every minute of a day through atTime', () => {
    const day = k('2026-06-15');
    for (let m = 0; m < 24 * 60; m += 7) expect(timeOf(atTime(day, toHHmm(m)))).toBe(toHHmm(m));
  });
});

describe('atTime at DST transitions (R-1, E-10)', () => {
  describe('Europe/Berlin', () => {
    inZone('Europe/Berlin');
    it('moves a time inside the spring-forward gap to the next valid minute', () => {
      const t = atTime(k('2026-03-29'), hhmm('02:30'));
      expect(timeOf(t)).toBe('03:00');
      expect(t.toISOString()).toBe('2026-03-29T01:00:00.000Z');
      expect(atTime(k('2026-03-29'), hhmm('03:00')).toISOString()).toBe('2026-03-29T01:00:00.000Z');
      expect(atTime(k('2026-03-29'), hhmm('01:59')).toISOString()).toBe('2026-03-29T00:59:00.000Z');
    });
    it('uses the first of the two fall-back occurrences', () => {
      expect(atTime(k('2026-10-25'), hhmm('02:30')).toISOString()).toBe('2026-10-25T00:30:00.000Z');
      expect(atTime(k('2026-10-25'), hhmm('03:00')).toISOString()).toBe('2026-10-25T02:00:00.000Z');
    });
  });

  describe('America/New_York', () => {
    inZone('America/New_York');
    it('handles the March gap and the November overlap', () => {
      expect(atTime(k('2026-03-08'), hhmm('02:15')).toISOString()).toBe('2026-03-08T07:00:00.000Z');
      expect(atTime(k('2026-11-01'), hhmm('01:30')).toISOString()).toBe('2026-11-01T05:30:00.000Z');
    });
  });

  describe('Australia/Lord_Howe (30-minute DST)', () => {
    inZone('Australia/Lord_Howe');
    it('handles the half-hour gap and overlap', () => {
      const gap = atTime(k('2026-10-04'), hhmm('02:10'));
      expect(timeOf(gap)).toBe('02:30');
      expect(gap.toISOString()).toBe('2026-10-03T15:30:00.000Z');
      expect(atTime(k('2026-04-05'), hhmm('01:45')).toISOString()).toBe('2026-04-04T14:45:00.000Z');
    });
  });
});

describe('default test zone', () => {
  it('is Europe/Skopje, whatever the machine says', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Skopje');
    expect(toDateKey(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05');
  });
});
