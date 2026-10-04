import { describe, expect, it } from 'vitest';
import { k, timetable } from '@/test/builders';
import { nextTimetableName, normalizePeriods, placeTimetable } from './timetable';

let n = 0;
const newId = () => `p${++n}`;

describe('normalizePeriods', () => {
  it('keeps good periods as they are', () => {
    expect(normalizePeriods([{ start: '08:00', end: '08:45' }, { start: '08:50', end: '09:35' }], newId).map((p) => [p.start, p.end])).toEqual([
      ['08:00', '08:45'],
      ['08:50', '09:35'],
    ]);
  });

  it('repairs broken, reversed and overlapping times from their neighbours', () => {
    const out = normalizePeriods(
      [
        { start: 'x', end: '' },
        { start: '08:30', end: '08:20' },
        { start: '08:40', end: '09:30' },
        { start: '', end: '10:00' },
      ],
      newId,
    );
    expect(out.map((p) => `${p.start}–${p.end}`)).toEqual(['08:00–08:45', '08:45–09:30', '09:30–10:15', '10:20–11:05']);
  });

  it('caps at 14 periods and stops before midnight', () => {
    expect(normalizePeriods(Array.from({ length: 20 }, () => ({ start: '', end: '' })), newId)).toHaveLength(14);
    expect(normalizePeriods([{ start: '23:30', end: '23:59' }, { start: '', end: '' }], newId).map((p) => `${p.start}–${p.end}`)).toEqual([
      '23:30–23:59',
    ]);
  });
});

describe('nextTimetableName', () => {
  it('numbers names that are taken', () => {
    expect(nextTimetableName([])).toBe('Timetable');
    expect(nextTimetableName([{ name: 'Timetable' }])).toBe('Timetable 2');
    expect(nextTimetableName([{ name: 'Timetable' }, { name: 'Timetable 2' }])).toBe('Timetable 3');
  });
});

describe('placeTimetable (R-2)', () => {
  const autumn = timetable({ id: 'autumn', validFrom: k('2026-09-01'), validTo: null });

  it('trims a neighbour that started earlier to end the day before', () => {
    expect(placeTimetable([autumn], k('2027-02-01'), null)).toEqual({ kept: [{ ...autumn, validTo: '2027-01-31' }], removed: [] });
  });

  it('moves a later neighbour to start after the new one ends, keeping its rotation anchor', () => {
    const spring = timetable({ id: 'spring', validFrom: k('2027-02-01'), validTo: null });
    const { kept } = placeTimetable([spring], k('2027-01-15'), k('2027-02-14'));
    expect(kept[0]).toMatchObject({ id: 'spring', validFrom: '2027-02-15', rotation: spring.rotation });
  });

  it('replaces a neighbour left with no days, and leaves others alone', () => {
    const short = timetable({ id: 'short', validFrom: k('2027-02-03'), validTo: k('2027-02-10') });
    const far = timetable({ id: 'far', validFrom: k('2028-01-01'), validTo: null });
    expect(placeTimetable([short, far], k('2027-02-01'), k('2027-02-28'))).toEqual({ kept: [far], removed: ['short'] });
  });
});
