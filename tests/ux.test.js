import { describe, it, expect, beforeEach } from 'vitest';
import { UX_FLAGS, parseUx, serializeUx, resolveUx, uxOn, resetUxForTests, applyUxClasses } from '../src/ux.js';

const ALL = Object.keys(UX_FLAGS);
const memory = (init = {}) => { const m = { ...init }; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, m }; };

describe('UX experiment switches', () => {
  beforeEach(() => resetUxForTests());
  it('reads none / all / a list, ignores unknown names, and falls back to the default', () => {
    expect(parseUx('none')).toEqual([]); expect(parseUx('off')).toEqual([]); expect(parseUx('all')).toEqual(ALL);
    expect(parseUx('nav,home')).toEqual(['nav', 'home']); expect(parseUx('home, nav ')).toEqual(['nav', 'home']);   // always in the canonical order
    expect(parseUx('nav,banana')).toEqual(['nav']); expect(parseUx('banana')).toEqual(ALL); expect(parseUx(null)).toEqual(ALL);
  });
  it('round-trips through the stored form', () => {
    for (const l of [[], ALL, ['nav'], ['home', 'flow']]) expect(parseUx(serializeUx(l))).toEqual(l);
    expect(serializeUx([])).toBe('none'); expect(serializeUx(ALL)).toBe('all');
  });
  it('the URL wins and is remembered; without it the remembered choice is used; with neither, everything is on', () => {
    const s = memory();
    expect(resolveUx('', s)).toEqual(ALL);
    expect(resolveUx('?ux=none', s)).toEqual([]); expect(s.m['dl.ux']).toBe('none');
    expect(resolveUx('', s)).toEqual([]);                                   // remembered
    expect(resolveUx('?other=1&ux=nav,home', s)).toEqual(['nav', 'home']); expect(resolveUx('', s)).toEqual(['nav', 'home']);
  });
  it('survives storage that is blocked or full', () => {
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(resolveUx('?ux=home', bad)).toEqual(['home']); expect(resolveUx('', bad)).toEqual(ALL); expect(resolveUx('', null)).toEqual(ALL);
  });
  it('marks <html> with a class per flag that is on', () => {
    const cls = new Set(), root = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
    resetUxForTests(); globalThis.location = { search: '?ux=nav,lists' }; globalThis.localStorage = memory();
    applyUxClasses(root);
    expect([...cls].sort()).toEqual(['ux-lists', 'ux-nav']); expect(uxOn('nav')).toBe(true); expect(uxOn('home')).toBe(false);
    delete globalThis.location; delete globalThis.localStorage;
  });
});
