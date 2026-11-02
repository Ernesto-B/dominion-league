import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { generate, rerollSlot, seededRng, DEFAULT_OPTIONS, COST_SPREADS } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const roll = (opts, seed) => generate(catalog, { ...DEFAULT_OPTIONS, ...opts }, { rng: seededRng(seed) });
const seeds = Array.from({ length: 100 }, (_, i) => i + 1);
const attacks = r => r.slots.filter(s => s.cards.some(c => c.types.includes('Attack'))).length;
const costs = r => r.slots.map(s => s.cards[0]);

describe('at least N Attacks', () => {
  it('every roll has at least that many, and still honours "at most"', () => {
    seeds.forEach(n => {
      const a = roll({ minAttacks: 5 }, n); expect(a.ok).toBe(true); expect(attacks(a)).toBeGreaterThanOrEqual(5);
      const b = roll({ minAttacks: 3, maxAttacks: 3 }, n); expect(b.ok).toBe(true); expect(attacks(b)).toBe(3);
    });
  });
  it('says so when the limits cannot fit, or the chosen expansions have too few Attacks', () => {
    expect(roll({ minAttacks: 4, maxAttacks: 2 }, 1)).toMatchObject({ ok: false, message: expect.stringMatching(/At least 4 Attacks but at most 2/) });
    expect(roll({ minAttacks: 6, expansions: ['Dominion Base Game'] }, 1)).toMatchObject({ ok: false, message: expect.stringMatching(/Only [1-9]\d* Attack cards/) });
  });
  it('a single re-roll cannot take the kingdom below the minimum', () => {
    const base = roll({ minAttacks: 4 }, 5), o = { ...DEFAULT_OPTIONS, minAttacks: 4 };
    base.slots.forEach((_, i) => { const r = rerollSlot(catalog, o, base, i, { rng: seededRng(i + 3) }); if (r.ok) expect(attacks(r)).toBeGreaterThanOrEqual(4); });
  });
});

describe('a cost cap', () => {
  it('no card costs more than the cap, and none costs Debt', () => {
    [3, 4, 5].forEach(cap => seeds.slice(0, 40).forEach(n => {
      const r = roll({ maxCost: cap }, n); expect(r.ok).toBe(true);
      costs(r).forEach(c => { expect(c.debt).toBe(0); expect(c.coins).toBeLessThanOrEqual(cap); });
    }));
  });
  it('refuses a card you included that is over the cap', () => {
    const big = catalog.cards.find(c => c.coins === 6 && c.debt === 0);
    expect(roll({ maxCost: 4, include: [big.id] }, 1)).toMatchObject({ ok: false, message: expect.stringMatching(/costs more than your limit/) });
  });
});

describe('the Barbell cost spread', () => {
  it('always has at least three cheap ($2 or less) and three pricey ($6 or more) cards in ten', () => {
    expect(COST_SPREADS.barbell.label).toBe('Barbell');
    seeds.forEach(n => {
      const r = roll({ costSpread: 'barbell' }, n); expect(r.ok).toBe(true);
      expect(costs(r).filter(c => c.debt === 0 && c.coins <= 2).length).toBeGreaterThanOrEqual(3);
      expect(costs(r).filter(c => c.debt === 0 && c.coins >= 6).length).toBeGreaterThanOrEqual(3);
    });
  });
  it('still rolls with an expansion that has few expensive cards (it asks for what exists)', () => {
    expect(roll({ costSpread: 'barbell', expansions: ['Dominion Base Game'] }, 2).ok).toBe(true);
  });
});
