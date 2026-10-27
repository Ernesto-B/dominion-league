import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { humanize } from '../../src/dominion/constants.js';
import { DEFAULT_CARD_FILTERS as D0, DEFAULT_LANDSCAPE_FILTERS as L0, filterCards, browseCards, browseLandscapes, activeCardFilters, activeLandscapeFilters, debtMatches, norm } from '../../src/dominion/filters.js';

const { cards, landscapes } = realCatalog();
const F = over => ({ ...D0, ...over });
const names = list => list.map(c => c.name);

describe('card search and filtering', () => {
  it('returns everything with no filters', () => { expect(filterCards(cards, D0)).toHaveLength(331); expect(activeCardFilters(D0)).toBe(0); });
  it('searches names case-insensitively, ignoring accents and extra spaces', () => {
    expect(names(filterCards(cards, F({ q: '  COURTYARD ' })))).toEqual(['Courtyard']);
    expect(norm('Café')).toBe('cafe');
    expect(filterCards(cards, F({ q: 'sea' })).every(c => /sea/i.test(c.name))).toBe(true);
  });
  it('every word must match', () => { expect(names(filterCards(cards, F({ q: 'royal black' })))).toEqual(['Royal Blacksmith']); });
  it('also finds a card by its previous name', () => { expect(names(filterCards(cards, F({ q: 'harem' })))).toEqual(['Farm']); });
  it('filters by one or several expansions (any of them)', () => {
    expect(filterCards(cards, F({ expansions: ['Plunder'] }))).toHaveLength(40);
    expect(filterCards(cards, F({ expansions: ['Plunder', 'Menagerie'] }))).toHaveLength(70);
  });
  it('combines facets with AND', () => {
    const r = filterCards(cards, F({ expansions: ['Dark Ages'], types: ['Attack'] }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every(c => c.expansion === 'Dark Ages' && c.types.includes('Attack'))).toBe(true);
  });
});

describe('multi-type cards', () => {
  it('a card with several types is found under each of them', () => {
    const lurk = cards.find(c => c.types.length === 3);
    for (const t of lurk.types) expect(filterCards(cards, F({ types: [t] })).map(c => c.id)).toContain(lurk.id);
  });
  it('"all selected" requires every type; "any selected" requires one', () => {
    const both = filterCards(cards, F({ types: ['Action', 'Attack'], typeMode: 'all' }));
    const either = filterCards(cards, F({ types: ['Action', 'Attack'], typeMode: 'any' }));
    expect(both.every(c => c.types.includes('Action') && c.types.includes('Attack'))).toBe(true);
    expect(both.length).toBeLessThan(either.length);
    expect(both.length).toBe(cards.filter(c => c.types.includes('Action') && c.types.includes('Attack')).length);
    expect(either.length).toBe(cards.filter(c => c.types.includes('Action') || c.types.includes('Attack')).length);
  });
  it('a three-type request only matches cards that have all three', () => {
    const r = filterCards(cards, F({ types: ['Action', 'Duration', 'Attack'], typeMode: 'all' }));
    r.forEach(c => ['Action', 'Duration', 'Attack'].forEach(t => expect(c.types).toContain(t)));
  });
});

describe('cost filters', () => {
  it('filters by one or several exact coin costs (any of them)', () => {
    expect(filterCards(cards, F({ costs: [5] }))).toHaveLength(130);
    expect(filterCards(cards, F({ costs: [5, 6] }))).toHaveLength(130 + 14);
    expect(filterCards(cards, F({ costs: [9, 10] }))).toHaveLength(2);
    expect(filterCards(cards, F({ costs: [5] })).every(c => c.coins === 5)).toBe(true);
  });
  it('a Debt-only card has no coin cost, so it never matches a coin chip (not even $0)', () => {
    const debtOnly = cards.filter(c => c.coins === 0 && c.debt > 0).map(c => c.name).sort();
    expect(debtOnly).toEqual(['City Quarter', 'Engineer', 'Overlord', 'Royal Blacksmith']);
    expect(filterCards(cards, F({ costs: [0] }))).toEqual([]);                       // no card actually costs $0
    for (const c of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(names(filterCards(cards, F({ costs: [c] }))).some(n => debtOnly.includes(n)), '$' + c).toBe(false);
  });
  it('a card with BOTH coins and Debt matches its coin cost and its Debt cost (Fortune: 8 coins + 8 Debt)', () => {
    expect(names(filterCards(cards, F({ costs: [8] })))).toContain('Fortune');
    expect(names(filterCards(cards, F({ debt: '8' })))).toContain('Fortune');
    expect(names(filterCards(cards, F({ costs: [8], debt: '8' })))).toEqual(['Fortune']);
  });
  it('filters Debt: any / none / has / an exact amount', () => {
    expect(filterCards(cards, F({ debt: 'any' }))).toHaveLength(331);
    expect(filterCards(cards, F({ debt: 'has' }))).toHaveLength(5);
    expect(filterCards(cards, F({ debt: 'none' }))).toHaveLength(326);
    expect(names(filterCards(cards, F({ debt: '4' }))).sort()).toEqual(['Engineer']);
    expect(names(filterCards(cards, F({ debt: '8' }))).sort()).toEqual(['City Quarter', 'Fortune', 'Overlord', 'Royal Blacksmith']);   // Fortune is 8 coins + 8 Debt (8D8)
    expect(debtMatches(0, 'none')).toBe(true);
  });
});

describe('mechanics filters never imply a negative', () => {
  const m = 'cantrip';
  it('"has the tag" returns exactly the cards where the tag is recorded', () => {
    const r = filterCards(cards, F({ mechanics: [m] }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.every(c => c.mechanicIds.includes(m))).toBe(true);
    expect(r).toHaveLength(cards.filter(c => c.mechanicIds.includes(m)).length);
  });
  it('offers no "without" / "exclude" operation at all (a missing tag is not a confirmed "no")', () => {
    expect(Object.keys(D0).concat(Object.keys(L0)).some(k => /not|without|exclude|lacks|missing/i.test(k))).toBe(false);
    // unknown keys in a filter object are ignored, never interpreted as a negation
    const base = filterCards(cards, F({ mechanics: [m] })).length;
    expect(filterCards(cards, { ...F({ mechanics: [m] }), exclude: [m], not: [m], without: [m] })).toHaveLength(base);
  });
  it('an untagged card is simply absent from a tag filter — it is not reported as lacking the effect', () => {
    const untagged = cards.filter(c => !c.mechanicIds.includes(m));
    expect(untagged.length).toBeGreaterThan(0);
    expect(filterCards(cards, F({ mechanics: [m] })).some(c => untagged.includes(c))).toBe(false);
  });
  it('"all" needs every selected tag; "any" needs one', () => {
    const ids = ['cantrip', 'village'];
    const all = filterCards(cards, F({ mechanics: ids, mechanicMode: 'all' })), any = filterCards(cards, F({ mechanics: ids, mechanicMode: 'any' }));
    expect(all.every(c => ids.every(i => c.mechanicIds.includes(i)))).toBe(true);
    expect(any.every(c => ids.some(i => c.mechanicIds.includes(i)))).toBe(true);
    expect(all.length).toBeLessThanOrEqual(any.length);
  });
});

describe('sorting, counting and clearing', () => {
  it('sorts by name both ways', () => {
    const asc = names(browseCards(cards, F({ sort: 'name' })));
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    expect(names(browseCards(cards, F({ sort: 'name', dir: 'desc' })))).toEqual([...asc].reverse());
  });
  it('sorts by coin cost (then Debt, then name), with Debt-only cards LAST in both directions', () => {
    for (const dir of ['asc', 'desc']) {
      const c = browseCards(cards, F({ sort: 'cost', dir }));
      const coinCards = c.filter(x => x.coins > 0 || x.debt === 0), debtOnly = c.filter(x => !(x.coins > 0 || x.debt === 0));
      expect(c.slice(0, 327).every(x => x.coins > 0 || x.debt === 0), dir + ': coin-cost cards first').toBe(true);
      expect(debtOnly.map(x => x.name).sort()).toEqual(['City Quarter', 'Engineer', 'Overlord', 'Royal Blacksmith']);
      expect(c.slice(327).map(x => x.id)).toEqual(debtOnly.map(x => x.id));
      for (let i = 1; i < coinCards.length; i++) expect(dir === 'asc' ? coinCards[i - 1].coins <= coinCards[i].coins : coinCards[i - 1].coins >= coinCards[i].coins, `${dir} ${coinCards[i - 1].name}/${coinCards[i].name}`).toBe(true);
      const d = debtOnly.map(x => x.debt); expect(dir === 'asc' ? d : [...d].reverse()).toEqual([...d].sort((x, y) => x - y));   // among themselves, by Debt
    }
    expect(browseCards(cards, F({ sort: 'cost', dir: 'asc' }))[0].name).toBe('Poor House');   // the cheapest COIN card, not a Debt card
  });
  it('sorts by expansion order', () => { expect(browseCards(cards, F({ sort: 'expansion' }))[0].expansion).toBe('Dominion Base Game'); });
  it('sorting never changes how many cards match', () => {
    expect(browseCards(cards, F({ sort: 'cost', dir: 'desc', expansions: ['Empires'] }))).toHaveLength(36);
  });
  it('counts active filters, and clearing returns to the defaults', () => {
    const f = F({ q: 'a', expansions: ['Empires'], types: ['Action'], costs: [2], debt: 'has', sort: 'cost' });
    expect(activeCardFilters(f)).toBe(5);
    expect(browseCards(cards, { ...D0 })).toHaveLength(331);
  });
  it('an impossible combination yields an empty list, not an error', () => {
    expect(filterCards(cards, F({ expansions: ['Plunder'], debt: 'has', types: ['Victory'] }))).toEqual([]);
  });
});

describe('sorting by every table column', () => {
  const by = (sort, dir = 'asc') => browseCards(cards, F({ sort, dir }));
  it('knows each card\'s shared pile (null when it has its own)', () => {
    expect(cards.find(c => c.name === 'Catapult').sharedPile).toBe('Catapult / Rocks');
    expect(cards.find(c => c.name === 'Dame Anna').sharedPile).toBe('Knights');
    expect(cards.find(c => c.name === 'Courtyard').sharedPile).toBeNull();
    expect(cards.filter(c => c.sharedPile)).toHaveLength(10 + 8 + 5 * 2);   // Knights + Castles + five split piles
  });
  it('sorts by printed type, reading multi-type cards together, then by name', () => {
    const r = by('types'); const key = c => c.types.join(' ');
    for (let i = 1; i < r.length; i++) expect(key(r[i - 1]).localeCompare(key(r[i])) <= 0, `${r[i - 1].name} / ${r[i].name}`).toBe(true);
    expect(by('types', 'desc').map(c => c.id)).toEqual([...r].reverse().map(c => c.id));
  });
  it('sorts by number of copies, then by name', () => {
    const r = by('copies');
    for (let i = 1; i < r.length; i++) expect(r[i - 1].copies <= r[i].copies).toBe(true);
    expect(r[0].copies).toBe(1); expect(by('copies', 'desc')[0].name).toBe('Rats');   // 20 copies
    const ties = r.filter(c => c.copies === 10).map(c => c.name); expect(ties).toEqual([...ties].sort((a, b) => a.localeCompare(b)));
  });
  it('sorts by shared pile with cards that have none LAST in both directions', () => {
    for (const dir of ['asc', 'desc']) {
      const r = by('pile', dir), shared = r.filter(c => c.sharedPile);
      expect(shared).toHaveLength(28);
      expect(r.slice(0, 28).every(c => c.sharedPile), dir + ': shared piles first').toBe(true);
      expect(r.slice(28).every(c => !c.sharedPile), dir + ': the rest last').toBe(true);
    }
    const asc = by('pile', 'asc').slice(0, 28).map(c => c.sharedPile), desc = by('pile', 'desc').slice(0, 28).map(c => c.sharedPile);
    expect(asc[0].localeCompare(asc.at(-1)) <= 0).toBe(true); expect(desc[0].localeCompare(desc.at(-1)) >= 0).toBe(true);
  });
  it('an unknown sort key falls back to name instead of throwing', () => { expect(names(by('nonsense')).slice(0, 3)).toEqual(names(by('name')).slice(0, 3)); });
});

describe('landscape browsing', () => {
  const LF = over => ({ ...L0, ...over });
  it('lists all 124, and 48 Events', () => {
    expect(browseLandscapes(landscapes, L0)).toHaveLength(124);
    expect(browseLandscapes(landscapes, LF({ types: ['Event'] }))).toHaveLength(48);
  });
  it('filters by type, expansion and name together', () => {
    const r = browseLandscapes(landscapes, LF({ types: ['Way'], expansions: ['Menagerie'] }));
    expect(r).toHaveLength(20);
    expect(r.every(l => l.type === 'Way' && l.expansion === 'Menagerie')).toBe(true);
    expect(browseLandscapes(landscapes, LF({ q: 'way of the butterfly' })).map(l => l.name)).toEqual(['Way of the Butterfly']);
  });
  it('counts its own active filters', () => { expect(activeLandscapeFilters(LF({ q: 'x', types: ['Way'] }))).toBe(2); });
  it('filters by recorded tag with the same positive-only meaning', () => {
    const tag = landscapes.find(l => l.mechanicIds.length).mechanicIds[0];
    const r = browseLandscapes(landscapes, LF({ mechanics: [tag] }));
    expect(r.every(l => l.mechanicIds.includes(tag))).toBe(true);
  });
});

describe('sorting landscapes by every table column', () => {
  const LF = over => ({ ...L0, ...over });
  const by = (sort, dir = 'asc') => browseLandscapes(landscapes, LF({ sort, dir }));
  it('sorts by name both ways', () => {
    const asc = by('name').map(l => l.name); expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    expect(by('name', 'desc').map(l => l.name)).toEqual([...asc].reverse());
  });
  it('sorts by type, then name', () => {
    const r = by('type'); for (let i = 1; i < r.length; i++) expect(r[i - 1].type.localeCompare(r[i].type) <= 0).toBe(true);
    expect(r[0].type).toBe('Event'); expect(by('type', 'desc')[0].type).toBe('Way');
    const events = r.filter(l => l.type === 'Event').map(l => l.name); expect(events).toEqual([...events].sort((a, b) => a.localeCompare(b)));
  });
  it('sorts by "when it applies" using the label people read, not the raw id', () => {
    const label = l => humanize(l.trigger);
    const r = by('trigger'); for (let i = 1; i < r.length; i++) expect(label(r[i - 1]).localeCompare(label(r[i])) <= 0, `${r[i - 1].name}/${r[i].name}`).toBe(true);
    const d = by('trigger', 'desc'); for (let i = 1; i < d.length; i++) expect(label(d[i - 1]).localeCompare(label(d[i])) >= 0).toBe(true);
    expect(label(r[0])).toBe('Action play alternative');
  });
  it('a landscape with no trigger sorts last in BOTH directions', () => {
    const odd = [{ id: 'x:1', name: 'Zero', type: 'Event', expansion: 'Empires', trigger: null, mechanicIds: [] }, ...landscapes];
    for (const dir of ['asc', 'desc']) expect(browseLandscapes(odd, LF({ sort: 'trigger', dir })).at(-1).name, dir).toBe('Zero');
  });
  it('an unknown key falls back to name; sorting never changes how many match', () => {
    expect(by('nonsense').slice(0, 3).map(l => l.name)).toEqual(by('name').slice(0, 3).map(l => l.name));
    expect(browseLandscapes(landscapes, LF({ sort: 'trigger', dir: 'desc', types: ['Way'] }))).toHaveLength(20);
  });
});
