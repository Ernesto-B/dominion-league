import { usePage } from '../PageContext.js';
import { xpOf } from '../lib/xp.js';
import { f0 } from '../lib/format.js';
import TierIcon from './TierIcon.jsx';

/* The signed-in player's corner of the screen, on every page, like a game's HUD: tier, level with the bar to the next one, Elo and a live win
   streak. It is one link to their own page. Pictures are the site's existing icons; the bar is a transform, so it costs nothing to draw. */
export default function PlayerHud() {
  const { me, D, gid, hashFor, catalog } = usePage();
  if (!me) return null;
  const p = D.byName && D.byName[me.name];
  const x = xpOf(D, me.name, catalog);
  const lv = x && x.perGame.length ? x : null;
  return (
    <a className="hud" href={hashFor('players', gid, encodeURIComponent(me.name))} aria-label={`${me.name}${lv ? `, level ${lv.level}` : ''}${p && p.rated ? `, Elo ${f0(p.elo)}` : ''}: your page`}>
      {p && p.tier ? <TierIcon id={p.tier.icon} size={30} alt="" /> : null}
      <span className="hud-name">{me.name}</span>
      {lv && <>
        <span className="hud-lvl">Lv <b>{lv.level}</b></span>
        <span className="hud-bar" role="img" aria-label={`${Math.round(lv.pct * 100)}% of the way to level ${lv.level + 1}`}><i style={{ '--p': Math.max(0.04, lv.pct) }}></i></span>
      </>}
      {p && p.rated && <span className="hud-stat" title="Elo"><img src="icons/stats/elo.png" alt="" width="18" height="18" />{f0(p.elo)}</span>}
      {p && p.streak >= 3 && <span className="hud-stat hud-hot" title={`${p.streak}-game win streak`}><img src="icons/stats/win-streak.png" alt="" width="18" height="18" />{p.streak}</span>}
    </a>
  );
}
