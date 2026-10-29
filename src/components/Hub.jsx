import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import { badgesFor } from '../lib/xp.js';
import { nextUp } from '../lib/hub.js';
import { TIERS } from '../lib/achievements.js';

const LABEL = Object.fromEntries(TIERS.map(t => [t.id, t.label]));

/* The front page's "Next up": the badges closest to being earned, with progress bars. (The menu tiles that once sat under it were dropped.) */
export default function Hub() {
  const { D, gid, hashFor, me, catalog } = usePage();
  const mineP = me && D.players.find(x => x.name === me.name);
  const list = useMemo(() => (mineP && mineP.rated ? badgesFor(D, mineP, catalog) : []), [mineP, D, catalog]);
  const next = useMemo(() => nextUp(list, 3), [list]);
  if (!next.length) return null;
  return (
    <section className="nextup" aria-label="Badges to hunt next">
      <h2>Next up</h2>
      <ul>
        {next.map(x => (
          <li key={x.id}>
            <a href={hashFor('players', gid, `${encodeURIComponent(me.name)}?badge=${encodeURIComponent(x.id)}`)} title="Show this badge on your page">
              <b><i className={'tier-dot td-' + x.tier} title={LABEL[x.tier]}></i>{x.name}{x.track ? <span className="meta"> · {x.track}</span> : null}</b>
              <small>{x.hint}</small>
              {x.pct != null ? <>
                <span className="nu-bar" role="img" aria-label={`${Math.round(x.pct * 100)}% done`}><i style={{ '--p': Math.max(0.03, x.pct) }}></i></span>
                <span className="nu-n">{x.value} of {x.target}</span>
              </> : <span className="nu-n">Not started</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
