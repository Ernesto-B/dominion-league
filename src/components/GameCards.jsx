import { Suspense, lazy } from 'react';
import { usePage } from '../PageContext.js';
import { f0, ord, sgn, short } from '../lib/format.js';
import { ordered } from './GameFinish.jsx';
import { setIconPath } from '../lib/sets.js';
import PlayerLink from './PlayerLink.jsx';
import LandscapePills from './LandscapePills.jsx';
import SetIcon from './SetIcon.jsx';
import TierIcon from './TierIcon.jsx';
import TypePill from './TypePill.jsx';

const GameKingdom = lazy(() => import('../dominion/components/GameKingdom.jsx'));
const tone = (d, eps) => (d > eps ? 'up-t' : d < -eps ? 'down-t' : '');

/* ux experiment "lists": a game as a small card on a phone instead of a row of a wide table. The card is the finish order, one line
   per player (place, name, Elo change) with the sets underneath; tapping it opens each player's Elo, season points and VP stacked
   under their line, then the kingdom and notes. Used by Last night and by the Games page; the table stays for desktop.
   `me` marks one player's line (the Players page). `open` is a Set of game ids and `toggle(id)` flips one, owned by the table next to it, so the two views agree. */
export default function GameCards({ games, open, toggle, onEdit, showDate = false, highlight, me = null }) {
  const { D } = usePage();
  return (
    <ul className="gcards" aria-label="Games">
      {games.map(g => {
        const isOpen = open.has(g.line);
        return (
          <li key={g.line} className={'gcard' + (isOpen ? ' open' : '') + (g.line === highlight ? ' hl' : '')} data-g={g.line} onClick={() => toggle(g.line)}>
            <div className="gcard-head">
              <button type="button" className="gcard-toggle" aria-expanded={isOpen} aria-label={`${short(g.date)}, ${isOpen ? 'hide' : 'show'} details`}>
                <span className="chev">▸</span>{showDate && <b>{short(g.date)}</b>}
              </button>
              <TypePill type={g.type} />
              <span className="gcard-sets">{g.sets.map(s => (setIconPath(s) ? <SetIcon key={s} name={s} size={20} /> : <span key={s} className="meta">{s}</span>))}</span>
            </div>
            <ol className={'gcard-rows' + (g.names.length > 3 ? ' cols2' : '')} style={{ '--rows': Math.ceil(g.names.length / 2) }}>
              {ordered(g).map(n => {
                const elo = g.elo && g.elo[n], d = elo ? elo.after - elo.before : null, t = D.tierFor(g.snapshot[n]);
                const score = g.score && g.score[n], sd = score ? score.after - score.before : null, vp = g.playerVP && g.playerVP[n];
                const won = g.places[n] === 1;
                return (
                  <li key={n} className={'gcard-row' + (n === me ? ' me' : '')}>
                    <span className="gc-place">{ord(g.places[n])}</span>
                    <span className="gc-name">{isOpen ? <PlayerLink name={n} at={g.snapshot[n]} /> : <>{t && <TierIcon id={t.icon} size={20} alt={t.name + ' tier'} />}{won ? <b>{n}</b> : n}</>}</span>
                    <span className={'gc-chg ' + (d != null ? tone(d, 0.5) : '')}>{d != null ? sgn(d) : ''}</span>
                    {isOpen && (
                      <span className="gc-sub">
                        {elo ? `${f0(elo.before)} → ${f0(elo.after)}` : 'Not rated'}
                        {sd != null && <> · season <span className={tone(sd, 0.0005)}>{(sd > 0.0005 ? '+' : sd < -0.0005 ? '−' : '') + Math.abs(Math.round(sd * 1000))}</span></>}
                        {vp != null && <> · {vp} VP</>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {isOpen && (
              <div className="gcard-more" onClick={e => e.stopPropagation()}>
                {(g.kingdom || []).length > 0 && <Suspense fallback={<p className="meta dn-kingdom">Loading the kingdom…</p>}><GameKingdom items={g.kingdom} /></Suspense>}
                {(g.landscapes || []).length > 0 && <p className="note">Landscapes in play: <LandscapePills game={g} /></p>}
                {g.notes && <p className="note">{g.notes}</p>}
                {onEdit && <p style={{ margin: '12px 0 0' }}><button type="button" className="ghost" onClick={() => onEdit(g.line)}>Edit this game</button></p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
