import { describe, it, expect } from 'vitest';
import { createNightHistory, readView, viewOf, withView } from '../src/lib/nightHistory.js';
import { blankNight } from '../src/lib/night.js';

// a window with just enough history: a list of entries, an index, and pushState / replaceState / back / forward that behave like the browser's (popstate is raised by the test)
function fakeWindow(hash = '#/night/g1') {
  const entries = [{ hash, state: null }]; let i = 0;
  const win = {
    entries,
    get location() { return { hash: entries[i].hash }; },
    history: {
      get state() { return entries[i].state; },
      pushState(state, _t, url) { entries.splice(i + 1); entries.push({ hash: url, state }); i = entries.length - 1; },
      replaceState(state, _t, url) { entries[i] = { hash: url, state }; },
    },
    go(d) { i += d; return entries[i].state; },
    index: () => i,
  };
  return win;
}

describe('which screen a night is on', () => {
  const st = (o = {}) => ({ ...blankNight(), ...o });
  it('names every screen of the flow, so each has its own address', () => {
    expect(viewOf(st())).toBe('players');
    expect(viewOf(st({ step: 'kingdom' }))).toBe('kingdom');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'random' }))).toBe('kingdom-random');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'random', randomDone: true }))).toBe('kingdom-random-summary');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'manual' }))).toBe('kingdom-manual');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'recommended', recPicking: true, kingdom: [{ kind: 'card', id: 'x' }] }))).toBe('kingdom-recommended');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'recommended', recPicking: false, kingdom: [{ kind: 'card', id: 'x' }] }))).toBe('kingdom-recommended-set');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'recommended', recPicking: false, randomDone: true, kingdom: [{ kind: 'card', id: 'x' }] }))).toBe('kingdom-recommended-summary');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'draft' }))).toBe('kingdom-draft');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'draft', draftSave: { draft: {}, finished: false } }))).toBe('kingdom-draft-run');
    expect(viewOf(st({ step: 'kingdom', kingdomMode: 'draft', draftSave: { draft: {}, finished: true } }))).toBe('kingdom-draft-done');
    for (const s of ['play', 'scores', 'review']) expect(viewOf(st({ step: s }))).toBe(s);
  });
  it('writes the screen into the address and reads it back', () => {
    expect(withView('#/night/g1', 'play')).toBe('#/night/g1?v=play');
    expect(withView('#/night/g1?v=kingdom', 'play')).toBe('#/night/g1?v=play');
    expect(readView('#/night/g1?v=kingdom-random-summary')).toBe('kingdom-random-summary'); expect(readView('#/night/g1')).toBe(null);
  });
});

describe('the browser history of a night', () => {
  it('opens on its first screen, then makes an entry for every move, and a move back or forward is told apart', () => {
    const w = fakeWindow(), h = createNightHistory(w);
    h.start('players'); expect(w.entries.length).toBe(1); expect(readView(w.location.hash)).toBe('players');
    h.changed('kingdom'); h.changed('kingdom-random'); expect(w.entries.length).toBe(3); expect(readView(w.location.hash)).toBe('kingdom-random');
    expect(h.popped(w.go(-1))).toBe('back'); expect(readView(w.location.hash)).toBe('kingdom');
    h.changed('kingdom');   // the state caught up with the address: no new entry
    expect(w.entries.length).toBe(3);
    expect(h.popped(w.go(1))).toBe('forward'); h.changed('kingdom-random'); expect(w.entries.length).toBe(3);
  });
  it('drops the screens ahead when you go back and choose differently', () => {
    const w = fakeWindow(), h = createNightHistory(w);
    h.start('players'); h.changed('kingdom'); h.changed('kingdom-random');
    h.popped(w.go(-1)); h.changed('kingdom');
    h.changed('kingdom-manual');
    expect(w.entries.map(e => readView(e.hash))).toEqual(['players', 'kingdom', 'kingdom-manual']);
  });
  it('ignores entries that are not the night\'s, and puts the address right when a Forward was not allowed', () => {
    const w = fakeWindow(), h = createNightHistory(w);
    h.start('players'); h.changed('kingdom');
    expect(h.popped(null)).toBe(null); expect(h.popped({ other: 1 })).toBe(null);
    h.popped(w.go(-1)); h.changed('players');
    expect(h.popped(w.go(1))).toBe('forward');   // the state stays on players (the move was refused)
    h.settle('players'); expect(readView(w.location.hash)).toBe('players');
  });
  it('the page\'s own Back with nothing earlier in the history rewrites the entry instead of adding one', () => {
    const w = fakeWindow(), h = createNightHistory(w);
    h.start('kingdom'); expect(h.index()).toBe(0);
    h.changed('players', { back: true }); expect(w.entries.length).toBe(1); expect(readView(w.location.hash)).toBe('players');
  });
  it('carries on from the entry it finds after a reload', () => {
    const w = fakeWindow('#/night/g1?v=play'); w.entries[0].state = { night: 1, n: 4 };
    const h = createNightHistory(w); h.start('play'); expect(h.index()).toBe(4);
    h.changed('scores'); expect(w.history.state.n).toBe(5);
  });
});
