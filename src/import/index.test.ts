import { describe, expect, it } from 'vitest';
import { wordsToDraft } from './index';
import type { WordBox } from './layout';

/** One line of words laid out left to right, like a text run read from a file. */
function line(text: string, y = 10): WordBox[] {
  let x = 10;
  return text.split(' ').map((word) => {
    const box = { text: word, x0: x, y0: y, x1: x + word.length * 9, y1: y + 18 };
    x = box.x1 + 6;
    return box;
  });
}

describe('wordsToDraft', () => {
  it('does not turn a document without timetable structure into a timetable', () => {
    expect(wordsToDraft(line('Shopping list: milk, eggs, bread.'))).toBeNull();
    expect(wordsToDraft([...line('Math, English, Biology'), ...line('English, Math, PE', 40)])).toBeNull();
  });

  it('still reads day-labelled text that has no grid', () => {
    const draft = wordsToDraft([...line('Monday: Math, English, Biology'), ...line('Tuesday: English, Math', 40)]);
    expect(draft?.days).toEqual([1, 2]);
    expect(draft?.cells).toHaveLength(5);
  });
});
