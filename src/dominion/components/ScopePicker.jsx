import { scrollFadeRef } from '../../lib/scrollFade.js';
import { useEffect, useRef, useState } from 'react';
import NameIcon from '../../components/NameIcon.jsx';

/* Whose games the play counts read: the whole group, or one player (a dropdown in the same look as the Player page's picker, the `pp-*` styles).
   `bar` draws it in a bar of its own with a line saying what it does (Kingdom insights); the default is a small inline control (the card and
   landscape tables, a card's page). `onPick('')` means the whole group. */
export default function ScopePicker({ who, players, onPick, bar = false, label = 'Whose games?', hint = 'See what the whole group plays, or only the games one player sat at.' }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!players || players.length < 1) return null;
  const choose = n => { onPick(n); setOpen(false); };
  const btn = bar ? 'pp-btn' : 'dn-chip';   // in a bar of its own the pills are the Player page's; inline they are the filter chips beside them
  const controls = (
    <div className={bar ? 'dn-scopebar-ctl' : 'dn-chips'}>
      <button type="button" className={btn + ' dn-scope-all' + (bar && !who ? ' on' : '')} aria-pressed={!who} onClick={() => choose('')}>Whole group</button>
      <span className="pp" ref={box}>
        <button type="button" className={btn + ' dn-scope-one' + (bar && who ? ' on' : '')} aria-haspopup="true" aria-expanded={open} aria-pressed={!!who} onClick={() => setOpen(o => !o)}>
          {who ? <NameIcon name={who} size={18} /> : null}<span>{who || 'A player'}</span><span className="pp-chev" aria-hidden="true">▾</span>
        </button>
        {open && (
          <nav className="pp-menu" ref={scrollFadeRef} aria-label="Choose a player">
            {players.map(n => <a key={n} href="#" aria-current={n === who ? 'true' : undefined} onClick={e => { e.preventDefault(); choose(n); }}><NameIcon name={n} size={18} />{n}</a>)}
          </nav>
        )}
      </span>
    </div>
  );
  if (!bar) return label ? <div className="dn-scope-inline"><span className="dn-scope-label">{label}</span>{controls}</div> : controls;
  return (
    <div className="dn-scopebar">
      <div className="dn-scopebar-text"><b>{label}</b><span className="meta">{hint}</span></div>
      {controls}
    </div>
  );
}
