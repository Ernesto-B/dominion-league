import { describe, it, expect } from 'vitest';
import * as Eng from '../src/lib/engine.js';
import { DEFAULT_STEADY, isRatedGame, finishScores, steadyPayout, classicPayout, computeSteady, rankPlayers, ladderStats, classicRecords } from '../src/lib/steadyElo.js';

const sum = a => a.reduce((x, y) => x + y, 0);
const game = (order, extra = {}) => ({ names: order.flat(), places: Object.fromEntries(order.flatMap((grp, i) => (Array.isArray(grp) ? grp : [grp]).map(n => [n, 1 + order.slice(0, i).flat().length]))), n: order.flat().length, type: '', ...extra });
const G = (...order) => game(order);

describe('the points-per-finish table', () => {
  it('pays the top half first, then the win: each place pays more than the one below, and the top-half step is the biggest', () => {
    for (const n of [3, 4, 5, 6]) {
      const s = finishScores(Array.from({ length: n }, (_, i) => i + 1));
      for (let i = 1; i < n; i++) expect(s[i - 1]).toBeGreaterThan(s[i]);
      const half = Math.floor(n / 2), steps = s.slice(0, -1).map((v, i) => v - s[i + 1]);
      expect(steps[half - 1], `n=${n}: the step across the top-half line`).toBe(Math.max(...steps));
    }
  });
  it('pays exactly `target` on average at every table size, so drift is a dial and not an accident', () => {
    for (const target of [0.5, 0.54, 0.58]) for (const n of [2, 3, 4, 5, 6, 7]) {
      expect(sum(finishScores(Array.from({ length: n }, (_, i) => i + 1), { target })) / n).toBeCloseTo(target, 10);
    }
  });
  it('shares the average of the positions between tied players, and still pays the same in total', () => {
    const tied = finishScores([1, 2, 2, 4]), plain = finishScores([1, 2, 3, 4]);
    expect(tied[1]).toBeCloseTo(tied[2], 10); expect(tied[1]).toBeCloseTo((plain[1] + plain[2]) / 2, 10); expect(sum(tied)).toBeCloseTo(sum(plain), 10);
    expect(finishScores([1, 1, 3, 3])[0]).toBeCloseTo((plain[0] + plain[1]) / 2, 10);
  });
});

describe('what a game pays', () => {
  it('the engine pays +100 / +33 / −33 / −100 at an even table of four, the steady system far less, and a loss costs less than a win earns', () => {
    expect(classicPayout(4).map(Math.round)).toEqual([100, 33, -33, -100]);
    const p = steadyPayout(4).map(Math.round); expect(p).toEqual([42, 18, -18, -30]);
    expect(Math.abs(p[3])).toBeLessThan(p[0]);                      // last place doesn't undo a win
    expect(p[1]).toBeGreaterThan(0); expect(p[2]).toBeLessThan(0);   // the top half gains, the bottom half loses
  });
  it('with target 0.5 a table is zero-sum at even ratings, with a higher target it pays out a little more than it takes', () => {
    expect(sum(steadyPayout(5, { target: 0.5 }))).toBeCloseTo(0, 8);
    expect(sum(steadyPayout(5, { target: 0.54 }))).toBeGreaterThan(5);
  });
  it('is smaller for a smaller K, in proportion', () => { expect(steadyPayout(4, { k: 40 })[0]).toBeCloseTo(steadyPayout(4, { k: 80 })[0] / 2, 10); });
});

describe('replaying games', () => {
  const players = ['Ann', 'Bob', 'Cy'];
  it('starts everyone on 1000 and ignores Friendly games and one-player rows, as the engine does', () => {
    const r = computeSteady([G('Ann', 'Bob', 'Cy')].concat([game(['Ann', 'Bob'], { type: 'Friendly' }), { names: ['Ann'], places: { Ann: 1 }, n: 1, type: '' }]), players);
    expect(r.rated).toEqual({ Ann: 1, Bob: 1, Cy: 1 }); expect(r.records).toHaveLength(3);
    expect(computeSteady([], players).ranked).toEqual([]);                                             // nobody has played: nobody is ranked
  });
  it('keeps the same winner on top, gives the winner the most and the loser the least', () => {
    const r = computeSteady([G('Ann', 'Bob', 'Cy')], players), d = Object.fromEntries(r.records.map(x => [x.name, x.delta]));
    expect(d.Ann).toBeGreaterThan(d.Bob); expect(d.Bob).toBeGreaterThan(d.Cy); expect(r.ranked.map(p => p.name)).toEqual(['Ann', 'Bob', 'Cy']);
  });
  it('is zero-sum for established players when the table pays 0.5, and drifts up when it pays more', () => {
    const many = Array.from({ length: 30 }, (_, i) => G(...(i % 2 ? ['Bob', 'Ann', 'Cy'] : ['Ann', 'Cy', 'Bob']))), est = { provisionalGames: 0 };
    const closed = computeSteady(many, players, { ...est, target: 0.5 }), open = computeSteady(many, players, { ...est, target: 0.54 });
    expect(sum(Object.values(closed.ratings)) / 3).toBeCloseTo(1000, 6); expect(sum(Object.values(open.ratings)) / 3).toBeGreaterThan(1050);
  });
  it('moves new players faster than established ones (provisional K)', () => {
    const fresh = computeSteady([G('Ann', 'Bob')], ['Ann', 'Bob'], { provisionalGames: 10 }).records[0].delta, est = computeSteady([G('Ann', 'Bob')], ['Ann', 'Bob'], { provisionalGames: 0 }).records[0].delta;
    expect(fresh).toBeCloseTo(est * 2, 8);
  });
  it('rewards beating a stronger player more than beating a weaker one', () => {
    const history = Array.from({ length: 6 }, () => G('Ann', 'Bob'));                                // Ann is now clearly ahead of Bob
    const upset = computeSteady([...history, G('Bob', 'Ann')], ['Ann', 'Bob']), expected = computeSteady([...history, G('Ann', 'Bob')], ['Ann', 'Bob']);
    const bobWin = upset.records.find((r, i) => i >= upset.records.length - 2 && r.name === 'Bob').delta, annWin = expected.records.find((r, i) => i >= expected.records.length - 2 && r.name === 'Ann').delta;
    expect(bobWin).toBeGreaterThan(annWin);
  });
  it('shares a rank between players within a tenth of a point and leaves out the unrated', () => {
    expect(rankPlayers({ A: 1000, B: 1000.04, C: 950, D: 1000 }, { A: 1, B: 1, C: 1, D: 0 }).map(p => [p.name, p.rank])).toEqual([['B', 1], ['A', 1], ['C', 3]]);
  });
});

describe('measuring how a system feels', () => {
  it('reports the typical swing and how often a loss undoes the last win', () => {
    const rec = [{ name: 'A', delta: 40, win: true }, { name: 'A', delta: -45, win: false }, { name: 'A', delta: -10, win: false }, { name: 'B', delta: -20, win: false }];
    expect(ladderStats(rec)).toEqual({ swing: (40 + 45 + 10 + 20) / 4, erasesWin: 0.5, games: 4 });   // A's -45 erased the +40; A's -10 did not; B had no win to erase
    expect(ladderStats([])).toEqual({ swing: 0, erasesWin: 0, games: 0 });
  });
  it('measures the real engine and the steady system identically, and the steady one is calmer', () => {
    const names = ['Ann', 'Bob', 'Cy', 'Dee'], rows = Array.from({ length: 40 }, (_, i) => ({ _line: i + 1, date: `2026-02-${String(1 + (i % 28)).padStart(2, '0')}`, type: '', finish: [0, 1, 2, 3].map(k => names[(i + k * (1 + (i % 3))) % 4]).filter((v, k, a) => a.indexOf(v) === k).join(' > '), sets: '', landscapes: '', playerVP: {} }));
    const D = Eng.compute({ title: 't', players: names, seasons: [], elo: { k: 200, provisionalK: 300, provisionalGames: 10, start: 1000, scale: 400 } }, rows, Eng.todayDay());
    const classic = ladderStats(classicRecords(D.games)), steady = ladderStats(computeSteady(D.games, names).records);
    expect(classic.games).toBe(steady.games); expect(steady.swing).toBeLessThan(classic.swing); expect(steady.erasesWin).toBeLessThanOrEqual(classic.erasesWin);
  });
  it('agrees with the engine about which games count towards a rating', () => {
    const rows = [{ _line: 1, date: '2026-01-01', type: '', finish: 'Ann > Bob', sets: '', landscapes: '', playerVP: {} }, { _line: 2, date: '2026-01-02', type: 'Friendly', finish: 'Ann > Bob', sets: '', landscapes: '', playerVP: {} }, { _line: 3, date: '2026-01-03', type: 'Playoff', finish: 'Bob > Ann', sets: '', landscapes: '', playerVP: {} }];
    const D = Eng.compute({ title: 't', players: ['Ann', 'Bob'], seasons: [], elo: {} }, rows, Eng.todayDay());
    D.games.forEach(g => expect(isRatedGame(g), `line ${g.line}`).toBe(Object.keys(g.elo).length > 0));
  });
});
