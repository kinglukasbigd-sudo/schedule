import { describe, expect, it } from 'vitest';
import { parseDayFields, parseDayList, parseTimetableText } from './text';

const subjectsOf = (draft: ReturnType<typeof parseTimetableText>, day: number) =>
  draft?.cells
    .filter((c) => c.day === day)
    .sort((a, b) => a.period - b.period)
    .map((c) => `${c.period}:${c.subject}`);

describe('parseDayList', () => {
  it('splits on commas and keeps interior gaps as free periods', () => {
    expect(parseDayList('Math, , Bio,').map((e) => e.subject)).toEqual(['Math', '', 'Bio']);
  });
  it('reads rooms and numbered periods', () => {
    expect(parseDayList('3. Math (R12)')[0]).toEqual({ subject: 'Math', room: 'R12', period: 2 });
    expect(parseDayList('Chemistry 204')[0]).toEqual({ subject: 'Chemistry', room: '204' });
    expect(parseDayList('English 2')[0]).toEqual({ subject: 'English 2' });
  });
});

describe('parseTimetableText', () => {
  it('reads "Day: subjects" lines', () => {
    const draft = parseTimetableText('Monday: Math, English, Biology\nTuesday: English, Math\nWed: PE');
    expect(draft?.days).toEqual([1, 2, 3]);
    expect(subjectsOf(draft, 1)).toEqual(['0:Math', '1:English', '2:Biology']);
    expect(subjectsOf(draft, 3)).toEqual(['0:PE']);
  });

  it('reads day headers followed by one subject per line, with times', () => {
    const draft = parseTimetableText('Montag\n1. 08:00-08:45 Mathe\n2. 08:50-09:35 Deutsch\nDienstag\n1. Englisch');
    expect(subjectsOf(draft, 1)).toEqual(['0:Mathe', '1:Deutsch']);
    expect(draft?.bells[0]).toEqual({ start: '08:00', end: '08:45' });
    expect(draft?.bells[1]).toEqual({ start: '08:50', end: '09:35' });
  });

  it('reads a spreadsheet paste with days across', () => {
    const tsv = [
      '\tMon\tTue\tWed\tThu\tFri',
      '08:00-08:45\tMath\tEnglish\tBiology\tMath\tPE',
      '08:50-09:35\tEnglish\tMath\t\tChemistry\tPE',
      '09:35-09:55\tBreak\tBreak\tBreak\tBreak\tBreak',
      '09:55-10:40\tHistory\tArt\tMath\tEnglish\tMusic',
    ].join('\n');
    const draft = parseTimetableText(tsv);
    expect(draft?.days).toEqual([1, 2, 3, 4, 5]);
    expect(draft?.bells).toEqual([
      { start: '08:00', end: '08:45' },
      { start: '08:50', end: '09:35' },
      { start: '09:55', end: '10:40' },
    ]);
    expect(subjectsOf(draft, 3)).toEqual(['0:Biology', '2:Math']);
    expect(subjectsOf(draft, 5)).toEqual(['0:PE', '1:PE', '2:Music']);
  });

  it('reads a spreadsheet paste with days down the side', () => {
    const draft = parseTimetableText('\t08:00\t08:50\nПонеделник\tМатематика\tАнглиски\nВторник\tБиологија\tМатематика');
    expect(subjectsOf(draft, 1)).toEqual(['0:Математика', '1:Англиски']);
    expect(subjectsOf(draft, 2)).toEqual(['0:Биологија', '1:Математика']);
    expect(draft?.bells[1]?.start).toBe('08:50');
  });

  it('treats unlabelled lines as Monday onwards', () => {
    const draft = parseTimetableText('Math, English\nBio, PE');
    expect(subjectsOf(draft, 1)).toEqual(['0:Math', '1:English']);
    expect(subjectsOf(draft, 2)).toEqual(['0:Bio', '1:PE']);
  });

  it('does not mistake a subject abbreviation for a day header', () => {
    const draft = parseTimetableText('Monday\nMath\nFr\nBio');
    expect(subjectsOf(draft, 1)).toEqual(['0:Math', '1:Fr', '2:Bio']);
  });

  it('only guesses days for unlabelled lines when asked to (typed text, not files)', () => {
    expect(parseTimetableText('Shopping list: milk, eggs, bread.', { unlabelled: false })).toBeNull();
    expect(subjectsOf(parseTimetableText('Math, English\nBio, PE', { unlabelled: false }), 1)).toBeUndefined();
    expect(subjectsOf(parseTimetableText('Monday: Math, English', { unlabelled: false }), 1)).toEqual(['0:Math', '1:English']);
  });

  it('returns null for nothing useful', () => {
    expect(parseTimetableText('')).toBeNull();
    expect(parseTimetableText('-, -')).toBeNull();
  });
});

describe('parseDayFields', () => {
  it('builds a draft from the onboarding form, merging spelling variants', () => {
    const draft = parseDayFields({ 1: 'Math, English, Biology', 2: 'english, math', 3: '', 4: 'Englsh, PE' });
    expect(draft?.days).toEqual([1, 2, 3, 4]);
    expect(new Set(draft?.cells.map((c) => c.subject))).toEqual(new Set(['Math', 'English', 'Biology', 'PE']));
    expect(draft?.bells).toHaveLength(3);
  });
});
