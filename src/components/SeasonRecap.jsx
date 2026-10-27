import { f0, pc, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import TierIcon from './TierIcon.jsx';
import SetIcon from './SetIcon.jsx';

// "Hall of Fame" for a completed season: champion plus a handful of superlatives.
export default function SeasonRecap({ standings: st }) {
  const s = st.season;
  if (s.status !== 'Complete' || !st.rows.length) return null;
  const riser = st.rows.reduce((b, r) => (!b || r.eloChange > b.eloChange) ? r : b, null);
  const best = st.rows.reduce((b, r) => (!b || r.winPct > b.winPct) ? r : b, null);
  const tables = st.games.filter(g => g.n >= 2).length;
  const ironman = st.rows.reduce((b, r) => (!b || (r.attendance ?? -1) > (b.attendance ?? -1)) ? r : b, null);
  // Same deficit-of-the-loser-who-won algorithm as the all-time `biggestUpset` record in
  // engine.js, just scoped to this season's games.
  let upset = null;
  st.games.forEach(g => {
    if (!g.elo || g.n < 2) return;
    g.names.forEach(w => {
      if (g.places[w] !== 1 || !g.elo[w]) return;
      g.names.forEach(o => {
        if (o === w || g.places[o] === g.places[w] || !g.elo[o]) return;
        const deficit = g.elo[o].before - g.elo[w].before;
        if (deficit > 0 && (!upset || deficit > upset.deficit)) upset = { winner: w, loser: o, deficit };
      });
    });
  });
  let topVP = null;
  st.games.forEach(g => { if (g.vp && (!topVP || g.vp > topVP.value)) topVP = { who: g.names.filter(n => g.places[n] === 1).join(' & '), value: g.vp }; });
  const setCounts = {};
  st.games.forEach(g => g.sets.forEach(nm => { setCounts[nm] = (setCounts[nm] || 0) + 1; }));
  const setEntries = Object.entries(setCounts);
  const topSet = setEntries.length ? setEntries.reduce((a, b) => b[1] > a[1] ? b : a) : null;
  const tone = x => x > 0.5 ? 'up-t' : x < -0.5 ? 'down-t' : '';

  return (
    <>
      <h2>Hall of Fame</h2>
      <div className="recap">
        <div className="recapchamp"><TierIcon id="champion" size={56} alt="" /><div><span className="slabel">Season champion</span><h3>{s.champion ? <PlayerLink name={s.champion} /> : 'Not decided'}</h3></div></div>
        <div className="stats">
          {riser && <div className="stat has-icon"><img className="staticon" src="icons/stats/elo.png" alt="" /><div className="stat-body"><b className={tone(riser.eloChange)}>{sgn(riser.eloChange)}</b><span>biggest riser: {riser.name}</span></div></div>}
          {best && <div className="stat"><b>{pc(best.winPct)}</b><span>best record: {best.name}</span></div>}
          <div className="stat"><b>{tables}</b><span>tables played</span></div>
          {upset && <div className="stat"><b>{f0(upset.deficit)}</b><span>biggest upset: {upset.winner} over {upset.loser}</span></div>}
          {topVP && <div className="stat"><b>{topVP.value} VP</b><span>highest score: {topVP.who}</span></div>}
          {topSet && <div className="stat seticon-stat"><SetIcon name={topSet[0]} size={24} /><span>most played: {topSet[0]}</span></div>}
          {ironman && ironman.attendance != null && <div className="stat"><b>{pc(ironman.attendance)}</b><span>best attendance: {ironman.name}</span></div>}
        </div>
      </div>
    </>
  );
}
