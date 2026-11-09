import { useEffect, useRef, useState } from 'react';
import { PAGE_SIZES, pageSlice } from '../model.js';

/* "Showing 1–10 of 40 cards · Per page [10] · ← Previous  Page 1 of 4  Next →" under a table. usePager(items) pages the items;
   render `pg.items` in the table and `pager` beneath it. Keyed by the caller where a new list should start again on page 1. */
export function usePager(items, noun = 'cards', sizes = PAGE_SIZES, { size: first = sizes[0], page: firstPage = 1 } = {}) {   // `sizes`: the per-page choices (then All); the first is the default unless `size` says otherwise; `page` opens on that page
  const [size, setSize] = useState(first);
  const [page, setPage] = useState(firstPage);
  const pg = pageSlice(items, page, size);
  const bar = useRef(null), moved = useRef(false);
  // Previous / Next sit under the table: after one, bring the top of the table back into view (only when its top has scrolled off)
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const el = bar.current && (bar.current.previousElementSibling || bar.current);
    if (!el || !el.scrollIntoView) return;
    if (el.getBoundingClientRect().top < 90) { el.style.scrollMarginTop = '110px'; el.scrollIntoView({ block: 'start', behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }   // clear of the sticky bars
  }, [pg.page]);
  const go = n => { moved.current = true; setPage(n); };
  const pager = (
    <div className="dn-pager" ref={bar}>
      <span className="meta" aria-live="polite">Showing {pg.from}–{pg.to} of {pg.total} {noun}</span>
      <label className="f">Per page <select value={size === Infinity ? 'all' : size} onChange={e => { setSize(e.target.value === 'all' ? Infinity : Number(e.target.value)); setPage(1); }}>{sizes.map(n => <option key={n} value={n}>{n}</option>)}<option value="all">All</option></select></label>
      {pg.pages > 1 && (
        <span className="dn-pager-nav">
          <button type="button" className="ghost" onClick={() => go(pg.page - 1)} disabled={pg.page <= 1}>← Previous</button>
          <span className="meta">Page {pg.page} of {pg.pages}</span>
          <button type="button" className="ghost" onClick={() => go(pg.page + 1)} disabled={pg.page >= pg.pages}>Next →</button>
        </span>
      )}
    </div>
  );
  return { pg, pager };
}
