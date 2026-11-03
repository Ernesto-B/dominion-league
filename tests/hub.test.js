import { describe, it, expect } from 'vitest';
import { nextUp } from '../src/lib/hub.js';

const b = (id, tier, extra = {}) => ({ id, name: id, hint: id, tier, earned: null, ...extra });

describe('nextUp', () => {
  it('puts partly done badges first (closest first), then the easiest unstarted ones, skipping earned badges', () => {
    const list = [
      b('done', 'common', { earned: { date: '2026-01-01' } }),
      b('hard', 'epic'), b('easy', 'common'),
      b('half', 'rare', { value: 5, target: 10 }), b('almost', 'rare', { value: 9, target: 10 }),
    ];
    expect(nextUp(list, 4).map(x => x.id)).toEqual(['almost', 'half', 'easy', 'hard']);
    expect(nextUp(list, 2).map(x => x.id)).toEqual(['almost', 'half']);
  });
  it('offers only the next step of a track', () => {
    const list = [b('s1', 'common', { track: 't', trackName: 'Track', earned: { date: 'x' } }), b('s2', 'uncommon', { track: 't', trackName: 'Track', value: 3, target: 5 }), b('s3', 'rare', { track: 't', trackName: 'Track', value: 3, target: 20 })];
    const r = nextUp(list, 3);
    expect(r.map(x => x.id)).toEqual(['s2']);
    expect(r[0].track).toBe('Track'); expect(r[0].pct).toBeCloseTo(0.6);
  });
  it('returns nothing when everything is earned', () => { expect(nextUp([b('a', 'common', { earned: {} })])).toEqual([]); });
});

import { nextUp as nextUpExp } from '../src/lib/hub.js';
import { chaseHref as chaseExp } from '../src/lib/chase.js';
describe('Next up keeps what a kingdom chase needs', () => {
  it('an expansion step arrives with its expansion, so it gets a Randomizer link', () => {
    const [x] = nextUpExp([{ id: 'exp-base-half', name: 'Village Elder', tier: 'uncommon', target: 14, value: 10, expansion: 'Base Game', earned: null }], 1);
    expect(x.expansion).toBe('Base Game');
    expect(chaseExp(x.id, x)).toMatch(/^#\/dominion\/randomizer\?/);
  });
});
