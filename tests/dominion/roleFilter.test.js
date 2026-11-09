import { describe, it, expect } from 'vitest';
import { filterCards, DEFAULT_CARD_FILTERS, cardFiltersToQuery, cardFiltersFromQuery, describeFilters, activeCardFilters, ROLE_KEYS } from '../../src/dominion/filters.js';
import { realCatalog } from './fixtures.js';

describe('the Randomizer roles as a card filter', () => {
  it('offers the five mechanic rules, not the cost rules', () => { expect(ROLE_KEYS).toEqual(['village', 'draw', 'trash', 'buy', 'scoring']); });
  it('keeps a card that has any recorded tag of any chosen role, and nothing else', () => {
    const catalog = realCatalog();
    const f = { ...DEFAULT_CARD_FILTERS, roles: ['buy'] }, got = filterCards(catalog.cards, f);
    expect(got.length).toBeGreaterThan(0); expect(got.length).toBeLessThan(catalog.cards.length);
    expect(got.every(c => c.mechanicIds.includes('plus_buy'))).toBe(true);
    expect(filterCards(catalog.cards, { ...f, roles: ['buy', 'village'] }).length).toBeGreaterThan(got.length);   // any of the chosen roles
  });
  it('round-trips through the link, counts as one filter and is listed in the strip', () => {
    const f = { ...DEFAULT_CARD_FILTERS, roles: ['draw', 'trash'] };
    expect(cardFiltersToQuery(f)).toBe('?role=draw&role=trash'); expect(cardFiltersFromQuery('?role=draw&role=nonsense').roles).toEqual(['draw']);
    expect(activeCardFilters(f)).toBe(1); expect(describeFilters(f)[0].text).toBe('Role: Drawer, Trashing');
  });
});
