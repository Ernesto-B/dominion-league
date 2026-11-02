import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { generate, rerollSlot, seededRng, slotThemeRole, THEMES, THEME_KEYS, DEFAULT_OPTIONS } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const roll = (opts, seed, extra = {}) => generate(catalog, { ...DEFAULT_OPTIONS, ...opts }, { rng: seededRng(seed), ...extra });
const cores = (r, t) => r.slots.filter(s => slotThemeRole(catalog, s, t) === 'core').length;
const seeds = Array.from({ length: 120 }, (_, i) => i + 1);

describe('building a kingdom around a theme', () => {
  for (const t of THEME_KEYS) {
    it(`${THEMES[t].chip}: every roll has at least four core cards (of ten) and leans that way more than a plain roll`, () => {
      const themed = seeds.map(n => roll({ themes: [t] }, n)), plain = seeds.map(n => roll({}, n));
      themed.forEach(r => { expect(r.ok).toBe(true); expect(r.slots).toHaveLength(10); expect(cores(r, t)).toBeGreaterThanOrEqual(4); });
      const avg = rs => rs.reduce((n, r) => n + cores(r, t), 0) / rs.length;
      expect(avg(themed)).toBeGreaterThan(avg(plain) + 1);
    });
  }
  it('two themes need at least three core cards each, three themes two each', () => {
    seeds.forEach(n => {
      const two = roll({ themes: ['treasure', 'trash'] }, n); expect(two.ok).toBe(true);
      expect(cores(two, 'treasure')).toBeGreaterThanOrEqual(3); expect(cores(two, 'trash')).toBeGreaterThanOrEqual(3);
      const three = roll({ themes: ['duration', 'vp', 'trash'] }, n); expect(three.ok).toBe(true);
      ['duration', 'vp', 'trash'].forEach(t => expect(cores(three, t)).toBeGreaterThanOrEqual(2));
    });
  });
  it('treats Spoils-givers and Loot-givers as Treasure-centric, and Throne-style cards as support for Duration', () => {
    const slot = name => { const c = catalog.cards.find(x => x.name === name); return { key: c.pileKey, cards: [c] }; };
    expect(slotThemeRole(catalog, slot('Marauder'), 'treasure')).toBe('core');
    expect(slotThemeRole(catalog, slot('Bandit Camp'), 'treasure')).toBe('core');
    expect(slotThemeRole(catalog, slot('Cutthroat'), 'treasure')).toBe('core');     // gains Loot
    expect(slotThemeRole(catalog, slot('Fortune'), 'treasure')).toBe('core');
    expect(slotThemeRole(catalog, slot('Throne Room'), 'duration')).toBe('support');
    expect(slotThemeRole(catalog, slot('Village'), 'treasure')).toBeNull();
  });
  it('cards you lock or include count toward the minimum', () => {
    const wharf = catalog.cards.find(c => c.name === 'Wharf'), caravan = catalog.cards.find(c => c.name === 'Caravan');
    const r = roll({ themes: ['duration'], include: [wharf.id, caravan.id] }, 7);
    expect(r.ok).toBe(true); expect(cores(r, 'duration')).toBeGreaterThanOrEqual(4);
    expect(r.slots.some(s => s.cards.some(c => c.id === wharf.id))).toBe(true);
  });
  it('says so, plainly, when the chosen expansions have nothing to build around', () => {
    const r = roll({ themes: ['duration'], expansions: ['Base Game'] }, 1);   // Base Game has no Duration cards
    expect(r.ok).toBe(false); expect(r.message).toMatch(/Duration cards/);
  });
  it('a single re-roll keeps the theme at its minimum', () => {
    const base = roll({ themes: ['trash'] }, 3);
    for (let i = 0; i < base.slots.length; i++) {
      const res = rerollSlot(catalog, { ...DEFAULT_OPTIONS, themes: ['trash'] }, base, i, { rng: seededRng(i + 10) });
      if (res.ok) expect(cores(res, 'trash')).toBeGreaterThanOrEqual(4);
    }
  });
  it('is the same roll for the same seed, and a theme changes it', () => {
    expect(roll({ themes: ['vp'] }, 42).slots.map(s => s.key)).toEqual(roll({ themes: ['vp'] }, 42).slots.map(s => s.key));
    expect(roll({ themes: ['vp'] }, 42).slots.map(s => s.key)).not.toEqual(roll({}, 42).slots.map(s => s.key));
  });
});
