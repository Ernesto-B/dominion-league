import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let store, hist;
beforeEach(() => {
  store = {}; hist = { state: { dlNav: 'e1' } };
  vi.stubGlobal('history', hist);
  vi.stubGlobal('sessionStorage', { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } });
});

describe('page state that comes back with Back', () => {
  it('is kept for one history entry and not for another', async () => {
    const { saveEntryState, loadEntryState } = await import('../src/lib/entryState.js');
    saveEntryState('last-night', [12, 15]);
    expect(loadEntryState('last-night')).toEqual([12, 15]);       // Back to this entry: the same games are open
    hist.state = { dlNav: 'e2' };                                   // the same page reached by a new link: a different entry
    expect(loadEntryState('last-night')).toBeUndefined();
    hist.state = null;                                              // an entry not tagged yet: nothing to keep or find
    saveEntryState('x', 1); expect(loadEntryState('x')).toBeUndefined();
  });
  it('opens the saved games on the first render', async () => {
    const { saveEntryState, useOpenGames } = await import('../src/lib/entryState.js');
    saveEntryState('t', [7]);
    let seen; const C = () => { const [open] = useOpenGames('t'); seen = [...open]; return null; };
    renderToStaticMarkup(createElement(C)); expect(seen).toEqual([7]);
    hist.state = { dlNav: 'other' }; renderToStaticMarkup(createElement(C)); expect(seen).toEqual([]);
  });
});
