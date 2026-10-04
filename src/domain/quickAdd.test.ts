import { describe, expect, it } from 'vitest';
import { at, subjects } from '@/test/fixtures';
import { detectDate, parseQuickAdd, stripDate } from './quickAdd';

const now = at('2026-10-05T15:00'); // Monday

describe('parseQuickAdd', () => {
  it('reads subject, kind and weekday in English', () => {
    expect(parseQuickAdd('Math test friday', subjects, now)).toEqual({ kind: 'test', subjectId: 'math', date: '2026-10-09' });
  });

  it('matches prefixes and acronyms', () => {
    expect(parseQuickAdd('bio worksheet', subjects, now).subjectId).toBe('bio');
    expect(parseQuickAdd('PE kit', subjects, now).subjectId).toBe('pe');
    expect(parseQuickAdd('english essay tomorrow', subjects, now)).toEqual({
      kind: 'assignment',
      subjectId: 'eng',
      date: '2026-10-06',
    });
  });

  it('understands Macedonian', () => {
    const mk = [{ id: 'm', name: 'Математика', color: 'sky' as const, createdAt: 1 }];
    expect(parseQuickAdd('Контролна по математика во петок', mk, now)).toEqual({ kind: 'test', subjectId: 'm', date: '2026-10-09' });
    expect(parseQuickAdd('домашна утре', mk, now)).toEqual({ kind: 'homework', date: '2026-10-06' });
  });

  it('understands German, including compounds and umlauts', () => {
    expect(parseQuickAdd('Deutsch Aufsatz Mittwoch', subjects, now)).toEqual({
      kind: 'assignment',
      subjectId: 'de',
      date: '2026-10-07',
    });
    expect(parseQuickAdd('Mathearbeit übermorgen', subjects, now)).toEqual({
      kind: 'test',
      subjectId: 'math',
      date: '2026-10-07',
    });
    expect(parseQuickAdd('Prufung', [], now).kind).toBe('test');
  });

  it('does not invent anything from plain text', () => {
    expect(parseQuickAdd('read chapter 3', subjects, now)).toEqual({});
    // "do" and "so" are English words, not German weekday abbreviations here.
    expect(parseQuickAdd('do the reading so it is done', subjects, now)).toEqual({});
  });
});

describe('detectDate', () => {
  it('uses the next occurrence of a weekday, never today', () => {
    expect(detectDate('monday', now)).toBe('2026-10-12');
    expect(detectDate('tuesday', now)).toBe('2026-10-06');
  });

  it('reads near day-first numeric dates', () => {
    expect(detectDate('due 12.10', now)).toBe('2026-10-12');
    expect(detectDate('due 3/1', now)).toBe('2027-01-03');
    expect(detectDate('ex 4.7', now)).toBeUndefined(); // an exercise number, not July
    expect(detectDate('31.02', now)).toBeUndefined();
  });

  it('handles "day after tomorrow"', () => {
    expect(detectDate('the day after tomorrow', now)).toBe('2026-10-07');
  });
});

describe('stripDate', () => {
  it('removes the date phrase and its preposition, keeping the rest', () => {
    expect(stripDate('Math test friday')).toBe('Math test');
    expect(stripDate('Essay due on Friday, 2 pages')).toBe('Essay due, 2 pages');
    expect(stripDate('Контролна по математика во петок')).toBe('Контролна по математика');
    expect(stripDate('Aufsatz bis übermorgen')).toBe('Aufsatz');
    expect(stripDate('Read ch. 3 by 12.10')).toBe('Read ch. 3');
    expect(stripDate('homework the day after tomorrow')).toBe('homework');
    expect(stripDate('tomorrow')).toBe('');
  });
});
