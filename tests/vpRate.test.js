import { describe, expect, it } from 'vitest';
import { vpPerMin } from '../src/lib/vpRate.js';

const g = (minutes, vp, sets, places = { Ann: 1 }) => ({ minutes, playerVP: vp, sets, places });
describe('VP per minute', () => {
  it('is total VP over total minutes of the timed games, overall and by expansion', () => {
    const D = { games: [g(40, { Ann: 40 }, ['Base']), g(20, { Ann: 30 }, ['Base', 'Seaside']), g(null, { Ann: 99 }, ['Base']), g(30, {}, ['Base']), g(30, { Ann: 10 }, ['Plunder'], { Bob: 1 })] };
    const r = vpPerMin(D, 'Ann');
    expect(r.games).toBe(2); expect(r.rate).toBeCloseTo(70 / 60);
    expect(r.bySet.Base.rate).toBeCloseTo(70 / 60); expect(r.bySet.Seaside).toEqual({ rate: 1.5, games: 1 }); expect(r.bySet.Plunder).toBeUndefined();
  });
  it('is null when nothing was timed', () => {
    expect(vpPerMin({ games: [g(null, { Ann: 5 }, ['Base'])] }, 'Ann')).toEqual({ rate: null, games: 0, bySet: {} });
  });
});
