import { useEffect, useRef, useState } from 'react';

/* The Collection browsers' filters: one row of short buttons (Expansion, Type, Cost, ...), each showing how many choices it holds, and only the
   ONE you open shows its choices, right under the row. Nothing else is on the page until you ask, so the list stays the main thing.
   facets: [{ id, label, n (choices on), children (the choices) }]. A tap on the open button or Escape closes it. */
export default function FacetBar({ facets }) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const esc = e => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc);
  }, [open]);
  return (
    <div className="dn-facets" ref={ref}>
      <div className="dn-facet-row" role="group" aria-label="Filter by">
        {facets.map(f => (
          <button key={f.id} type="button" className={'dn-facet' + (f.n ? ' on' : '')} aria-expanded={open === f.id} aria-controls={`dn-facet-${f.id}`} onClick={() => setOpen(open === f.id ? null : f.id)}>
            {f.label}{f.n ? <span className="n">{f.n}</span> : null}<span className="dn-facet-caret" aria-hidden="true" />
          </button>
        ))}
      </div>
      {/* every panel stays in the page (hidden until opened), so a choice and what was typed in a search box are kept while another facet is open */}
      {facets.map(f => (
        <div key={f.id} className="dn-facet-panel" id={`dn-facet-${f.id}`} role="region" aria-label={f.label} hidden={open !== f.id}>
          {f.children}
        </div>
      ))}
    </div>
  );
}
