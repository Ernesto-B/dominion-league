/* What the logged kingdoms say about how the Collection has actually been played. Pure: it takes the catalog and one
   group's games (D.games, each with `kingdom`, `places`, `names`, `line`, `date`) and counts.

   Only games that HAVE a kingdom logged count, and a supply pile counts once per game however its names were logged
   (so Knights is one pile, however many Knights the log happens to name). `me` is the viewer's player name, for "your
   record"; a win is first place, a shared first counts. */
export const MIN_GAMES_FOR_RECORD = 3;

export function playStats(catalog, games, me = null) {
  const piles = new Map(), landscapes = new Map();
  let withKingdom = 0;
  const bump = (map, key, g) => {
    let e = map.get(key); if (!e) map.set(key, e = { games: 0, list: [], mine: { games: 0, wins: 0 } });
    e.games++; e.list.push(g);
    if (me && g.places && g.places[me] != null) { e.mine.games++; if (g.places[me] === 1) e.mine.wins++; }
  };
  for (const g of games) {   // D.games is oldest first, so each list ends with the most recent
    const items = g.kingdom || [];
    if (!items.length) continue;
    withKingdom++;
    new Set(items.filter(i => i.kind === 'card').map(i => catalog.cardsById.get(i.id)?.pileKey).filter(Boolean)).forEach(k => bump(piles, k, g));
    new Set(items.filter(i => i.kind === 'landscape').map(i => i.id)).forEach(id => bump(landscapes, id, g));
  }
  return { piles, landscapes, withKingdom, totalGames: games.length };
}

export const pilesPlayed = stats => new Map([...stats.piles].map(([k, e]) => [k, e.games]));   // pile key -> games (for the randomizer's weighting)

export function winners(g) { return g.names.filter(n => g.places[n] === 1); }

/* The Insights page's three lists. */
export function insights(catalog, stats, { top = 10 } = {}) {
  const pileName = key => catalog.pilesByKey.get(key)?.id ?? key;
  const last = e => e.list[e.list.length - 1];
  const mostPlayed = [...stats.piles].map(([key, e]) => ({ key, name: pileName(key), expansion: catalog.pilesByKey.get(key)?.expansion, games: e.games, last: last(e) }))
    .sort((a, b) => b.games - a.games || b.last.day - a.last.day || a.name.localeCompare(b.name)).slice(0, top);

  const unplayed = new Map();   // expansion -> { total, never }
  catalog.piles.forEach(p => { const x = unplayed.get(p.expansion) || unplayed.set(p.expansion, { expansion: p.expansion, total: 0, never: 0 }).get(p.expansion); x.total++; if (!stats.piles.has(p.key)) x.never++; });
  const neverByExpansion = catalog.ownedExpansions.map(e => unplayed.get(e.name)).filter(Boolean);

  const mine = [...stats.piles].filter(([, e]) => e.mine.games >= MIN_GAMES_FOR_RECORD)
    .map(([key, e]) => ({ key, name: pileName(key), games: e.mine.games, wins: e.mine.wins, rate: e.mine.wins / e.mine.games }))
    .sort((a, b) => b.rate - a.rate || b.games - a.games || a.name.localeCompare(b.name));
  const myGames = [...stats.piles.values()].reduce((m, e) => Math.max(m, e.mine.games), 0);
  return { mostPlayed, neverByExpansion, neverTotal: neverByExpansion.reduce((a, x) => a + x.never, 0), mine, myGames };
}
