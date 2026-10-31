import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describeFilters, DEFAULT_CARD_FILTERS, DEFAULT_LANDSCAPE_FILTERS, NO_COST } from '../../src/dominion/filters.js';
import FilterSummary from '../../src/dominion/components/FilterSummary.jsx';

describe('the active-filter strip', () => {
  it('says nothing when nothing is filtered', () => {
    expect(describeFilters(DEFAULT_CARD_FILTERS)).toEqual([]);
    expect(renderToString(createElement(FilterSummary, { f: DEFAULT_LANDSCAPE_FILTERS, update: () => {} }))).toBe('');
  });
  it('describes each active group and how to switch it off', () => {
    const f = { ...DEFAULT_LANDSCAPE_FILTERS, types: ['Event'], expansions: ['Empires'], expMode: 'none', costs: [5, NO_COST], debt: 'has', played: 'no' };
    const d = describeFilters(f);
    expect(d.map(x => x.text)).toEqual(['Type: Event', 'Not Set: Empires', 'Cost: $5, none', 'Has debt', 'Not played yet']);
    expect(d[0].clear).toEqual({ types: [] });
    expect(d[3].clear).toEqual({ debt: 'any' });
  });
  it('renders a removable chip per group', () => {
    const html = renderToString(createElement(FilterSummary, { f: { ...DEFAULT_CARD_FILTERS, types: ['Attack'] }, update: () => {} }));
    expect(html).toContain('Type: Attack');
    expect(html).toContain('aria-label="Remove filter: Type: Attack"');
  });
});
