import { describe, expect, it } from 'vitest';
import { parseLayout, type WordBox } from './layout';

/** Lay out a grid of cell texts as word boxes, like a rendered table. */
function grid(rows: string[][], opts: { cellW?: number; cellH?: number; x0?: number; y0?: number; multiWord?: boolean } = {}) {
  const { cellW = 120, cellH = 48, x0 = 40, y0 = 60 } = opts;
  const words: WordBox[] = [];
  rows.forEach((row, r) =>
    row.forEach((text, c) => {
      if (!text) return;
      text.split('\n').forEach((line, li) => {
        let x = x0 + c * cellW + 8;
        const y = y0 + r * cellH + 8 + li * 16;
        for (const word of line.split(' ')) {
          const w = word.length * 7;
          words.push({ text: word, x0: x, y0: y, x1: x + w, y1: y + 12 });
          x += w + 4;
        }
      });
    }),
  );
  return words;
}

const cellsOf = (draft: ReturnType<typeof parseLayout>, day: number) =>
  draft?.cells
    .filter((c) => c.day === day)
    .sort((a, b) => a.period - b.period)
    .map((c) => c.subject + (c.room ? `@${c.room}` : ''));

describe('parseLayout', () => {
  it('reads a classic days-across timetable with times, rooms and a break row', () => {
    const words = grid([
      ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      ['08:00 - 08:45', 'Math\nR12', 'English', 'Biology', 'Math', 'Physical Education'],
      ['08:50 - 09:35', 'English', 'Math\nR12', '', 'Chemistry', 'Physical Education'],
      ['09:35 - 09:55', 'Break', 'Break', 'Break', 'Break', 'Break'],
      ['09:55 - 10:40', 'History', 'Art', 'Math', 'English', 'Music'],
    ], { cellW: 150 });
    const draft = parseLayout(words);
    expect(draft?.days).toEqual([1, 2, 3, 4, 5]);
    expect(draft?.bells).toEqual([
      { start: '08:00', end: '08:45' },
      { start: '08:50', end: '09:35' },
      { start: '09:55', end: '10:40' },
    ]);
    expect(cellsOf(draft, 1)).toEqual(['Math@R12', 'English', 'History']);
    expect(cellsOf(draft, 3)).toEqual(['Biology', 'Math']);
    expect(cellsOf(draft, 5)).toEqual(['Physical Education', 'Physical Education', 'Music']);
  });

  it('works without a time column (period rows found from text lines)', () => {
    const words = grid([
      ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr'],
      ['', 'Mathe', 'Deutsch', 'Englisch', 'Bio', 'Sport'],
      ['', 'Deutsch', 'Mathe', 'Kunst', 'Mathe', 'Sport'],
    ]);
    const draft = parseLayout(words);
    expect(draft?.days).toEqual([1, 2, 3, 4, 5]);
    expect(cellsOf(draft, 2)).toEqual(['Deutsch', 'Mathe']);
  });

  it('reads Macedonian headers and ALL CAPS OCR text', () => {
    const words = grid([
      ['', 'ПОНЕДЕЛНИК', 'ВТОРНИК', 'СРЕДА'],
      ['1. 7:30', 'МАТЕМАТИКА', 'ФИЗИКА', 'ХЕМИЈА'],
      ['2. 8:15', 'ИСТОРИЈА', 'МАТЕМАТИКА', 'ФИЗИКА'],
    ]);
    const draft = parseLayout(words);
    expect(draft?.days).toEqual([1, 2, 3]);
    expect(cellsOf(draft, 2)).toEqual(['Физика', 'Математика']);
    expect(draft?.bells[0]?.start).toBe('07:30');
  });

  it('reads a days-down timetable', () => {
    const words = grid(
      [
        ['', '1', '2', '3'],
        ['Monday', 'Math', 'English', 'Art'],
        ['Tuesday', 'Biology', 'Math', 'Music'],
        ['Wednesday', 'History', 'PE', 'Math'],
      ],
      { cellW: 140 },
    );
    const draft = parseLayout(words);
    expect(draft?.days).toEqual([1, 2, 3]);
    expect(cellsOf(draft, 1)).toEqual(['Math', 'English', 'Art']);
    expect(cellsOf(draft, 3)).toEqual(['History', 'PE', 'Math']);
  });

  it('returns null when there is no grid', () => {
    expect(parseLayout(grid([['Hello world'], ['Just a note']]))).toBeNull();
  });
});
