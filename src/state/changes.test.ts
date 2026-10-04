import { describe, expect, it } from 'vitest';
import { holiday, subject, task } from '@/test/builders';
import { EMPTY_COLLECTIONS, applyChange, invertChange, tablesOf, type Collections } from './changes';

const a = subject('a', 'Art');
const b = subject('b', 'Biology');
const state: Collections = { ...EMPTY_COLLECTIONS, subjects: [a, b], holidays: [holiday('x', '2026-10-05')] };

describe('change sets', () => {
  it('lists only the tables a change touches', () => {
    expect(tablesOf({ subjects: { put: [a] }, tasks: { put: [], delete: [] } })).toEqual(['subjects']);
    expect(tablesOf({})).toEqual([]);
  });

  it('replaces in place, appends new rows and deletes, leaving other tables untouched', () => {
    const renamed = { ...a, name: 'Drawing' };
    const c = subject('c', 'Chemistry');
    const next = applyChange(state, { subjects: { put: [renamed, c], delete: ['b'] } });
    expect(next.subjects).toEqual([renamed, c]);
    expect(next.holidays).toBe(state.holidays);
    expect(applyChange(state, {})).toEqual(state);
  });

  it('lets a delete win over a put of the same row', () => {
    expect(applyChange(state, { subjects: { put: [subject('c', 'Chemistry')], delete: ['c'] } }).subjects).toEqual([a, b]);
  });

  it('inverts any change: applying both gets back to the start', () => {
    const t = task({ id: 't', due: '2026-10-05' });
    const changes = [
      { subjects: { put: [{ ...a, name: 'Drawing' }, subject('c', 'Chemistry')], delete: ['b'] } },
      { tasks: { put: [t] } },
      { holidays: { delete: ['h-x-2026-10-05', 'missing'] } },
    ];
    for (const change of changes) {
      const after = applyChange(state, change);
      const back = applyChange(after, invertChange(state, change));
      for (const table of tablesOf(change)) expect([...back[table]].sort((x, y) => x.id.localeCompare(y.id))).toEqual([...state[table]].sort((x, y) => x.id.localeCompare(y.id)));
    }
  });
});
