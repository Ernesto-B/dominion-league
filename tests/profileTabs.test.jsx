import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import Players from '../src/pages/Players.jsx';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';
import { tabFromQuery, tabQuery } from '../src/lib/profileTabs.js';

describe('the Player page tab address', () => {
  it('defaults to Overview, reads ?tab=, and a ?badge= link opens Badges', () => {
    expect(tabFromQuery('')).toBe('overview'); expect(tabFromQuery(undefined)).toBe('overview');
    expect(tabFromQuery('tab=history')).toBe('history'); expect(tabFromQuery('tab=nonsense')).toBe('overview');
    expect(tabFromQuery('badge=first-win')).toBe('badges'); expect(tabFromQuery('tab=history&badge=x')).toBe('badges');
  });
  it('writes no query for Overview', () => {
    expect(tabQuery('overview')).toBe(''); expect(tabQuery('badges')).toBe('?tab=badges'); expect(tabQuery('badges', { badge: 'x' })).toBe('?badge=x&tab=badges');
  });
});

const row = (f, d) => ({ _line: 1, date: d, type: '', finish: f, sets: '', landscapes: '', playerVP: {}, minutes: '', kingdom: [], savedAt: null });
const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob'], seasons: [] }, [row('Ann > Bob', '2026-01-01'), row('Bob > Ann', '2026-01-02')], Eng.todayDay());
const draw = arg => renderToString(createElement(PageContext.Provider, { value: { D, gid: 'a', arg, hashFor: (r, g, x) => `#/${r}/${g}/${x}`, me: null, catalog: null, allGroups: [{ id: 'a' }], enabledSets: new Set(['Base']), rawPlayers: [] } }, createElement(Players)));

describe('the Player page by tab', () => {
  it('Overview has the tiles and a badge shelf, not the rating chart or the whole collection', () => {
    const h = draw('Ann');
    expect(h).toContain('pt-tabs'); expect(h).toContain('class="stats"'); expect(h).toContain('View all →'); expect(h).not.toContain('Rating history'); expect(h).not.toContain('badges-tab');
  });
  it('Badges has the collection with its toolbar and no tiles', () => {
    const h = draw('Ann?tab=badges');
    expect(h).toMatch(/bt-clear[^>]*disabled/); expect(h).toContain('badges-tab'); expect(h).toContain('Owned'); expect(h).toContain('Locked'); expect(h).toContain('Difficulty'); expect(h).not.toContain('class="stats"');
  });
  it('History has the chart, matchups and results', () => {
    const h = draw('Ann?tab=history');
    expect(h).toContain('Rating history'); expect(h).toContain('Results'); expect(h).not.toContain('badges-tab');
    expect(h).toContain('Per page'); expect(h).toMatch(/<option value="6"[^>]*>6<\/option><option value="12"[^>]*>12<\/option><option value="24"[^>]*>24<\/option><option value="all">All/);
  });
});

describe('the + beside the pinned badges', () => {
  it('opens the Badges tab on the earned ones, for the viewer\'s own page only', () => {
    const own = renderToString(createElement(PageContext.Provider, { value: { D, gid: 'a', arg: 'Ann', hashFor: (r, g, x) => `#/${r}/${g}/${x}`, me: { name: 'Ann' }, catalog: null, allGroups: [{ id: 'a' }], enabledSets: new Set(['Base']), rawPlayers: [{ name: 'Ann', pinned_badges: [] }] } }, createElement(Players)));
    expect(own).toContain('pin-add'); expect(own).toContain('tab=badges'); expect(own).toContain('show=owned');
    expect(draw('Ann')).not.toContain('pin-add');   // someone else's page: nothing to add
  });
  it('a ?show=owned link opens the Badges tab with Owned selected', () => {
    expect(draw('Ann?tab=badges&show=owned')).toMatch(/aria-pressed="true"[^>]*>Owned/);
  });
});

describe('a saved pin that no longer shows', () => {
  it('does not use up a place: the + still appears', () => {
    const stale = renderToString(createElement(PageContext.Provider, { value: { D, gid: 'a', arg: 'Ann', hashFor: (r, g, x) => `#/${r}/${g}/${x}`, me: { name: 'Ann' }, catalog: null, allGroups: [{ id: 'a' }], enabledSets: new Set(['Base']), rawPlayers: [{ name: 'Ann', pinned_badges: ['gone-1', 'gone-2', 'gone-3'] }] } }, createElement(Players)));
    expect(stale).toContain('pin-add');
  });
});
