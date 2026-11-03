import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { realCatalog } from './dominion/fixtures.js';
import { scopeCatalog, setKeyOf } from '../src/dominion/model.js';
import { EXPANSIONS } from '../src/dominion/constants.js';
import { SET_NAMES, setIconPath } from '../src/lib/sets.js';
import { generate } from '../src/dominion/randomizer.js';
import { badgesFor, xpOf } from '../src/lib/xp.js';
import * as Eng from '../src/lib/engine.js';

const cat = realCatalog();
const all = new Set(SET_NAMES);
const without = (...off) => new Set(SET_NAMES.filter(n => !off.includes(n)));

describe('the expansion registry', () => {
  it('lists every set the league has always had, in the same order', () => {
    expect(SET_NAMES).toEqual(['Base', 'Intrigue', 'Seaside', 'Prosperity', 'Hinterlands', 'Dark Ages', 'Cornucopia & Guilds', 'Adventures', 'Empires', 'Renaissance', 'Menagerie', 'Plunder', 'Rising Sun']);
  });
  it('has an icon file for every set (a new entry without its picture fails here)', () => {
    SET_NAMES.forEach(n => expect(existsSync(path.join('public', setIconPath(n))), `${n}: public/${setIconPath(n)}`).toBe(true));
  });
  it('knows every expansion in the catalog (otherwise it could never be switched off)', () => {
    cat.expansions.forEach(e => expect(EXPANSIONS[e.name], `${e.name} has no entry in dominion/constants.js EXPANSIONS`).toBeDefined());
  });
});

describe('switching a set off', () => {
  it('changes nothing while every set is on', () => { expect(scopeCatalog(cat, all)).toBe(cat); expect(scopeCatalog(cat, null)).toBe(cat); });
  const off = scopeCatalog(cat, without('Seaside'));
  it('leaves that expansion out of every list', () => {
    expect(off.cards.some(c => c.expansion === 'Seaside')).toBe(false);
    expect(off.piles.some(p => p.expansion === 'Seaside')).toBe(false);
    expect(off.landscapes.some(l => l.expansion === 'Seaside')).toBe(false);
    expect(off.expansions.some(e => e.name === 'Seaside')).toBe(false);
    expect(off.ownedExpansions.length).toBe(cat.ownedExpansions.length - 1);
    expect(off.cards.length).toBeLessThan(cat.cards.length);
  });
  it('still knows every id, so a past game keeps its names; the strict view does not', () => {
    const seaside = cat.cards.find(c => c.expansion === 'Seaside');
    expect(off.cardsById.get(seaside.id)).toBe(seaside);
    expect(off.strict.cardsById.get(seaside.id)).toBeUndefined();
  });
  it('is the same object for the same inputs (components compare catalogs by identity)', () => { expect(scopeCatalog(cat, without('Seaside'))).toBe(off); });
  it('never lets the Randomizer draw it, even when asked for it by name', () => {
    for (let i = 0; i < 20; i++) {
      const r = generate(off, { expansions: ['Seaside', 'Intrigue'] });
      expect(r.ok).toBe(true);
      r.slots.forEach(s => s.cards.forEach(c => expect(c.expansion).not.toBe("Seaside")));
    }
  });
  it('maps the catalog name to the league set key', () => { expect(setKeyOf('Dominion Base Game')).toBe('Base'); expect(setKeyOf('Unlisted Box')).toBe('Unlisted Box'); });
  it('keeps an expansion the registry has never heard of switched on', () => {
    const odd = { ...cat, expansions: [...cat.expansions, { name: 'Unlisted Box', order: 99 }], cards: [...cat.cards, { ...cat.cards[0], id: 'x:1', expansion: 'Unlisted Box' }] };
    expect(scopeCatalog(odd, without('Seaside')).cards.some(c => c.expansion === 'Unlisted Box')).toBe(true);
  });
});

describe('badges when a set is switched off', () => {
  // one player who sat in a game whose kingdom is every Seaside card id the catalog has (enough to look like they "played with" the set)
  const seasideIds = cat.cards.filter(c => c.expansion === 'Seaside').map(c => ({ kind: 'card', id: c.id }));
  const row = { _line: 1, date: '2026-01-10', type: '', finish: 'Ann > Bob', sets: '', landscapes: '', playerVP: {}, kingdom: seasideIds };
  const D = Eng.compute({ title: 't', players: ['Ann', 'Bob'], seasons: [], elo: {}, season: {} }, [row], Eng.todayDay());
  const ann = D.players.find(p => p.name === 'Ann');
  const on = badgesFor(D, ann, cat), offList = badgesFor(D, ann, scopeCatalog(cat, without('Seaside')));
  it('lists the set\'s own badge track only while the set is on', () => {
    expect(on.some(b => b.id.startsWith('exp-seaside'))).toBe(true);
    expect(offList.some(b => b.id.startsWith('exp-seaside'))).toBe(false);
  });
  it('earns it again, untouched, when the set is switched back on', () => {
    const back = badgesFor(D, ann, scopeCatalog(cat, all));
    expect(back.filter(b => b.id.startsWith('exp-seaside') && b.earned).map(b => b.id)).toEqual(on.filter(b => b.id.startsWith('exp-seaside') && b.earned).map(b => b.id));
  });
  it('stops counting what the set\'s cards earned (the Collection total shrinks)', () => {
    const total = l => l.find(b => b.id === 'master-of-all-realms').target;
    expect(total(offList)).toBeLessThan(total(on));
  });
  it('XP never goes up when a set is switched off', () => { expect(xpOf(D, 'Ann', scopeCatalog(cat, without('Seaside'))).total).toBeLessThanOrEqual(xpOf(D, 'Ann', cat).total); });
});
