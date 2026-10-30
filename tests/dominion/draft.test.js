import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { snakeSeat, snakeOrder, rollPool, finishDraft, shuffled, poolSizeFor, draftState, bansNeeded, handSwaps } from '../../src/dominion/draft.js';
import { DEFAULT_OPTIONS, seededRng } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();

describe('snake order', () => {
  it('goes 1-2-3-3-2-1 and keeps going back and forth', () => {
    expect(Array.from({ length: 10 }, (_, i) => snakeSeat(i, 3))).toEqual([0, 1, 2, 2, 1, 0, 0, 1, 2, 2]);
    expect(Array.from({ length: 8 }, (_, i) => snakeSeat(i, 2))).toEqual([0, 1, 1, 0, 0, 1, 1, 0]);
    expect(snakeOrder(['A', 'B', 'C', 'D'], 6)).toEqual(['A', 'B', 'C', 'D', 'D', 'C']);
  });
  it('a shuffle keeps everyone', () => { expect(shuffled(['A', 'B', 'C', 'D'], seededRng(3)).sort()).toEqual(['A', 'B', 'C', 'D']); });
});

describe('the pool and the finished kingdom', () => {
  it('is twice the kingdom, with no pile twice, and the same seed gives the same pool', () => {
    const a = rollPool(catalog, DEFAULT_OPTIONS, 42);
    expect(a.ok).toBe(true); expect(a.pool).toHaveLength(20); expect(new Set(a.pool.map(s => s.key)).size).toBe(20); expect(a.n).toBe(10);
    expect(rollPool(catalog, DEFAULT_OPTIONS, 42).pool.map(s => s.key)).toEqual(a.pool.map(s => s.key));
  });
  it('follows the rules in the pool: no Attacks means none to choose', () => {
    const r = rollPool(catalog, { ...DEFAULT_OPTIONS, maxAttacks: 0 }, 7);
    expect(r.ok).toBe(true); expect(r.pool.some(s => s.cards.some(c => c.types.includes('Attack')))).toBe(false);
  });
  it('a smaller kingdom drafts from a proportionally smaller pool', () => {
    const r = rollPool(catalog, { ...DEFAULT_OPTIONS, cards: 6 }, 9);
    expect(r.pool).toHaveLength(12); expect(r.n).toBe(6);
  });
  it('turns the picks into a kingdom of exactly those piles, with its landscapes and setup notes', () => {
    const d = rollPool(catalog, { ...DEFAULT_OPTIONS, landscapes: 2 }, 11);
    const picked = d.pool.slice(0, 10).map(s => s.key);
    const res = finishDraft(catalog, d, picked);
    expect(res.ok).toBe(true); expect(res.slots.map(s => s.key).sort()).toEqual(picked.slice().sort());
    expect(res.landscapes.map(l => l.landscape.id).sort()).toEqual(d.landscapes.map(l => l.landscape.id).sort());
    expect(res.setup).toBeTruthy(); expect(res.seed).toBeNull();
  });
  it('says so when the chosen expansions cannot fill a pool', () => {
    const r = rollPool(catalog, { ...DEFAULT_OPTIONS, expansions: ['Plunder'], cards: 12, exclude: catalog.cards.filter(c => c.expansion === 'Plunder').slice(0, 20).map(c => c.id) }, 1);
    expect(r.ok).toBe(false); expect(r.message).toMatch(/./);
  });
});

describe('the Game night draft', () => {
  it('suggests a pool by the number of players, leaving the last pick 4 to 6 cards after one ban each', () => {
    expect([2, 3, 4, 5, 6].map(poolSizeFor)).toEqual([15, 16, 17, 20, 20]);
    for (const p of [2, 3, 4, 5, 6]) expect(poolSizeFor(p) - p - 9).toBeGreaterThanOrEqual(4);
  });
  it('rolls the suggested number of cards to pick ten from, repeatable for one seed', () => {
    const a = rollPool(catalog, DEFAULT_OPTIONS, 5, { n: 10, size: 17 });
    expect(a.ok).toBe(true); expect(a.pool).toHaveLength(17); expect(a.n).toBe(10); expect(a.size).toBe(17);
    expect(rollPool(catalog, DEFAULT_OPTIONS, 5, { n: 10, size: 17 }).pool.map(s => s.key)).toEqual(a.pool.map(s => s.key));
  });
  it('starts with no bans (one each when turned on), and ignores a draft saved for other players', () => {
    const st = draftState(null, ['A', 'B', 'C']);
    expect(st).toMatchObject({ bans: false, draft: null, picks: [], banned: [], finished: false }); expect(bansNeeded(st)).toBe(0);
    expect(bansNeeded({ ...st, bans: true })).toBe(3);
    const saved = { ...st, seats: ['C', 'A', 'B'], picks: ['x'] };
    expect(draftState(saved, ['A', 'B', 'C']).seats).toEqual(['C', 'A', 'B']);
    expect(draftState(saved, ['A', 'B', 'D']).picks).toEqual([]);
  });
});

describe('optional bans', () => {
  it("a skipped ban is a null that still uses up the seat's turn", () => {
    const st = { ...draftState(null, ['A', 'B', 'C']), bans: true };
    const banned = ['k1', null, 'k3'];   // B skipped
    expect(banned.length).toBe(bansNeeded(st));
    expect(banned.filter(Boolean)).toEqual(['k1', 'k3']);
    expect(JSON.parse(JSON.stringify({ ...st, banned })).banned).toEqual(banned);   // it survives the saved night
  });
});

describe('picking by hand after a draft', () => {
  it('says which card each hand-picked card replaced, and which are left over', () => {
    expect(handSwaps(['a', 'b', 'c'], ['a', 'b', 'c'])).toMatchObject({ removed: [], added: [], extra: [] });
    const one = handSwaps(['a', 'b', 'c'], ['a', 'x', 'c']);
    expect(one.removed).toEqual(['b']); expect([...one.replacedBy]).toEqual([['b', 'x']]); expect(one.extra).toEqual([]);
    const two = handSwaps(['a', 'b', 'c'], ['a', 'x', 'y', 'z']);   // c and b out, x y z in: two pairs and one extra
    expect(two.removed).toEqual(['b', 'c']); expect(two.replacedBy.get('b')).toBe('x'); expect(two.replacedBy.get('c')).toBe('y'); expect(two.extra).toEqual(['z']);
    const gone = handSwaps(['a', 'b'], ['a']);
    expect(gone.removed).toEqual(['b']); expect(gone.replacedBy.size).toBe(0);
  });
});
