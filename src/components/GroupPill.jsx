import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GLOBAL_ROUTES, hashFor } from '../lib/route.js';
import { groupHue } from '../lib/groups.js';

/* The one place a group is chosen, in the top bar of every page: a pill with the current group's name, and a short menu of the others. It replaces the row of group buttons each page used to draw.
   A page with the group in its address (Rankings, Season, Players, Games, Records) is reopened in the other group; a Collection or Admin page, which has no group in its address, stays where it is and
   just changes the group the league numbers on it (Insights, play counts) are for. Nothing is drawn for someone who belongs to one group. */
export default function GroupPill({ ready, onPick }) {
  const groups = ready.allGroups || [];
  const [open, setOpen] = useState(false);
  const box = useRef(null), menu = useRef(null);
  // the menu hangs from the pill's right edge; on a phone the pill sits near the left, so slide it back inside the screen
  useLayoutEffect(() => {
    const m = menu.current; if (!open || !m) return;
    m.style.transform = '';
    const r = m.getBoundingClientRect(), W = document.documentElement.clientWidth;
    const dx = r.left < 8 ? 8 - r.left : r.right > W - 8 ? W - 8 - r.right : 0;
    if (dx) m.style.transform = `translateX(${dx}px)`;
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', key); window.addEventListener('hashchange', () => setOpen(false), { once: true });
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  if (groups.length <= 1) return null;
  const gid = ready.route.gid, cur = groups.find(g => g.id === gid) || groups[0], route = ready.route.route;
  const global = GLOBAL_ROUTES.includes(route) || !route;
  const hrefFor = g => (global ? '#' + location.hash.replace(/^#/, '') : hashFor(route === 'home' ? '' : route, g.id, undefined, groups));
  return (
    <span className="grouppill" ref={box} style={{ '--gh': groupHue(groups, cur.id) }}>
      <button type="button" className="grouppill-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)} title="Switch group">
        <i aria-hidden="true" />{cur.name}<span aria-hidden="true" className="grouppill-chev">▾</span>
      </button>
      {open && (
        <ul className="grouppill-menu" ref={menu} role="listbox" aria-label="Choose a group">
          {groups.map(g => (
            <li key={g.id} role="option" aria-selected={g.id === cur.id} style={{ '--gh': groupHue(groups, g.id) }}>
              <a href={hrefFor(g)} onClick={() => { onPick(g.id); setOpen(false); }}><i aria-hidden="true" />{g.name}</a>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
