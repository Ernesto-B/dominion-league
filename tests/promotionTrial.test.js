import { describe, expect, it } from 'vitest';
import * as Eng from '../src/lib/engine.js';

// A beats B every game: A's Elo climbs past the lines, so we can watch the trial move A up one rank at a time.
const tiers = [{ id: 'peasant', name: 'Peasant', min: null }, { id: 'commoner', name: 'Commoner', min: 1020 }, { id: 'knight', name: 'Knight', min: 1060 }, { id: 'lord', name: 'Lord', min: 1100 }];
const cfg = (over = {}) => ({ elo: { model: 'steady', k: 100, provisionalK: 100, start: 1000, demotionGrace: 2, promotionHold: 2, promotionHoldFrom: 'knight', ...over }, tiers });
const run = (script, over) => Eng.compute(cfg(over), script.map((w, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, finish: w === 'A' ? 'A > B' : 'B > A', type: 'Regular' })), 100000);
const tiersOf = (D, n = 'A') => D.games.map(g => g.tierSnap[n].id);

describe('promotion trial', () => {
  it('moves up one rank at a time, never straight to the tier the Elo earns', () => {
    const D = run(Array(8).fill('A'));
    const seq = tiersOf(D);
    const rank = id => tiers.findIndex(t => t.id === id);
    for (let i = 1; i < seq.length; i++) expect(rank(seq[i]) - rank(seq[i - 1])).toBeLessThanOrEqual(1);
    const earned = Eng.compute(cfg(), [], 1);
    expect(D.games.some(g => rank(earned.tierFor(g.snapshot.A).id) > rank(g.tierSnap.A.id))).toBe(true);   // the Elo alone is ahead of the shown rank while a trial runs
  });
  it('needs the whole hold in a row over the next line before a rank above the start of trials', () => {
    const D = run(Array(8).fill('A'));
    const seq = tiersOf(D), elos = D.games.map(g => g.snapshot.A);
    const k = seq.indexOf('knight'); expect(k).toBeGreaterThan(0);
    expect(Math.round(elos[k])).toBeGreaterThanOrEqual(1060);
    expect(Math.round(elos[k - 1])).toBeGreaterThanOrEqual(1060);   // the game before it also ended over the line
  });
  it('a game that ends under the line starts the count again', () => {
    const D = run(['A', 'A', 'A', 'A', 'B', 'A']);
    const A = D.players.find(p => p.name === 'A');
    expect(A.trial === null || A.trial.have <= A.trial.need).toBe(true);
    D.games.forEach(g => { const e = g.elo.A; if (e.trial) expect(e.trial.have).toBeGreaterThan(0); });
  });
  it('is off when promotionHold is 1: rises at once to the tier the Elo earns', () => {
    const D = run(Array(6).fill('A'), { promotionHold: 1 });
    D.games.forEach(g => expect(g.tierSnap.A.id).toBe(D.tierFor(g.snapshot.A).id));
  });
  it('never changes the Elo', () => {
    const on = run(['A', 'A', 'B', 'A', 'A', 'A'], { promotionHold: 2 }), off = run(['A', 'A', 'B', 'A', 'A', 'A'], { promotionHold: 1 });
    expect(on.games.map(g => g.snapshot.A)).toEqual(off.games.map(g => g.snapshot.A));
  });
  it('exposes the trial on the player while it is under way', () => {
    const D = run(['A', 'A', 'A', 'A']);
    const A = D.players.find(p => p.name === 'A');
    if (A.trial) { expect(A.trial.need).toBe(2); expect(A.trial.tier.min).toBeGreaterThan(A.tier.min); }
  });
});

describe('the Rank badges follow the shipped tier list', () => {
  it('has a "Reached Commoner" badge as the first Rank step, earned at 1075 Elo, with the commoner icon', async () => {
    const { achievements, grouped } = await import('../src/lib/achievements.js');
    const shipped = JSON.parse((await import('node:fs')).readFileSync('public/data/config.json', 'utf8')).tiers.map(t => ({ ...t, min: t.min == null ? -Infinity : t.min }));
    const g = (n, before, after) => ({ place: 1, pts: 1, before, after, game: { line: n, date: `2026-01-0${n}`, n: 2, names: ['A', 'B'], places: { A: 1, B: 2 }, minutes: null, landscapes: [], kingdom: [] } });
    const list = achievements({ name: 'A', rated: 2, wins: 2, peak: 1090, results: [g(1, 1000, 1060), g(2, 1060, 1090)], allGames: 2 }, shipped);
    const b = list.find(x => x.id === 'tier-commoner');
    expect(b).toMatchObject({ name: 'Reached Commoner', target: 1075, tier: 'common' });
    expect(b.tierIcon.id).toBe('commoner');
    expect(b.earned).toBeTruthy();                                    // the 2nd game took them to 1090, over the line
    expect(list.find(x => x.id === 'tier-knight').earned).toBeFalsy();
    const rank = grouped(list).find(s => s.group === 'Milestones').items.find(i => i.id === 'rank');
    expect(rank.steps.map(s => s.id)).toEqual(['tier-commoner', 'tier-knight', 'tier-lord', 'tier-duke', 'tier-emperor']);
  });
});

describe('grace on the player', () => {
  it('says which line they are under and how many games of grace remain', () => {
    const D = run(['A', 'A', 'A', 'A', 'A', 'B', 'B'], { promotionHold: 1 });
    const A = D.players.find(p => p.name === 'A');
    if (A.tierHeld) { expect(A.grace.line).toBe(A.tier.min); expect(A.grace.left).toBeGreaterThanOrEqual(0); } else expect(A.grace).toBeNull();
  });
});
