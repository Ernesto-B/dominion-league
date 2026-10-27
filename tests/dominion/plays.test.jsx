import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import { DominionView } from '../../src/dominion/DominionPage.jsx';
import { PageContext } from '../../src/PageContext.js';
import { playStats, insights, pilesPlayed, winners, MIN_GAMES_FOR_RECORD } from '../../src/dominion/playStats.js';
import { DEFAULT_CARD_FILTERS, browseCards, cardFiltersFromQuery, cardFiltersToQuery, activeCardFilters } from '../../src/dominion/filters.js';

const catalog = realCatalog();
const card = n => catalog.cards.find(c => c.name === n);
const land = n => catalog.landscapes.find(l => l.name === n);
const K = (...items) => items.map(i => (i.id ? { kind: 'landscape', id: i.id } : { kind: 'card', id: i.id ?? i }));
const kc = (...names) => names.map(n => ({ kind: 'card', id: card(n).id }));
// a game as the engine hands it to the pages
let line = 0;
const game = (day, kingdom, places) => ({ line: ++line, day, date: `2026-02-${String(day).padStart(2, '0')}`, kingdom, places, names: Object.keys(places) });

const games = [
  game(1, kc('Village', 'Militia', 'Moat'), { Ann: 1, Bob: 2 }),
  game(2, kc('Village', 'Militia'), { Ann: 2, Bob: 1 }),
  game(3, [...kc('Village', 'Gladiator'), { kind: 'landscape', id: land('Way of the Mole').id }], { Ann: 1, Bob: 1 }),   // a shared win
  game(4, kc('Village', 'Fortune'), { Ann: 1, Bob: 2 }),                                                                 // the same pile, logged by its other name
  game(5, [], { Ann: 1, Bob: 2 }),                                                                                          // no kingdom logged: never counted
];
const stats = playStats(catalog, games, 'Ann');
const pile = n => stats.piles.get(card(n).pileKey);

describe('play counts', () => {
  it('counts only games that have a kingdom, a pile once per game', () => {
    expect(stats.withKingdom).toBe(4); expect(stats.totalGames).toBe(5);
    expect(pile('Village').games).toBe(4); expect(pile('Militia').games).toBe(2); expect(pile('Moat').games).toBe(1);
  });
  it('treats the two names of a split pile as one pile', () => {
    expect(pile('Gladiator')).toBe(pile('Fortune')); expect(pile('Gladiator').games).toBe(2);
  });
  it('keeps each pile\'s games oldest first, so the last is the most recent', () => { expect(pile('Village').list.map(g => g.day)).toEqual([1, 2, 3, 4]); });
  it('counts landscapes by id', () => { expect(stats.landscapes.get(land('Way of the Mole').id).games).toBe(1); });
  it('works out the viewer\'s record, a shared first place being a win', () => {
    expect(pile('Village').mine).toEqual({ games: 4, wins: 3 }); expect(pile('Militia').mine).toEqual({ games: 2, wins: 1 });
    expect(playStats(catalog, games, 'Zed').piles.get(card('Village').pileKey).mine).toEqual({ games: 0, wins: 0 });
    expect(playStats(catalog, games).piles.get(card('Village').pileKey).mine.games).toBe(0);   // nobody signed in
  });
  it('names a game\'s winners, ties included', () => { expect(winners(games[2])).toEqual(['Ann', 'Bob']); expect(winners(games[0])).toEqual(['Ann']); });
  it('hands the randomizer plain per-pile counts', () => { expect(pilesPlayed(stats).get(card('Village').pileKey)).toBe(4); });
  it('copes with no games, and with ids the catalog no longer knows', () => {
    const none = playStats(catalog, [], 'Ann'); expect(none.withKingdom).toBe(0); expect(none.piles.size).toBe(0);
    const odd = playStats(catalog, [game(1, [{ kind: 'card', id: 'gone:card' }, { kind: 'landscape', id: 'gone:land' }], { Ann: 1 })], 'Ann'); expect(odd.piles.size).toBe(0);
  });
});

describe('insights', () => {
  const ins = insights(catalog, stats);
  it('lists the most played piles first, by games then by recency', () => {
    expect(ins.mostPlayed[0]).toMatchObject({ name: 'Village', games: 4 });
    expect(ins.mostPlayed.map(r => r.games)).toEqual([...ins.mostPlayed.map(r => r.games)].sort((a, b) => b - a));
    expect(ins.mostPlayed[1].name).toBe('Gladiator / Fortune');   // last played on day 4, Militia on day 2
  });
  it('counts what has never been played, per expansion, and in total', () => {
    expect(ins.neverTotal).toBe(catalog.piles.length - stats.piles.size);
    expect(ins.neverByExpansion.reduce((a, x) => a + x.total, 0)).toBe(catalog.piles.length);
    expect(ins.neverByExpansion.find(x => x.expansion === 'Dominion Base Game')).toMatchObject({ total: 26, never: 23 });   // Village, Militia and Moat were played
    expect(ins.neverByExpansion.find(x => x.expansion === 'Empires').never).toBe(24 - 1);                                     // Gladiator / Fortune is one pile
  });
  it('gives a record only for cards seen at least the minimum number of times, best win rate first', () => {
    expect(MIN_GAMES_FOR_RECORD).toBe(3);
    expect(ins.mine.map(r => r.name)).toEqual(['Village']); expect(ins.mine[0]).toMatchObject({ games: 4, wins: 3, rate: 0.75 });
    expect(ins.myGames).toBe(4);
  });
});

describe('filtering and sorting by play', () => {
  const plays = stats.piles;
  it('"not played yet" keeps only piles with no logged game, and is in the URL', () => {
    const f = { ...DEFAULT_CARD_FILTERS, unplayed: true };
    const out = browseCards(catalog.cards, f, { plays });
    expect(out.some(c => ['Village', 'Militia', 'Moat', 'Gladiator', 'Fortune'].includes(c.name))).toBe(false);
    expect(out.length).toBe(catalog.cards.filter(c => !plays.has(c.pileKey)).length);
    expect(cardFiltersToQuery(f)).toBe('?unplayed=1'); expect(cardFiltersFromQuery('?unplayed=1').unplayed).toBe(true); expect(activeCardFilters(f)).toBe(1);
    expect(browseCards(catalog.cards, f).length).toBe(catalog.cards.length);   // no league data: the filter can't apply, so it hides nothing
  });
  it('sorts by times played, either way, ties by name', () => {
    const asc = browseCards(catalog.cards, { ...DEFAULT_CARD_FILTERS, sort: 'plays', dir: 'asc' }, { plays }), desc = browseCards(catalog.cards, { ...DEFAULT_CARD_FILTERS, sort: 'plays', dir: 'desc' }, { plays });
    expect(asc[0].name < asc[1].name).toBe(true); expect(plays.get(asc[0].pileKey)).toBeUndefined();
    expect(desc[0].name).toBe('Village'); expect(cardFiltersFromQuery('?sort=plays').sort).toBe('plays');
    expect(browseCards(catalog.cards, { ...DEFAULT_CARD_FILTERS, sort: 'plays' }).map(c => c.name)).toEqual(browseCards(catalog.cards, DEFAULT_CARD_FILTERS).map(c => c.name));   // no data: by name
  });
});

// the views, inside a stand-in for the league page context
const page = over => ({ D: { games }, gid: 'g1', me: { name: 'Ann', is_admin: false }, allGroups: [{ id: 'g1', name: 'Friends' }], hashFor: (r, g, rest) => `#/${r}/${g}${rest != null ? '/' + rest : ''}`, ...over });
const view = (arg, ctx) => renderToStaticMarkup(<CatalogProvider catalog={catalog}><PageContext.Provider value={ctx === null ? null : page(ctx)}><DominionView arg={arg} /></PageContext.Provider></CatalogProvider>);
const text = h => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');

describe('the Collection pages with play data', () => {
  it('a card page shows how often it was played, its recent games as links, and the viewer\'s record', () => {
    const h = view(`cards/${encodeURIComponent(card('Village').id)}`), t = text(h);
    expect(t).toMatch(/4\s+logged games/); expect(t).toMatch(/In our games/); expect(t).toMatch(/In 4 logged games for Friends/);
    expect(h).toContain('href="#/games/g1/4"'); expect(t).toMatch(/won by Ann/); expect(t).toMatch(/won by Ann & Bob/);
    expect(t).toMatch(/You played it in 4 games and won 3/);
  });
  it('says so when a card has never been played, and shows no section at all without any logged kingdom', () => {
    expect(text(view(`cards/${encodeURIComponent(card('Witch').id)}`))).toMatch(/Not played yet in a logged game/);
    const none = text(view(`cards/${encodeURIComponent(card('Witch').id)}`, { D: { games: [game(1, [], { Ann: 1, Bob: 2 })] } }));
    expect(none).not.toMatch(/In our games|logged games/);
    expect(text(view(`cards/${encodeURIComponent(card('Witch').id)}`, null))).not.toMatch(/In our games/);   // outside the league
  });
  it('a landscape page shows its play history too', () => {
    const t = text(view(`landscapes/${encodeURIComponent(land('Way of the Mole').id)}`)); expect(t).toMatch(/1\s+logged games?/); expect(t).toMatch(/In our games/);
  });
  it('the cards table gets a Played column, a sort option and a "Not played yet" filter, only once kingdoms are logged', () => {
    const h = view('cards'); expect(h).toMatch(/>Played</); expect(h).toMatch(/Times played/); expect(text(h)).toMatch(/Not played yet/);
    const bare = view('cards', null); expect(bare).not.toMatch(/>Played</); expect(text(bare)).not.toMatch(/Not played yet|Times played/);
    const unplayed = view('cards?unplayed=1'); expect((unplayed.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr[ >]/g) || []).length).toBe(catalog.cards.filter(c => !stats.piles.has(c.pileKey)).length);
  });
  it('Previous/Next on a card page follow the same order as a list sorted by times played', () => {
    const list = browseCards(catalog.cards, { ...DEFAULT_CARD_FILTERS, sort: 'plays', dir: 'desc' }, { plays: stats.piles }), q = '?sort=plays&dir=desc';
    const h = view(`cards/${encodeURIComponent(list[3].id)}${q}`);
    expect(h).toContain(`href="#/dominion/cards/${encodeURIComponent(list[4].id)}?sort=plays&amp;dir=desc"`); expect(text(h)).toContain(`4 of ${list.length}`);
  });
});

describe('the Insights page', () => {
  it('shows the most played, what has not been played, and the viewer\'s record', () => {
    const h = view('insights'), t = text(h);
    expect(t).toMatch(/Based on 4 of 5 games in Friends/); expect(t).toMatch(/Most played cards/); expect(t).toMatch(/Village/);
    expect(t).toMatch(/Not played yet/); expect(h).toContain('unplayed=1'); expect(t).toMatch(/Your record with cards/); expect(t).toMatch(/75%/);
  });
  it('explains itself when no kingdom has been logged, with a pointer for an admin', () => {
    const none = { D: { games: [game(1, [], { Ann: 1, Bob: 2 })] } };
    expect(text(view('insights', none))).toMatch(/No game for Friends has a kingdom logged yet/); expect(text(view('insights', none))).toMatch(/Once the admin starts logging them/);
    expect(text(view('insights', { ...none, me: { name: 'Ann', is_admin: true } }))).toMatch(/step 5 of Add a game/);
  });
  it('says so outside the league, and asks for more games before showing a record', () => {
    expect(text(view('insights', null))).toMatch(/aren.t available here/);
    expect(text(view('insights', { D: { games: games.slice(0, 2) } }))).toMatch(/Once you.ve played 3 games/);
  });
});
