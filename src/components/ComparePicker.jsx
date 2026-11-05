import { useEffect, useRef, useState } from 'react';
import NameIcon from './NameIcon.jsx';

/* "Compare with <player>": a small dropdown that always opens DOWNWARD. A native <select> lets the browser place its list (on a Mac it centres the chosen
   name over the control, which covered the nav bar), so this draws its own, in the same look as the PlayerPicker (the `pp-*` styles). */
export default function ComparePicker({ current, names: unsorted, hrefFor }) {
  const names = [...unsorted].sort((a, b) => a.localeCompare(b));   // A to Z
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <span className="pp cmp-pick" ref={box}>
      <span className="cmp-pick-label">Compare with</span>
      <button type="button" className="pp-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {current && <NameIcon name={current} size={18} />}<span>{current || 'Choose…'}</span><span className="pp-chev" aria-hidden="true">▾</span>
      </button>
      {open && (
        <nav className="pp-menu" aria-label="Compare with">
          {names.map(n => <a key={n} href={hrefFor(n)} aria-current={n === current ? 'true' : undefined} onClick={() => setOpen(false)}><NameIcon name={n} size={18} />{n}</a>)}
        </nav>
      )}
    </span>
  );
}
