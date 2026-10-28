import { describe, it, expect } from 'vitest';
import { tierProgress, LOWEST_TIER_SPAN } from '../src/lib/tierProgress.js';

const peasant = { id: 'peasant', min: null }, knight = { id: 'knight', min: 1125 }, lord = { id: 'lord', min: 1275 };

describe('progress to the next tier', () => {
  it('the lowest tier starts 250 below the first threshold, so a rating under the start still shows progress', () => {
    expect(LOWEST_TIER_SPAN).toBe(250);
    expect(tierProgress(875, peasant, knight)).toBe(0);
    expect(tierProgress(909, peasant, knight)).toBeCloseTo(34 / 250);
    expect(tierProgress(1000, peasant, knight)).toBeCloseTo(0.5);
  });
  it('a rating below the floor is an empty bar, never negative; other tiers run from their own threshold', () => {
    expect(tierProgress(700, peasant, knight)).toBe(0);
    expect(tierProgress(1200, knight, lord)).toBeCloseTo(0.5);
  });
});
