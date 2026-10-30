import { describe, it, expect } from 'vitest';
import { STEPS, blankNight, canAdvance, advance, back, nextStep, prevStep, stepNumber, elapsed, loadNight, saveNight, clearNight, todayISO, NIGHT_TTL, NIGHT_VERSION, cleanNight } from '../src/lib/night.js';

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

describe('the game clock', () => {
  const kingdom = [{ kind: 'card', id: 'a' }];
  it('starts on Play, stops when leaving Play for the scores, and runs again if you go back', () => {
    let st = { ...blankNight(), step: 'kingdom', picked: ['Ann', 'Bob'], kingdom };
    st = advance(st, 1000); expect(st).toMatchObject({ step: 'play', startedAt: 1000, endedAt: null });
    st = advance(st, 1000 + 47 * 60000); expect(st).toMatchObject({ step: 'scores', startedAt: 1000, endedAt: 1000 + 47 * 60000 });
    st = advance(st, 9e9); expect(st.endedAt).toBe(1000 + 47 * 60000);   // typing the scores and reviewing don't move it
    st = back(back(st)); expect(st).toMatchObject({ step: 'play', endedAt: null, startedAt: 1000 });
  });
  it('a game with no kingdom has no clock', () => {
    const st = advance({ ...blankNight(), step: 'kingdom', picked: ['Ann', 'Bob'] }, 5);
    expect(st).toMatchObject({ step: 'scores', startedAt: null });
  });
});

describe('an old or odd saved night never breaks the page', () => {
  const store = raw => ({ getItem: () => raw, setItem() {}, removeItem() {} });
  const good = { ...blankNight('2026-10-30'), step: 'kingdom', picked: ['Ann', 'Bob'], v: NIGHT_VERSION, savedAt: 1 };
  const load = o => loadNight(store(JSON.stringify(o)), 'g1', '2026-10-30', 2);
  it('starts fresh when the save has another version, or none', () => {
    expect(load({ ...good, v: NIGHT_VERSION - 1 })).toEqual(blankNight('2026-10-30'));
    const { v, ...noVersion } = good; expect(load(noVersion)).toEqual(blankNight('2026-10-30'));
    expect(load(null)).toEqual(blankNight('2026-10-30')); expect(load('nonsense')).toEqual(blankNight('2026-10-30'));
    expect(loadNight(store('{not json'), 'g1', '2026-10-30')).toEqual(blankNight('2026-10-30'));
  });
  it('keeps what it understands and resets only the odd fields', () => {
    const st = load({ ...good, kingdom: 'oops', vp: [], kingdomMode: 'teleport', startedAt: 'yesterday', notes: 'keep me', rollOpts: { cards: 8 }, unknownField: 1 });
    expect(st).toMatchObject({ step: 'kingdom', picked: ['Ann', 'Bob'], notes: 'keep me', rollOpts: { cards: 8 }, kingdom: [], vp: {}, kingdomMode: null, startedAt: null });
    expect('unknownField' in st).toBe(false);
  });
  it('drops a draft that does not hold together, and one for players who are not at the table', () => {
    expect(load({ ...good, draftSave: { seats: 'Ann', picks: [], draft: null } }).draftSave).toBeNull();
    expect(load({ ...good, draftSave: { seats: ['Ann', 'Bob'], picks: [], banned: [], draft: { seed: 'x', options: {} } } }).draftSave).toBeNull();
    expect(load({ ...good, draftSave: { seats: ['Ann', 'Zed'], picks: [], banned: [], draft: null } }).draftSave).toBeNull();
    const ok = { seats: ['Bob', 'Ann'], picks: ['p'], banned: [null, 'q'], draft: { seed: 3, options: { cards: 10 }, n: 10, size: 17 }, bans: true, finished: false };
    expect(load({ ...good, draftSave: ok }).draftSave).toEqual(ok);
  });
  it('a kingdom of anything but { kind, id } items is dropped', () => {
    expect(load({ ...good, kingdom: [{ kind: 'card' }] }).kingdom).toEqual([]);
    const items = [{ kind: 'card', id: 'a' }, { kind: 'landscape', id: 'l', on: 'a' }];
    expect(load({ ...good, kingdom: items }).kingdom).toEqual(items);
  });
  it('a save that was just written reads back whole', () => {
    const mem = memory(), st = { ...blankNight(), step: 'scores', picked: ['Ann', 'Bob'], vp: { Ann: '20' }, kingdom: [{ kind: 'card', id: 'a' }], startedAt: 5, endedAt: 9 };
    saveNight(mem, 'g1', st); expect(loadNight(mem, 'g1')).toMatchObject({ step: 'scores', vp: { Ann: '20' }, kingdom: st.kingdom, startedAt: 5, endedAt: 9 });
  });
});

describe('how long a saved night is kept', () => {
  it('forgets a night older than the limit, keeps a recent one', () => {
    const st = memory(), at = Date.UTC(2026, 9, 30, 20, 0);
    saveNight(st, 'g1', { ...blankNight(), step: 'scores', picked: ['Ann', 'Bob'] }, at);
    expect(loadNight(st, 'g1', '2026-10-30', at + NIGHT_TTL - 1000).step).toBe('scores');
    expect(loadNight(st, 'g1', '2026-10-31', at + NIGHT_TTL + 1000)).toEqual(blankNight('2026-10-31'));
  });
});

describe('the kingdom method', () => {
  it('keeps the randomizer options and locked cards in the saved night', () => {
    const st = memory(), opts = { cards: 8, require: ['draw'] }, kept = { cards: ['k1'], lands: [], seed: '' };
    saveNight(st, 'g1', { ...blankNight(), step: 'kingdom', picked: ['Ann', 'Bob'], rollOpts: opts, kept });
    const back = loadNight(st, 'g1'); expect(back.rollOpts).toEqual(opts); expect(back.kept).toEqual(kept);
    expect(blankNight().rollOpts).toBeNull();
    const more = { handOpen: true, kept: { cards: [], lands: [], seed: '123456' }, draftSave: { seats: ['Ann', 'Bob'], picks: ['p1'], draft: { seed: 7, options: { cards: 10 } } } };
    saveNight(st, 'g2', { ...blankNight(), step: 'kingdom', picked: ['Ann', 'Bob'], ...more });
    expect(loadNight(st, 'g2')).toMatchObject(more);
  });
  it('starts with none chosen, and a reload keeps the method picked', () => {
    expect(blankNight().kingdomMode).toBeNull();
    const st = memory(); saveNight(st, 'g1', { ...blankNight(), step: 'kingdom', picked: ['Ann', 'Bob'], kingdomMode: 'draft' });
    expect(loadNight(st, 'g1').kingdomMode).toBe('draft');
  });
});
