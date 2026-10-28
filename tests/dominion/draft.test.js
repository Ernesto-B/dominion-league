import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { snakeSeat, snakeOrder, rollPool, finishDraft, shuffled } from '../../src/dominion/draft.js';
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
