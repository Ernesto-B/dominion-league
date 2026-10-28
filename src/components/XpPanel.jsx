import { usePage } from '../PageContext.js';
import { xpOf, partLabel, PART_ORDER } from '../lib/xp.js';
import { short } from '../lib/format.js';

/* A player's level and where their XP came from. XP is experience, not skill: it never goes down and is not what the ladder ranks by. */
export default function XpPanel({ name }) {
  const { D, gid, hashFor, catalog } = usePage();
  const x = xpOf(D, name, catalog);
  if (!x || !x.perGame.length) return null;
  const rows = PART_ORDER.map(k => [k, x.totals[k] || 0]);   // every part, in a fixed order, so nothing moves between players
  const pct = Math.round(x.pct * 100), last = x.last;
  const lastParts = Object.entries(last.parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <section className="xp" aria-label="Level and XP">
      <div className="xp-top">
        <span className="xp-lvl" aria-label={`Level ${x.level}`}>Lv <b>{x.level}</b></span>
        <span className="xp-bar mecard-bar" role="img" aria-label={`${pct}% of the way to level ${x.level + 1}`}><i style={{ width: pct + '%' }}></i></span>
        <span className="xp-txt"><b>{x.total.toLocaleString()} XP</b> · {x.need.toLocaleString()} to level {x.level + 1}</span>
      </div>
      <p className="meta xp-last">Last game <a href={hashFor('games', gid, last.line)}>{short(last.date)}</a>: <b>+{last.xp} XP</b> — {lastParts.map(([k, v]) => `${partLabel(k)} ${v}`).join(', ')}.</p>
      <details className="xp-more">
        <summary>Where your XP comes from</summary>
        <ul>{rows.map(([k, v]) => <li key={k} className={v ? undefined : 'none'}><span>{partLabel(k)}</span><b>{v.toLocaleString()}</b></li>)}</ul>
      </details>
    </section>
  );
}
