import { describe, expect, it } from 'vitest';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';
import { compare } from '../src/lib/compare.js';

const row = (f, d, o = {}) => ({ _line: 1, date: d, type: o.type || '', finish: f, sets: o.sets || '', landscapes: '', playerVP: {}, minutes: '', kingdom: [], savedAt: null });
const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob', 'Cy'], seasons: [] }, [
  row('Ann > Bob > Cy', '2026-01-01', { sets: 'Base' }), row('Bob > Ann', '2026-01-02', { sets: 'Base; Seaside' }), row('Ann > Bob', '2026-01-03', { type: 'Friendly' }),
  row('Ann > Cy', '2026-01-04'), row('Ann > Bob', '2026-01-05'),
], Eng.todayDay());

describe('comparing two players', () => {
  it('counts what they played together first: rated games both sat in, who finished ahead, the latest first', () => {
    const c = compare(D, 'Ann', 'Bob');
    expect(c.together.games).toBe(3);                         // the Friendly one does not count
    expect(c.together).toMatchObject({ aheadA: 2, aheadB: 1, ties: 0 });
    expect(c.together.recent.map(r => r.date)).toEqual(['2026-01-05', '2026-01-02', '2026-01-01']);
    expect(c.together.recent[1]).toMatchObject({ placeA: 2, placeB: 1, n: 2 });
  });
  it('lists the same stats for both, as plain values with no winner', () => {
    const c = compare(D, 'Ann', 'Cy');
    expect(c.rows.map(r => r.key)).toEqual(['elo', 'peak', 'tier', 'level', 'games', 'wins', 'winpct', 'tophalf', 'avgplace', 'avgvp', 'streak', 'titles', 'vpm', 'lasts', 'dry', 'badges']);
    c.rows.forEach(r => { expect(r).not.toHaveProperty('winner'); expect(r).not.toHaveProperty('diff'); });
    expect(c.rows.find(r => r.key === 'wins').a).toBeGreaterThan(c.rows.find(r => r.key === 'wins').b);
    expect(c.rows.find(r => r.key === 'badges').a).toBe('—');   // no catalog loaded yet: shown as a dash, not as zero
  });
  it('gives each one\'s most played expansions', () => {
    expect(compare(D, 'Ann', 'Bob').sets.a[0]).toEqual(['Base', 2]);
  });
  it('is null for the same player twice or someone who is not there', () => {
    expect(compare(D, 'Ann', 'Ann')).toBeNull(); expect(compare(D, 'Ann', 'Nobody')).toBeNull();
  });
});

describe('rivalry extras', () => {
  it('reports the pair\'s record by expansion (two games or more) and their closest game by VP', () => {
    const c = compare(D, 'Ann', 'Bob');
    c.together.bySet.forEach(e => { expect(e.games).toBeGreaterThanOrEqual(2); expect(e.aheadA + e.aheadB).toBeLessThanOrEqual(e.games); });
    if (c.together.closest) expect(c.together.closest.gap).toBe(Math.abs(c.together.closest.vpA - c.together.closest.vpB));
  });
  it('shows the average finish with one decimal', () => {
    const r = compare(D, 'Ann', 'Bob').rows.find(x => x.key === 'avgplace');
    expect(r.a).toMatch(/^\d\.\d$/);
  });
});

describe('games together list', () => {
  it('carries every game together, newest first, for the page to show three at a time', () => {
    const c = compare(D, 'Ann', 'Bob');
    expect(c.together.recent).toHaveLength(c.together.games);
    const d = c.together.recent.map(r => r.date); expect([...d].sort().reverse()).toEqual(d);
  });
});
