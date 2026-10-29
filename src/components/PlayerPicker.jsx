import { useEffect, useRef, useState } from 'react';
import NameIcon from './NameIcon.jsx';

/* Choose which player's page to look at: one small button showing who you are looking at, opening a short list, with the previous and next arrows to its right, so they stay put whatever the name's length (stepping wraps round). It replaces a row of pills
   that took two lines on a phone. Closes on a pick, Escape (focus goes back to the button) or a click elsewhere. */
export default function PlayerPicker({ names, current, hrefFor }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null), btn = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') { setOpen(false); btn.current && btn.current.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const at = names.indexOf(current), prev = names[(at - 1 + names.length) % names.length], next = names[(at + 1) % names.length];
  const step = (n, label, glyph) => <a className="pp-step" href={hrefFor(n)} aria-label={`${label}: ${n}`} title={`${label}: ${n}`} onClick={() => setOpen(false)}>{glyph}</a>;
  return (
    <div className="pp" ref={box}>
      <button type="button" ref={btn} className="pp-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>
        <NameIcon name={current} size={18} /><span>{current}</span><span className="pp-chev" aria-hidden="true">▾</span>
        <span className="pp-hint">Switch player</span>
      </button>
      {names.length > 1 && step(prev, 'Previous player', '‹')}
      {names.length > 1 && step(next, 'Next player', '›')}
      {open && (
        <nav className="pp-menu" aria-label="Choose a player">
          {names.map(n => <a key={n} href={hrefFor(n)} aria-current={n === current ? 'true' : undefined} onClick={() => setOpen(false)}><NameIcon name={n} size={18} />{n}</a>)}
        </nav>
      )}
    </div>
  );
}
