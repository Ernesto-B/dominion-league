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
        <p className="note">Every regular game gives you points for where you finished: 1 for a win down to 0 for last, the same at a 3-player or a 6-player table, with ties splitting the points.{D.S.streakBonus > 0 && <> Win streak: each win in a row after your first adds {D.S.streakBonus} to that game, up to +{+(D.S.streakBonus * D.S.streakCap).toFixed(2)}; any game you don't win starts you over.</>}{D.S.vpWeight > 0 && <> Close games: {Math.round(D.S.vpWeight * 100)}% of a game’s points come from your VP as a share of the winner’s (so a big-VP Prosperity game and a small-VP Base game count alike), and the other {Math.round((1 - D.S.vpWeight) * 100)}% from where you finished. A narrow loss therefore keeps most of that share and a blowout keeps little; a game without everyone’s VP just uses where you finished.</>} Your season score is 1000 × your average points per game, after adding {D.S.prior} imaginary average games so one lucky night can’t top the table{(D.S.streakBonus > 0 || D.S.vpWeight > 0) && <> (with the bonuses a score can go above 1000 or below 0)</>}. Missing a night costs nothing. Qualified players rank first; green rows are playoff seeds. Playoff and friendly games don't count toward the table (playoffs still move Elo). This table — not Elo — decides the season champion; Elo is a separate, ongoing skill rating shown on <a href={hashFor('', gid)}>Rankings</a> that never resets.</p>
      </details>
      {seasonGames.length > 0 && <>
        <h2>Games this season</h2>
        <GamesTable key={num} games={seasonGames} link />
      </>}
    </>
  );
}
