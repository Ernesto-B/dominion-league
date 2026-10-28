import { describe, it, expect } from 'vitest';
import { meSummary } from '../src/lib/meSummary.js';

const game = (n, date) => ({ n, date });
const P = (name, rank, elo, over = {}) => ({ name, rank, elo, tier: { icon: 'peasant', name: 'Peasant' }, status: 'Established', streak: 0, titles: 0, results: [], ...over });
const ladder = [
  P('Fay', 1, 1408), P('Ann', 2, 1118, { status: 'Provisional', results: [
    { place: 2, pts: 0.5, before: 1100, after: 1090, game: game(4, '2026-01-01') }, { place: 1, pts: 1, before: 1090, after: 1118, game: game(3, '2026-01-05') } ] }),
  P('Bob', 3, 983), P('Cy', 4, 937),
];

describe('the "starts with you" home card', () => {
  it('is null for someone who is not on the ladder', () => { expect(meSummary(ladder, 'Zed')).toBeNull(); expect(meSummary([], 'Ann')).toBeNull(); });
  it('says where you stand, and how far behind the player above', () => {
    const s = meSummary(ladder, 'Ann', 1000);
    expect(s).toMatchObject({ rank: 2, of: 4, elo: 1118, fromStart: 118, provisional: true, gap: { kind: 'behind', who: 'Fay', rank: 1, elo: 290 } });
  });
  it('the leader hears how far clear of second they are', () => {
    expect(meSummary(ladder, 'Fay').gap).toEqual({ kind: 'clear', who: 'Ann', rank: 2, elo: 290 });
    expect(meSummary([P('Solo', 1, 1000)], 'Solo').gap).toBeNull();                   // nobody to compare with
  });
  it('summarises the last game and the recent form, oldest first', () => {
    const s = meSummary(ladder, 'Ann');
    expect(s.last).toEqual({ place: 1, of: 3, date: '2026-01-05', delta: 28 });
    expect(s.form.map(f => f.tone)).toEqual(['m', 'w']); expect(meSummary(ladder, 'Bob').last).toBeNull(); expect(meSummary(ladder, 'Bob').form).toEqual([]);
  });
  it('never reports a negative gap when two players are level', () => {
    expect(meSummary([P('A', 1, 800), P('B', 1, 800)], 'B').gap.elo).toBe(0);
  });
});
