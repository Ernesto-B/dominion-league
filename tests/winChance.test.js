import { describe, expect, it } from 'vitest';
import { winChances } from '../src/lib/winChance.js';

describe('win chances from Elo', () => {
  it('splits evenly at equal ratings and adds up to 100%', () => {
    expect(winChances([1000, 1000, 1000, 1000])).toEqual([0.25, 0.25, 0.25, 0.25]);
    const w = winChances([1300, 1100, 950]); expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it('gives a higher rating the bigger share: 400 points is ten times the weight', () => {
    const [a, b] = winChances([1400, 1000]); expect(a / b).toBeCloseTo(10, 6); expect(a).toBeGreaterThan(0.9);
  });
  it('copes with nothing', () => { expect(winChances([])).toEqual([]); });
});
