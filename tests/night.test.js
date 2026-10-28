import { describe, it, expect } from 'vitest';
import { STEPS, blankNight, canAdvance, advance, back, nextStep, prevStep, stepNumber, elapsed, loadNight, saveNight, clearNight, todayISO } from '../src/lib/night.js';

const memory = (init = {}) => { const m = { ...init }; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; }, m }; };

describe('Game night steps', () => {
  it('runs Players, Kingdom, Play, Scores, Save in that order, and cannot go past either end', () => {
    expect(STEPS.map(s => s.id)).toEqual(['players', 'kingdom', 'play', 'scores', 'review']);
    expect(nextStep('review')).toBe('review'); expect(prevStep('players')).toBe('players'); expect(nextStep('players')).toBe('kingdom'); expect(stepNumber('scores')).toBe(4);
  });
  it('needs two players before leaving the first step, and nothing after that', () => {
    const st = blankNight('2026-01-01');
    expect(canAdvance('players', st)).toBe(false); expect(advance(st)).toBe(st);
    expect(canAdvance('players', { ...st, picked: ['Ann'] })).toBe(false); expect(canAdvance('players', { ...st, picked: ['Ann', 'Bob'] })).toBe(true);
    for (const s of ['kingdom', 'play', 'scores', 'review']) expect(canAdvance(s, st)).toBe(true);
  });
  it('starts the clock when the game begins, once, and goes back without touching it', () => {
    let st = { ...blankNight(), picked: ['Ann', 'Bob'], kingdom: [{ kind: 'card', id: 'a:b' }] };   // a kingdom, so there is a Play step
    st = advance(st, 1000); expect(st.step).toBe('kingdom'); expect(st.startedAt).toBeNull();
    st = advance(st, 5000); expect(st.step).toBe('play'); expect(st.startedAt).toBe(5000);
    st = advance(st, 9000); expect(st.step).toBe('scores'); st = back(back(st)); expect(st.step).toBe('kingdom'); st = advance(st, 20000); expect(st.step).toBe('play'); expect(st.startedAt).toBe(5000);   // never restarted
  });
  it('skips the Play step when there is no kingdom to keep on screen, in both directions', () => {
    let st = { ...blankNight(), picked: ['Ann', 'Bob'], step: 'kingdom' };
    st = advance(st, 5000); expect(st.step).toBe('scores'); expect(st.startedAt).toBeNull();
    expect(back(st).step).toBe('kingdom');
    const withKingdom = { ...blankNight(), picked: ['Ann', 'Bob'], step: 'kingdom', kingdom: [{ kind: 'card', id: 'a:b' }] };
    expect(advance(withKingdom, 5000).step).toBe('play'); expect(back({ ...withKingdom, step: 'scores' }).step).toBe('play');
  });
  it('says how long the game has been going', () => {
    expect(elapsed(null)).toBe(''); expect(elapsed(1000, 1000 + 30000)).toBe('just started'); expect(elapsed(0, 23 * 60000)).toBe('23 min'); expect(elapsed(0, 65 * 60000)).toBe('1 h 05 min'); expect(elapsed(5000, 1000)).toBe('just started');
  });
  it('formats today as an ISO date', () => { expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05'); });
});

describe('keeping a Game night between page loads', () => {
  it('saves per group and loads it back, without the heavy rolled kingdom', () => {
    const s = memory(), st = { ...blankNight('2026-01-01'), step: 'scores', picked: ['Ann', 'Bob'], vp: { Ann: '30' }, rolled: { slots: [1, 2, 3] }, kingdom: [{ kind: 'card', id: 'a:b' }] };
    expect(saveNight(s, 'g1', st)).toBe(true);
    const back = loadNight(s, 'g1', '2026-02-02');
    expect(back).toMatchObject({ step: 'scores', picked: ['Ann', 'Bob'], vp: { Ann: '30' }, kingdom: [{ kind: 'card', id: 'a:b' }], rolled: null });
    expect(loadNight(s, 'g2', '2026-02-02')).toEqual(blankNight('2026-02-02'));           // another group starts clean
  });
  it('clears after a save, and survives missing, corrupt, wrong-shaped or blocked storage', () => {
    const s = memory(); saveNight(s, 'g1', { ...blankNight(), picked: ['Ann', 'Bob'] }); clearNight(s, 'g1'); expect(loadNight(s, 'g1', 'T')).toEqual(blankNight('T'));
    expect(loadNight(memory({ 'dl.night.g1': '{not json' }), 'g1', 'T')).toEqual(blankNight('T'));
    expect(loadNight(memory({ 'dl.night.g1': JSON.stringify({ step: 'nonsense', picked: [] }) }), 'g1', 'T')).toEqual(blankNight('T'));
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(loadNight(bad, 'g1', 'T')).toEqual(blankNight('T')); expect(saveNight(bad, 'g1', blankNight())).toBe(false); expect(() => clearNight(bad, 'g1')).not.toThrow();
  });
});
