import { useMemo } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { useLeagueGames } from '../useLeagueGames.js';
import { MIN_GAMES_FOR_RECORD, insights } from '../playStats.js';
import { cardHref, cardsFilterHref, dominionHref } from '../links.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, Section, TypePills } from '../components/bits.jsx';
import CostIcons from '../components/Cost.jsx';
import { usePager } from '../components/Pager.jsx';

const pct = r => `${Math.round(r * 100)}%`;

/* What the logged kingdoms say about the cards the group actually plays: the most played, what hasn't been tried, and the
   viewer's own record. Everything comes from the games of the group last picked on the league pages (see useLeagueGames). */
export default function Insights() {
  const { catalog } = useCatalog();
  const lg = useLeagueGames();

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

  return <Loaded head={head} lg={lg} />;
}

function Loaded({ head, lg }) {
  const { catalog } = useCatalog();
  const ins = useMemo(() => insights(catalog, lg.stats, { top: Infinity }), [catalog, lg.stats]);
  const { pg, pager } = usePager(ins.mostPlayed, 'cards');
  const repCard = key => catalog.pilesByKey.get(key).cardIds[0];

  return (
    <>
      {head}
      <p className="note" style={{ marginTop: 0 }}>Based on <b>{lg.withKingdom}</b> of {lg.totalGames} {lg.totalGames === 1 ? 'game' : 'games'}{lg.groupName ? ` in ${lg.groupName}` : ''} that {lg.withKingdom === 1 ? 'has' : 'have'} a kingdom logged.{lg.multiGroup ? ' It shows the group you last picked on the league pages.' : ''}</p>

      <Section title="Most played cards" id="in-most">
        <div className="tablewrap"><table className="plain dn-table dn-iconset">
          <caption className="dn-sr">The most played Kingdom cards</caption>
          <thead><tr><th className="l" scope="col">Card</th><th className="l dn-hide-sm" scope="col">Types</th><th className="l" scope="col"><span className="th-full">Expansion</span><span className="th-short" aria-hidden="true">Set</span></th><th className="edge" scope="col">Games</th><th className="l dn-hide-sm" scope="col">Last played</th></tr></thead>
          <tbody>{pg.items.map(r => {
            const members = catalog.pilesByKey.get(r.key).cardIds.map(id => catalog.cardsById.get(id)).filter(Boolean), first = members[0];
            return (
            <tr key={r.key}>
              <td className="l name"><span className="dn-namecost">{first && <CostIcons coins={first.coins} debt={first.debt} overpay={first.overpay} size={22} />}<a href={cardHref(repCard(r.key))}>{r.name}</a></span></td>
              <td className="l dn-hide-sm"><TypePills types={[...new Set(members.flatMap(c => c.types))]} /></td>
              <td className="l"><ExpansionBadge name={r.expansion} size={16} /></td>
              <td className="edge">{r.games}</td>
              <td className="l dn-hide-sm"><a href={lg.hashFor('games', lg.gid, r.last.line)} title="Open that game">{r.last.date}</a></td>
            </tr>
            );
          })}</tbody>
        </table></div>
        {pager}
      </Section>

      <Section title="Not played yet" id="in-never">
        <div className="tablewrap"><table className="plain dn-table dn-pcttable">
          <caption className="dn-sr">Kingdom supply piles played and not played yet, by expansion</caption>
          <thead><tr><th className="l" scope="col">Expansion</th><th className="dn-hide-sm" scope="col">Piles</th><th scope="col">Played</th><th scope="col">Not played</th></tr></thead>
          <tbody>{ins.neverByExpansion.map(x => (
            <tr key={x.expansion}>
              <td className="l"><a href={cardsFilterHref({ expansions: [x.expansion] })}><ExpansionBadge name={x.expansion} /></a></td>
              <Counts total={x.total} played={x.total - x.never} patch={{ expansions: [x.expansion] }} />
            </tr>
          ))}</tbody>
          <tfoot><tr>
            <th className="l" scope="row">Total</th>
            <Counts total={catalog.piles.length} played={catalog.piles.length - ins.neverTotal} patch={{}} />
          </tr></tfoot>
        </table></div>
      </Section>

      <Section title="Your record with cards" id="in-mine">
        {ins.mine.length ? (
          <>
            <div className="tablewrap"><table className="plain dn-table">
              <caption className="dn-sr">Your win rate in games that had each card</caption>
              <thead><tr><th className="l" scope="col">Card</th><th scope="col">Games</th><th scope="col">Wins</th><th scope="col">Win rate</th></tr></thead>
              <tbody>{ins.mine.map(r => (
                <tr key={r.key}><td className="l name"><a href={cardHref(repCard(r.key))}>{r.name}</a></td><td>{r.games}</td><td>{r.wins}</td><td>{pct(r.rate)}</td></tr>
              ))}</tbody>
            </table></div>
            <p className="note">Your results in logged games that had the card in the kingdom, for cards you’ve seen at least {MIN_GAMES_FOR_RECORD} times. A card being in the kingdom doesn’t mean you bought it, so read this as “how I do when it’s out”, not “how good it is”.</p>
          </>
        ) : (
          <EmptyState>{lg.me ? <>Once you’ve played {MIN_GAMES_FOR_RECORD} games with the same card in the kingdom, your record with it shows here{ins.myGames ? ` (the most for any card so far is ${ins.myGames})` : ''}.</> : 'Your record shows once you’re signed in as a player.'}</EmptyState>
        )}
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
