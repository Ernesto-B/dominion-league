import { useEffect, useRef, useState } from 'react';
import SetIcon from './SetIcon.jsx';

/* A drop-down for choosing a set that shows each set's icon beside its name (a native <select> can't show pictures). `value` is a set name or 'all'.
   Closes on a pick, Escape (focus returns to the button) or a click elsewhere. */
export default function SetSelect({ id, value, sets, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null), btn = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') { setOpen(false); btn.current && btn.current.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const pick = v => { onChange(v); setOpen(false); };
  const label = v => (v === 'all' ? 'All sets' : v);
  const item = v => (
    <button type="button" key={v} className={'ss-item' + (v === value ? ' on' : '')} role="option" aria-selected={v === value} onClick={() => pick(v)}>
      {v === 'all' ? <span className="ss-none" aria-hidden="true"></span> : <SetIcon name={v} size={20} />}{label(v)}
    </button>
  );
  return (
    <span className="ss" ref={box}>
      <button type="button" id={id} ref={btn} className="ss-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {value !== 'all' && <SetIcon name={value} size={20} />}<span>{label(value)}</span><span className="ss-chev" aria-hidden="true">▾</span>
      </button>
      {open && <div className="ss-menu" role="listbox" aria-label="Choose a set">{['all', ...sets].map(item)}</div>}
    </span>
  );
}
