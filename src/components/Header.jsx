import { hashFor, ROUTES, GLOBAL_ROUTES } from '../lib/route.js';
import { pickD } from '../lib/league.js';

const NAV = [
  ['home', 'Rankings', 'rankings'], ['season', 'Season', 'season'], ['players', 'Players', 'players'],
  ['games', 'Games', 'games'],
  ['dominion', 'Collection', 'collection'],   // the URL stays #/dominion (an id, not a label); the icon file is icons/nav/collection.png
  ['records', 'Records', 'records'], ['admin', 'Admin', 'admin'],
];

/* Where a nav link goes. "Players" opens the signed-in player's own page when they have played in the group being viewed (the
   page otherwise opens on whoever is top of the ladder); everyone else, and every other link, goes to the section's front page. */
export function navHref(route, ready) {
  const gid = GLOBAL_ROUTES.includes(route) ? null : ready.route.gid;
  let rest;
  if (route === 'players' && ready.me && ready.computedByGroup) {
    const D = pickD(ready, ready.route.gid), mine = D && D.players.find(p => p.name === ready.me.name);
    if (mine && mine.allGames > 0) rest = encodeURIComponent(mine.name);
  }
  return hashFor(route === 'home' ? '' : route, gid, rest, ready.allGroups);
}

// `ready` is null until a league is loaded: the nav is hidden on the loading,
// sign-in and set-password screens.
export default function Header({ ready, hash, hud }) {
  const show = !!ready;
  const active = ready && ROUTES.includes(ready.route.route) ? ready.route.route : 'home';
  return (
    <header className="top">
      <div className="top-inner">
        {show && ready.cfg && <span className="brand">{ready.cfg.title || 'Dominion Night'}</span>}
        <nav id="nav" aria-label="Sections" style={show ? undefined : { display: 'none' }}>
          {show && NAV.filter(([r]) => r !== 'admin' || ready.me.is_admin).map(([r, label, icon]) => (
            <a key={r} href={navHref(r, ready)}
              aria-current={active === r ? 'page' : undefined}>
              {icon && <img src={`icons/nav/${icon}.png`} alt="" />}{label}
            </a>
          ))}
        </nav>
        <span id="navuser">
          {show && (hud || <span>{ready.me.name}</span>)}
        </span>
      </div>
    </header>
  );
}
