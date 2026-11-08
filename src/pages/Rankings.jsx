import { useMemo, useState } from 'react';
import { usePage } from '../PageContext.js';
import { f0, ord, short, sgn } from '../lib/format.js';
import SeasonChip from '../components/SeasonChip.jsx';
import Banner from '../components/Banner.jsx';
import StoryCards from '../components/StoryCards.jsx';
import TierIcon from '../components/TierIcon.jsx';
import TierLegend from '../components/TierLegend.jsx';
import LastNight from '../components/LastNight.jsx';
import HoverPopup from '../components/HoverPopup.jsx';
import BadgePop from '../components/BadgePop.jsx';
import RankMedal from '../components/RankMedal.jsx';
import RankMark from '../components/RankState.jsx';
import { tierProgress } from '../lib/tierProgress.js';
import RatingChart from '../components/RatingChart.jsx';
import MeCard from '../components/MeCard.jsx';
import Hub from '../components/Hub.jsx';
import Welcome from '../components/Welcome.jsx';
import PendingGames from '../components/PendingGames.jsx';
import SinceVisit from '../components/SinceVisit.jsx';
import { badgesFor, xpOf } from '../lib/xp.js';
import { pinnedBadges, viewHint } from '../lib/achievements.js';
import { steadyPayout } from '../lib/steadyElo.js';


// How far along the way to the next rank, in one thin bar: Elo to go and the next tier's icon; in a trial the games done; in grace the Elo under the line.
function NextRank({ p }) {
  const nx = p.nextTier, kind = p.trial ? ' trial' : p.grace ? ' grace' : '';
  const pct = !nx ? 100 : p.trial ? 100 : Math.round(tierProgress(p.elo, p.tier, nx.tier) * 100);
  const txt = p.trial ? `${p.trial.have}/${p.trial.need}` : p.grace ? `−${Math.max(1, Math.round(p.grace.line - p.elo))}` : nx ? String(nx.need) : '';
  const label = p.trial ? `${p.trial.tier.name} trial, ${p.trial.have} of ${p.trial.need} games` : p.grace ? `${Math.round(p.grace.line - p.elo)} Elo under the ${p.tier.name} line` : nx ? `${nx.need} Elo to ${nx.tier.name}` : 'Top rank';
  return (
    <span className={'lnext' + kind} role="img" aria-label={label} title={label}>
      <span className="nbar"><i style={{ width: pct + '%' }}></i></span>
      {nx ? <><span className="nneed">{txt}</span><TierIcon id={nx.tier.icon} size={18} alt="" /></> : <span className="nneed">Top rank</span>}
    </span>
  );
}

function Ladder({ ranked: rk, highlight, setHighlight }) {
  const { D, gid, hashFor, catalog, rawPlayers, me } = usePage();
  // each player's first pinned badge, shown beside their name (badges are only worked out for players who pinned something)
  const showcase = useMemo(() => {
    const m = new Map();
    for (const r of rawPlayers || []) {
      const ids = r.pinned_badges || []; if (!ids.length) continue;
      const p = D.players.find(x => x.name === r.name); if (!p || !p.rated) continue;
      const b = pinnedBadges(ids, badgesFor(D, p, catalog))[0]; if (b) m.set(r.name, b);
    }
    return m;
  }, [D, catalog, rawPlayers]);
  return (
    <div className="ladder" role="table" aria-label="Elo rankings">
      <div className="lhead" role="row"><span>Rank</span><span>Player</span><span>Next rank</span><span>Elo</span><span>Last</span><span>Recent form</span></div>
      {rk.map((p, idx) => {
        const lastR = p.results[p.results.length - 1];
        const dl = lastR ? lastR.after - lastR.before : 0;
        const rm = p.rankDelta, lv = xpOf(D, p.name, catalog), sb = showcase.get(p.name);   // sb: the badge they show off beside their name
        return (
          <div key={p.name} className={'lrow' + (p.rank <= 3 ? ' stand stand' + p.rank : '') + (sb ? '' : ' nopin') + (highlight === p.name ? ' hot' : '')} data-p={p.name} role="row" style={{ '--i': Math.min(idx, 12) }}
            onMouseEnter={() => setHighlight(p.name)} onFocus={() => setHighlight(p.name)}>
            <span className="lrank"><RankMedal rank={p.rank} size={30} />
              {!rm ? null : rm > 0
                ? <span className="rankmove up-t" title={`Up ${rm} spot${rm === 1 ? '' : 's'} after the latest game`}>▲{rm}</span>
                : <span className="rankmove down-t" title={`Down ${-rm} spot${rm === -1 ? '' : 's'} after the latest game`}>▼{-rm}</span>}
            </span>
            <a className="lname" href={hashFor('players', gid, encodeURIComponent(p.name))}>
              <span className="lname-id"><RankMark p={p} />{p.name}
              {lv && lv.perGame.length > 0 ? <span className="lvl" title={`Level ${lv.level} · ${lv.total.toLocaleString()} XP`}>Lv {lv.level}</span> : null}</span>
              {p.titles ? <span className="crown" title={`${p.titles} season title${p.titles > 1 ? 's' : ''}`}><TierIcon id="champion" size={20} alt="Season champion" />{p.titles > 1 ? '×' + p.titles : ''}</span> : null}
              {sb ? <HoverPopup className="lpin-wrap" content={<BadgePop badge={sb} hint={viewHint(sb, !!me && me.name === p.name)} />}><span className={'pin-chip lpin td-' + sb.tier}>{sb.name}</span></HoverPopup> : null}
              {p.streak >= 3 ? <span className="pill hot" title={`${p.streak}-game win streak`}>🔥 {p.streak}</span> : null}
              {p.status === 'Provisional' ? <span className="tag">provisional</span> : null}
            </a>
            <NextRank p={p} />
            <span className="lelo">{f0(p.elo)}</span>
            <span className={'ldelta ' + (dl > 0.5 ? 'up-t' : dl < -0.5 ? 'down-t' : '')}>{sgn(dl)}</span>
            <span className="lsub">
              <span className="form" aria-label="Recent form">{p.results.slice(-5).map((r, i) => (
                <i key={i} className={r.pts >= 0.67 ? 'w' : r.pts <= 0.33 ? 'l' : 'm'} title={`${r.game.date}: ${ord(r.place)} of ${r.game.n}`}></i>
              ))}</span>
              {sb ? <HoverPopup className="lpin-wrap lpin-m" content={<BadgePop badge={sb} hint={viewHint(sb, !!me && me.name === p.name)} />}><span className={'pin-chip lpin td-' + sb.tier}>{sb.name}</span></HoverPopup> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Rankings() {
  const { D, gid, hashFor } = usePage();
  const [highlight, setHighlight] = useState(null);   // hovering a ladder row or chart label lights up both
  const rk = D.ranked;
  const gl = D.games.filter(g => g.n >= 2);
  const last = gl.length ? gl[gl.length - 1].date : null;
  const R = D.records, nights = R.overview.nights;

  // what one game pays at an even table of four, from the league's own settings 
  const pay4 = steadyPayout(4, D.E).map(v => Math.round(v));
  const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  const notes = <>
    <div className="how-key">
      <p><b>The fastest way up: finish in the top half.</b></p>
      <p>Finish ahead of the middle of the table and your Elo goes up; finish behind it and it goes down. Winning pays a little extra on top. At an odd-sized table, the exact middle seat (3rd of 5) is roughly break-even.</p>
      <p className="meta">A table of four, everyone rated the same: 1st {sg(pay4[0])} · 2nd {sg(pay4[1])} · 3rd {sg(pay4[2])} · 4th {sg(pay4[3])}.</p>
    </div>
    <h2>Rank tiers</h2>
    <TierLegend />
    <p className="note">Your tier follows your Elo, so it can go down as well as up. {D.E.demotionGrace > 0 && <><b>Demotion grace:</b> you can end {D.E.demotionGrace} rated game{D.E.demotionGrace === 1 ? '' : 's'} in a row under the line of the tier you hold and keep it. The game that takes you under counts as the first. Finish a game back at or over the line and the count resets; end one more game under it after your last one and you drop. Your Elo itself is never changed by it.</>}</p>
    {D.E.demotionGrace > 0 && D.E.savingGrace > 0 && <p className="note"><b>Saving Grace:</b> while you are in grace, a top-half finish adds {Math.round(D.E.savingGrace * 100)}% of what you lost in your previous rated game on top of the normal gain, so one decent night can pull you back over the line.</p>}
    {D.E.promotionHold > 1 && <p className="note"><b>Promotion trial:</b> from {(D.tiers.find(t => t.id === D.E.promotionHoldFrom) || D.tiers[1]).name} upward, one big game does not promote you. You rise one rank after ending {D.E.promotionHold} rated games in a row at or over the next line, and a game that ends under it starts the count again. Win more than one rank's worth and the next trial starts straight after.</p>}
    {D.E.duelScale > 0 && D.E.duelScale < 1 && <p className="note"><b>Duels:</b> a game of two is a coin flip, so it moves your Elo much less than a bigger table does: about {Math.round(D.E.duelScale * 100)}% of the usual swing, and the winner isn’t paid twice for finishing top half and first.</p>}
    <p className="note">The trophy is for winning a season and never goes away.</p>
    <p className="note">Everyone starts at {D.E.start} as a {D.startTier.name} and climbs from there. Elo carries across seasons; friendly games never count. New players move faster for their first {D.E.provisionalGames} games (provisional).</p>
    <p className="note">This ladder is Elo — a lifetime skill rating that never resets. It's not what decides a season's winner; that's points, on the <a href={hashFor('season', gid)}>Season page</a>.</p>
  </>;
  const chips = (
    <div className="chips toprow">
      <SeasonChip />
      {last && <span className="chip">Last night <b>{short(last)}</b></span>}
      <span className="chip"><b>{nights}</b> night{nights === 1 ? '' : 's'} played</span>
    </div>
  );

  // the front door: you, what changed, the ladder; the explanations are folded away at the bottom
  return (
    <>
      <h1 className="dn-sr">Rankings</h1>
      <Welcome />
      <MeCard ranked={rk} />
      <PendingGames compact />
      {rk.length > 0 && <Hub />}
      {rk.length > 0 && <SinceVisit ranked={rk} />}
      {chips}
      <Banner />
      {!rk.length ? <p className="empty">No rated games yet. Once the admin adds one, the rankings show up here.</p> : <>
        <Ladder ranked={rk} highlight={highlight} setHighlight={setHighlight} />
        <p className="note dn-only-sm form-key"><span className="form"><i className="w"></i></span> strong finish <span className="form"><i className="m"></i></span> middling <span className="form"><i className="l"></i></span> weak — each player’s last five games, oldest first.</p>
        <LastNight games={gl} />
        <h2>Rating history</h2>
        <RatingChart names={rk.map(p => p.name)} highlight={highlight} onHover={setHighlight} />
        <h2>Highlights</h2>
        <StoryCards R={R} ranked={rk} />
        <details className="help how"><summary>How ratings and tiers work</summary>{notes}</details>
      </>}
    </>
  );
}
