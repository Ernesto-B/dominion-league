import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { RECOMMENDED } from '../../src/dominion/recommended.js';

const catalog = realCatalog();
// a card by name, or a pile by its name (Knights, Catapult/Rocks: the first half names the pile's card)
const find = n => catalog.cards.find(c => c.name === n.split('/')[0]) || catalog.pilesByKey && [...catalog.pilesByKey.values()].find(p => p.id === n);
describe('the recommended kingdoms', () => {
  it('has 139 sets, each with ten Kingdom cards', () => {
    expect(RECOMMENDED.length).toBe(139);
    for (const s of RECOMMENDED) expect(s.cards.length, s.name).toBe(10);
  });
  it('has no set twice (a set is named once, whichever expansion it is listed under)', () => { const ids = RECOMMENDED.map(s => s.id); expect(new Set(ids).size).toBe(ids.length); });
  it('names only cards and landscapes that are in the catalog', () => {
    const missing = [];
    for (const s of RECOMMENDED) {
      for (const n of s.cards) if (!find(n)) missing.push(`${s.name}: card ${n}`);
      for (const l of s.landscapes) { const nm = l.name || l; if (!catalog.landscapes.find(x => x.name === nm)) missing.push(`${s.name}: landscape ${nm}`); if (l.on && !s.cards.includes(l.on)) missing.push(`${s.name}: ${nm} sits on ${l.on}, which is not in the set`); }
    }
    expect(missing).toEqual([]);
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { itemsOfSet } from '../../src/dominion/recommended.js';
import RecommendedPicker from '../../src/dominion/components/RecommendedPicker.jsx';
import { stateFromItems } from '../../src/dominion/randomizer.js';

describe('using a recommended set in Game night', () => {
  const set = name => RECOMMENDED.find(s => s.name === name);
  it('turns every set into ten Kingdom cards (a Bane is extra), with a Trait on its card', () => {
    for (const s of RECOMMENDED) { const r = itemsOfSet(catalog, s); expect(r.missing, s.name).toEqual([]); expect(r.items.filter(i => i.kind === 'card').length, s.name).toBe(10 + (r.baneId ? 1 : 0)); }
    const r = itemsOfSet(catalog, set('Basic Looting')), trait = r.items.find(i => i.kind === 'landscape');
    expect(catalog.landscapesById.get(trait.id).name).toBe('Tireless'); expect(catalog.cardsById.get(trait.on).name).toBe('Harbor Village');
  });
  it('keeps the Bane a set names, so the kingdom shows it as the Young Witch\'s Bane and is not short a card', () => {
    const r = itemsOfSet(catalog, set('Gilding the Lily')), st = stateFromItems(catalog, r.items, r.baneId);
    expect(catalog.cardsById.get(r.baneId).name).toBe('Vassal'); expect(st.slots.length).toBe(10); expect(st.setup.bane.name).toBe('Vassal'); expect(st.setup.needsBane).toBe(false);
  });
  it('offers the sets as a list under expansion buttons, and greys one that uses a card from the other table', () => {
    const h = renderToStaticMarkup(<RecommendedPicker catalog={catalog} onChoose={() => {}} />);
    expect(h).toContain('First Game'); expect(h).toContain('Size Distortion'); expect(h).toContain('Which recommended kingdom?');
    const busy = renderToStaticMarkup(<RecommendedPicker catalog={catalog} avoid={[{ id: catalog.cards.find(c => c.name === 'Cellar').id }]} onChoose={() => {}} />);
    expect(busy).toContain('in use at the other table');
  });
});
