import { describe, expect, it } from 'vitest';
import { abbreviate, editDistance, fold, tokens } from './text';

describe('text helpers', () => {
  it('folds case and diacritics', () => {
    expect(fold('Prüfung')).toBe('prufung');
    expect(tokens('Math-Test, Freitag!')).toEqual(['math', 'test', 'freitag']);
  });

  it('measures edit distance with a bound', () => {
    expect(editDistance('english', 'englsh')).toBe(1);
    expect(editDistance('abc', 'xyz12345', 2)).toBe(3);
  });

  it('abbreviates subjects the way students do', () => {
    expect(abbreviate('Mathematics')).toBe('Math');
    expect(abbreviate('German')).toBe('Ger');
    expect(abbreviate('Music')).toBe('Music');
    expect(abbreviate('Geschichte')).toBe('Gesch');
    expect(abbreviate('Physical Education')).toBe('PE');
    expect(abbreviate('Физичко и здравствено образование')).toBe('ФЗО');
    expect(abbreviate('Mathematics 2')).toBe('Math 2');
    expect(abbreviate('Astronomy')).toBe('Astr');
    expect(abbreviate('Art')).toBe('Art');
  });
});
