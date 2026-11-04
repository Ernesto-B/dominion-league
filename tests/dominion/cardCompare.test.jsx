import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import { DominionView } from '../../src/dominion/DominionPage.jsx';
import { MAX_COMPARE, compareHref, compareIdsFromQuery, parseDominionArg, tabFor } from '../../src/dominion/links.js';

const catalog = realCatalog();
const render = arg => renderToStaticMarkup(<CatalogProvider catalog={catalog}><DominionView arg={arg} /></CatalogProvider>);
const ids = catalog.cards.slice(0, 5).map(c => c.id);

describe('the compare address', () => {
  it('round-trips ids, drops repeats, and keeps at most four', () => {
    expect(compareIdsFromQuery(compareHref(ids).split('compare')[1])).toEqual(ids.slice(0, MAX_COMPARE));
    expect(compareIdsFromQuery('?cards=a,a,b')).toEqual(['a', 'b']);
    expect(compareIdsFromQuery('')).toEqual([]);
    expect(compareHref([])).toBe('#/dominion/compare');
  });
  it('is its own view under the Kingdom cards tab', () => {
    expect(parseDominionArg('compare?cards=x').view).toBe('compare');
    expect(tabFor('compare')).toBe('cards');
  });
});

describe('the compare view', () => {
  it('shows four empty slots when none is chosen', () => {
    const h = render('compare'); expect((h.match(/dn-cmp-slot/g) || []).length).toBe(MAX_COMPARE); expect(h).not.toContain('dn-cmp-col');
  });
  it('shows one column per card with a remove link, and ignores unknown ids', () => {
    const h = render(compareHref(ids.slice(0, 2)).replace('#/dominion/', '') + ',nope');
    expect((h.match(/dn-cmp-col/g) || []).length).toBe(2); expect((h.match(/dn-cmp-slot/g) || []).length).toBe(2);
    expect(h).toContain('Remove'); expect(h).toContain('Recorded in common');
  });
  it('stops offering more at four cards', () => {
    const h = render(compareHref(ids).replace('#/dominion/', ''));
    expect((h.match(/dn-cmp-col/g) || []).length).toBe(MAX_COMPARE);
  });
  it('marks a mechanic by how many cards share it', () => {
    const [a, b] = catalog.cards.filter(c => c.mechanicIds.length).slice(0, 2);
    const h = render(compareHref([a.id, b.id]).replace('#/dominion/', ''));
    expect(h).toMatch(/dn-mtag (all|some|only)/);
  });
});

import { toggled, startPicking, stopPicking, togglePick } from '../../src/dominion/compareBasket.js';

describe('picking cards from the Kingdom cards list', () => {
  it('adds and removes a card, and refuses a fifth', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggled(['a', 'b', 'c', 'd'], 'e')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('shows a pick box on each row and a tray with the picks only in pick mode', () => {
    expect(render('cards')).not.toContain('dn-tray');
    startPicking([ids[0]]);
    const h = render('cards');
    expect(h).toContain('dn-pickbox'); expect(h).toContain('dn-tray'); expect(h).toContain('1 of 4'); expect(h).toContain('Pick 2 or more');
    togglePick(ids[1]);
    expect(render('cards')).toContain('Compare 2');
    stopPicking();
    expect(render('cards')).not.toContain('dn-tray');
  });
});
