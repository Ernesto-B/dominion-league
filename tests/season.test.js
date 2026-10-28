import { describe, it, expect } from 'vitest';
import * as Eng from '../src/lib/engine.js';

const SEASON = [{ name: 'S1', start: '2026-01-01', weeks: 40, targetGames: 4, playoffSpots: 2 }];
let line = 0;
const g = (finish, vp, date = '2026-01-10', type = '') => ({ _line: ++line, date, type, finish, sets: '', landscapes: '', playerVP: vp || {} });
const run = (rows, season = {}) => Eng.compute({ title: 't', players: ['Ann', 'Bob', 'Cy', 'Dee'], seasons: SEASON, elo: {}, season }, rows, Eng.todayDay());
const standing = (D, name) => D.seasonStandings(1).rows.find(r => r.name === name);
const sum = a => a.reduce((x, y) => x + y, 0);

describe('season score bonuses', () => {
  const rows = [g('Ann > Bob > Cy > Dee', { Ann: 60, Bob: 50, Cy: 40, Dee: 30 }, '2026-01-10'), g('Ann > Cy > Bob > Dee', { Ann: 55, Cy: 52, Bob: 40, Dee: 20 }, '2026-01-17'), g('Bob > Ann > Dee > Cy', {}, '2026-01-24')];

  it('with both bonuses off (the default) the score is exactly the plain finishing points, as before', () => {
    const D = run(rows);
    D.games.forEach(x => Object.keys(x.sp).forEach(n => expect(x.sp[n]).toBe(x.pts[n])));
    const r = standing(D, 'Ann'); expect(r.bonusPts).toBe(0); expect(r.score).toBeCloseTo((r.avgPts * 3 + 1.5) / 6, 12);
  });

  it('a win streak pays streakBonus per win beyond the first, up to the cap, and any non-win resets it', () => {
    const wins = ['Ann > Bob', 'Ann > Bob', 'Ann > Bob', 'Ann > Bob', 'Ann > Bob', 'Bob > Ann', 'Ann > Bob'].map((f, i) => g(f, {}, `2026-01-${String(10 + i).padStart(2, '0')}`));
    const D = run(wins, { streakBonus: 0.04, streakCap: 3 });
    expect(D.games.map(x => +(x.sp.Ann - x.pts.Ann).toFixed(6))).toEqual([0, 0.04, 0.08, 0.12, 0.12, 0, 0]);   // the 6th game was a loss (no bonus), the 7th starts again
    expect(D.games.every(x => x.sp.Bob === x.pts.Bob)).toBe(true);                                             // Bob never won twice in a row
  });

  it('streaks are counted per season and only over Regular games', () => {
    const D = run([g('Ann > Bob', {}, '2026-01-10'), g('Bob > Ann', {}, '2026-01-11', 'Friendly'), g('Ann > Bob', {}, '2026-01-12')], { streakBonus: 0.05 });
    expect(D.games[2].sp.Ann - D.games[2].pts.Ann).toBeCloseTo(0.05, 10);   // the Friendly loss in between didn't break the streak
  });

  it('the VP bonus is zero-sum at a table and rewards a close finish over a blowout', () => {
    const close = run([g('Ann > Bob > Cy > Dee', { Ann: 60, Bob: 58, Cy: 30, Dee: 20 })], { vpBonus: 0.5 }).games[0];
    const blow = run([g('Ann > Bob > Cy > Dee', { Ann: 60, Bob: 30, Cy: 30, Dee: 20 })], { vpBonus: 0.5 }).games[0];
    const bonus = x => Object.fromEntries(Object.keys(x.sp).map(n => [n, x.sp[n] - x.pts[n]]));
    expect(sum(Object.values(bonus(close)))).toBeCloseTo(0, 10);
    expect(bonus(close).Bob).toBeGreaterThan(bonus(blow).Bob);
  });

  it('the VP bonus does not care how many VP a game has: the same shape of result earns the same bonus', () => {
    const low = run([g('Ann > Bob > Cy', { Ann: 40, Bob: 30, Cy: 20 })], { vpBonus: 0.5 }).games[0], high = run([g('Ann > Bob > Cy', { Ann: 120, Bob: 90, Cy: 60 })], { vpBonus: 0.5 }).games[0];
    Object.keys(low.sp).forEach(n => expect(high.sp[n]).toBeCloseTo(low.sp[n], 10));
  });

  it('a game missing anyone’s VP gets no VP bonus, and negative VP counts as zero', () => {
    expect(run([g('Ann > Bob > Cy', { Ann: 40, Bob: 30 })], { vpBonus: 0.5 }).games[0].sp.Ann).toBe(1);
    const d = run([g('Ann > Bob', { Ann: 20, Bob: -6 })], { vpBonus: 0.5 }).games[0];
    expect(d.sp.Bob - d.pts.Bob).toBeCloseTo(0.5 * (0 - 0.5), 10);
  });

  it('feeds the standings and the per-game season score, and leaves average finish alone', () => {
    const plain = standing(run(rows), 'Ann'), bonus = standing(run(rows, { streakBonus: 0.05 }), 'Ann'), D = run(rows, { streakBonus: 0.05 });
    expect(bonus.avgPts).toBe(plain.avgPts); expect(bonus.score).toBeGreaterThan(plain.score);
    expect(D.games[1].score.Ann.after).toBeCloseTo(standing(D, 'Ann').score - 0, 1);   // two games in: Ann's second win earned a bonus (the third game lost it)
    const last = D.games[D.games.length - 1].score.Ann.after; expect(last).toBeCloseTo(standing(D, 'Ann').score, 12);
  });
});
