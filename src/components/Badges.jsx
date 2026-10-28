import { useState } from 'react';
import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';
import { achievements, grouped } from '../lib/achievements.js';
import { xpOf } from '../lib/xp.js';
import { short } from '../lib/format.js';

const KEY = 'dl.badgesopen';
const readOpen = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };   // open unless the viewer closed it

/* The badges on a Player page: earned ones with the game that earned them, the rest dimmed with how to get them. */
export default function Badges({ p }) {
  const { D, gid, hashFor } = usePage();
  const list = achievements(p, D.tiers, D.ranked.map(x => x.name), xpOf(D, p.name));
  const [open, setOpen] = useState(readOpen);
  const got = list.filter(b => b.earned).length;
  const when = b => b.earned && (b.earned.line != null ? <small className="badge-when">Earned <a href={hashFor('games', gid, b.earned.line)}>{short(b.earned.date)}</a></small> : <small className="badge-when">Earned</small>);
  return (
    <details className="badges-fold" open={open} onToggle={e => { const o = e.currentTarget.open; setOpen(o); try { localStorage.setItem(KEY, o ? '1' : '0'); } catch { /* not remembered */ } }}>
      <summary><h2>Badges <span className="meta">{got} of {list.length}</span></h2></summary>
      {grouped(list).map(sec => (
        <section key={sec.group} className="badge-sec">
          <h3>{sec.group} <span className="meta">{sec.got} of {sec.of}</span></h3>
          <ul className="badges">
            {sec.items.map(it => it.kind === 'track' ? <Track key={it.id} t={it} when={when} /> : <Badge key={it.id} b={it.badge} when={when} />)}
          </ul>
        </section>
      ))}
    </details>
  );
}

const icon = b => b.tier ? <TierIcon id={b.tier.icon} size={26} alt="" /> : b.id === 'champion' ? <TierIcon id="champion" size={26} alt="" /> : b.earned ? '★' : '☆';

function Badge({ b, when }) {
  return (
    <li className={b.earned ? 'got' : 'locked'}>
      <span className="badge-ico" aria-hidden="true">{icon(b)}</span>
      <span className="badge-txt"><b>{b.name}</b><small>{b.hint}</small>{when(b)}</span>
    </li>
  );
}

/* A ladder of badges as one box: the step you are on and how far to the next; opening it lists every step. */
function Track({ t, when }) {
  const cur = t.current, nx = t.next, ref = nx || cur;
  const pct = nx && nx.value != null ? Math.max(0, Math.min(100, Math.round(nx.value / nx.target * 100))) : 100;
  return (
    <li className={'badge-track ' + (cur ? 'got' : 'locked')}>
      <details>
        <summary>
          <span className="badge-ico" aria-hidden="true">{icon(cur || ref)}</span>
          <span className="badge-txt">
            <b>{t.name} <span className="meta">{t.got} of {t.of}</span></b>
            <small>{cur ? cur.name : 'Not started'}{nx ? <> → {nx.name}</> : ' · all done'}</small>
            {nx && nx.value != null && <span className="mecard-bar badge-bar" role="img" aria-label={`${pct}% of the way to ${nx.name}`}><i style={{ width: pct + '%' }}></i></span>}
          </span>
        </summary>
        <ol className="badge-steps">
          {t.steps.map(b => <li key={b.id} className={b.earned ? 'got' : 'locked'}><span aria-hidden="true">{b.earned ? '✓' : '○'}</span><span><b>{b.name}</b> <small>{b.hint}</small> {when(b)}</span></li>)}
        </ol>
      </details>
    </li>
  );
}
