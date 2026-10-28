import { useState } from 'react';
import { PAGE_SIZES, pageSlice } from '../model.js';

/* "Showing 1–10 of 40 cards · Per page [10] · ← Previous  Page 1 of 4  Next →" under a table. usePager(items) pages the items;
   render `pg.items` in the table and `pager` beneath it. Keyed by the caller where a new list should start again on page 1. */
export function usePager(items, noun = 'cards') {
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const pg = pageSlice(items, page, size);
  const pager = (
    <div className="dn-pager">
      <span className="meta" aria-live="polite">Showing {pg.from}–{pg.to} of {pg.total} {noun}</span>
      <label className="f">Per page <select value={size === Infinity ? 'all' : size} onChange={e => { setSize(e.target.value === 'all' ? Infinity : Number(e.target.value)); setPage(1); }}>{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}<option value="all">All</option></select></label>
      {pg.pages > 1 && (
        <span className="dn-pager-nav">
          <button type="button" className="ghost" onClick={() => setPage(pg.page - 1)} disabled={pg.page <= 1}>← Previous</button>
          <span className="meta">Page {pg.page} of {pg.pages}</span>
          <button type="button" className="ghost" onClick={() => setPage(pg.page + 1)} disabled={pg.page >= pg.pages}>Next →</button>
        </span>
      )}
    </div>
  );
  return { pg, pager };
}
