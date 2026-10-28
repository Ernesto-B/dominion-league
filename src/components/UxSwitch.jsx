import { useState } from 'react';
import { UX_FLAGS, chooseUx, uxList } from '../ux.js';

// Footer control for the UX experiments: flip the whole new layout on/off, or pick experiments one by one. See src/ux.js.
export default function UxSwitch() {
  const on = uxList(), all = Object.keys(UX_FLAGS);
  const [open, setOpen] = useState(false);
  const toggle = f => chooseUx(on.includes(f) ? on.filter(x => x !== f) : [...on, f]);
  return (
    <span className="uxswitch">
      UX experiment:{' '}
      <button type="button" className="linkish" aria-pressed={on.length === all.length} onClick={() => chooseUx(all)}>new</button> ·{' '}
      <button type="button" className="linkish" aria-pressed={on.length === 0} onClick={() => chooseUx([])}>current</button> ·{' '}
      <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen(o => !o)}>choose…</button>
      {open && (
        <span className="uxswitch-list">
          {all.map(f => <label key={f} className="dn-check"><input type="checkbox" checked={on.includes(f)} onChange={() => toggle(f)} /> {UX_FLAGS[f]}</label>)}
        </span>
      )}
    </span>
  );
}
