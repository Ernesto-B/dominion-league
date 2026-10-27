import { describe, it, expect } from 'vitest';
import { realCatalog } from './fixtures.js';
import { summarize, sortMatrixRows } from '../../src/dominion/stats.js';
import { rawFromCsv } from './fixtures.js';
import { formatCost, costLabel, hasCoin, sharedMechanicCards, pileOf, pileMembers } from '../../src/dominion/model.js';

const catalog = realCatalog();
const s = summarize(catalog);
const card = name => catalog.cards.find(c => c.name === name);

describe('counts are never confused', () => {
  it('keeps names, piles and physical copies apart', () => {
    expect(s.names).toBe(331);
    expect(s.piles).toBe(310);
    expect(s.copies).toBe(3132);
    expect(s.copiesFromCards).toBe(3132);
    expect(s.names).not.toBe(s.piles);
  });
  it('explains the gap: 7 multi-name piles hold 21 extra names', () => {
    expect(s.multiNamePiles.map(p => p.id).sort()).toEqual(['Castles', 'Catapult / Rocks', 'Encampment / Plunder', 'Gladiator / Fortune', 'Knights', 'Patrician / Emporium', 'Settlers / Bustling Village']);
    expect(s.extraNames).toBe(21);
  });
  it('does not count landscapes or Artifacts as Kingdom cards', () => {
    expect(catalog.cards).toHaveLength(331);                          // not 331 + 124 + 5
    expect(s.landscapes).toBe(124);
    expect(s.artifacts).toBe(5);
    expect(catalog.cards.some(c => ['Event', 'Landmark', 'Project', 'Way', 'Trait', 'Artifact'].some(t => c.types.includes(t)))).toBe(false);
    expect(s.byType.map(t => t.key)).not.toContain('Event');
  });
  it('has 11 owned expansions, whose per-expansion numbers add back up to the totals', () => {
    expect(s.expansions).toBe(11);
    const total = k => s.byExpansion.reduce((a, e) => a + e[k], 0);
    expect(total('names')).toBe(331); expect(total('piles')).toBe(310); expect(total('copies')).toBe(3132);
    expect(total('landscapes')).toBe(124); expect(total('artifacts')).toBe(5);
  });
  it('splits landscapes by type: 48 / 21 / 20 / 20 / 15', () => {
    expect(Object.fromEntries(s.landscapeByType.map(x => [x.key, x.count]))).toEqual({ Event: 48, Landmark: 21, Project: 20, Way: 20, Trait: 15 });
  });
  it('reports internal consistency as true for the shipped data', () => {
    expect(s.checks).toEqual({ copiesAgree: true, relationshipsAgree: true, pileNamesAgree: true });
  });
});

describe('multi-type cards', () => {
  it('keeps every printed type on a card (122 cards have more than one)', () => {
    expect(s.multiType).toBe(122);
    const multi = catalog.cards.filter(c => c.types.length > 1);
    expect(multi).toHaveLength(122);
    expect(multi.some(c => c.types.length === 3)).toBe(true);
  });
  it('counts a card once under EACH of its types, so type totals exceed the number of names', () => {
    const typeSum = s.byType.reduce((a, t) => a + t.count, 0);
    expect(typeSum).toBe(482);
    expect(typeSum).toBeGreaterThan(s.names);
    expect(s.byType.find(t => t.key === 'Action').count).toBe(281);
    expect(s.byType.find(t => t.key === 'Attack').count).toBe(50);
  });
});

describe('costs', () => {
  it('formats coin, debt, mixed and overpay costs from the stored fields', () => {
    expect(formatCost(card('Courtyard'))).toBe('$2');
    expect(formatCost(card('Engineer'))).toBe('4 Debt');
    expect(formatCost(card('Fortune'))).toBe('$8 + 8 Debt');   // cost_raw 8D8
    expect(formatCost(card('Farrier'))).toBe('$2+');
  });
  it('knows the 5 debt cards and 3 overpay cards', () => {
    expect(s.debtCards.map(c => c.name).sort()).toEqual(['City Quarter', 'Engineer', 'Fortune', 'Overlord', 'Royal Blacksmith']);
    expect(s.overpayCards.map(c => c.name).sort()).toEqual(['Farrier', 'Herald', 'Infirmary']);
    // the coin chart counts only cards that HAVE a coin cost; the 4 Debt-only cards are reported on their own
    expect(s.coinCosts.reduce((a, c) => a + c.count, 0)).toBe(327);
    expect(s.debtOnly.map(c => c.name)).toEqual(['City Quarter', 'Engineer', 'Overlord', 'Royal Blacksmith']);
    expect(s.coinCosts.reduce((a, c) => a + c.count, 0) + s.debtOnly.length).toBe(331);
    expect(s.coinCosts.map(c => c.key)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);   // there is no "$0" bar: nothing costs $0
  });
  it('says what a cost is in words, for screen readers', () => {
    expect(costLabel(card('Courtyard'))).toBe('2 coins');
    expect(costLabel({ coins: 1, debt: 0, overpay: false })).toBe('1 coin');
    expect(costLabel(card('Farrier'))).toBe('2 coins or more (overpay)');
    expect(costLabel(card('Engineer'))).toBe('4 Debt');
    expect(costLabel(card('Fortune'))).toBe('8 coins and 8 Debt');
  });
  it('knows which cards have a coin part: all except the 4 Debt-only cards', () => {
    expect(catalog.cards.filter(c => !hasCoin(c))).toHaveLength(4);
    expect(hasCoin(card('Fortune'))).toBe(true); expect(hasCoin(card('Engineer'))).toBe(false);
  });
  it('computes average coin cost and Attack counts per expansion from the cards', () => {
    const plunder = s.byExpansion.find(e => e.name === 'Plunder');
    const ps = catalog.cards.filter(c => c.expansion === 'Plunder');
    expect(plunder.avgCoins).toBeCloseTo(ps.reduce((a, c) => a + c.coins, 0) / ps.length, 10);
    expect(plunder.attacks).toBe(ps.filter(c => c.types.includes('Attack')).length);
    expect(s.byExpansion.reduce((a, e) => a + e.attacks, 0)).toBe(50);
    expect(s.attacks).toBe(50);
    const dark = s.byExpansion.find(e => e.name === 'Dark Ages');   // Engineer etc. are Empires: Debt-only cards are excluded from the average
    const emp = s.byExpansion.find(e => e.name === 'Empires'), es = catalog.cards.filter(c => c.expansion === 'Empires' && hasCoin(c));
    expect(emp.avgCoins).toBeCloseTo(es.reduce((a, c) => a + c.coins, 0) / es.length, 10);
    expect(dark.avgCoins).toBeGreaterThan(0);
  });
});

describe('piles and relations', () => {
  it('links a card to its pile and a pile to all of its names', () => {
    const catapult = card('Catapult');
    const pile = pileOf(catalog, catapult);
    expect(pile.id).toBe('Catapult / Rocks');
    expect(pileMembers(catalog, pile).map(c => c.name).sort()).toEqual(['Catapult', 'Rocks']);
  });
  it('remembers a renamed card', () => { expect(card('Farm').previousName).toBe('Harem'); });
  it('finds cards with recorded mechanics in common, never including itself', () => {
    const c = card('Courtyard');
    const rel = sharedMechanicCards(catalog, c);
    expect(rel.every(r => r.card.id !== c.id)).toBe(true);
    rel.forEach(r => expect(r.shared.length).toBeGreaterThanOrEqual(Math.min(2, c.mechanicIds.length)));
    rel.forEach(r => r.shared.forEach(m => expect(c.mechanicIds).toContain(m)));
  });
});

describe('mechanics are provisional', () => {
  it('totals 1,366 recorded relationships across 93 of 98 taxonomy tags', () => {
    expect(s.mechanics.relationships).toBe(1366);
    expect(s.mechanics.distinct).toBe(93);
    expect(s.mechanics.taxonomySize).toBe(98);
  });
  it('knows how many cards are still pending detailed verification', () => {
    expect(s.mechanics.pending).toBe(69);
  });
});

describe('card types by expansion (the matrix)', () => {
  const m = s.typeMatrix;
  const raw = rawFromCsv().cards;                                            // independent of the app's own code
  it('has one row per owned expansion and one column per printed type (except Knight and Castle), most common first', () => {
    expect(m.rows).toHaveLength(11);
    expect(m.types).toEqual(['Action', 'Attack', 'Duration', 'Treasure', 'Reaction', 'Victory', 'Command', 'Gathering', 'Looter']);
    expect(m.types).not.toContain('Knight'); expect(m.types).not.toContain('Castle'); expect(m.skipped).toEqual(['Knight', 'Castle']);
    expect(s.byType.map(t => t.key)).toEqual(expect.arrayContaining(['Knight', 'Castle']));   // still in the printed-types chart
  });
  it('every cell equals a direct count over the raw card rows (all 99 cells)', () => {
    for (const r of m.rows) for (const t of m.types) {
      const want = raw.filter(c => c.expansion === (r.name) && c.printed_types_list.includes(t)).length;
      expect(r.counts[t], `${r.label} / ${t}`).toBe(want);
    }
  });
  it('answers the questions asked: reactions in the Base Game, attacks in Menagerie, durations in Plunder', () => {
    const cell = (label, t) => m.rows.find(r => r.label === label).counts[t];
    expect(cell('Base Game', 'Reaction')).toBe(1);        // Moat
    expect(cell('Menagerie', 'Attack')).toBe(4);
    expect(cell('Plunder', 'Duration')).toBe(20);
    expect(cell('Dark Ages', 'Attack')).toBe(15); expect(cell('Empires', 'Gathering')).toBe(3);
  });
  it('each column adds up to that type\'s total, and the totals match the printed-types chart', () => {
    for (const t of m.types) { expect(m.rows.reduce((a, r) => a + r.counts[t], 0), t).toBe(m.totals[t]); expect(m.totals[t]).toBe(s.byType.find(x => x.key === t).count); }
  });
  it('a row can add up to more than its card names, because multi-type cards count under each type', () => {
    const sum = r => m.types.reduce((a, t) => a + r.counts[t], 0);
    expect(m.rows.every(r => sum(r) >= r.names)).toBe(true);
    expect(m.rows.some(r => sum(r) > r.names)).toBe(true);
    expect(m.rows.reduce((a, r) => a + r.names, 0)).toBe(331);
  });
  it('sorts rows by a type (biggest first when descending), by name, by card names, and leaves ties A–Z', () => {
    const lab = rs => rs.map(r => r.label);
    expect(lab(sortMatrixRows(m.rows, { key: null }))).toEqual(lab(m.rows));                       // collection order untouched
    expect(lab(sortMatrixRows(m.rows, { key: 'expansion', dir: 'asc' }))).toEqual(lab(m.rows).sort((a, b) => a.localeCompare(b)));
    expect(lab(sortMatrixRows(m.rows, { key: 'expansion', dir: 'desc' }))).toEqual(lab(m.rows).sort((a, b) => b.localeCompare(a)));
    const att = sortMatrixRows(m.rows, { key: 'Attack', dir: 'desc' });
    expect(att[0].label).toBe('Dark Ages'); for (let i = 1; i < att.length; i++) expect(att[i - 1].counts.Attack >= att[i].counts.Attack).toBe(true);
    const asc = sortMatrixRows(m.rows, { key: 'Attack', dir: 'asc' }); for (let i = 1; i < asc.length; i++) expect(asc[i - 1].counts.Attack <= asc[i].counts.Attack).toBe(true);
    const ties = att.filter(r => r.counts.Attack === 4).map(r => r.label); expect(ties).toEqual([...ties].sort((a, b) => a.localeCompare(b)));
    expect(sortMatrixRows(m.rows, { key: 'names', dir: 'desc' })[0].label).toBe('Dark Ages');
    expect(m.rows).toHaveLength(11); expect(lab(m.rows)[0]).toBe('Base Game');                    // the input was not mutated
  });
});
