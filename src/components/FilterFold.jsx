import { useState } from 'react';

/* Filter controls folded away on a phone (where they would fill more than a screen before the list starts) and open on a wider screen.
   Whatever must stay visible (a result count, a search box) goes outside it. Used by the Collection browsers and the Games page. */
export default function FilterFold({ active, children }) {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(min-width: 721px)').matches);
  return (
    <details className="dn-fold" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>Filters{active ? <span className="meta"> · {active} on</span> : null}</summary>
      {children}
    </details>
  );
}
