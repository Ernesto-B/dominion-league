/* The <thead> of a table whose column headings sort it, styled exactly like every other sortable table on the site: the
   heading cell itself is the control (the site's `th.sortable` rule gives it the pointer cursor, the hover colour and the
   small ▲/▼ after the text via data-dir) — no button inside it. Same markup SortableTable uses.
   `columns` is [[sortKey, heading, thClass], ...]. The active column carries aria-sort; click, Enter or Space calls
   onSort(key). The page decides what a click means (the browsers flip the direction on the active column and start
   another column ascending). Shared by the Kingdom cards, Landscapes and card-types tables. */
export default function SortHeaders({ columns, sort, dir, onSort }) {
  return (
    <thead><tr>{columns.map(([key, label, cls]) => {
      const on = sort === key;
      return (
        <th key={key} className={[cls, 'sortable'].filter(Boolean).join(' ')} scope="col"
          tabIndex={0} role="button" title={`Sort by ${label.toLowerCase()}`}
          data-dir={on ? dir : undefined} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
          onClick={() => onSort(key)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(key); } }}>
          {label}
        </th>
      );
    })}</tr></thead>
  );
}
