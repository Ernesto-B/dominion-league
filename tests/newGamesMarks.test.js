import { describe, it, expect } from 'vitest';
import { gameMarksOf } from '../src/lib/data.js';

describe('the new-games notice counts one group at a time', () => {
  it('keeps a count and newest id per group, so a game in another group is not news', () => {
    const m = gameMarksOf([{ id: 3, group_id: 'a' }, { id: 9, group_id: 'test' }, { id: 5, group_id: 'a' }, { id: 7, group_id: null }]);
    expect(m).toEqual({ a: { count: 2, latest: 5 }, test: { count: 1, latest: 9 }, '': { count: 1, latest: 7 } });
    expect(gameMarksOf([])).toEqual({});
  });
});
