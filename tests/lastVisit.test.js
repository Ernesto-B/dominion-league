import { describe, it, expect } from 'vitest';
import { loadSeen, saveSeen, sinceLastVisit, snapshotOf } from '../src/lib/lastVisit.js';
import { gameSummary } from '../src/lib/night.js';

const tier = (id, name) => ({ id, name });
const P = (name, rank, elo, extra = {}) => ({ name, rank, elo, tier: tier(elo >= 1125 ? 'knight' : 'peasant', elo >= 1125 ? 'Knight' : 'Peasant'), streak: 0, nextTier: null, ...extra });
const game = (line, day = 1) => ({ line, day, n: 3 });
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; } }; };

describe('since you last looked', () => {
  const ranked0 = [P('Ann', 1, 1100), P('Bob', 2, 1050), P('Cy', 3, 1000)], games0 = [game(1), game(2)];
  const prev = snapshotOf(ranked0, games0, 1);

  it('records the newest game and everyone’s rank and tier', () => {
    expect(prev).toMatchObject({ line: 2, ranks: { Ann: 1, Bob: 2, Cy: 3 }, tiers: { Ann: 'peasant' }, elo: { Ann: 1100 } });
  });
  it('is silent the first time and when nothing is new', () => {
    expect(sinceLastVisit(null, ranked0, games0, 'Ann')).toBeNull();
    expect(sinceLastVisit(prev, ranked0, games0, 'Ann')).toBeNull();
  });
  it('counts new games and nights, and tells the viewer how they moved', () => {
    const now = [P('Cy', 1, 1130), P('Ann', 2, 1100), P('Bob', 3, 1020)], games = [...games0, game(3, 5), game(4, 6)];
    const s = sinceLastVisit(prev, now, games, 'Ann');
    expect(s.games).toBe(2); expect(s.nights).toBe(2);
    expect(s.lines[0].text).toBe('You slipped 1 place, to 2nd.');
    expect(s.lines.some(l => /Cy climbed 2 to 1st/.test(l.text))).toBe(true);
    expect(sinceLastVisit(prev, now, games, 'Cy').lines[0].text).toBe('You moved up 2 places, to 1st.');
    expect(sinceLastVisit(prev, now, games, 'Cy').lines.some(l => l.kind === 'tier')).toBe(true);   // Cy crossed into Knight
  });
  it('says who is on a streak, says how close the viewer is to a tier, and never more than four lines', () => {
    const now = [P('Ann', 1, 1100, { streak: 4, nextTier: { tier: tier('knight', 'Knight'), need: 25 } }), P('Bob', 2, 1050), P('Cy', 3, 1000)];
    const s = sinceLastVisit(prev, now, [...games0, game(3)], 'Ann');
    expect(s.lines.map(l => l.text)).toEqual(['You held 1st place.', '25 Elo from Knight.', 'You are on a 4-win streak.']);
    expect(s.lines.length).toBeLessThanOrEqual(4);
  });
  it('keeps what was seen in storage, and survives broken storage', () => {
    const st = mem(); saveSeen(st, 'a', prev); expect(loadSeen(st, 'a')).toEqual(prev); expect(loadSeen(st, 'b')).toBeNull();
    expect(loadSeen({ getItem: () => 'not json' }, 'a')).toBeNull(); expect(() => saveSeen({ setItem() { throw new Error('full'); } }, 'a', prev)).not.toThrow();
  });
});

describe('what a saved game did', () => {
  const tierFor = e => (e >= 1125 ? { id: 'knight', name: 'Knight' } : { id: 'peasant', name: 'Peasant' });
  const g = { names: ['Ann', 'Bob', 'Cy'], places: { Ann: 2, Bob: 1, Cy: 3 }, elo: { Ann: { before: 1100, after: 1100.4 }, Bob: { before: 1110, after: 1160 }, Cy: { before: 1000, after: 960 } } };
  const ranked = [P('Bob', 1, 1160), P('Ann', 2, 1100), P('Cy', 3, 960)];
  it('lists players in finish order with their rating, rank and tier moves', () => {
    const r = gameSummary(g, { ranks: { Ann: 1, Bob: 2, Cy: 3 }, tiers: {} }, ranked, tierFor);
    expect(r.map(x => x.name)).toEqual(['Bob', 'Ann', 'Cy']);
    expect(r[0]).toMatchObject({ delta: 50, rankBefore: 2, rankAfter: 1, rankMove: 1 }); expect(r[0].tierUp).toMatchObject({ name: 'Knight' });
    expect(r[1].rankMove).toBe(-1); expect(r[2].delta).toBe(-40); expect(r[2].tierUp).toBeNull();
  });
  it('copes with a first-time player and with a game that moved nothing', () => {
    expect(gameSummary(g, { ranks: {}, tiers: {} }, ranked, tierFor)[0].rankBefore).toBeNull();
    expect(gameSummary({ names: ['A'], places: { A: 1 }, elo: {} }, { ranks: {} }, [], tierFor)).toBeNull(); expect(gameSummary(null, { ranks: {} }, [], tierFor)).toBeNull();
  });
});
