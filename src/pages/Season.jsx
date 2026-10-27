import { usePage } from '../PageContext.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import DateAnchor from '../components/DateAnchor.jsx';
import SeasonRecap from '../components/SeasonRecap.jsx';
import SeasonTable from '../components/SeasonTable.jsx';
import GamesTable from '../components/GamesTable.jsx';

export default function Season() {
  const { D, gid, arg, me, hashFor } = usePage();
  const admin = !!(me && me.is_admin);
  if (!D.seasons.length) {
    return <>
      <h1>Season</h1><GroupSwitcher route="season" />
      <p className="empty">No seasons are set up yet.{admin && <> Add one from the <a href="#/admin">Admin page</a>.</>}</p>
    </>;
  }
  // An unknown season number (a hand-typed URL) falls back to the current season instead of crashing.
  const asked = +arg;
  const num = D.seasons.some(x => x.number === asked) ? asked : D.currentSeasonFor();
  const st = D.seasonStandings(num), s = st.season;
  const wk = s.status === 'In progress' ? Math.floor((D.today - s.start) / 7) + 1 : null;
  const frac = !s.ok ? 0 : Math.max(0, Math.min(1, (D.today - s.start + 1) / (7 * s.weeks)));
  const seasonGames = st.games.filter(g => g.n >= 2).slice().reverse();

  return (
    <>
      <div className="head">
        <div>
          <h1>{s.name}</h1>
          {!s.ok && <p className="lede">Start date or length is missing.{admin && <> Fix it from the <a href="#/admin">Admin page</a>.</>}</p>}
        </div>
        <div className="pills" aria-label="Choose a season">
          {D.seasons.map(x => <a key={x.number} href={hashFor('season', gid, x.number)} aria-current={x.number === num ? 'true' : undefined}>{x.name}</a>)}
        </div>
      </div>
      <GroupSwitcher route="season" />
      <Banner />
      <SeasonRecap standings={st} />
      <div className="stats">
        <div className="stat"><b>{wk ? 'Week ' + wk + ' of ' + s.weeks : s.status}</b><span>{wk ? s.weeksLeft + ' week' + (s.weeksLeft === 1 ? '' : 's') + ' left' : 'status'}</span></div>
        <div className="stat"><b>{s.regularGames}</b><span>regular games</span></div>
        <div className="stat"><b>{s.nightsHeld}</b><span>nights held</span></div>
        <div className="stat"><b>{s.minGames}</b><span>games to qualify ({s.target} target)</span></div>
        <div className="stat"><b>{s.spots}</b><span>playoff spots</span></div>
        <div className="stat"><b>{s.champion || '—'}</b><span>champion</span></div>
      </div>
      {s.ok && (
        <div className="tierbar">
          <DateAnchor day={s.start} label="Start" />
          <div className="progress" role="img" aria-label={`${Math.round(frac * 100)} percent of the season has passed`}><i style={{ width: frac * 100 + '%' }}></i></div>
          <DateAnchor day={s.end} label="End" />
        </div>
      )}
      {st.rows.length ? <SeasonTable standings={st} /> : <p className="empty">No regular games in this season yet.</p>}
      <details className="help">
        <summary>How is the season score calculated?</summary>
        <p className="note">Season score = 1000 × (points + {D.S.prior} × 0.5) ÷ (games + {D.S.prior}), so it always lands somewhere between 0 and 1000. Points run from 1 for a win down to 0 for last, so a 3-player table and a 6-player table are worth the same, and ties split. The {D.S.prior} imaginary average games stop one lucky night from topping the table. Missing a night costs nothing. Qualified players rank first; green rows are playoff seeds. Playoff and friendly games don't count toward the table (playoffs still move Elo). This table — not Elo — decides the season champion; Elo is a separate, ongoing skill rating shown on <a href={hashFor('', gid)}>Rankings</a> that never resets.</p>
      </details>
      {seasonGames.length > 0 && <>
        <h2>Games this season</h2>
        <GamesTable key={num} games={seasonGames} />
      </>}
    </>
  );
}
