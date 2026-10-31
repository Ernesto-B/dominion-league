import { describe, expect, it } from 'vitest';
import * as Eng from '../src/lib/engine.js';

// Two players; A wins N games to climb, then results are scripted. Elo is steady-model, so we only assert on tiers relative to the real Elo.
const cfg = grace => ({ elo: { model: 'steady', k: 100, provisionalK: 100, start: 1000, demotionGrace: grace }, tiers: [{ id: 'peasant', name: 'Peasant', min: null }, { id: 'knight', name: 'Knight', min: 1020 }] });
const row = (d, f) => ({ date: d, finish: f, type: 'Regular' });
function run(grace, results) {
  const rows = results.map((w, i) => row(`2026-01-${String(i + 1).padStart(2, '0')}`, w === 'A' ? 'A > B' : 'B > A'));
  return Eng.compute(cfg(grace), rows, 100000);
}

describe('demotion grace', () => {
  it('holds the tier for one game under the line, then drops', () => {
    // find a script where A crosses the line and then loses twice
    const D = run(1, ['A', 'A', 'A', 'B', 'B', 'B', 'B']);
    const tiers = D.games.map(g => g.tierSnap.A.id), elos = D.games.map(g => g.snapshot.A);
    const first = tiers.indexOf('knight'); expect(first).toBeGreaterThan(-1);
    const under = elos.findIndex((e, i) => i > first && Math.round(e) < 1020);
    expect(under).toBeGreaterThan(first);
    expect(tiers[under]).toBe('knight');       // first game under the line: kept
    expect(Math.round(elos[under + 1])).toBeLessThan(1020);
    expect(tiers[under + 1]).toBe('peasant');  // still under after the next game: dropped
  });
  it('forgets the grace when back over the line', () => {
    const D = run(1, ['A', 'A', 'A', 'B', 'A', 'A', 'B', 'A']);
    const lastTiers = D.games.map(g => g.tierSnap.A.id);
    expect(lastTiers.includes('peasant') && lastTiers.indexOf('peasant') > lastTiers.indexOf('knight')).toBe(false);
  });
  it('is off by default and never changes the Elo', () => {
    const off = run(0, ['A', 'A', 'A', 'B', 'B', 'B']), on = run(1, ['A', 'A', 'A', 'B', 'B', 'B']);
    expect(on.games.map(g => g.snapshot.A)).toEqual(off.games.map(g => g.snapshot.A));
    off.games.forEach(g => expect(g.tierSnap.A.id).toBe(Eng.compute(cfg(0), [], 1).tierFor(g.snapshot.A).id));
  });
  it('marks a held player on the ladder', () => {
    const D = run(1, ['A', 'A', 'A', 'B']);
    const A = D.players.find(p => p.name === 'A');
    expect(A.tierHeld).toBe(Math.round(A.elo) < 1020);
  });
});

describe('saving grace', () => {
  const cfgS = s => ({ ...cfg(1), elo: { ...cfg(1).elo, savingGrace: s } });
  const go = (s, res) => Eng.compute(cfgS(s), res.map((w, i) => row(`2026-01-${String(i + 1).padStart(2, '0')}`, w === 'A' ? 'A > B' : 'B > A')), 100000);
  it('pays 10% of the last loss to a held player who then finishes top half', () => {
    const on = go(0.1, ['A', 'A', 'A', 'B', 'B', 'A']), off = go(0, ['A', 'A', 'A', 'B', 'B', 'A']);
    const i = on.games.findIndex(g => g.elo.A && g.elo.A.saving);
    expect(i).toBe(5);
    const loss = on.games[4].elo.A.before - on.games[4].elo.A.after;
    expect(on.games[5].elo.A.saving).toBeCloseTo(0.1 * loss, 6);
    expect(on.games[5].elo.A.after - off.games[5].elo.A.after).toBeCloseTo(0.1 * loss, 6);
  });
  it('pays nothing after a bottom-half finish or when not held', () => {
    const on = go(0.1, ['A', 'A', 'A', 'B', 'B', 'B']);
    on.games.forEach(g => expect(g.elo.A.saving).toBeUndefined());
  });
});
