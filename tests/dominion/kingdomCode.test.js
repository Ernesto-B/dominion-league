import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { decodeKingdom, encodeKingdom, looksLikeCode } from '../../src/dominion/kingdomCode.js';
import { rollSeeded, stateFromItems, toGameItems, DEFAULT_OPTIONS } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const card = n => catalog.cards.find(c => c.name === n).id;
const names = s => s.slots.map(x => x.name);

describe('kingdom codes', () => {
  it('round-trips a hand-picked kingdom', () => {
    const st = stateFromItems(catalog, ['Village', 'Smithy', 'Market', 'Moat'].map(n => ({ kind: 'card', id: card(n) })));
    const code = encodeKingdom(catalog, st);
    expect(code).toMatch(/^K-[0-9A-Z-]+$/);
    expect(names(decodeKingdom(catalog, code).state)).toEqual(names(st));
  });
  it('is forgiving about case, dashes, spaces and look-alike letters', () => {
    const st = stateFromItems(catalog, ['Village', 'Smithy'].map(n => ({ kind: 'card', id: card(n) })));
    const code = encodeKingdom(catalog, st);
    expect(names(decodeKingdom(catalog, code.toLowerCase().replace(/-/g, ' ')).state)).toEqual(names(st));
  });
  it('round-trips a whole roll: cards, landscapes, a Trait\'s host and a Bane', () => {
    for (const seed of [1, 7, 123456, 999999]) {
      const res = rollSeeded(catalog, { ...DEFAULT_OPTIONS, landscapes: 3 }, seed);
      if (!res.ok) continue;
      const back = decodeKingdom(catalog, encodeKingdom(catalog, res)).state;
      expect(names(back)).toEqual(names(res));
      expect(back.landscapes.map(l => [l.landscape.id, l.on])).toEqual(res.landscapes.map(l => [l.landscape.id, l.on]));
      expect(toGameItems(back)).toEqual(toGameItems(res));
    }
  });
  it('keeps a Young Witch\'s Bane', () => {
    const items = [card('Young Witch'), card('Smithy'), card('Village')].map(id => ({ kind: 'card', id }));
    const st = stateFromItems(catalog, items, card('Village'));
    const back = decodeKingdom(catalog, encodeKingdom(catalog, st)).state;
    expect(back.setup.bane.name).toBe('Village'); expect(names(back)).toEqual(['Young Witch', 'Smithy']);
  });
  it('refuses nonsense, and a code made against another card list', () => {
    expect(decodeKingdom(catalog, 'K-????').error).toBeTruthy();
    expect(decodeKingdom(catalog, 'K-ZZZZ-ZZZZ').error).toBeTruthy();
    const st = stateFromItems(catalog, [{ kind: 'card', id: card('Village') }]);
    const code = encodeKingdom(catalog, st), other = { ...catalog, cards: catalog.cards.slice(1) };
    expect(decodeKingdom(other, code).error).toMatch(/different card list/);
  });
  it('tells a code from a seed', () => {
    expect(looksLikeCode('K-AB12-CD34')).toBe(true); expect(looksLikeCode('k ab12')).toBe(true);
    expect(looksLikeCode('182736')).toBe(false); expect(looksLikeCode('')).toBe(false);
  });
});
