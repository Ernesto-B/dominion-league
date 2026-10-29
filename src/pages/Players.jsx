import { usePage } from '../PageContext.js';
import { f0, f2, pc, sgn } from '../lib/format.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import PlayerLink from '../components/PlayerLink.jsx';
import NameIcon from '../components/NameIcon.jsx';
import TierIcon from '../components/TierIcon.jsx';
import StatTile, { SetStatTile, SetBreakdown, PopText } from '../components/StatTile.jsx';
import TierProgressBar from '../components/TierProgressBar.jsx';
import GameCards from '../components/GameCards.jsx';
import H2HMatrix from '../components/H2HMatrix.jsx';
import Badges from '../components/Badges.jsx';
import XpPanel from '../components/XpPanel.jsx';
import { rivalries } from '../lib/achievements.js';
import PlayerPicker from '../components/PlayerPicker.jsx';
import PinnedBadges from '../components/PinnedBadges.jsx';
import RatingChart from '../components/RatingChart.jsx';
import { useState } from 'react';

export default function Players() {
  const { D, gid, arg, hashFor, enabledSets } = usePage();
  const [hover, setHover] = useState({ of: null, name: null });
  const all = D.players.filter(p => p.allGames > 0);
  if (!all.length) return <><h1>Players</h1><GroupSwitcher route="players" /><p className="empty">No games yet.</p></>;
  const rankedHere = D.ranked;
  const name = arg ? decodeURIComponent(arg) : (rankedHere[0] || all[0]).name;
  const p = D.players.find(x => x.name === name) || all[0];
  // Hovering a chart label lights up that line; switching players starts fresh, like a re-render did.
  const highlight = hover.of === p.name ? hover.name : null;

  const header = (
    <>
      <div className="head headc">
        <div className="who">
          {p.tier && <TierIcon id={p.tier.icon} size={72} alt={p.tier.name + ' tier'} />}
          <div>
            <div className="namerow"><h1>{p.name}</h1><PinnedBadges p={p} /></div>
            {p.tier && <p className="lede">{p.tier.name} tier{p.nextTier ? `, ${p.nextTier.need} Elo to ${p.nextTier.tier.name}` : ', top tier'}{p.peakTier && p.peakTier.id !== p.tier.id ? `. Best ever: ${p.peakTier.name}.` : ''}</p>}
          </div>
        </div>
        <PlayerPicker names={all.map(x => x.name)} current={p.name} hrefFor={n => hashFor('players', gid, encodeURIComponent(n))} />
      </div>
      <GroupSwitcher route="players" />
      <TierProgressBar p={p} />
      <Banner />
    </>
  );
  if (!p.rated) return <>{header}<p className="empty">No rated games yet.</p></>;

  const hh = D.h2h(null);
  const setCounts = {};
  D.games.forEach(g => { if (g.places[p.name] != null) g.sets.forEach(s => { setCounts[s] = (setCounts[s] || 0) + 1; }); });
  const setEntries = Object.entries(setCounts);
  const mostSet = setEntries.length ? setEntries.reduce((a, b) => b[1] > a[1] ? b : a) : null;
  const leastSet = setEntries.length > 1 ? setEntries.reduce((a, b) => b[1] < a[1] ? b : a) : null;
  const losses = p.rated - p.wins;
  const ratioTxt = p.wins ? (losses ? `${(p.wins / losses).toFixed(2)}:1` : 'no losses yet') : '—';
  const peakGap = p.peak - p.elo;
  const setsPop = <SetBreakdown setCounts={setCounts} enabledSets={enabledSets} />;

  // Best/worst landscape type by win %, only counting types with enough games to mean something.
  let landscapeTiles = null;
  const q = Object.entries(p.landscapeStats).filter(([, e]) => e.games >= D.S.minGamesForRecords);
  if (q.length >= 2) {
    const best = q.reduce((a, b) => b[1].winPct > a[1].winPct ? b : a), worst = q.reduce((a, b) => b[1].winPct < a[1].winPct ? b : a);
    if (best[1].winPct !== worst[1].winPct) {
      const pop = (t, e) => <PopText text={`Your win rate in rated games with ${t} in play, out of ${e.games} games. Only types with at least ${D.S.minGamesForRecords} games count.`} extra={`Overall: ${pc(p.winPct)}`} />;
      landscapeTiles = <>
        <StatTile big={best[0]} label={`best landscape (${pc(best[1].winPct)} wins)`} popup={pop(best[0], best[1])} />
        <StatTile big={worst[0]} label={`worst landscape (${pc(worst[1].winPct)} wins)`} popup={pop(worst[0], worst[1])} />
      </>;
    }
  }

  const rivals = hh.players.filter(o => o !== p.name).map(o => ({ o, w: hh.ahead[p.name][o], l: hh.ahead[o][p.name] }));
  const { nem, vic } = rivalries(hh, p.name);
  const opp = rivals.filter(x => x.w + x.l > 0).sort((a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)) || (b.w + b.l) - (a.w + a.l));

  return (
    <>
      {header}
      <div className="stats">
        <StatTile icon="icons/stats/elo.png" big={f0(p.elo)} label={'Elo' + (p.rank ? ', rank ' + p.rank : '')}
          popup={<PopText text={`Your current skill rating. Everyone starts at ${D.E.start}; it moves after every rated game based on who you played and how surprising the result was.`} />} />
        <StatTile icon="icons/stats/peak-elo.png" big={f0(p.peak)} label="peak Elo"
          popup={<PopText text="The highest Elo you've ever reached — it never goes down." extra={peakGap > 0.5 ? `${f0(peakGap)} below your peak right now` : "You're at your all-time peak right now"} />} />
        <StatTile icon="icons/stats/rated-games.png" big={p.rated} label={'rated games' + (p.status === 'Provisional' ? ' (provisional)' : '')}
          popup={<PopText text={`Games that count toward Elo — everything except Friendly games. Your first ${D.E.provisionalGames} are Provisional, with bigger rating swings while the system is still learning your skill.`} />} />
        <StatTile icon="icons/stats/wins.png" big={p.wins} label={`wins (${pc(p.winPct)})`}
          popup={<PopText text="Tables you've won outright — sole 1st place, no ties." extra={`W/L ratio ${ratioTxt}`} />} />
        <StatTile icon="icons/stats/average-points.png" big={f2(p.avgPts)} label="avg points, 0 to 1"
          popup={<PopText text="Your average share of the points on offer at your tables, from 0 (always last) to 1 (always first). 0.5 is what an evenly matched table averages." />} />
        <StatTile icon="icons/stats/win-streak.png" big={p.streak} label={`win streak (best ${p.bestStreak})`}
          popup={<PopText text="Wins in a row right now — resets the moment you don't finish 1st." extra={`Best ever: ${p.bestStreak}`} />} />
        <StatTile icon="icons/champion.png" big={p.titles} label={'season title' + (p.titles === 1 ? '' : 's')}
          popup={<PopText text="Seasons you've won outright. Decided by points, not Elo — see the Season page." />} />
        <StatTile icon="icons/stats/top-half-finishes.png" big={pc(p.topHalf)} label="top half"
          popup={<PopText text="Share of tables where your points share was 0.5 or better — roughly, finishing in the top half of the table." />} />
        <StatTile icon="icons/stats/last-place-finishes.png" big={p.lasts} label="last places"
          popup={<PopText text="Tables where you finished alone in last place. A tie for last doesn't count against you." />} />
        <StatTile icon="icons/stats/longest-without-win.png" big={p.bestDry} label="longest dry spell"
          popup={<PopText text="Your longest-ever run of rated games without a win." extra={p.dry > 0 ? `${p.dry} games into one right now` : 'Not in one right now'} />} />
        {landscapeTiles}
        <SetStatTile setName={mostSet && mostSet[0]} label="most played" popup={setsPop} />
        <SetStatTile setName={leastSet && leastSet[0]} label="least played" popup={setsPop} />
      </div>
      {(nem || vic) && (
        <div className="rivals">
          {nem && <p><b>Nemesis</b> <PlayerLink name={nem.o} />, who finished ahead {nem.l} of {nem.w + nem.l} times.</p>}
          {vic && <p><b>Favourite victim</b> <PlayerLink name={vic.o} />, finished behind {vic.w} of {vic.w + vic.l} times.</p>}
        </div>
      )}
      <XpPanel name={p.name} />
      <Badges p={p} />
      <h2>Rating history</h2>
      <RatingChart names={rankedHere.map(x => x.name)} hot={p.name} highlight={highlight} onHover={n => setHover({ of: p.name, name: n })} />
      {opp.length > 0 && <>
        <h2>Against each opponent</h2>
        <H2HMatrix hh={D.h2h(null)} focus={p.name} />
        <p className="note">Each cell is how often the row player finished ahead of the column player; your row is highlighted. Rated games where both sat at the same table; ties aren't counted either way.</p>
      </>}
      <h2>Results</h2>
      <Results key={p.name} p={p} />
    </>
  );
}

// This player's rated games, newest first, each expandable into the full table's breakdown.
function Results({ p }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = line => setOpen(o => { const n = new Set(o); n.has(line) ? n.delete(line) : n.add(line); return n; });
  // the same games as on the Games page: cards on a phone and a wide screen; this player's own line is marked
  return <div className="gview-cards"><GameCards games={p.results.slice().reverse().map(r => r.game)} open={open} toggle={toggle} showDate link me={p.name} /></div>;
}
