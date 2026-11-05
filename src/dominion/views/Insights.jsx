import { useMemo } from 'react';
import { writeQuery } from '../urlState.js';
import ScopePicker from '../components/ScopePicker.jsx';
import { useCatalog } from '../CatalogContext.jsx';
import { useLeagueGames } from '../useLeagueGames.js';
import { insights } from '../playStats.js';
import { cardHref, cardsFilterHref, dominionHref, landscapeHref, landscapesFilterHref } from '../links.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, LandscapePill, Section, TypePills } from '../components/bits.jsx';
import CostIcons from '../components/Cost.jsx';
import { usePager } from '../components/Pager.jsx';
import { hoverHandlers } from '../components/CardHover.jsx';
import { slotFaceId } from '../cardImages.js';

const pct = r => `${Math.round(r * 100)}%`;

/* What the logged kingdoms say about the cards the group actually plays: the most played, what hasn't been tried, and the
   viewer's own record. Everything comes from the games of the group last picked on the league pages (see useLeagueGames). */
export default function Insights({ query = '' }) {
  const { catalog } = useCatalog();
  const asked = new URLSearchParams(query.replace(/^\?/, '')).get('who') || '';   // `?who=Name` in the address, so a link shares the choice; a name that isn't a player is ignored
  const lg = useLeagueGames(asked);

  const head = <div className="head"><div><h1>Kingdom insights</h1><p className="lede">What the logged kingdoms say about the cards you actually play.</p></div></div>;

  if (!lg) return <>{head}<EmptyState>Insights come from the league’s logged games, which aren’t available here.</EmptyState></>;
  if (!lg.stats) return (
    <>
      {head}
      <EmptyState>
        No game{lg.groupName ? ` for ${lg.groupName}` : ''} has a kingdom logged yet.{' '}
        {lg.canLog
          ? <>Pick the cards in step 5 of <b>Add a game</b>, or roll a kingdom in the <a href={dominionHref('randomizer')}>Randomizer</a> and choose <b>Use for a game</b>.</>
          : <>Once the admin starts logging them, the most played cards and your own record will show up here.</>}
      </EmptyState>
    </>
  );

  return <Loaded head={head} lg={lg} query={query} />;
}

function Loaded({ head, lg, query }) {
  const { catalog } = useCatalog();
  // the whole group, or one player's own games: the same lists either way (only the games the player sat at count)
  const who = lg.who, stats = lg.stats;
  const setWho = n => writeQuery(n ? '?who=' + encodeURIComponent(n) : '');
  const scope = <ScopePicker bar who={who} players={lg.players} onPick={setWho} />;
  const lands = useMemo(() => [...stats.landscapes].map(([id, e]) => ({ l: catalog.landscapesById.get(id), games: e.games, last: e.list[e.list.length - 1] })).filter(x => x.l)
    .sort((a, b) => b.games - a.games || b.last.day - a.last.day || a.l.name.localeCompare(b.l.name)), [catalog, stats]);
  const { pg: lpg, pager: lpager } = usePager(lands, 'landscapes');
  const ins = useMemo(() => insights(catalog, stats, { top: Infinity }), [catalog, stats]);
  const { pg, pager } = usePager(ins.mostPlayed, 'cards');
  const repCard = key => catalog.pilesByKey.get(key).cardIds[0];
  // the picture that stands for a pile: its own pile card (Knights, Castles, split piles) or its first card that has one
  const pileFace = key => () => { const p = catalog.pilesByKey.get(key); return p && slotFaceId({ key, name: p.id, cards: p.cardIds.map(id => catalog.cardsById.get(id)).filter(Boolean) }); };

  return (
    <>
      {head}
      {scope}
      <p className="note dn-based" style={{ marginTop: 0 }}>Based on <b>{stats.withKingdom}</b> of {stats.totalGames} {stats.totalGames === 1 ? 'game' : 'games'}{who ? ` ${who} played in the group` : lg.groupName ? ` in ${lg.groupName}` : ''} that {stats.withKingdom === 1 ? 'has' : 'have'} a kingdom logged.{lg.multiGroup ? ' It shows the group you last picked on the league pages.' : ''}</p>

      <Section title="Most played cards" id="in-most">
        <div className="tablewrap"><table className="plain dn-table dn-iconset">
          <caption className="dn-sr">The most played Kingdom cards</caption>
          <thead><tr><th className="l" scope="col">Card</th><th className="l dn-hide-sm" scope="col">Types</th><th className="l" scope="col"><span className="th-full">Expansion</span><span className="th-short" aria-hidden="true">Set</span></th><th className="edge" scope="col">Games</th><th className="l dn-hide-sm" scope="col">Last played</th></tr></thead>
          <tbody>{pg.items.map(r => {
            const members = catalog.pilesByKey.get(r.key).cardIds.map(id => catalog.cardsById.get(id)).filter(Boolean), first = members[0];
            return (
            <tr key={r.key} {...hoverHandlers(pileFace(r.key))}>
              <td className="l name"><span className="dn-namecost">{first && <CostIcons coins={first.coins} debt={first.debt} overpay={first.overpay} size={22} />}<a href={cardHref(repCard(r.key))}>{r.name}</a></span></td>
              <td className="l dn-hide-sm"><TypePills types={[...new Set(members.flatMap(c => c.types))]} /></td>
              <td className="l"><ExpansionBadge name={r.expansion} size={16} /></td>
              <td className="edge">{r.games}</td>
              <td className="l dn-hide-sm"><a href={lg.hashFor('games', lg.gid) + '?game=' + r.last.line} title="Show that game in the Games page">{r.last.date}</a></td>
            </tr>
            );
          })}</tbody>
        </table></div>
        {pager}
      </Section>

      <Section title="Most played landscapes" id="in-lands">
        {lands.length ? (
          <>
            <div className="tablewrap"><table className="plain dn-table dn-iconset">
              <caption className="dn-sr">The most played landscapes</caption>
              <thead><tr><th className="l" scope="col">Landscape</th><th className="l dn-hide-sm" scope="col">Type</th><th className="l" scope="col"><span className="th-full">Expansion</span><span className="th-short" aria-hidden="true">Set</span></th><th className="edge" scope="col">Games</th><th className="l dn-hide-sm" scope="col">Last played</th></tr></thead>
              <tbody>{lpg.items.map(r => (
                <tr key={r.l.id} {...hoverHandlers(r.l.id)}>
                  <td className="l name"><span className="dn-namecost">{r.l.coins != null && <CostIcons coins={r.l.coins} debt={r.l.debt} size={22} />}<a href={landscapeHref(r.l.id)}>{r.l.name}</a></span></td>
                  <td className="l dn-hide-sm"><LandscapePill type={r.l.type} /></td>
                  <td className="l"><ExpansionBadge name={r.l.expansion} size={16} /></td>
                  <td className="edge">{r.games}</td>
                  <td className="l dn-hide-sm"><a href={lg.hashFor('games', lg.gid) + '?game=' + r.last.line} title="Show that game in the Games page">{r.last.date}</a></td>
                </tr>
              ))}</tbody>
            </table></div>
            {lpager}
          </>
        ) : <EmptyState>{who ? `${who} hasn’t played with a landscape in a logged game yet.` : 'No logged game has had a landscape yet.'}</EmptyState>}
        {catalog.landscapes.length > lands.length && <p className="note"><a href={landscapesFilterHref({ played: 'no', by: who })}>{catalog.landscapes.length - lands.length} of {catalog.landscapes.length} landscapes</a> {who ? `haven’t been played by ${who}` : 'haven’t been played yet'}.</p>}
      </Section>

      <Section title={who ? `Not played yet by ${who}` : 'Not played yet'} id="in-never">
        <div className="tablewrap"><table className="plain dn-table dn-pcttable">
          <caption className="dn-sr">Kingdom supply piles played and not played yet, by expansion</caption>
          <thead><tr><th className="l" scope="col">Expansion</th><th className="dn-hide-sm" scope="col">Piles</th><th scope="col">Played</th><th scope="col">Not played</th></tr></thead>
          <tbody>{ins.neverByExpansion.map(x => (
            <tr key={x.expansion}>
              <td className="l"><a href={cardsFilterHref({ expansions: [x.expansion], by: who })}><ExpansionBadge name={x.expansion} /></a></td>
              <Counts total={x.total} played={x.total - x.never} patch={{ expansions: [x.expansion], by: who }} />
            </tr>
          ))}</tbody>
          <tfoot><tr>
            <th className="l" scope="row">Total</th>
            <Counts total={catalog.piles.length} played={catalog.piles.length - ins.neverTotal} patch={{ by: who }} />
          </tr></tfoot>
        </table></div>
      </Section>
    </>
  );
}

// Piles / Played / Not played cells: each number opens the Kingdom cards table with that expansion (or all) and that play history filtered
function Counts({ total, played, patch }) {
  const never = total - played;
  // the number and its percentage are one link, so the whole cell is the target
  const cell = (n, extra, showShare = true) => {
    const inner = <><span className="dn-num">{n}</span>{showShare && <span className="dn-pct">{total ? Math.round(n / total * 100) : 0}%</span>}</>;
    return n ? <a className="dn-cell-link" href={cardsFilterHref({ ...patch, ...extra })}>{inner}</a> : <span className="dn-cell-link off">{inner}</span>;
  };
  return (
    <>
      <td className="dn-hide-sm">{cell(total, {}, false)}</td>
      <td>{cell(played, { played: 'yes' })}</td>
      <td>{cell(never, { played: 'no' })}</td>
    </>
  );
}
