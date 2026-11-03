import { describe, expect, it } from 'vitest';
import { chaseHref, chaseOptions } from '../src/lib/chase.js';
import { optionsFromParams } from '../src/dominion/randomizer.js';

describe('rolling a kingdom to chase a badge', () => {
  it('aims the randomizer at the badges its rules can steer', () => {
    expect(chaseOptions('war-zone')).toEqual({ minAttacks: 5 });
    expect(chaseOptions('turning-point')).toEqual({ landscapes: 1, landscapeTypes: ['Event'] });
    expect(chaseOptions('ten-kingdoms')).toBeNull();      // "every pile from a different expansion" cannot be forced
    expect(chaseHref('ten-kingdoms')).toBeNull();
  });
  it('links to a Randomizer address that reads back as exactly those options', () => {
    const href = chaseHref('cheap-tricks'), q = href.split('?')[1];
    expect(href.startsWith('#/dominion/randomizer?')).toBe(true);
    expect(optionsFromParams(new URLSearchParams(q)).maxCost).toBe(4);
    expect(optionsFromParams(new URLSearchParams(chaseHref('the-great-divide').split('?')[1])).costSpread).toBe('barbell');
    expect(optionsFromParams(new URLSearchParams(chaseHref('gold-rush').split('?')[1])).themes).toEqual(['treasure']);
  });
});

describe('expansion badges', () => {
  it('aim a roll at just that expansion, leaning to cards not seen yet', () => {
    expect(chaseOptions('exp-base-half', { expansion: 'Base Game' })).toEqual({ expansions: ['Base Game'], favor: true });
    const o = optionsFromParams(new URLSearchParams(chaseHref('exp-base-half', { expansion: 'Base Game' }).split('?')[1]));
    expect(o.expansions).toEqual(['Base Game']);
  });
});
