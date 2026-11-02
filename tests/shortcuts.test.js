import { describe, expect, it } from 'vitest';
import { GO, activeBindings, isTyping, normKey, registerShortcuts } from '../src/lib/shortcuts.js';

describe('keyboard shortcuts', () => {
  it('lets the page that is showing win, and forgets it when it leaves', () => {
    const run = () => {}, a = registerShortcuts(() => [{ key: 'r', label: 'site', run }, { key: '1', label: 'one', run }]);
    const b = registerShortcuts(() => [{ key: 'r', label: 'page', run }]);
    const now = activeBindings(); expect(now.find(x => x.key === 'r').label).toBe('page'); expect(now.map(x => x.key).sort()).toEqual(['1', 'r']);
    registerShortcuts(() => [])();                                            // a page that registered and left changes nothing
    const off = registerShortcuts(() => [{ key: 'z', label: 'z', run }]); off();
    expect(activeBindings().find(x => x.key === 'z')).toBeUndefined();
    b(); expect(activeBindings().find(x => x.key === 'r').label).toBe('site'); a(); expect(activeBindings()).toEqual([]);
  });
  it('ignores key presses meant for a field', () => {
    expect(isTyping({ tagName: 'INPUT' })).toBe(true); expect(isTyping({ tagName: 'SELECT' })).toBe(true); expect(isTyping({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTyping({ tagName: 'BUTTON' })).toBe(false); expect(isTyping(null)).toBe(false);
  });
  it('treats letters without regard to case, and has no two pages on one letter', () => {
    expect(normKey('R')).toBe('r'); expect(normKey('ArrowLeft')).toBe('ArrowLeft');
    expect(new Set(GO.map(g => g[0])).size).toBe(GO.length);
  });
});

import { matches, idOf } from '../src/lib/shortcuts.js';
import { hasTrail, popTrail, pushTrail } from '../src/lib/randomTrail.js';
import { vi, beforeEach } from 'vitest';
describe('Shift + a letter', () => {
  it('is its own shortcut: R and Shift+R do different things, and a ? is not a Shift binding', () => {
    const r = { key: 'r' }, sr = { key: 'r', shift: true }, q = { key: '?' };
    expect(matches(r, { key: 'r', shiftKey: false })).toBe(true); expect(matches(r, { key: 'R', shiftKey: true })).toBe(false);
    expect(matches(sr, { key: 'R', shiftKey: true })).toBe(true); expect(matches(sr, { key: 'r', shiftKey: false })).toBe(false);
    expect(matches(q, { key: '?', shiftKey: true })).toBe(true);
    expect(idOf(sr)).toBe('shift+r'); expect(idOf(r)).toBe('r');
  });
});
describe('the random trail (Shift+R)', () => {
  let store; beforeEach(() => { store = {}; vi.stubGlobal('sessionStorage', { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }); });
  it('walks back one card per press, skipping the page you are on', () => {
    pushTrail('card', 'A'); pushTrail('card', 'B'); pushTrail('card', 'C');   // A -> B -> C -> D by Random, now on D
    expect(hasTrail('card', 'D')).toBe(true);
    expect(popTrail('card', 'D')).toBe('C'); expect(popTrail('card', 'C')).toBe('B'); expect(popTrail('card', 'B')).toBe('A');
    expect(popTrail('card', 'A')).toBeNull(); expect(hasTrail('card', 'A')).toBe(false);
  });
  it('keeps cards and landscapes apart, and a repeat is not stored twice', () => {
    pushTrail('card', 'A'); pushTrail('card', 'A'); expect(popTrail('landscape', 'x')).toBeNull();
    expect(popTrail('card', 'Z')).toBe('A'); expect(popTrail('card', 'Z')).toBeNull();
  });
});
