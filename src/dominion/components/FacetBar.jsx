import { useEffect, useRef, useState } from 'react';

/* The Collection browsers' filters: one row of short buttons (Expansion, Type, Cost, ...), each showing how many choices it holds, and only the
   ONE you open shows its choices, right under the row. Nothing else is on the page until you ask, so the list stays the main thing.
   facets: [{ id, label, n (choices on), value (optional: what is chosen, shown on the button), single (a one-of-many list: a pick closes the panel), menu (a long list: a dropdown under its own button, as on the Player page, instead of a panel), children (the choices) }]. A tap on the open button or Escape closes it. */
export default function FacetBar({ facets }) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const esc = e => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc);
  }, [open]);
  useEffect(() => {   // a dropdown closes on a click elsewhere
    if (!open || !(facets.find(f => f.id === open) || {}).menu) return undefined;
    const away = e => { if (ref.current && !e.target.closest?.('.dn-facet-wrap')) setOpen(null); };
    document.addEventListener('pointerdown', away); return () => document.removeEventListener('pointerdown', away);
  }, [open, facets]);
  const button = f => (
    <button key={f.id} type="button" className={'dn-facet' + (f.n || f.value ? ' on' : '')} aria-expanded={open === f.id} aria-controls={`dn-facet-${f.id}`} onClick={() => setOpen(open === f.id ? null : f.id)}>
      {f.label}{f.value ? <span className="dn-facet-val">{f.value}</span> : f.n ? <span className="n">{f.n}</span> : null}<span className="dn-facet-caret" aria-hidden="true" />
    </button>
  );
  return (
    <div className={'dn-facets' + (open && facets.find(f => f.id === open)?.menu ? ' menu-open' : '')} ref={ref}>
      <div className="dn-facet-row" role="group" aria-label="Filter by">
        {facets.map(f => f.menu ? (
          <span key={f.id} className="dn-facet-wrap" id={`dn-facet-${f.id}`} onClick={e => { if (e.target.closest('button[aria-pressed]')) setOpen(null); }}>
            {button(f)}
            {open === f.id && f.children}
          </span>
        ) : button(f))}
      </div>
      {/* every panel stays in the page (hidden until opened), so a choice and what was typed in a search box are kept while another facet is open */}
      {facets.filter(f => !f.menu).map(f => (
        <div key={f.id} className="dn-facet-panel" id={`dn-facet-${f.id}`} role="region" aria-label={f.label} hidden={open !== f.id} onClick={f.single ? e => { if (e.target.closest('button[aria-pressed]')) setOpen(null); } : undefined}>
          {f.children}
        </div>
      ))}
    </div>
  );
}
