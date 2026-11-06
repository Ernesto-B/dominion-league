import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { generate, seededRng, COST_SPREADS, DEFAULT_OPTIONS } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
describe('cost mix', () => {
  it('is Standard unless said otherwise', () => { expect(DEFAULT_OPTIONS.costSpread).toBe('standard'); });
  it('lands on the average cost its hover promises', () => {
    for (const [k, c] of Object.entries(COST_SPREADS)) {
      if (!c.avg) continue;
      let sum = 0, n = 0;
      for (let i = 1; i <= 200; i++) { const r = generate(catalog, { costSpread: k }, { rng: seededRng(i) }); const cs = r.slots.filter(s => s.cards[0].debt === 0).map(s => s.cards[0].coins); sum += cs.reduce((a, b) => a + b, 0) / cs.length; n++; }
      expect(Math.abs(sum / n - c.avg)).toBeLessThan(0.25);
    }
  });
});
