import { useEffect, useRef, useState } from 'react';

/* "Compare with <player>": a small dropdown that always opens DOWNWARD. A native <select> lets the browser place its list (on a Mac it centres the chosen
   name over the control, which covered the nav bar), so this draws its own, in the same look as the group pill. */
export default function ComparePicker({ current, names, hrefFor }) {
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
    <span className="grouppill cmp-pick" ref={box}>
      <span className="cmp-pick-label">Compare with</span>
      <button type="button" className="grouppill-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {current || 'Choose…'}<span aria-hidden="true" className="grouppill-chev">▾</span>
      </button>
      {open && (
        <ul className="grouppill-menu cmp-pick-menu" role="listbox" aria-label="Compare with">
          {names.map(n => (
            <li key={n} role="option" aria-selected={n === current}><a href={hrefFor(n)} onClick={() => setOpen(false)}>{n}</a></li>
          ))}
        </ul>
      )}
    </span>
  );
}
