import { useState } from 'react';
import { usePage } from '../PageContext.js';
import { f0, ord, short, sgn } from '../lib/format.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import StoryCards from '../components/StoryCards.jsx';
import SeasonChip from '../components/SeasonChip.jsx';
import TierIcon from '../components/TierIcon.jsx';
import TierLegend from '../components/TierLegend.jsx';
import LastNight from '../components/LastNight.jsx';
import RatingChart from '../components/RatingChart.jsx';
import MeCard from '../components/MeCard.jsx';
import { uxOn } from '../ux.js';

function Ladder({ ranked: rk, highlight, setHighlight }) {
  const { D, gid, hashFor } = usePage();
  const mx = Math.max(60, ...rk.map(p => Math.abs(p.elo - D.E.start))) * 1.08;
  return (
    <div className="ladder" role="table" aria-label="Elo rankings">
      <div className="lhead" role="row"><span>Rank</span><span>Player</span><span>Rating vs {D.E.start} start</span><span>Elo</span><span>Last</span><span>Recent form</span></div>
      {rk.map(p => {
        const d = p.elo - D.E.start, wpx = Math.abs(d) / mx * 50;
        const lastR = p.results[p.results.length - 1];
        const dl = lastR ? lastR.after - lastR.before : 0;
        const rm = p.rankDelta;
        return (
          <div key={p.name} className={'lrow' + (highlight === p.name ? ' hot' : '')} data-p={p.name} role="row"
            onMouseEnter={() => setHighlight(p.name)} onFocus={() => setHighlight(p.name)}>
            <span className="lrank">{p.rank}
              {!rm ? null : rm > 0
                ? <span className="rankmove up-t" title={`Up ${rm} spot${rm === 1 ? '' : 's'} since last night`}>▲{rm}</span>
                : <span className="rankmove down-t" title={`Down ${-rm} spot${rm === -1 ? '' : 's'} since last night`}>▼{-rm}</span>}
            </span>
            <a className="lname" href={hashFor('players', gid, encodeURIComponent(p.name))}>
              <TierIcon id={p.tier.icon} size={28} alt={p.tier.name + ' tier'} />{p.name}
              {p.titles ? <span className="crown" title={`${p.titles} season title${p.titles > 1 ? 's' : ''}`}><TierIcon id="champion" size={20} alt="Season champion" />{p.titles > 1 ? '×' + p.titles : ''}</span> : null}
              {p.streak >= 3 ? <span className="pill hot" title={`${p.streak}-game win streak`}>🔥 {p.streak}</span> : null}
              {p.status === 'Provisional' ? <span className="tag">provisional</span> : null}
            </a>
            <span className="bar" aria-hidden="true"><i className={d >= 0 ? 'up' : 'down'} style={{ width: wpx + '%', left: d >= 0 ? '50%' : (50 - wpx) + '%' }}></i></span>
            <span className="lelo">{f0(p.elo)}</span>
            <span className={'ldelta ' + (dl > 0.5 ? 'up-t' : dl < -0.5 ? 'down-t' : '')}>{sgn(dl)}</span>
            <span className="form" aria-label="Recent form">{p.results.slice(-5).map((r, i) => (
              <i key={i} className={r.pts >= 0.67 ? 'w' : r.pts <= 0.33 ? 'l' : 'm'} title={`${r.game.date}: ${ord(r.place)} of ${r.game.n}`}></i>
            ))}</span>
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

  return (
    <>
      <GroupSwitcher route="" />
      {uxOn('home') && <MeCard ranked={rk} />}
      <div className="chips toprow">
        <SeasonChip />
        {last && <span className="chip">Last night <b>{short(last)}</b></span>}
        <span className="chip"><b>{nights}</b> night{nights === 1 ? '' : 's'} played</span>
      </div>
      <StoryCards R={R} ranked={rk} />
      <Banner />
      {!rk.length ? <p className="empty">No rated games yet. Once the admin adds one, the rankings show up here.</p> : <>
        <Ladder ranked={rk} highlight={highlight} setHighlight={setHighlight} />
        <LastNight games={gl} />
        <h2>Rank tiers</h2>
        <TierLegend />
        <p className="note">Your tier follows your current Elo, so it can go down as well as up. The trophy is for winning a season and never goes away.</p>
        <p className="note">Everyone starts at {D.E.start} as a {D.startTier.name} and climbs from there. Elo carries across seasons; friendly games never count. New players move faster for their first {D.E.provisionalGames} games (provisional).</p>
        <p className="note">This ladder is Elo — a lifetime skill rating that never resets. It's not what decides a season's winner; that's points, on the <a href={hashFor('season', gid)}>Season page</a>.</p>
        <h2>Rating history</h2>
        <RatingChart names={rk.map(p => p.name)} highlight={highlight} onHover={setHighlight} />
      </>}
    </>
  );
}
