import { f0, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import LandscapePills from './LandscapePills.jsx';
import { ordered } from './GameFinish.jsx';

// The expanded per-player breakdown under a game row.
export default function GameDetail({ game: g }) {
  // Season score is a 0-1 ratio internally, but displayed x1000 so it reads as a whole-number
  // points total instead of a 3-decimal fraction.
  const sc = x => f0(x * 1000);
  const sgnSc = x => (x > 0.5 ? '+' : x < -0.5 ? '−' : '') + Math.abs(Math.round(x * 1000));
  const tone = (d, eps) => d > eps ? 'up-t' : d < -eps ? 'down-t' : '';
  return (
    <>
      <div className="tablewrap"><table className="plain">
        <thead><tr><th className="l">Player</th><th>Elo</th><th>Change</th><th>Season score</th><th>Change</th><th>VP</th></tr></thead>
        <tbody>{ordered(g).map(n => {
          const elo = g.elo && g.elo[n], score = g.score && g.score[n], vp = g.playerVP && g.playerVP[n];
          const d = elo ? elo.after - elo.before : null, sd = score ? score.after - score.before : null;
          return (
            <tr key={n}>
              <td className="name"><PlayerLink name={n} at={g.snapshot[n]} /></td>
              <td>{elo ? f0(elo.before) + ' → ' + f0(elo.after) : '—'}</td>
              <td className={tone(d, 0.5)}>{d != null ? sgn(d) : ''}</td>
              <td>{score ? sc(score.before) + ' → ' + sc(score.after) : '—'}</td>
              <td className={tone(sd, 0.0005)}>{sd != null ? sgnSc(sd) : ''}</td>
              <td>{vp != null ? vp : '—'}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      {(g.landscapes || []).length > 0 && <p className="note">Landscapes in play: <LandscapePills game={g} /></p>}
      {g.notes && <p className="note">{g.notes}</p>}
    </>
  );
}
