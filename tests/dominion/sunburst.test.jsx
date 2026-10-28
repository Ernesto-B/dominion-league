import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { summarize } from '../../src/dominion/stats.js';
import { DEFAULT_CHART, chartFromQuery, chartToQuery, TAU, arcLength, arcPath, centroid, layoutSunburst, shortName, sunburstData, typeVar, zoomData } from '../../src/dominion/sunburst.js';
import { parseHash } from '../../src/lib/route.js';
import { parseDominionArg } from '../../src/dominion/links.js';
import { DominionView } from '../../src/dominion/DominionPage.jsx';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import SunburstChart from '../../src/dominion/components/SunburstChart.jsx';
import TypeMatrix from '../../src/dominion/components/TypeMatrix.jsx';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/dominion/lib/tables.mjs';

const catalog = realCatalog(), s = summarize(catalog), matrix = s.typeMatrix;
const render = arg => renderToStaticMarkup(<CatalogProvider catalog={catalog}><DominionView arg={arg} /></CatalogProvider>);
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

describe('sunburst data', () => {
  it('by expansion: one group per expansion sized by its card names, children carry the real type counts', () => {
    const d = sunburstData(matrix, 'expansion');
    expect(d.groups).toHaveLength(11); expect(d.total).toBe(331);
    for (const g of d.groups) {
      const row = matrix.rows.find(r => r.name === g.key);
      expect(g.value).toBe(row.names);
      expect(g.children.every(k => k.count > 0 && k.count === row.counts[k.type])).toBe(true);        // zero counts are left out, the rest are real
      expect(close(g.children.reduce((a, k) => a + k.value, 0), row.names)).toBe(true);               // the children exactly fill the expansion's arc
      expect(g.children.length).toBe(matrix.types.filter(t => row.counts[t] > 0).length);
    }
  });
  it('by type: one group per printed type sized by how many names have it, children are exactly the expansions\' counts', () => {
    const d = sunburstData(matrix, 'type');
    expect(d.groups.map(g => g.key)).toEqual(matrix.types);
    for (const g of d.groups) { expect(g.value).toBe(matrix.totals[g.key]); expect(g.children.reduce((a, k) => a + k.value, 0)).toBe(g.value); }
    expect(d.total).toBe(matrix.types.reduce((a, t) => a + matrix.totals[t], 0));
  });
  it('drops a group with nothing in it instead of drawing an empty arc', () => {
    const m = { ...matrix, rows: matrix.rows.map(r => ({ ...r, counts: { ...r.counts, Looter: 0 } })), totals: { ...matrix.totals, Looter: 0 } };
    expect(sunburstData(m, 'type').groups.some(g => g.key === 'Looter')).toBe(false);
  });
});

describe('sunburst layout', () => {
  for (const by of ['expansion', 'type']) it(`(${by}) the groups tile the whole circle, and each group's children tile exactly its arc`, () => {
    const g = layoutSunburst(sunburstData(matrix, by));
    expect(g[0].a0).toBe(0); expect(close(g.at(-1).a1, TAU)).toBe(true);
    g.forEach((x, i) => { if (i) expect(close(x.a0, g[i - 1].a1)).toBe(true); expect(x.a1).toBeGreaterThan(x.a0); });
    g.forEach(x => { expect(close(x.children[0].a0, x.a0)).toBe(true); expect(close(x.children.at(-1).a1, x.a1)).toBe(true); x.children.forEach(k => { expect(k.a0).toBeGreaterThanOrEqual(x.a0 - 1e-9); expect(k.a1).toBeLessThanOrEqual(x.a1 + 1e-9); }); });
  });
  it('an arc is proportional to its value', () => {
    const g = layoutSunburst(sunburstData(matrix, 'type')), action = g.find(x => x.key === 'Action'), attack = g.find(x => x.key === 'Attack');
    expect(close((action.a1 - action.a0) / (attack.a1 - attack.a0), 281 / 50, 1e-6)).toBe(true);
  });
});

describe('the chart state in the URL', () => {
  it('writes nothing for the default table, and only what differs for the sunburst', () => {
    expect(chartToQuery(DEFAULT_CHART)).toBe(''); expect(chartToQuery({ view: 'table', by: 'type', zoom: 'Attack' })).toBe('');
    expect(chartToQuery({ view: 'sunburst', by: 'expansion', zoom: null })).toBe('?chart=sunburst');
    expect(chartToQuery({ view: 'sunburst', by: 'type', zoom: 'Attack' })).toBe('?chart=sunburst&ring=type&zoom=Attack');
    expect(chartToQuery({ view: 'sunburst', by: 'expansion', zoom: 'Cornucopia & Guilds' })).toBe('?chart=sunburst&zoom=Cornucopia+%26+Guilds');
  });
  it('round-trips, and ignores junk', () => {
    for (const c of [{ view: 'sunburst', by: 'type', zoom: 'Attack' }, { view: 'sunburst', by: 'expansion', zoom: 'Cornucopia & Guilds' }, { view: 'sunburst', by: 'expansion', zoom: null }, DEFAULT_CHART])
      expect(chartFromQuery(chartToQuery(c))).toEqual(c);
    expect(chartFromQuery('?chart=banana&ring=type&zoom=x')).toEqual(DEFAULT_CHART); expect(chartFromQuery('?chart=sunburst&ring=sideways')).toEqual({ view: 'sunburst', by: 'expansion', zoom: null });
    expect(chartFromQuery(undefined)).toEqual(DEFAULT_CHART);
  });
  it('the Overview opens straight into a shared chart link', () => {
    const t = render('?chart=sunburst&ring=type&zoom=Attack');
    expect(t).toContain('Card type: <b>Attack</b>'); expect(t).toContain('dn-sb-svg');
    expect(render('?chart=sunburst')).toContain('click an expansion'); expect(render('')).not.toContain('dn-sb-svg');
  });
  it('routing hands the Overview its query instead of mistaking it for part of the page name', () => {
    expect(parseDominionArg('?chart=sunburst&zoom=Attack')).toEqual({ view: 'overview', id: null, query: '?chart=sunburst&zoom=Attack' });
    expect(parseHash('#/dominion?chart=sunburst', [])).toMatchObject({ route: 'dominion', arg: '?chart=sunburst' });
    expect(parseHash('#/dominion/cards?type=Attack', [])).toMatchObject({ route: 'dominion', arg: 'cards?type=Attack' });
    expect(parseHash('#/games/a/3', [{ id: 'a' }, { id: 'b' }])).toMatchObject({ route: 'games', gid: 'a', arg: '3' });   // paths without a query parse as before
  });
});

describe('zooming in', () => {
  const dark = catalog.cards.filter(c => c.expansion === 'Dark Ages');
  it('an expansion becomes its printed types, each made of that type\'s actual cards', () => {
    const z = zoomData(matrix, catalog.cards, 'expansion', 'Dark Ages');
    expect(z.title).toBe('Dark Ages'); expect(z.big).toBe(44); expect(z.zoom).toBe('Dark Ages');
    const row = matrix.rows.find(r => r.name === 'Dark Ages');
    expect(z.groups.map(g => g.type)).toEqual(matrix.types.filter(t => row.counts[t] > 0));
    for (const g of z.groups) {
      expect(g.value).toBe(row.counts[g.type]); expect(g.children).toHaveLength(g.value);                       // one arc per card
      expect(g.children.every(k => dark.find(c => c.id === k.id).types.includes(g.type))).toBe(true);
    }
    expect(z.groups.find(g => g.type === 'Attack').children.map(k => k.name)).toContain('Cultist');
  });
  it('a printed type becomes the expansions that have it, each made of its cards', () => {
    const z = zoomData(matrix, catalog.cards, 'type', 'Attack');
    expect(z.title).toBe('Attack'); expect(z.big).toBe(matrix.totals.Attack);
    expect(z.groups.reduce((a, g) => a + g.children.length, 0)).toBe(matrix.totals.Attack);
    expect(z.groups.find(g => g.expansion === 'Dark Ages').children).toHaveLength(15);
    expect(z.groups.every(g => g.children.every(k => catalog.cards.find(c => c.id === k.id).types.includes('Attack')))).toBe(true);
  });
  it('lists the cards cheapest first, ties by name, and puts a multi-type card under each of its types', () => {
    const z = zoomData(matrix, catalog.cards, 'expansion', 'Dark Ages');
    for (const g of z.groups) expect(g.children.map(k => k.coins)).toEqual([...g.children.map(k => k.coins)].sort((a, b) => a - b));
    const ties = z.groups.find(g => g.type === 'Action').children.filter(k => k.coins === 4 && k.debt === 0).map(k => k.name); expect(ties).toEqual([...ties].sort((a, b) => a.localeCompare(b)));
    const cultist = catalog.cards.find(c => c.name === 'Cultist');
    expect(z.groups.filter(g => g.children.some(k => k.id === cultist.id)).map(g => g.type).sort()).toEqual(cultist.types.filter(t => matrix.types.includes(t)).sort());
  });
  it('lays out like the overview (groups tile the circle, leaves tile their group), and knows no such key', () => {
    for (const z of [zoomData(matrix, catalog.cards, 'expansion', 'Empires'), zoomData(matrix, catalog.cards, 'type', 'Treasure')]) {
      const g = layoutSunburst(z); expect(close(g.at(-1).a1, TAU)).toBe(true);
      g.forEach(x => { expect(close(x.children[0].a0, x.a0)).toBe(true); expect(close(x.children.at(-1).a1, x.a1)).toBe(true); });
    }
    expect(zoomData(matrix, catalog.cards, 'expansion', 'Nope')).toBeNull(); expect(zoomData(matrix, catalog.cards, 'type', 'Knight')).toBeNull();
  });
  it('shortens a long name for a narrow label', () => { expect(shortName('Militia')).toBe('Militia'); expect(shortName('Cornucopia and Guilds Card').length).toBeLessThanOrEqual(15); expect(shortName('Cornucopia and Guilds Card')).toMatch(/…$/); });
});

describe('arc geometry', () => {
  it('draws a closed ring segment, using the large-arc flag past a half turn', () => {
    expect(arcPath(100, 100, 40, 80, 0, 1)).toMatch(/^M[\d.,-]+A80,80 0 0 1 [\d.,-]+L[\d.,-]+A40,40 0 0 0 [\d.,-]+Z$/);
    expect(arcPath(100, 100, 40, 80, 0, 4)).toMatch(/A80,80 0 1 1/);
  });
  it('starts at 12 o\'clock and goes clockwise', () => { expect(arcPath(100, 100, 40, 80, 0, 1)).toMatch(/^M100,20A/); expect(centroid(100, 100, 40, 80, Math.PI / 2 - 0.0001, Math.PI / 2 + 0.0001)[0]).toBeGreaterThan(100); });
  it('puts the centre of a segment between its radii, and measures its length', () => {
    const [x, y] = centroid(100, 100, 40, 80, 0.2, 1.2), r = Math.hypot(x - 100, y - 100); expect(r).toBeGreaterThan(40); expect(r).toBeLessThan(80); expect(close(r, 60, 1e-6)).toBe(true);
    expect(close(arcLength(60, 0.2, 1.2), 60)).toBe(true);
  });
  it('trims padding without ever inverting a tiny arc', () => { expect(arcPath(100, 100, 40, 80, 1, 1.001, 0.5)).toMatch(/Z$/); });
});

describe('the chart', () => {
  const html = (by, extra) => renderToStaticMarkup(<SunburstChart matrix={matrix} by={by} cards={catalog.cards} {...extra} />);
  it('draws every group and every child as a labelled, focusable, pressable arc', () => {
    for (const by of ['expansion', 'type']) {
      const d = sunburstData(matrix, by), n = d.groups.length + d.groups.reduce((a, g) => a + g.children.length, 0), h = html(by);
      expect((h.match(/<path /g) || []).length).toBe(n); expect((h.match(/role="button"/g) || []).length).toBeGreaterThanOrEqual(n);
      expect((h.match(/tabindex="0"/g) || []).length).toBeGreaterThanOrEqual(n); expect((h.match(/aria-pressed="false"/g) || []).length).toBeGreaterThanOrEqual(n - d.groups.length);   // the inner arcs zoom instead of pinning, so they aren't toggles
    }
    expect(html('expansion')).toContain('aria-label="Dark Ages, Attack: 15 of 44 card names"'); expect(html('type')).toContain('aria-label="Dark Ages, Attack: 15 of 44 card names"');   // read as "expansion, type" whichever ring is inside
  });
  it('colours the type arcs with the same variables as the type pills', () => {
    const h = html('expansion'); for (const t of ['Action', 'Attack', 'Duration', 'Treasure', 'Reaction', 'Victory']) expect(h).toContain(`rgb(var(${typeVar(t)}))`);
    const css = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    for (const t of matrix.types) expect(css, t).toContain(`--t-${t.toLowerCase()}:`);   // every type has a colour, including the three whose pills stay plain
  });
  it('has a legend of the printed types to isolate one, and the centre shows the total until an arc is chosen', () => {
    const h = html('expansion'); for (const t of matrix.types) expect(h).toContain(`</i>${t}</button>`);
    expect(h).toMatch(/dn-sb-big">331</); expect(h).toContain('click an expansion');
  });
  it('explains what the sizes mean, differently for each ring order', () => {
    expect(html('expansion')).toMatch(/shares of its type counts/); expect(html('type')).toMatch(/sized by how many card names have the type/);
  });
  it('zoomed into an expansion: its types in the inner ring, its cards in the outer, a way back, and the cards open', () => {
    const h = html('expansion', { zoom: 'Dark Ages' }), z = zoomData(matrix, catalog.cards, 'expansion', 'Dark Ages');
    expect((h.match(/<path /g) || []).length).toBe(z.groups.length + z.groups.reduce((a, g) => a + g.children.length, 0));
    expect(h).toContain('← All expansions'); expect(h).toMatch(/Expansion: <b>Dark Ages<\/b>/); expect(h).toContain('aria-label="Zoom out to all expansions"');
    expect(h).toContain('aria-label="Cultist, Attack, Dark Ages"'); expect(h).toMatch(/dn-sb-card[^>]*>Cultist</); expect(h).toMatch(/dn-sb-big">44</);
    // every card on the outer ring is a real link to its own page
    const cultist = catalog.cards.find(c => c.name === 'Cultist');
    expect(h).toContain(`<a href="#/dominion/cards/${encodeURIComponent(cultist.id)}" aria-label="Cultist, Attack, Dark Ages">`);
    expect((h.match(/<a href="#\/dominion\/cards\/[^"?]+" aria-label=/g) || []).length).toBe(z.groups.reduce((a, g) => a + g.children.length, 0));
    expect(h).toContain('press Esc'); expect(h).toContain('Click a card to open its page'); expect(h).toMatch(/cards themselves, cheapest first/);
    expect(h).not.toContain('</i>Duration</button>') ; expect(h).toContain('</i>Attack</button>');   // the legend only lists the types this expansion has
  });
  it('zoomed into a type: its expansions in the inner ring (their icons), its cards outside, no type legend', () => {
    const h = html('type', { zoom: 'Attack' });
    expect(h).toContain('← All card types'); expect(h).toMatch(/Card type: <b>Attack<\/b>/); expect(h).toContain('aria-label="Zoom out to all card types"');
    expect(h).toContain('aria-label="Dark Ages, Attack: 15 of 44 card names"'); expect(h).not.toContain('dn-sb-legend'); expect(h).toContain('rgb(var(--t-attack))');
    expect(h).toContain('icons/sets/');
  });
  it('an unknown or missing zoom falls back to the overview, and the overview invites a click', () => {
    expect(html('expansion', { zoom: 'Nope' })).not.toContain('All expansions');
    const h = html('expansion'); expect(h).toContain('Click an expansion in the inner ring to zoom in'); expect(h).toContain('click an expansion');
    expect(h).toContain('aria-label="Dark Ages: 44 card names. Zoom in"');
    expect(html('type')).toContain('Click a card type in the inner ring to zoom in');
  });
  it('the Overview section opens on the table, and the sunburst is one tap away (both orders)', () => {
    const t = renderToStaticMarkup(<TypeMatrix matrix={matrix} names={s.names} />);
    expect(t).toContain('dn-matrix'); expect(t).not.toContain('dn-sb-svg'); expect(t).toMatch(/aria-pressed="true"[^>]*>Table</); expect(t).toMatch(/>Sunburst</);
  });
});
