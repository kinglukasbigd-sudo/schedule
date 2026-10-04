import { format } from 'date-fns';
import { de } from 'date-fns/locale/de';
import { enGB } from 'date-fns/locale/en-GB';
import { mk } from 'date-fns/locale/mk';
import { describe, expect, it } from 'vitest';
import { datePattern } from './format';

const monday = new Date(2026, 9, 5);

describe('datePattern', () => {
  it('writes German days of the month as ordinals', () => {
    expect(format(monday, datePattern('fullDate', 'de'), { locale: de })).toBe('Montag, 5. Oktober');
    expect(format(monday, datePattern('dayMonth', 'de'), { locale: de })).toBe('5. Okt.');
    expect(format(monday, datePattern('weekdayDayMonth', 'de'), { locale: de })).toBe('Mo., 5. Okt.');
  });

  it('keeps English and Macedonian without the dot', () => {
    expect(format(monday, datePattern('fullDate', 'en'), { locale: enGB })).toBe('Monday, 5 October');
    expect(format(monday, datePattern('fullDate', 'mk'), { locale: mk })).toBe('понеделник, 5 октомври');
  });

  it('falls back to English patterns for unknown languages', () => {
    expect(datePattern('dayMonth', 'fr')).toBe('d MMM');
  });
});
