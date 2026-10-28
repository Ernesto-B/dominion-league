import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/supabase.js';
import { hashFor, GLOBAL_ROUTES } from '../lib/route.js';
import { navHref } from './Header.jsx';
import { uxOn } from '../ux.js';

// the four places visited most, always one thumb-tap away; everything else lives behind "More"
const PRIMARY = [['home', 'Rankings', 'rankings'], ['games', 'Games', 'games'], ['players', 'Players', 'players'], ['dominion', 'Collection', 'collection']];
const MORE = [['season', 'Season', 'season'], ['h2h', 'Head to head', 'h2h'], ['records', 'Records', 'records'], ['admin', 'Admin', 'admin']];

/* EXPERIMENT (ux flag "nav"): on a phone, a bar at the bottom of the screen replaces the hamburger menu. Hidden on wider screens
   (CSS), where the top nav is unchanged. `ready` is the same object Header gets. */
export default function BottomNav({ ready, hash }) {
  const [more, setMore] = useState(false);
  const sheet = useRef(null);
  useEffect(() => setMore(false), [hash]);   // following any link closes the sheet
  useEffect(() => {
    if (!more) return undefined;
    const onKey = e => { if (e.key === 'Escape') setMore(false); };
    document.addEventListener('keydown', onKey); sheet.current?.querySelector('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [more]);

  const route = ready.route.route === 'night' ? 'games' : ready.route.route, extra = MORE.filter(([r]) => r !== 'admin' || ready.me.is_admin);
  const inMore = extra.some(([r]) => r === route);
  const link = ([r, label, icon]) => (
    <a key={r} href={navHref(r, ready)} aria-current={route === r ? 'page' : undefined}><img src={`icons/nav/${icon}.png`} alt="" /><span>{label}</span></a>
  );
  return (
    <>
      <nav className="bottomnav" aria-label="Main">
        {PRIMARY.map(link)}
        <button type="button" className={inMore ? 'on' : ''} aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore(m => !m)}>
          <i className="dots" aria-hidden="true"><b></b><b></b><b></b></i><span>More</span>
        </button>
      </nav>
      {more && (
        <div className="moresheet-back" onClick={e => { if (e.target === e.currentTarget) setMore(false); }}>
          <div className="moresheet" role="dialog" aria-modal="true" aria-label="More" ref={sheet}>
            <ul>
              {uxOn('flow') && ready.me.is_admin && <li><a href={hashFor('night', ready.route.gid, undefined, ready.allGroups)} aria-current={route === 'night' ? 'page' : undefined}><img src="icons/nav/add-a-game.png" alt="" />Game night</a></li>}
              {extra.map(([r, label, icon]) => (
                <li key={r}><a href={navHref(r, ready)} aria-current={route === r ? 'page' : undefined}><img src={`icons/nav/${icon}.png`} alt="" />{label}</a></li>
              ))}
            </ul>
            {ready.allGroups.length > 1 && (
              <div className="moresheet-groups"><p className="meta">Group</p>
                {ready.allGroups.map(g => (
                  <a key={g.id} className={'pill' + (g.id === ready.route.gid ? ' ok' : '')} href={hashFor(route === 'home' ? '' : route, GLOBAL_ROUTES.includes(route) ? null : g.id, undefined, ready.allGroups)}>{g.name}</a>
                ))}
              </div>
            )}
            <p className="moresheet-user"><span>Signed in as <b>{ready.me.name}</b></span> <button type="button" className="ghost" onClick={() => sb.auth.signOut()}>Log out</button></p>
          </div>
        </div>
      )}
    </>
  );
}
