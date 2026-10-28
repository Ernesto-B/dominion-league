import { describe, it, expect } from 'vitest';
import * as Eng from '../src/lib/engine.js';
import { DEFAULT_STEADY, finishScores, steadyPayout } from '../src/lib/steadyElo.js';

const sum = a => a.reduce((x, y) => x + y, 0);
const seq = n => Array.from({ length: n }, (_, i) => i + 1);
const row = (i, finish, extra = {}) => ({ _line: i, date: '2026-02-01', type: '', finish, sets: '', landscapes: '', playerVP: {}, ...extra });
const league = (rows, elo = {}, names = ['Ann', 'Bob', 'Cy', 'Dee', 'Eli']) => Eng.compute({ title: 't', players: names, seasons: [], elo }, rows, Eng.todayDay());
const STEADY = { model: 'steady', k: 100, provisionalK: 200, provisionalGames: 0, start: 1000, scale: 400, target: 0.52 };

describe('the points-per-finish table', () => {
  it('pays the top half first, then the win: each place pays more than the one below, and the top-half step is the biggest', () => {
    for (const n of [4, 6]) {
      const s = finishScores(seq(n));
      for (let i = 1; i < n; i++) expect(s[i - 1]).toBeGreaterThan(s[i]);
      const half = Math.floor(n / 2), steps = s.slice(0, -1).map((v, i) => v - s[i + 1]);
      expect(steps[half - 1], `n=${n}: the step across the top-half line`).toBe(Math.max(...steps));
    }
  });
  it('pays exactly `target` on average at every table size, so drift is a dial and not an accident', () => {
    for (const target of [0.5, 0.52, 0.58]) for (const n of [2, 3, 4, 5, 6, 7]) expect(sum(finishScores(seq(n), { target })) / n).toBeCloseTo(target, 10);
  });
  it('shares the average of the positions between tied players, and still pays the same in total', () => {
    const tied = finishScores([1, 2, 2, 4]), plain = finishScores([1, 2, 3, 4]);
    expect(tied[1]).toBeCloseTo(tied[2], 10); expect(tied[1]).toBeCloseTo((plain[1] + plain[2]) / 2, 10); expect(sum(tied)).toBeCloseTo(sum(plain), 10);
  });
  it('ignores weights it does not know and falls back to the defaults', () => {
    expect(finishScores(seq(4), { k: 999, scale: 1 })).toEqual(finishScores(seq(4)));
    expect(DEFAULT_STEADY.target).toBe(0.52);
  });
});

describe('what a game pays at an even table (K=100, drift 0.52)', () => {
  it('a win earns about +50 and last place loses about 40, at every size', () => {
    for (const n of [2, 3, 4, 5, 6, 7]) {
      const p = steadyPayout(n, { k: 100, target: 0.52 });
      expect(p[0]).toBeGreaterThan(45); expect(p[0]).toBeLessThan(55); expect(p[n - 1]).toBeGreaterThan(-45); expect(p[n - 1]).toBeLessThan(-35);
    }
  });
  it('the exact middle of an odd table is an average result: it costs next to nothing', () => {
    for (const n of [3, 5, 7]) {
      const mid = steadyPayout(n, { k: 100, target: 0.52 })[(n - 1) / 2];
      expect(Math.abs(mid), `n=${n}`).toBeLessThan(4);
      expect(mid).toBeGreaterThan(steadyPayout(n, { k: 100, target: 0.52, middle: 0 })[(n - 1) / 2] + 5);   // and clearly better than being treated as the bottom half
    }
  });
  it('an even table has no middle, so its payouts do not depend on the middle rule', () => {
    expect(steadyPayout(4, { middle: 0 })).toEqual(steadyPayout(4, { middle: 1 }));
  });
  it('the table pays out a little more than it takes (the drift), by K x (target - 0.5) per player', () => {
    expect(sum(steadyPayout(5, { k: 100, target: 0.52 }))).toBeCloseTo(5 * 100 * 0.02, 8);
    expect(sum(steadyPayout(5, { k: 100, target: 0.5 }))).toBeCloseTo(0, 8);
  });
});

describe('the engine with model "steady"', () => {
  it('is the original Elo unless asked: a fresh config pays +100 / +33 / −33 / −100 at an even table of four', () => {
    const D = league([row(1, 'Ann > Bob > Cy > Dee')], { provisionalGames: 0 });
    expect(['Ann', 'Bob', 'Cy', 'Dee'].map(n => Math.round(D.games[0].elo[n].after - D.games[0].elo[n].before))).toEqual([100, 33, -33, -100]);
  });
  it('pays the steady table when asked, and matches steadyPayout at an even table', () => {
    const D = league([row(1, 'Ann > Bob > Cy > Dee > Eli')], STEADY), want = steadyPayout(5, { k: 100, target: 0.52 });
    ['Ann', 'Bob', 'Cy', 'Dee', 'Eli'].forEach((n, i) => expect(D.games[0].elo[n].after - D.games[0].elo[n].before).toBeCloseTo(want[i], 8));
    expect(D.games[0].elo.Cy.after).toBeGreaterThan(995);                      // 3rd of 5 stays about level
  });
  it('is zero-sum when the table pays 0.5, and drifts upward when it pays more', () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(i + 1, i % 2 ? 'Bob > Ann > Cy' : 'Ann > Cy > Bob'));
    const names = ['Ann', 'Bob', 'Cy'], avg = D => sum(names.map(n => D.players.find(p => p.name === n).elo)) / 3;
    expect(avg(league(rows, { ...STEADY, target: 0.5 }, names))).toBeCloseTo(1000, 6);
    expect(avg(league(rows, STEADY, names))).toBeCloseTo(1000 + 30 * 100 * 0.02, 6);
  });
  it('a loss rarely undoes a win: after winning, finishing last costs less than the win paid', () => {
    const D = league([row(1, 'Ann > Bob > Cy > Dee'), row(2, 'Bob > Cy > Dee > Ann')], STEADY, ['Ann', 'Bob', 'Cy', 'Dee']);
    const win = D.games[0].elo.Ann.after - D.games[0].elo.Ann.before, loss = D.games[1].elo.Ann.after - D.games[1].elo.Ann.before;
    expect(-loss).toBeLessThan(win);
  });
  it('the pre-game preview agrees with what a game actually pays', () => {
    const D = league([], STEADY), pv = D.preview(['Ann', 'Bob', 'Cy', 'Dee']), want = steadyPayout(4, { k: 100, target: 0.52 });
    expect(pv[0].ifWin).toBeCloseTo(want[0], 8); expect(pv[0].ifLast).toBeCloseTo(want[3], 8);
  });
  it('new players move twice as fast during their provisional games', () => {
    const rows = [row(1, 'Ann > Bob')];
    const fresh = league(rows, { ...STEADY, provisionalGames: 10 }, ['Ann', 'Bob']).games[0].elo.Ann, est = league(rows, STEADY, ['Ann', 'Bob']).games[0].elo.Ann;
    expect(fresh.after - 1000).toBeCloseTo((est.after - 1000) * 2, 8);
  });
  it('still skips Friendly games and one-player rows', () => {
    const D = league([row(1, 'Ann > Bob', { type: 'Friendly' }), row(2, 'Ann')], STEADY, ['Ann', 'Bob']);
    expect(Object.keys(D.games[0].elo)).toEqual([]); expect(D.players.find(p => p.name === 'Ann').elo).toBe(1000);
  });
});

describe('the shipped configuration', () => {
  it('turns the steady model on with K=100, drift 0.52 and tiers scaled to match (K=200 tiers x 100/200)', async () => {
    const cfg = JSON.parse((await import('node:fs')).readFileSync('public/data/config.json', 'utf8'));
    expect(cfg.elo).toMatchObject({ model: 'steady', k: 100, provisionalK: 200, target: 0.52 });
    expect(cfg.tiers.map(t => t.min)).toEqual([null, 1125, 1275, 1475, 1700]);
  });
  it('turns on both season bonuses (win streaks and VP)', async () => {
    const cfg = JSON.parse((await import('node:fs')).readFileSync('public/data/config.json', 'utf8'));
    expect(cfg.season).toMatchObject({ streakBonus: 0.04, streakCap: 3, vpBonus: 0.4 });
  });
});
