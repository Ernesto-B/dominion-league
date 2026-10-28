import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import DominionPage, { DominionView } from '../../src/dominion/DominionPage.jsx';
import { pageSlice, sharedMechanicCards } from '../../src/dominion/model.js';
import { rowLink } from '../../src/dominion/components/bits.jsx';
import { ErrorState } from '../../src/dominion/components/States.jsx';
import CostIcons, { coinIconSrc, debtIconSrc } from '../../src/dominion/components/Cost.jsx';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/dominion/lib/tables.mjs';
import Header from '../../src/components/Header.jsx';
import { ROUTE_TITLES } from '../../src/lib/route.js';
import { parseDominionArg, tabFor, cardHref, landscapeHref, dominionHref } from '../../src/dominion/links.js';
import { DEFAULT_CARD_FILTERS, DEFAULT_LANDSCAPE_FILTERS, cardFiltersToQuery, cardFiltersFromQuery, landscapeFiltersToQuery, landscapeFiltersFromQuery, browseCards, neighbors, pickRandom, textSnippet } from '../../src/dominion/filters.js';
import { forgetListScroll, navigated, restoreListScroll } from '../../src/dominion/scrollMemory.js';
const cardsWith = patch => render('cards' + cardFiltersToQuery({ ...DEFAULT_CARD_FILTERS, ...patch }));

const catalog = realCatalog();
const render = arg => renderToStaticMarkup(<CatalogProvider catalog={catalog}><DominionView arg={arg} /></CatalogProvider>);
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const rows = html => (html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr[ >]/g) || []).length;
const N = n => new RegExp(String(n).replace(/(\d)(?=(\d{3})+$)/g, '$1[,.   ]?'));   // tolerate locale digit grouping

describe('Overview', () => {
  const html = render(''), t = text(html);
  it('shows the six headline numbers, each with its own label', () => {
    for (const [n, label] of [[331, 'Kingdom card names'], [310, 'Kingdom supply piles'], [3132, 'Physical Kingdom cards'], [11, 'Owned expansions'], [124, 'Landscape designs'], [5, 'Artifacts']])
      expect(html).toMatch(new RegExp(`<b>${N(n).source}</b><span>${label}</span>`));
  });
  it('has no subheading under the title', () => {
    expect(html).not.toContain('class="lede"'); expect(t).not.toMatch(/What we own/); expect(t).not.toMatch(/imported collection catalog/);
  });
  it('keeps the "why the numbers differ" explanation in a disclosure (the site\'s ⓘ help pattern), closed by default', () => {
    const d = html.match(/<details class="help"[^>]*>[\s\S]*?<\/details>/)[0];
    expect(d).not.toMatch(/<details[^>]*\bopen\b/);                                   // closed until clicked
    expect(d).toMatch(/<summary>Why the numbers differ<\/summary>/);
    const e = text(d);
    expect(e).toMatch(/331.*card names sit in.*310.*supply piles/); expect(e).toMatch(/7 piles hold more than one name/); expect(e).toMatch(/21 extra names/);
    expect(e).toMatch(/3,?132.*physical cards count every copy/); expect(e).toMatch(/124.*landscapes and 5 Artifacts are separate components and are not included/);
    expect(html).not.toContain('dn-explain');                                           // not a permanent block on the page
    expect(html).not.toContain('dn-help');                                              // the old custom popover is gone
  });
  it('breaks down by expansion (11 rows + a total), by printed type, and by landscape type', () => {
    expect(html).toContain('Card names by expansion'); expect(html).toContain('Printed card types'); expect(html).toContain('aria-label="Landscape designs per type"');
    expect(html).toMatch(/<tr class="dn-total">/);
    expect(t).toMatch(/Base Game/); expect(t).toMatch(/Cornucopia & Guilds/);
    expect(t).toMatch(/Events.*48/); expect(t).toMatch(/Traits.*15/);
  });
  it('no longer has the "By expansion" table, nor the Edition / Attacks columns it replaced', () => {
    expect(html).not.toContain('id="ov-table"'); expect(t).not.toMatch(/Avg\. cost|Physical cards\s+Avg/);
    expect(t).not.toMatch(/Attacks counts/); expect(t).not.toMatch(/Only edition/);
  });
  it('also carries what used to be the Statistics tab (one page, no duplicate charts)', () => {
    for (const h of ['Physical cards by expansion', 'Supply piles', 'Card types by expansion', 'Most common type combinations', 'Coin cost', 'Recorded mechanics']) expect(t).toContain(h);
    expect((html.match(/aria-label="Landscape designs per type"/g) || []).length).toBe(1);
    expect((html.match(/aria-label="Kingdom card names per printed type"/g) || []).length).toBe(1);
  });
});

describe('Kingdom cards browser', () => {
  const html = render('cards'), t = text(html);
  it('lists all 331 names with a live result count', () => { expect(rows(html)).toBe(331); expect(t).toMatch(/Showing 331 of 331 card names/); });
  it('has the filters asked for: search, expansion, type, coin + Debt cost, mechanics, sort, clear', () => {
    expect(html).toContain('type="search"');
    for (const l of ['Expansion', 'Printed type', 'Cost', 'Recorded mechanics', 'Sort by', 'Debt', 'Clear filters']) expect(t).toContain(l);
    expect(html).toMatch(/aria-pressed="false"/);   // expansion/type toggles announce their state
  });
  it('offers no "without"/"exclude" mechanic control, and no longer carries the long disclaimer under the filter', () => {
    expect(t).not.toMatch(/not an exhaustive list|missing tag is not a confirmed/);
    // the controls (buttons, options, labels, legends) — not the prose, which legitimately says "a card without a tag may still..."
    const controls = [...html.matchAll(/<(?:button|option|label|legend|summary)\b[^>]*>([\s\S]*?)<\/(?:button|option|label|legend|summary)>/g)].map(m => text(m[1])).join(' | ');
    expect(controls.length).toBeGreaterThan(200);
    expect(controls).not.toMatch(/\b(without|exclude|excluding|except|not have|lacks?|missing|none of)\b/i);
  });
  it('shows each card\'s printed types (several for a multi-type card), cost, and a shared pile where there is one', () => {
    const lurk = catalog.cards.find(c => c.types.length === 3);
    for (const ty of lurk.types) expect(html).toContain(`<span class="pill t-${ty.toLowerCase()}">${ty}</span>`);
    expect(t).toMatch(/Catapult.*Catapult \/ Rocks/);
    expect(html).toContain('aria-label="8 coins and 8 Debt"');
  });
  it('shows costs as the owner\'s coin and Debt icons, with an accessible name', () => {
    expect(html).toMatch(/<span class="dn-cost" role="img" aria-label="4 coins"[^>]*><img class="dn-cost-icon" src="icons\/costs\/coin-4\.png"/);
    expect(html).toMatch(/aria-label="4 Debt"[^>]*><img class="dn-cost-icon" src="icons\/costs\/debt-4\.png"/);          // Engineer: Debt only, no coin icon
    expect(html).toMatch(/aria-label="8 coins and 8 Debt"[^>]*><img[^>]*coin-8\.png[^>]*\/><img[^>]*debt-8\.png/);   // Fortune: both
    expect(html).toMatch(/aria-label="2 coins or more \(overpay\)"[^>]*><img[^>]*coin-2plus\.png/);                // Farrier: the "+" coin
  });
  it('filters cost with coin and Debt icon buttons (1–10; no $0, since nothing costs $0)', () => {
    const coin = html.match(/aria-label="Coin cost \(pick one or more\)"[\s\S]*?<\/div>/)[0];
    expect((coin.match(/<button/g) || []).length).toBe(10);
    expect(coin).toContain('coin-1.png'); expect(coin).toContain('coin-10.png'); expect(coin).not.toContain('coin-0.png');
    const debt = html.match(/aria-label="Debt cost"[\s\S]*?<\/div>/)[0];
    expect(debt).toContain('No Debt'); expect(debt).toContain('Any Debt'); expect(debt).toContain('debt-4.png'); expect(debt).toContain('debt-8.png');
    expect(html).not.toMatch(/Coins from|<select[^>]*>\s*<option value="">Any<\/option>\s*<option value="1"/);          // the old min/max selects are gone
  });
  it('links every card to its own detail page', () => { expect((html.match(/href="#\/dominion\/cards\/[^"]+"/g) || []).length).toBe(331); });
  it('shows an empty state (not a crash) when filters match nothing', () => {
    const h = cardsWith({ q: 'zzzz-no-such-card' });
    expect(text(h)).toMatch(/No cards match these filters/); expect(text(h)).toMatch(/Showing 0 of 331/); expect(rows(h)).toBe(0);
  });
  it('restores the filters from the URL (so Back from a card, or a shared link, returns to the same list)', () => {
    const h = cardsWith({ expansions: ['Plunder'], types: ['Duration'], typeMode: 'all' });
    const expected = catalog.cards.filter(c => c.expansion === 'Plunder' && c.types.includes('Duration')).length;
    expect(rows(h)).toBe(expected); expect(expected).toBeGreaterThan(0); expect(text(h)).toMatch(new RegExp(`Showing ${expected} of 331`));
  });
});

// each sortable heading is the site's own pattern: the <th> itself is the control (class "sortable", role=button), and has no <button> in it
const ths = h => [...h.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/g)].map(m => ({ attrs: m[1], inner: m[2], label: text(m[2]).trim() }));
const dir = th => (th.attrs.match(/data-dir="(\w+)"/) || [])[1];

describe('sortable table headers', () => {
  const html = render('cards');
  const head = html.match(/<thead>[\s\S]*?<\/thead>/)[0], cols = ths(head);
  it('makes every column heading sortable the way the rest of the site does (the heading cell, no button inside)', () => {
    expect(cols.map(c => c.label)).toEqual(['Expansion Set', 'Card', 'Types', 'Cost', 'Shared Pile']);   // "Set" is the short heading a phone shows, hidden from screen readers
    for (const c of cols) { expect(c.attrs, c.label).toMatch(/class="[^"]*\bsortable\b/); expect(c.attrs).toMatch(/role="button"/); expect(c.attrs).toMatch(/tabindex="0"/); expect(c.inner, c.label).not.toMatch(/<button|<svg|<img/); }
    expect(head).not.toContain('<button');                     // no big buttons in the header row
  });
  it('marks only the active column, with the ▲/▼ coming from the site\'s data-dir styling (not extra markup)', () => {
    expect((head.match(/aria-sort=/g) || []).length).toBe(1);
    const card = cols.find(c => c.label === 'Card'); expect(card.attrs).toMatch(/aria-sort="ascending"/); expect(dir(card)).toBe('asc');
    expect(cols.filter(c => c !== card).every(c => dir(c) === undefined)).toBe(true);
    expect(card.inner).not.toMatch(/[▲▼]/);
  });
  it('shows the reversed direction on the active column', () => {
    const h = cardsWith({ sort: 'cost', dir: 'desc' });
    const cost = ths(h.match(/<thead>[\s\S]*?<\/thead>/)[0]).find(c => c.label === 'Cost');
    expect(cost.attrs).toMatch(/aria-sort="descending"/); expect(dir(cost)).toBe('desc');
  });
  it('the "Sort by" menu offers every sortable column, so a phone (where some columns are hidden) can sort by them too', () => {
    const sel = html.match(/Sort by <select[\s\S]*?<\/select>/)[0];
    for (const l of ['Name', 'Expansion', 'Printed type', 'Cost', 'Shared pile']) expect(text(sel)).toContain(l);
  });
});

describe('sortable landscape headers', () => {
  const html = render('landscapes');
  const head = html.match(/<thead>[\s\S]*?<\/thead>/)[0];   // the first table is the landscapes (the second is the Artifacts)
  const cols = ths(head);
  it('makes Expansion, Landscape, Type and "When it applies" sortable like the rest of the site, with no button in the heading', () => {
    expect(cols.map(c => c.label)).toEqual(['Expansion Set', 'Landscape', 'Type', 'When it applies']);
    for (const c of cols) { expect(c.attrs, c.label).toMatch(/class="[^"]*\bsortable\b/); expect(c.attrs).toMatch(/role="button"/); }
    expect(head).not.toContain('<button');
    expect((head.match(/aria-sort=/g) || []).length).toBe(1); expect(cols[1].attrs).toMatch(/aria-sort="ascending"/); expect(dir(cols[1])).toBe('asc');   // sorted by Landscape (name)
  });
  it('the "Sort by" menu offers the same columns (so a phone, which hides one, can use them too)', () => {
    const sel = html.match(/Sort by <select[\s\S]*?<\/select>/)[0];
    for (const l of ['Name', 'Type', 'Expansion', 'When it applies']) expect(text(sel)).toContain(l);
  });
  it('does not make the Artifacts table sortable (it is not a landscape list)', () => {
    expect((html.match(/class="[^"]*\bsortable\b/g) || []).length).toBe(4);   // the four landscape headings only
  });
  it('uses the very same header component as the Kingdom cards table', () => {
    const cards = ths(render('cards').match(/<thead>[\s\S]*?<\/thead>/)[0]);
    expect(cards.every(c => /\bsortable\b/.test(c.attrs))).toBe(true); expect(cards.filter(c => /aria-sort/.test(c.attrs))).toHaveLength(1);
  });
});

describe('the Overview charts', () => {
  const html = render(''), t = text(html);
  it('lets you click through: every expansion name, and every coin-cost column, opens the filtered Kingdom cards', () => {
    const phys = html.match(/<ol class="dn-lol"[^>]*aria-label="Physical Kingdom cards per expansion">[\s\S]*?<\/ol>/)[0];
    expect((phys.match(/href="#\/dominion\/cards\?[^"]*exp=/g) || []).length).toBe(11);
    const cols = html.match(/<ol class="dn-cols" aria-label="Kingdom card names per coin cost">[\s\S]*?<\/ol>/)[0];
    expect((cols.match(/class="dn-col-track dn-col-link"/g) || []).length).toBe(11);        // the bars themselves are links (10 costs + Debt)
    expect(cols).toMatch(/class="dn-col-track dn-col-link" href="#\/dominion\/cards\?[^"]*cost=5"/);
  });
  it('uses a different kind of chart for each question, not one bar chart repeated', () => {
    expect(html).not.toContain('dn-treemap'); expect((html.match(/class="dn-bars"/g) || []).length).toBe(1);   // one plain bar chart, not one for everything
    for (const [cls, label] of [['dn-donut', 'Kingdom card names per expansion'], ['dn-bars', 'Kingdom card names per printed type'], ['dn-lol', 'Physical Kingdom cards per expansion'],
      ['dn-seg', 'Supply piles by number of card names'], ['dn-waffle-wrap', 'Landscape designs per type'], ['dn-cols', 'Kingdom card names per coin cost'], ['dn-heat', 'Card names recorded with each mechanic, most common first']])
      expect(html, label).toMatch(new RegExp(`class="${cls}"[^>]*aria-label="${label}"`));
  });
  it('keeps every number as real text and the filter links', () => {
    expect(t).toMatch(/Base Game.*\d+/); expect(t).toMatch(/Events.*48/); expect(t).toMatch(/Traits.*15/);
    expect(html).toContain('href="#/dominion/cards?exp=');                                   // an expansion links to its cards
    expect(html).toMatch(/href="#\/dominion\/landscapes\?[^"]*"[^>]*>Events</);              // a landscape type links to its list
  });
  it('shows the coin-cost columns in order, the Debt-only column at the end', () => {
    const cols = html.match(/<ol class="dn-cols" aria-label="Kingdom card names per coin cost">[\s\S]*?<\/ol>/)[0];
    const lis = cols.split('<li').slice(1);
    expect(lis).toHaveLength(11);                                   // costs 1 to 10, then Debt-only
    expect(lis[lis.length - 1]).toContain('Debt only'); expect(lis[0]).toContain('<b class="dn-col-n">1</b>');   // one card costs 1
  });
});

describe('the plain Debt icon', () => {
  it('marks "Any Debt" in the cost filter and the "Debt only" bar in the statistics', () => {
    expect(render('cards')).toMatch(/aria-label="Any Debt cost"[^>]*><img[^>]*src="icons\/costs\/debt\.png"/);
    expect(render('')).toMatch(/aria-label="Debt only: cards that cost only Debt"[^>]*><img[^>]*src="icons\/costs\/debt\.png"/);
    expect(existsSync(path.join(ROOT, 'public/icons/costs/debt.png'))).toBe(true);
  });
});

describe('Card detail', () => {
  it('shows the stored facts for a card and nothing invented', () => {
    const html = render(`cards/${encodeURIComponent('empires:fortune')}`), t = text(html);
    expect(t).toMatch(/Fortune/); expect(html).toContain('aria-label="8 coins and 8 Debt"'); expect(html).toContain('width="40"'); expect(t).toMatch(/Empires/); expect(t).toMatch(/Gladiator \/ Fortune/);
    expect(t).toMatch(/Recorded mechanics/); expect(t).not.toMatch(/not an exhaustive list/); expect(t).not.toMatch(/batch\d+/i);   // review-batch provenance isn't shown to visitors
    expect(t).not.toMatch(/Verification/); expect(html).not.toContain('cd-verify'); expect(t).not.toMatch(/Open reference|Review note|Secondary reference list/);   // internal provenance isn't shown to visitors
    expect(t).toMatch(/Card text/); expect(t).not.toMatch(/Artwork isn.t part of this collection data|Based only on tags that are recorded/);
    expect(html).not.toMatch(/<img[^>]+src="[^"]*(card|art)/i);   // no card artwork (the inline symbol icons are fine)
  });
  it('lists the cards that share a split pile, as links', () => {
    const t = text(render(`cards/${encodeURIComponent('empires:catapult')}`));
    expect(t).toMatch(/Part of the Catapult \/ Rocks pile.*2 card names sharing 10 physical cards/);
    expect(render(`cards/${encodeURIComponent('empires:catapult')}`)).toContain(`href="${cardHref('empires:rocks')}"`);
  });
  it('shows a previous name and the Second Edition flag when the data has them', () => {
    expect(text(render(`cards/${encodeURIComponent(catalog.cards.find(c => c.name === 'Farm').id)}`))).toMatch(/Formerly called Harem/);
    expect(text(render(`cards/${encodeURIComponent('intrigue:lurker')}`))).toMatch(/New in Second Edition/);
  });
  it('words an untagged card as "none recorded", never "has none"', () => {
    const bare = { ...catalog.cards[0], id: 'zz:bare', mechanicIds: [], mechanics: [] };
    const c2 = { ...catalog, cards: [bare, ...catalog.cards], cardsById: new Map([...catalog.cardsById, [bare.id, bare]]) };
    const t = text(renderToStaticMarkup(<CatalogProvider catalog={c2}><DominionView arg="cards/zz%3Abare" /></CatalogProvider>));
    expect(t).toMatch(/No mechanics are recorded for this card yet — that does not mean it has none/);
  });
  it('handles an unknown card id gracefully', () => { expect(text(render('cards/nope%3Anothing'))).toMatch(/Card not found/); });
});

describe('Card text', () => {
  it('every Kingdom card, landscape and Artifact in the catalog has its printed text', () => {
    expect(catalog.cards.filter(c => !c.text).map(c => c.id)).toEqual([]);
    expect(catalog.landscapes.filter(l => !l.text).map(l => l.id)).toEqual([]);
    expect(catalog.artifacts.filter(a => !a.text).map(a => a.id)).toEqual([]);
  });
  it('resolves Plunder, whose text records use a different id shape', () => {
    expect(catalog.cardsById.get('plunder:cage').text).toMatch(/\S/);
    expect(catalog.landscapesById.get('plunder:event:bury').text).toMatch(/\S/);
    expect(catalog.landscapesById.get('plunder:trait:cheap').text).toMatch(/\S/);
  });
  it('shows the text on a card page, one paragraph per printed paragraph, with the transcription caveat', () => {
    const html = render(`cards/${encodeURIComponent('dominion-base-game:artisan')}`), t = text(html);
    expect(html).toMatch(/<p>Gain a card to your hand costing up to <span class="dn-nobr"><img[^>]+src="icons\/costs\/coin-5\.png"[^>]+alt="\$5"\/><\/span>\.<\/p><p>Put a card from your hand onto your deck\.<\/p>/);
    expect(t).not.toMatch(/Transcribed by hand/);
  });
  it('keeps a "+" glued to the coin icon that follows it, so the text cannot wrap between them', () => {
    const html = render(`landscapes/${encodeURIComponent('menagerie:way:way_of_the_chameleon')}`);
    expect(html).toMatch(/<span class="dn-nobr">\+<img[^>]+alt="\$"\/><\/span>/);
  });
  it('shows the VP shield and the blank Debt icon in place of "VP" and "Debt"', () => {
    const vp = render(`cards/${encodeURIComponent('dominion-base-game:gardens')}`);
    expect(vp).toMatch(/<img[^>]+src="icons\/costs\/vp\.png"[^>]+alt="VP"/);
    expect(render(`landscapes/${encodeURIComponent('empires:event:tax')}`)).toMatch(/<img[^>]+src="icons\/costs\/debt\.png"[^>]+alt="Debt"/);
    expect(render(`landscapes/${encodeURIComponent('renaissance:project:capitalism')}`)).toMatch(/<img[^>]+src="icons\/costs\/coin\.png"[^>]+alt="\$"/);
    ['vp', 'debt', 'coin'].forEach(n => expect(existsSync(path.join(ROOT, 'public/icons/costs', n + '.png'))).toBe(true));
  });
  it('shows the text on landscape pages too', () => {
    expect(text(render(`landscapes/${encodeURIComponent('plunder:trait:cheap')}`))).toMatch(/Card text/);
  });
  it('says so when the text table is not installed, instead of showing an empty section', () => {
    const bare = { ...catalog, meta: { ...catalog.meta, textRecordCount: 0 }, cardsById: new Map([...catalog.cardsById].map(([k, c]) => [k, { ...c, text: null }])) };
    const t = text(renderToStaticMarkup(<CatalogProvider catalog={bare}><DominionView arg={`cards/${encodeURIComponent('dominion-base-game:artisan')}`} /></CatalogProvider>));
    expect(t).toMatch(/Card text isn.t available yet/);
  });
});

describe('shareable filters, text search, and moving between cards', () => {
  const f = patch => ({ ...DEFAULT_CARD_FILTERS, ...patch });
  it('round-trips every card filter through the URL, writing only what differs from the default', () => {
    expect(cardFiltersToQuery(DEFAULT_CARD_FILTERS)).toBe('');
    const all = f({ q: 'gold coin', text: true, expansions: ['Dark Ages', 'Cornucopia & Guilds'], types: ['Action', 'Attack'], typeMode: 'any', mechanics: ['draw'], mechanicMode: 'any', costs: [3, 10], debt: '4', sort: 'cost', dir: 'desc' });
    expect(cardFiltersFromQuery(cardFiltersToQuery(all))).toEqual(all);
    expect(cardFiltersToQuery(f({ types: ['Attack'] }))).toBe('?type=Attack');
  });
  it('ignores junk in a hand-edited link instead of breaking', () => {
    expect(cardFiltersFromQuery('?sort=banana&dir=sideways&cost=abc&cost=2&debt=lots&tmode=maybe')).toEqual(f({ costs: [2] }));
    expect(cardFiltersFromQuery('?q=%E0%A4%A')).toBeTruthy();   // a malformed escape must not throw
  });
  it('round-trips the landscape filters too', () => {
    const l = { ...DEFAULT_LANDSCAPE_FILTERS, q: 'way', text: true, types: ['Way', 'Event'], expansions: ['Menagerie'], mechanics: ['gain_card'], mechanicMode: 'all', sort: 'trigger', dir: 'desc' };
    expect(landscapeFiltersFromQuery(landscapeFiltersToQuery(l))).toEqual(l);
    expect(landscapeFiltersToQuery(DEFAULT_LANDSCAPE_FILTERS)).toBe('');
  });
  it('reads the filters from the URL on the list pages, and carries them into each card link', () => {
    const h = cardsWith({ types: ['Attack'] }), n = catalog.cards.filter(c => c.types.includes('Attack')).length;
    expect(rows(h)).toBe(n);
    expect((h.match(/href="#\/dominion\/cards\/[^"?]+\?type=Attack"/g) || []).length).toBe(n);
    expect(h).toMatch(/aria-pressed="true"[^>]*>Attack/);
  });
  it('parses a query off a route without confusing it with an id', () => {
    expect(parseDominionArg('cards?type=Attack')).toEqual({ view: 'cards', id: null, query: '?type=Attack' });
    expect(parseDominionArg('cards/intrigue%3Acourtyard?type=Attack&sort=cost')).toEqual({ view: 'card', id: 'intrigue:courtyard', query: '?type=Attack&sort=cost' });
  });
  it('can search the card text too, showing an excerpt only for cards matched by text alone', () => {
    const names = rows(cardsWith({ q: 'trash' })), withText = cardsWith({ q: 'trash', text: true });
    expect(rows(withText)).toBeGreaterThan(names);
    expect(withText).toMatch(/class="meta dn-snippet"/);
    const t = text(withText); expect(t).toMatch(/Include card text/);
    expect(textSnippet('Gain a card costing up to $4. Trash a card from your hand.', 'trash')).toBe('Gain a card costing up to $4. Trash a card from your hand.');
    expect(textSnippet('x'.repeat(200) + ' trash ' + 'y'.repeat(200), 'TRASH')).toMatch(/^….*trash.*…$/);
    expect(textSnippet('nothing here', 'trash')).toBeNull();
    expect(textSnippet(null, 'trash')).toBeNull();
  });
  it('gives each card page Previous/Next/Random over the list it came from, keeping the filters', () => {
    const list = browseCards(catalog.cards, f({ types: ['Attack'], sort: 'cost' }));
    const mid = list[5], q = cardFiltersToQuery(f({ types: ['Attack'], sort: 'cost' }));
    const h = render(`cards/${encodeURIComponent(mid.id)}${q}`), attr = href => `href="${href.replace(/&/g, '&amp;')}"`;   // the markup escapes & in attributes
    expect(h).toContain(attr(cardHref(list[4].id, q))); expect(h).toContain(attr(cardHref(list[6].id, q)));
    expect(h).toContain(attr(dominionHref('cards', null, q)));
    expect(text(h)).toContain(`6 of ${list.length}`); expect(text(h)).toMatch(/Random card/);
  });
  it('disables Previous on the first card and Next on the last, and falls back to all cards for a stale filter', () => {
    const all = browseCards(catalog.cards, DEFAULT_CARD_FILTERS);
    expect(render(`cards/${encodeURIComponent(all[0].id)}`)).toMatch(/dn-itemnav-off[^>]*>← Previous/);
    expect(render(`cards/${encodeURIComponent(all.at(-1).id)}`)).toMatch(/dn-itemnav-off[^>]*>Next →/);
    expect(text(render(`cards/${encodeURIComponent(all[0].id)}?type=Victory`))).toContain(`1 of ${all.length}`);   // the card isn't a Victory card
  });
  it('landscape pages get the same strip', () => {
    const l = catalog.landscapes.find(x => x.type === 'Way'), h = render(`landscapes/${encodeURIComponent(l.id)}?type=Way`);
    expect(text(h)).toMatch(/Random landscape/); expect(h).toContain('href="#/dominion/landscapes?type=Way"');
  });
  it('neighbors() and pickRandom() behave at the edges', () => {
    const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(neighbors(l, 'a')).toMatchObject({ index: 0, total: 3, prev: null, next: { id: 'b' } });
    expect(neighbors(l, 'c')).toMatchObject({ index: 2, prev: { id: 'b' }, next: null });
    expect(neighbors(l, 'zz')).toMatchObject({ index: -1, prev: null, next: null });
    expect(pickRandom(l, 'b', () => 0).id).toBe('a'); expect(pickRandom(l, 'b', () => 0.99).id).toBe('c');
    expect(pickRandom([{ id: 'only' }], 'only').id).toBe('only'); expect(pickRandom([], null)).toBeNull();
    for (let i = 0; i < 50; i++) expect(pickRandom(l, 'b').id).not.toBe('b');
  });
});

describe('back to your place (scroll memory)', () => {
  const setup = () => { const win = { scrollTo: vi.fn() }; globalThis.window = win; globalThis.location = { hash: '' }; return win; };
  afterEach(() => { forgetListScroll(); delete globalThis.window; delete globalThis.location; });
  const list = '#/dominion/cards?type=Attack', detail = '#/dominion/cards/intrigue%3Acourtyard?type=Attack';
  it('restores the position when the same list URL comes back after a detail page', () => {
    const win = setup();
    navigated(list, detail, 1234);
    navigated(detail, list, 0); location.hash = list;
    restoreListScroll(); expect(win.scrollTo).toHaveBeenLastCalledWith(0, 1234);
  });
  it('keeps the position while moving between detail pages (Previous/Next/Random)', () => {
    const win = setup();
    navigated(list, detail, 800); navigated(detail, '#/dominion/cards/x?type=Attack', 0); navigated('#/dominion/cards/x?type=Attack', detail, 0);
    navigated(detail, list, 0); location.hash = list; restoreListScroll(); expect(win.scrollTo).toHaveBeenLastCalledWith(0, 800);
  });
  it('forgets it once the viewer leaves the list/detail pages, and for a different list URL', () => {
    const win = setup();
    navigated(list, detail, 500); navigated(detail, '#/dominion/insights', 0);   // off to Insights
    location.hash = list; restoreListScroll(); expect(win.scrollTo).not.toHaveBeenCalled();
    navigated(list, detail, 700); location.hash = '#/dominion/cards?type=Victory'; restoreListScroll(); expect(win.scrollTo).not.toHaveBeenCalled();
  });
  it('does not record a position for a filter change (same page); the landscapes list works like the cards list', () => {
    const win = setup();
    navigated('#/dominion/cards', list, 300); location.hash = list; restoreListScroll(); expect(win.scrollTo).not.toHaveBeenCalled();
    navigated('#/dominion/landscapes', '#/dominion/landscapes/x', 640); location.hash = '#/dominion/landscapes'; restoreListScroll(); expect(win.scrollTo).toHaveBeenLastCalledWith(0, 640);
  });
  it('the Overview works too, chart state and all, and an Artifact page counts as a detail page', () => {
    const win = setup(), ov = '#/dominion?chart=sunburst&zoom=Attack&ring=type';
    navigated(ov, '#/dominion/cards/dark-ages%3Acultist', 2200); navigated('#/dominion/cards/dark-ages%3Acultist', ov, 0); location.hash = ov;
    restoreListScroll(); expect(win.scrollTo).toHaveBeenLastCalledWith(0, 2200);
    navigated('#/dominion', '#/dominion/artifacts/renaissance%3Aartifact%3Ahorn', 900); location.hash = '#/dominion'; restoreListScroll(); expect(win.scrollTo).toHaveBeenLastCalledWith(0, 900);
    navigated('#/dominion', '#/dominion/cards/x', 300); location.hash = '#/dominion?chart=sunburst'; restoreListScroll(); expect(win.scrollTo).toHaveBeenCalledTimes(2);   // a different chart state: not restored
  });
});

describe('type pill tints', () => {
  it('gives each of the six main printed types its own class, and the other types none', () => {
    const html = render('cards');
    for (const t of ['action', 'treasure', 'duration', 'attack', 'reaction', 'victory']) expect(html, t).toMatch(new RegExp(`class="pill t-${t}"`));
    // Command, Knight, Castle, Gathering and Looter have no tint rule, so they render as the plain pill
    const css = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    for (const t of ['action', 'treasure', 'duration', 'attack', 'reaction', 'victory']) expect(css, t).toContain(`.pill.t-${t}{`);
    for (const t of ['command', 'knight', 'castle', 'gathering', 'looter']) expect(css, t).not.toContain(`.pill.t-${t}`);
  });
});

describe('type filter chips', () => {
  it('carry the printed-type class, so style.css can colour their edges (only the six main types have a rule)', () => {
    const html = render('cards');
    for (const t of ['action', 'treasure', 'duration', 'attack', 'reaction', 'victory']) expect(html, t).toMatch(new RegExp(`class="dn-chip t-${t}"`));
    const css = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    for (const t of ['action', 'treasure', 'duration', 'attack', 'reaction', 'victory']) expect(css, t).toContain(`.dn-chip.t-${t},`);
  });
});

describe('Landscapes filter panel', () => {
  it('has no tag disclaimer under the tags filter', () => {
    expect(text(render('landscapes'))).not.toMatch(/not an exhaustive list|own vocabulary/);
  });
});

describe('landscape type tints', () => {
  const kinds = ['project', 'trait', 'event', 'way', 'landmark'];
  const css = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  it('tints the type pill in the table and on the detail page, and the type chips\' edges, for all five landscape types', () => {
    const list = render('landscapes');
    for (const k of kinds) { expect(list, k).toMatch(new RegExp(`class="pill t-${k}"`)); expect(list, k).toMatch(new RegExp(`class="dn-chip t-${k}"`)); }
    expect(render(`landscapes/${encodeURIComponent('plunder:trait:cheap')}`)).toMatch(/class="pill t-trait">Trait</);
    for (const k of kinds) { expect(css, k).toContain(`.pill.t-${k}{`); expect(css, k).toContain(`.dn-chip.t-${k},`); }
  });
});

describe('related cards (same recorded mechanics)', () => {
  it('lists every match, 10 to a page by default, and says how many there are', () => {
    const c = catalog.cards.find(x => x.id === 'dominion-base-game:village') || catalog.cards[0];
    const total = sharedMechanicCards(catalog, c, { limit: Infinity }).length;
    expect(total).toBeGreaterThan(10);
    const html = render(`cards/${encodeURIComponent(c.id)}`);
    expect(rows(html.slice(html.indexOf('cd-related')))).toBe(10);
    expect(text(html)).toContain(`Showing 1–10 of ${total} cards`);
    expect(html).toMatch(/<option value="10" selected="">10<\/option><option value="20">20<\/option><option value="50">50<\/option><option value="all">All<\/option>/);
  });
  it('pages without overlap, clamps a stale page, and never invents rows', () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    expect(pageSlice(items, 1, 10).items).toEqual(items.slice(0, 10));
    expect(pageSlice(items, 3, 10)).toMatchObject({ items: [20, 21, 22], from: 21, to: 23, pages: 3 });
    expect(pageSlice(items, 9, 10).page).toBe(3);
    expect(pageSlice(items, 1, 50)).toMatchObject({ pages: 1, from: 1, to: 23 });
    expect(pageSlice(items, 1, Infinity)).toMatchObject({ items, pages: 1, from: 1, to: 23, total: 23 });   // the "All" option
    expect(pageSlice([], 1, 10)).toMatchObject({ items: [], from: 0, to: 0, pages: 1 });
  });
});

describe('clickable table rows', () => {
  it('every row in the Kingdom cards and landscapes tables is a whole-row link', () => {
    for (const [view, n] of [['cards', 331], ['landscapes', 124]]) {
      const html = render(view);
      expect((html.match(/<tr class="dn-rowlink"/g) || []).length).toBe(n);
    }
  });
  it('a click on the row (not on a link or a text selection) goes to the item', () => {
    const go = (e, selection = '') => {
      globalThis.window = { location: { hash: '' }, getSelection: () => selection };
      rowLink('#/dominion/cards/x').onClick({ button: 0, target: { closest: () => null }, ...e });
      const hash = globalThis.window.location.hash; delete globalThis.window; return hash;
    };
    expect(go({})).toBe('#/dominion/cards/x');
    expect(go({ target: { closest: () => ({}) } })).toBe('');   // on the real <a> (or a button): let it handle itself
    expect(go({ ctrlKey: true })).toBe('');                       // modified clicks are left to the browser
    expect(go({}, 'some selected text')).toBe('');                // finishing a text selection isn't a click
  });
});

describe('Artifacts', () => {
  const art = catalog.artifacts.find(a => a.name === 'Horn');
  it('are listed on the Landscapes page (each linking to its own page) and no longer as a section of the Overview', () => {
    const land = render('landscapes'), overview = render('');
    for (const a of catalog.artifacts) { expect(land, a.name).toContain(`href="#/dominion/artifacts/${encodeURIComponent(a.id)}"`); expect(overview, a.name).not.toContain(`href="#/dominion/artifacts/${encodeURIComponent(a.id)}"`); }
    expect(text(overview)).not.toMatch(/Artifacts are tracked on their own/);
  });
  it('have a details page with their text, how they are held and their tags', () => {
    const h = render(`artifacts/${encodeURIComponent(art.id)}`), t = text(h);
    expect(t).toMatch(/Horn/); expect(t).toMatch(/Artifact/); expect(t).toMatch(/Renaissance/); expect(t).toMatch(/Card text/); expect(art.text).toMatch(/\S/);
    expect(t).toContain(art.text.split(/\s+/).slice(0, 3).join(' ').replace(/\$/g, '')); expect(t).toMatch(/how it.s held/);
    expect(h).toContain('href="#/dominion/landscapes"');
  });
  it('say so for an Artifact that does not exist, and the route has no bare list', () => {
    expect(text(render('artifacts/nope'))).toMatch(/Artifact not found/);
    expect(parseDominionArg('artifacts/renaissance%3Aartifact%3Ahorn')).toEqual({ view: 'artifact', id: 'renaissance:artifact:horn', query: '' });
    expect(parseDominionArg('artifacts').view).toBe('notfound'); expect(tabFor('artifact')).toBe('landscapes');
  });
});

describe('Landscapes', () => {
  const html = render('landscapes'), t = text(html);
  it('lists all 124 landscapes and calls them landscapes, not Kingdom cards', () => { expect(t).toMatch(/Showing 124 of 124 landscapes/); expect(t).toMatch(/aren.t Kingdom cards/); });
  it('keeps Artifacts in their own section, separate from the landscape filters', () => {
    expect(html).toContain('id="ls-artifacts"'); expect(t).toMatch(/Artifacts are their own kind of component. They are not landscapes and not Kingdom cards/);
    const art = html.slice(html.indexOf('id="ls-artifacts"'));
    expect(rows(art)).toBe(5); for (const n of ['Flag', 'Horn', 'Key', 'Lantern', 'Treasure Chest']) expect(art).toContain(n);
  });
  it('filters by all five types', () => { for (const ty of ['Events', 'Landmarks', 'Projects', 'Ways', 'Traits']) expect(t).toContain(ty); });
  it('shows a landscape detail page with its tags, verification, and an honest note label', () => {
    const l = catalog.landscapes.find(x => x.name === 'Triumph');
    const d = text(render(`landscapes/${encodeURIComponent(l.id)}`));
    expect(d).not.toMatch(/Verification|Open reference/);
    expect(d).toMatch(/Triumph/); expect(d).toMatch(/Event/); expect(d).toMatch(/Classification note/); expect(d).not.toMatch(/Effect categories/); expect(d).not.toMatch(/not the official card text|artwork aren.t part|not an exhaustive list/);
  });
  it('encodes ids that contain underscores and colons round-trip', () => {
    const l = catalog.landscapes.find(x => x.id.includes('_'));
    expect(parseDominionArg(`landscapes/${encodeURIComponent(l.id)}`)).toEqual({ view: 'landscape', id: l.id, query: '' });
    expect(text(render(`landscapes/${encodeURIComponent(l.id)}`))).toContain(l.name);
  });
  it('handles an unknown landscape id gracefully', () => { expect(text(render('landscapes/zz%3Anone'))).toMatch(/Landscape not found/); });
});

describe('Physical cards by expansion (Overview)', () => {
  it('keeps the chart but not the explanation under it', () => {
    const t = text(render(''));
    expect(t).toMatch(/Physical cards by expansion/); expect(t).not.toMatch(/Every copy in the boxes/); expect(t).not.toMatch(/charted above/);
  });
});

describe('Printed card types (Overview)', () => {
  it('shows the chart without the multi-type explanation under it', () => {
    const t = text(render(''));
    expect(t).toMatch(/Printed card types/); expect(t).not.toMatch(/A card can have several printed types/); expect(t).not.toMatch(/these bars add up to/);
  });
});

describe('Statistics', () => {
  const html = render(''), t = text(html);
  it('states the denominator of the mechanics chart, without a provisional banner or a review-status table', () => {
    expect(t).toMatch(/denominator: 331 names/);
    expect(t).not.toMatch(/Provisional|lower bounds, not totals|not an exhaustive list/);
    expect(t).not.toMatch(/How far the tags have been reviewed|pending detailed verification|batch\d+/i);
  });
  it('reports the recorded relationship totals', () => {
    expect(t).toMatch(/1,?634 recorded mechanic tags across 96 of the 98 defined mechanics/);
  });
  it('covers the distributions asked for', () => {
    for (const h of ['Physical cards by expansion', 'Printed card types', 'Supply piles', 'Landscapes', 'Coin cost', 'Recorded mechanics']) expect(t).toContain(h);
    expect(t).toMatch(/Out of 331 card names\. 4 cards cost only Debt \(City Quarter, Engineer, Overlord, Royal Blacksmith\) and have no coin cost, so they get their own bar rather than counting as \$0/);
    expect(html).toContain('aria-label="Debt only: cards that cost only Debt"'); expect(html).not.toContain('coin-0.png');
    expect(t).toMatch(/Out of 310 piles/);
  });
  it('no longer shows a Data checks section (the checks themselves still pass on the real data)', () => { expect(t).not.toMatch(/Data checks/); expect(html).not.toContain('dn-checks'); });
});

describe('the card-types-by-expansion table on Statistics', () => {
  const html = render('');
  const sec = html.slice(html.indexOf('id="st-matrix"'), html.indexOf('id="st-combos"'));
  const head = sec.match(/<thead>[\s\S]*?<\/thead>/)[0], body = sec.match(/<tbody>[\s\S]*?<\/tbody>/)[0];
  it('has a heading, 11 expansion rows and a totals row', () => {
    expect(text(sec)).toContain('Card types by expansion'); expect((body.match(/<tr/g) || []).length).toBe(12); expect(body).toContain('class="dn-total"');
    for (const e of ['Base Game', 'Menagerie', 'Plunder', 'Cornucopia & Guilds']) expect(text(body)).toContain(e);
  });
  it('has a sortable heading for the expansion, the card names and every printed type, in the site\'s style (no buttons)', () => {
    const cols = ths(head);
    expect(cols.map(c => c.label)).toEqual(['Expansion', 'Card names', 'Action', 'Attack', 'Duration', 'Treasure', 'Reaction', 'Victory', 'Command', 'Gathering', 'Looter']);
    expect(text(head)).not.toMatch(/Knight|Castle/);
    for (const c of cols) expect(c.attrs, c.label).toMatch(/class="[^"]*\bsortable\b/);
    expect(head).not.toContain('<button');
    expect(head).not.toContain('aria-sort');                                  // starts in collection order, so no column is "active"
  });
  it('shows the counts (Menagerie attacks 4, Base Game reactions 1, Plunder durations 20) as links to those exact cards', () => {
    expect(body).toMatch(/title="4 Attack cards in Menagerie — show them"[^>]*>4<\/a>/);
    expect(body).toMatch(/title="1 Reaction card in Base Game — show them"[^>]*>1<\/a>/);
    expect(body).toMatch(/title="20 Duration cards in Plunder — show them"[^>]*>20<\/a>/);
    expect(body).toContain('class="dn-zero" aria-label="No Treasure cards in Base Game"');   // a zero is muted text with a spoken label, not a link
    expect(body).not.toMatch(/title="0 /);
  });
  it('says why Knight and Castle are not columns (they are only the type of two special piles)', () => {
    expect(text(sec)).toMatch(/Knight and Castle aren.t shown: they.re only the type of the Knights and Castles piles/);
    expect(html).toMatch(/aria-label="Kingdom card names per printed type"[\s\S]*Knight/);   // but the printed-types chart still has them
  });
  it('explains that multi-type cards count under each type, and shades cells', () => {
    expect(text(sec)).toMatch(/counts once under each, so a row can add up to more than that expansion.s card names/);
    expect(body).toMatch(/color-mix\(in srgb, var\(--felt\)/);
  });
});

describe('routing inside the section', () => {
  it('parses every Dominion URL', () => {
    expect(parseDominionArg('')).toEqual({ view: 'overview', id: null, query: '' });
    expect(parseDominionArg('cards')).toEqual({ view: 'cards', id: null, query: '' });
    expect(parseDominionArg('cards/intrigue%3Acourtyard')).toEqual({ view: 'card', id: 'intrigue:courtyard', query: '' });
    expect(parseDominionArg('landscapes')).toEqual({ view: 'landscapes', id: null, query: '' });
    expect(parseDominionArg('stats')).toEqual({ view: 'overview', id: null, query: '' });   // the old Statistics tab
    expect(parseDominionArg('nonsense')).toEqual({ view: 'notfound', id: null, query: '' });
    expect(parseDominionArg('stats/extra')).toEqual({ view: 'notfound', id: null, query: '' });
    expect(parseDominionArg('cards/%E0%A4%A')).toEqual({ view: 'notfound', id: null, query: '' });   // malformed escape must not throw
  });
  it('builds links that parse back to the same thing', () => {
    expect(cardHref('intrigue:courtyard')).toBe('#/dominion/cards/intrigue%3Acourtyard');
    expect(landscapeHref('menagerie:way:way_of_the_frog')).toBe('#/dominion/landscapes/menagerie%3Away%3Away_of_the_frog');
    expect(dominionHref()).toBe('#/dominion');
    expect(tabFor('card')).toBe('cards'); expect(tabFor('landscape')).toBe('landscapes'); expect(tabFor('overview')).toBe('overview');
  });
  it('an unknown path renders a not-found page, not an error', () => { expect(text(render('bogus'))).toMatch(/Not found/); });
  it('the section nav marks the right tab, including for a card\'s detail page', () => {
    const h = renderToStaticMarkup(<DominionPage arg="cards/intrigue%3Acourtyard" />);
    expect(h).toContain('role="navigation"'); expect(h).toMatch(/aria-current="true"[^>]*>Kingdom cards</);
    for (const l of ['Overview', 'Kingdom cards', 'Landscapes']) expect(h).toContain(`>${l}<`);
    expect(h).not.toContain('>Statistics<');
  });
  it('shows a loading state while the catalog loads (the nav is already there)', () => {
    const h = renderToStaticMarkup(<DominionPage arg="" />);
    expect(h).toContain('aria-busy="true"'); expect(text(h)).toMatch(/Loading the collection/); expect(h).toContain('role="navigation"');
  });
});

describe('error display is safe', () => {
  it('shows a fixed message and never the raw database error', () => {
    const raw = { code: 'PGRST205', message: "Could not find the table 'public.dominion_kingdom_cards' in the schema cache", hint: 'secret hint', details: 'secret details' };
    const h = renderToStaticMarkup(<ErrorState error={raw} onRetry={() => {}} />);
    expect(h).toContain('role="alert"'); expect(text(h)).toMatch(/isn.t available yet/);
    expect(h).not.toMatch(/dominion_kingdom_cards|schema cache|secret|PGRST/);
  });
  it('offers a retry for transient failures, but not when the catalog simply isn\'t installed', () => {
    expect(renderToStaticMarkup(<ErrorState error={new TypeError('Failed to fetch')} onRetry={() => {}} />)).toContain('Try again');
    expect(renderToStaticMarkup(<ErrorState error={{ code: 'PGRST205' }} onRetry={() => {}} />)).not.toContain('Try again');
  });
});

describe('cost icons', () => {
  const file = src => path.join(ROOT, 'public', src);
  it('has an icon file for every coin cost, "+" overpay cost and Debt amount that the data uses', () => {
    const missing = [];
    for (const c of catalog.cards) {
      if (c.coins > 0 || c.debt === 0) { const src = coinIconSrc(c.coins, c.overpay); if (!src || !existsSync(file(src))) missing.push(`${c.name}: coin ${c.coins}${c.overpay ? '+' : ''}`); }
      if (c.debt > 0) { const src = debtIconSrc(c.debt); if (!src || !existsSync(file(src))) missing.push(`${c.name}: debt ${c.debt}`); }
    }
    expect(missing).toEqual([]);
  });
  it('falls back to readable text, not a broken image, for a cost without artwork', () => {
    expect(renderToStaticMarkup(<CostIcons coins={13} size={20} />)).toMatch(/dn-cost-text[^>]*>\$13</);
    expect(renderToStaticMarkup(<CostIcons coins={0} debt={7} size={20} />)).toMatch(/7 Debt/);
    expect(renderToStaticMarkup(<CostIcons coins={13} size={20} />)).not.toContain('<img');
  });
  it('keeps the shipped icons small (the originals were over half a megabyte each)', async () => {
    const { statSync, readdirSync } = await import('node:fs');
    const dir = path.join(ROOT, 'public/icons/costs');
    for (const f of readdirSync(dir)) expect(statSync(path.join(dir, f)).size, f).toBeLessThan(40_000);
    expect(readdirSync(dir).every(f => f === f.toLowerCase()), 'lowercase names (GitHub Pages is case-sensitive)').toBe(true);
  });
});

describe('the Players link in the nav', () => {
  const D = players => ({ players: players.map(([name, allGames]) => ({ name, allGames })) });
  const ready = (me, players, groups = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], gid = 'a') =>
    ({ route: { route: 'home', gid }, me: { name: me, is_admin: false }, allGroups: groups, computedByGroup: { a: D(players), b: D([['Zed', 3]]) } });
  const playersHref = r => renderToStaticMarkup(<Header ready={r} hash="" />).match(/<a href="([^"]+)"[^>]*><img src="icons\/nav\/players\.png"/)[1];
  it('opens the signed-in player\'s own page when they have played in the group being viewed', () => {
    expect(playersHref(ready('Ann', [['Bob', 4], ['Ann', 2]]))).toBe('#/players/a/Ann');
    expect(playersHref(ready('Ann', [['Ann', 2]], [{ id: 'a', name: 'A' }]))).toBe('#/players/Ann');          // one group: no group segment
    expect(playersHref(ready('Ann Lee', [['Ann Lee', 2]]))).toBe('#/players/a/Ann%20Lee');                       // the name is encoded like every other player link
  });
  it('goes to the front page of Players (the ladder\'s top player) when they have not played there, or are not in the group', () => {
    expect(playersHref(ready('Ann', [['Bob', 4], ['Ann', 0]]))).toBe('#/players/a');
    expect(playersHref(ready('Ann', [['Bob', 4]]))).toBe('#/players/a');
    expect(playersHref(ready('Zed', [['Bob', 4]], undefined, 'b'))).toBe('#/players/b/Zed');                      // follows the group being viewed
  });
  it('changes nothing else in the nav, and still works for a viewer with no league data yet', () => {
    const nav = renderToStaticMarkup(<Header ready={ready('Ann', [['Ann', 2]])} hash="" />);
    expect(nav).toContain('<a href="#/games/a"'); expect(nav).not.toContain('#/h2h'); expect(nav).toContain('<a href="#/dominion"');
    const bare = { route: { route: 'home', gid: 'a' }, me: { name: 'Ann', is_admin: false }, allGroups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    expect(playersHref(bare)).toBe('#/players/a');
  });
});

describe('the page is called "Collection"', () => {
  it('uses that name in the nav (still linking to #/dominion) and for the browser tab title', () => {
    const ready = { route: { route: 'dominion', gid: 'a' }, me: { name: 'Ann', is_admin: false }, allGroups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    const nav = renderToStaticMarkup(<Header ready={ready} hash="#/dominion" />);
    expect(nav).toMatch(/<a href="#\/dominion" aria-current="page"><img src="icons\/nav\/collection\.png" alt=""\/>Collection<\/a>/);
    expect(text(nav)).not.toMatch(/\bDominion\b/);
    expect(ROUTE_TITLES.dominion).toBe('Collection');
  });
  it('says Collection in the heading, the loading and not-found messages and the section label', () => {
    expect(render('')).toContain('<h1>Collection</h1>');
    expect(text(render(''))).not.toMatch(/Dominion collection/);
    expect(text(render('bogus'))).toMatch(/no such page in the collection/);
    expect(renderToStaticMarkup(<DominionPage arg="" />)).toContain('aria-label="Collection sections"');
    expect(text(renderToStaticMarkup(<ErrorState error={{ code: 'PGRST205' }} />))).toMatch(/The collection isn.t available yet/);
  });
});

describe('nav icons', () => {
  it('every icon the header links to exists on disk (a typo would otherwise be a silent broken image)', () => {
    const ready = { route: { route: 'home', gid: 'a' }, me: { name: 'Ann', is_admin: true }, allGroups: [{ id: 'a', name: 'A' }] };
    const srcs = [...renderToStaticMarkup(<Header ready={ready} hash="" />).matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
    expect(srcs.length).toBe(7);                                           // every nav entry has an icon, Collection included
    expect(srcs).toContain('icons/nav/collection.png');
    for (const src of srcs) expect(existsSync(path.join(ROOT, 'public', src)), src).toBe(true);
  });
  it('ships the Collection icon at the same size as its neighbours (not the 1.2 MB original)', async () => {
    const { statSync } = await import('node:fs');
    expect(statSync(path.join(ROOT, 'public/icons/nav/collection.png')).size).toBeLessThan(60_000);
  });
});
