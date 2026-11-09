import { useMemo } from 'react';
import { playStats } from '../dominion/playStats.js';
import { cardHref, cardsFilterHref, landscapeHref, landscapesFilterHref } from '../dominion/links.js';
import { usePager } from '../dominion/components/Pager.jsx';
import { ExpansionBadge, LandscapePill, TypePills } from '../dominion/components/bits.jsx';
import CostIcons from '../dominion/components/Cost.jsx';
import { hoverHandlers } from '../dominion/components/CardHover.jsx';
import PlayedByExpansion from '../dominion/components/PlayedByExpansion.jsx';
import { slotFaceId } from '../dominion/cardImages.js';

/* The Player page's Cards tab: which Kingdom cards and landscapes this player has sat down with, and how they did when each was out.
   Built from the games they sat at that had a kingdom logged (the same counts as Kingdom insights and the card tables, narrowed to them).
   The tables are Kingdom insights' own (same columns), plus Won: the games they won with the card out. `catalog` is the page's (null until it has
   loaded). Popup-free and context-free: everything arrives as props. */
export default function PlayerCards({ p, D, catalog, insightsHref, gamesHref }) {
  const stats = useMemo(() => (catalog ? playStats(catalog, D.games.filter(g => g.places && g.places[p.name] != null), p.name) : null), [catalog, D, p.name]);
  const piles = useMemo(() => (stats ? [...stats.piles].map(([key, e]) => ({ key, pile: catalog.pilesByKey.get(key), e })).filter(x => x.pile)
    .sort((a, b) => b.e.games - a.e.games || b.e.mine.wins - a.e.mine.wins || a.pile.id.localeCompare(b.pile.id)) : []), [stats, catalog]);
  const lands = useMemo(() => (stats ? [...stats.landscapes].map(([id, e]) => ({ l: catalog.landscapesById.get(id), e })).filter(x => x.l)
    .sort((a, b) => b.e.games - a.e.games || b.e.mine.wins - a.e.mine.wins || a.l.name.localeCompare(b.l.name)) : []), [stats, catalog]);
  const { pg, pager } = usePager(piles, 'cards');
  const { pg: lpg, pager: lpager } = usePager(lands, 'landscapes');
  if (!catalog) return <p className="meta">Loading the card list…</p>;
  if (!stats.withKingdom) return <p className="empty">None of {p.name}’s games has a kingdom logged yet. Games started from Game night record one.</p>;

  const total = catalog.piles.length, seen = piles.length, left = total - seen;
  const last = e => e.list[e.list.length - 1];
  const pileFace = (key, pile) => () => slotFaceId({ key, name: pile.id, cards: pile.cardIds.map(id => catalog.cardsById.get(id)).filter(Boolean) });
  const lastCell = e => <td className="l dn-hide-sm"><a href={gamesHref(last(e).line)} title="Show that game in the Games page">{last(e).date}</a></td>;
  return (
    <>
      <p className="note dn-based" style={{ marginTop: 0 }}>
        {p.name} has sat down with <b>{seen}</b> of the {total} Kingdom piles and <b>{lands.length}</b> of the {catalog.landscapes.length} landscapes, across <b>{stats.withKingdom}</b> {stats.withKingdom === 1 ? 'game' : 'games'} with a kingdom logged.{' '}
        {left > 0 && <><a href={cardsFilterHref({ played: 'no', by: p.name })}>See the {left} cards left to try →</a>.&emsp;</>}
        <a href={insightsHref}>More in Kingdom insights →</a>
      </p>

      <h2>Most played cards</h2>
      <div className="tablewrap"><table className="plain dn-table dn-iconset">
        <caption className="dn-sr">Kingdom cards in {p.name}’s games, most played first</caption>
        <thead><tr><th className="l" scope="col">Card</th><th className="l dn-hide-sm" scope="col">Types</th><th className="l" scope="col"><span className="th-full">Expansion</span><span className="th-short" aria-hidden="true">Set</span></th><th className="edge" scope="col">Games</th><th className="edge" scope="col">Won</th><th className="l dn-hide-sm" scope="col">Last played</th></tr></thead>
        <tbody>{pg.items.map(({ key, pile, e }) => {
          const members = pile.cardIds.map(id => catalog.cardsById.get(id)).filter(Boolean), first = members[0];
          return (
            <tr key={key} {...hoverHandlers(pileFace(key, pile))}>
              <td className="l name"><span className="dn-namecost">{first && <CostIcons coins={first.coins} debt={first.debt} overpay={first.overpay} size={22} />}<a href={cardHref(pile.cardIds[0], '?by=' + encodeURIComponent(p.name))}>{pile.id}</a></span></td>
              <td className="l dn-hide-sm"><TypePills types={[...new Set(members.flatMap(c => c.types))]} /></td>
              <td className="l"><ExpansionBadge name={pile.expansion} size={16} /></td>
              <td className="edge">{e.games}</td><td className="edge">{e.mine.wins}</td>
              {lastCell(e)}
            </tr>
          );
        })}</tbody>
      </table></div>
      {pager}

      {lands.length > 0 && <>
        <h2>Most played landscapes</h2>
        <div className="tablewrap"><table className="plain dn-table dn-iconset">
          <caption className="dn-sr">Landscapes in {p.name}’s games, most played first</caption>
          <thead><tr><th className="l" scope="col">Landscape</th><th className="l dn-hide-sm" scope="col">Type</th><th className="l" scope="col"><span className="th-full">Expansion</span><span className="th-short" aria-hidden="true">Set</span></th><th className="edge" scope="col">Games</th><th className="edge" scope="col">Won</th><th className="l dn-hide-sm" scope="col">Last played</th></tr></thead>
          <tbody>{lpg.items.map(({ l, e }) => (
            <tr key={l.id} {...hoverHandlers(l.id)}>
              <td className="l name"><span className="dn-namecost">{l.coins != null ? <CostIcons coins={l.coins} debt={l.debt} size={22} /> : <span className="dn-nocost" role="img" aria-label="No cost" />}<a href={landscapeHref(l.id, '?by=' + encodeURIComponent(p.name))}>{l.name}</a></span></td>
              <td className="l dn-hide-sm"><LandscapePill type={l.type} /></td>
              <td className="l"><ExpansionBadge name={l.expansion} size={16} /></td>
              <td className="edge">{e.games}</td><td className="edge">{e.mine.wins}</td>
              {lastCell(e)}
            </tr>
          ))}</tbody>
        </table></div>
        {lpager}
        {lands.length < catalog.landscapes.length && <p className="note"><a href={landscapesFilterHref({ played: 'no', by: p.name })}>{catalog.landscapes.length - lands.length} landscapes</a> not played yet.</p>}
      </>}

      <h2>Cards played by expansion</h2>
      <PlayedByExpansion catalog={catalog} stats={stats} who={p.name} />
    </>
  );
}
