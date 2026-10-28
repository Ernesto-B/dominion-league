import { f0, ord, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import LandscapePills from './LandscapePills.jsx';
import { ordered } from './GameFinish.jsx';
import { Suspense, lazy, Fragment } from 'react';
import { setIconPath } from '../lib/sets.js';
import SetIcon from './SetIcon.jsx';

// the kingdom list needs the Collection's catalog code, so it loads only when a game with a kingdom is opened
const GameKingdom = lazy(() => import('../dominion/components/GameKingdom.jsx'));

// The expanded per-player breakdown under a game row.
export default function GameDetail({ game: g, onEdit, me = null }) {
  // Season score is a 0-1 ratio internally, but displayed x1000 so it reads as a whole-number
  // points total instead of a 3-decimal fraction.
  const sc = x => f0(x * 1000);
  const sgnSc = x => (x > 0.0005 ? '+' : x < -0.0005 ? '−' : '') + Math.abs(Math.round(x * 1000));
  const tone = (d, eps) => d > eps ? 'up-t' : d < -eps ? 'down-t' : '';
  return (
    <>
      <div className="tablewrap"><table className="plain">
        <thead><tr><th className="l">Place</th><th className="l">Player</th><th>Elo</th><th>Change</th><th>Season score</th><th>Change</th><th>VP</th></tr></thead>
        <tbody>{ordered(g).map(n => {
          const elo = g.elo && g.elo[n], score = g.score && g.score[n], vp = g.playerVP && g.playerVP[n];
          const d = elo ? elo.after - elo.before : null, sd = score ? score.after - score.before : null;
          return (
            <tr key={n} className={n === me ? 'gme' : undefined}>
              <td className="l meta">{ord(g.places[n])}</td>
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
      {(g.kingdom || []).length > 0 && <Suspense fallback={<p className="meta dn-kingdom">Loading the kingdom…</p>}><GameKingdom items={g.kingdom} /></Suspense>}
      {g.sets.length > 0 && <p className="note dn-only-sm">Sets: {g.sets.map((s, i) => <Fragment key={s}>{i > 0 && ' '}{setIconPath(s) ? <><SetIcon name={s} size={20} /> {s}</> : s}</Fragment>)}</p>}
      {(g.landscapes || []).length > 0 && <p className="note">Landscapes in play: <LandscapePills game={g} /></p>}
      {g.notes && <p className="note">{g.notes}</p>}
      {onEdit && <p className="dn-only-sm" style={{ margin: '12px 0 0' }}><button type="button" className="ghost" onClick={e => { e.stopPropagation(); onEdit(g.line); }}>Edit this game</button></p>}
    </>
  );
}
