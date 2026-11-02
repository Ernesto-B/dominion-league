import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store, hist;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  store = {};
  hist = { state: null, scrollRestoration: 'auto', replaceState(s) { this.state = s; } };
  globalThis.history = hist;
  globalThis.sessionStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  globalThis.document = { documentElement: { scrollHeight: 4000 } };
  globalThis.window = { scrollY: 0, innerHeight: 800, scrollTo: vi.fn((x, y) => { globalThis.window.scrollY = y; }), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('performance', { now: () => Date.now(), getEntriesByType: () => [] });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('going back to where you were', () => {
  it('a new page starts at the top, and Back to a page you scrolled puts you back down it', async () => {
    const nav = await import('../src/lib/navMemory.js');
    nav.startNavMemory();                                  // the page you are on gets a tag
    const first = hist.state.dlNav; expect(first).toBeTruthy(); expect(hist.scrollRestoration).toBe('manual');
    window.scrollY = 1250;                                 // scrolled down the game report, then clicked a card
    hist.state = null;                                     // a clicked link is a new history entry with no tag
    expect(nav.onNavigate({ pathChanged: true })).toBe('top');
    const second = hist.state.dlNav; expect(second).not.toBe(first);
    window.scrollY = 0;
    hist.state = { dlNav: first };                         // Back: the browser restores the first entry, tag and all
    expect(nav.onNavigate({ pathChanged: true })).toEqual({ restore: 1250 });
  });
  it('does nothing to the scroll when only the query changed (a filter click)', async () => {
    const nav = await import('../src/lib/navMemory.js');
    nav.startNavMemory(); hist.state = null;
    expect(nav.onNavigate({ pathChanged: false })).toBeNull();
  });
  it('waits for a page to grow tall enough, and stops as soon as it has been reached', async () => {
    const nav = await import('../src/lib/navMemory.js');
    document.documentElement.scrollHeight = 900;           // the page is still short: it has not filled in yet
    nav.scrollBackTo(2000);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 100);   // as far as it can go for now
    document.documentElement.scrollHeight = 4000;          // the cards arrived
    await vi.advanceTimersByTimeAsync(100);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 2000);
    const calls = window.scrollTo.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1000);
    expect(window.scrollTo.mock.calls.length).toBeLessThanOrEqual(calls + 1);   // it stopped
  });
  it('goes to the top when there is no position to return to', async () => {
    const nav = await import('../src/lib/navMemory.js');
    nav.scrollBackTo(0); expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
