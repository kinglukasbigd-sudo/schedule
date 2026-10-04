import { describe, expect, it } from 'vitest';
import { canonicalNames, extractTimes, splitRoom, tidyName } from './normalize';
import { isBreakText, matchDay } from './days';

describe('normalize', () => {
  it('extracts times', () => {
    expect(extractTimes('1. 8:00 – 8:45')).toEqual({ start: '08:00', end: '08:45' });
    expect(extractTimes('07.30')).toEqual({ start: '07:30' });
    expect(extractTimes('Math')).toEqual({});
  });

  it('tidies OCR capitals but keeps acronyms', () => {
    expect(tidyName('MATHEMATICS')).toBe('Mathematics');
    expect(tidyName('PE')).toBe('PE');
    expect(tidyName('physical education')).toBe('Physical education');
    expect(tidyName(' - Bio. ')).toBe('Bio');
  });

  it('splits rooms', () => {
    expect(splitRoom('Math @ 12')).toEqual({ subject: 'Math', room: '12' });
    expect(splitRoom('Bio Raum 101')).toEqual({ subject: 'Bio', room: 'Raum 101' });
    expect(splitRoom('Geschichte')).toEqual({ subject: 'Geschichte' });
  });

  it('merges spelling variants into the most common one', () => {
    const map = canonicalNames(['English', 'English', 'Englsh', 'english', 'Math', 'Maths']);
    expect(map.get('Englsh')).toBe('English');
    expect(map.get('english')).toBe('English');
    expect(map.get('Maths')).toBe('Maths'); // short names are never fuzzily merged
  });

  it('recognises days and breaks in three languages', () => {
    expect(matchDay('Mo.')).toBe(1);
    expect(matchDay('ЧЕТВРТОК')).toBe(4);
    expect(matchDay('Freitag:')).toBe(5);
    expect(matchDay('Math')).toBeNull();
    expect(isBreakText('Große Pause')).toBe(true);
    expect(isBreakText('Голем одмор')).toBe(true);
    expect(isBreakText('—')).toBe(true);
    expect(isBreakText('Класен час')).toBe(false);
  });
});
