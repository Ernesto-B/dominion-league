import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';
import { achievements } from '../lib/achievements.js';
import { short } from '../lib/format.js';

/* The badges on a Player page: earned ones with the game that earned them, the rest dimmed with how to get them. */
export default function Badges({ p }) {
  const { D, gid, hashFor } = usePage();
  const list = achievements(p, D.tiers, D.ranked.map(x => x.name));
  const got = list.filter(b => b.earned).length;
  return (
    <details className="badges-fold">
      <summary><h2>Badges <span className="meta">{got} of {list.length}</span></h2></summary>
      <ul className="badges">
        {list.map(b => (
          <li key={b.id} className={b.earned ? 'got' : 'locked'}>
            <span className="badge-ico" aria-hidden="true">{b.tier ? <TierIcon id={b.tier.icon} size={26} alt="" /> : b.id === 'champion' ? <TierIcon id="champion" size={26} alt="" /> : b.earned ? '★' : '☆'}</span>
            <span className="badge-txt">
              <b>{b.name}</b>
              <small>{b.hint}</small>
              {b.earned && <small className="badge-when">{b.earned.line != null ? <>Earned <a href={hashFor('games', gid, b.earned.line)}>{short(b.earned.date)}</a></> : 'Earned'}</small>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
