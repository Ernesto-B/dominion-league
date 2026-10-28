import { Fragment, isValidElement, useMemo, useState } from 'react';

/* Click-to-sort table, replacing the old DOM-mutating makeSortable(). Same rules: first click on a
   column sorts descending, then toggles; ISO dates compare as strings, leading numbers as numbers
   (%/+/,/− tolerated), anything else case-insensitively with natural ordering.

   head: [{ label, cls }]   — cls ('l' = left-aligned) is applied to the <th> and its <td>s;
                              a column with an empty label isn't sortable.
   rows: [{ key, cells }]   — a cell is a primitive, or { node, text, className }: `node` is what's
                              rendered, `text` is what's sorted on (defaults to the primitive); a cell's
                              own className replaces the column's `cls` (`className: undefined` = no class
                              attribute at all; '' renders class="", which some legacy markup had).
                              Optional per row: className, onClick, data (-> data-g), and an
                              expandable `detail` node shown in a following <tr class="gdetail">
                              when `open` — it stays attached to its row through sorts. */
const sortVal = raw => {
  const s = String(raw == null ? '' : raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^[-+−]?\d/.test(s)) { const n = parseFloat(s.replace(/[%+,]/g, '').replace('−', '-')); if (!isNaN(n)) return n; }
  return s.toLowerCase();
};
const asCell = c => (c !== null && typeof c === 'object' && !isValidElement(c)) ? c : { node: c, text: c };

/* `stack` (ux experiment "lists"): on a phone the table becomes a list of small cards, each cell labelled with its column. The header
   row (and so click-to-sort) disappears there, so a "Sort by" menu takes its place. Desktop is unchanged. */
export default function SortableTable({ head, rows, empty, stack = false }) {
  // `order` is the displayed row order (keys) after the last sort. Like the old DOM sorter, each
  // sort starts from what's on screen, so rows that tie keep their previous relative order.
  const [sort, setSort] = useState(null);   // { col, dir, order }
  const shown = useMemo(() => {
    if (!sort) return rows;
    const pos = new Map(sort.order.map((k, i) => [k, i]));
    return rows.slice().sort((a, b) => (pos.get(a.key) ?? 1e9) - (pos.get(b.key) ?? 1e9));
  }, [rows, sort]);

  const go = col => {
    const dir = sort && sort.col === col && sort.dir === 'desc' ? 'asc' : 'desc';
    const sorted = shown.slice().sort((ra, rb) => {
      const x = sortVal(asCell(ra.cells[col]).text), y = sortVal(asCell(rb.cells[col]).text);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return dir === 'asc' ? r : -r;
    });
    setSort({ col, dir, order: sorted.map(r => r.key) });
  };
  const sortable = head.map((h, i) => [i, h.label]).filter(([, l]) => l);
  return (
    <div className="tablewrap">
      {stack && sortable.length > 1 && (
        <label className="stack-sort">Sort by{' '}
          <select value={sort ? sort.col : ''} onChange={e => e.target.value !== '' && go(Number(e.target.value))} aria-label="Sort by">
            <option value="" disabled>Choose…</option>
            {sortable.map(([i, l]) => <option key={i} value={i}>{l}</option>)}
          </select>
          {sort && <button type="button" className="ghost" onClick={() => go(sort.col)} aria-label={`Sorted ${sort.dir === 'asc' ? 'ascending' : 'descending'}; reverse`}>{sort.dir === 'asc' ? '↑' : '↓'}</button>}
        </label>
      )}
      <table className={stack ? 'stack' : undefined}>
      <thead><tr>{head.map((h, i) => {
        const can = !!h.label;
        const dir = sort && sort.col === i ? sort.dir : undefined;
        return (
          <th key={i} className={[h.cls, can && 'sortable'].filter(Boolean).join(' ') || undefined}
            {...(can ? {
              tabIndex: 0, role: 'button', title: 'Sort by this column', 'data-dir': dir,
              'aria-sort': dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined,
              onClick: () => go(i),
              onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); } },
            } : {})}>{h.label}</th>
        );
      })}</tr></thead>
      <tbody>
        {shown.length ? shown.map(r => (
          <Fragment key={r.key}>
            <tr className={r.className} data-g={r.data} onClick={r.onClick}>
              {r.cells.map((c, i) => { const cell = asCell(c); return <td key={i} data-label={head[i].label || undefined} className={'className' in cell ? cell.className : head[i].cls}>{cell.node}</td>; })}
            </tr>
            {r.detail && <tr className="gdetail" data-g={r.data} hidden={!r.open}><td colSpan={head.length}>{r.detail}</td></tr>}
          </Fragment>
        )) : empty && <tr><td colSpan={head.length} className="l">{empty}</td></tr>}
      </tbody>
    </table></div>
  );
}
