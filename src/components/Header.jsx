import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase.js';
import { hashFor, ROUTES } from '../lib/route.js';

const NAV = [
  ['home', 'Rankings', 'rankings'], ['season', 'Season', 'season'], ['players', 'Players', 'players'],
  ['h2h', 'Head to head', 'h2h'], ['records', 'Records', 'records'], ['games', 'Games', 'games'], ['admin', 'Admin', 'admin'],
];

// `ready` is null until a league is loaded: the nav is hidden on the loading,
// sign-in and set-password screens.
export default function Header({ ready, hash }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [hash]);   // tapping a link collapses the mobile menu

  const show = !!ready;
  const active = ready && ROUTES.includes(ready.route.route) ? ready.route.route : 'home';
  return (
    <header className="top">
      <div className="top-inner">
        <button className="nav-toggle" type="button" aria-label="Menu" aria-expanded={open} aria-controls="nav"
          style={show ? undefined : { display: 'none' }} onClick={() => setOpen(o => !o)}>
          <span></span><span></span><span></span>
        </button>
        <nav id="nav" className={open ? 'nav-open' : undefined} aria-label="Sections" style={show ? undefined : { display: 'none' }}>
          {show && NAV.filter(([r]) => r !== 'admin' || ready.me.is_admin).map(([r, label, icon]) => (
            <a key={r} href={hashFor(r === 'home' ? '' : r, r === 'admin' ? null : ready.route.gid, undefined, ready.allGroups)}
              aria-current={active === r ? 'page' : undefined}>
              <img src={`icons/nav/${icon}.png`} alt="" />{label}
            </a>
          ))}
        </nav>
        <span id="navuser">
          {show && <><span>{ready.me.name}</span><a href="#" onClick={e => { e.preventDefault(); sb.auth.signOut(); }}>Log out</a></>}
        </span>
      </div>
    </header>
  );
}
