import { useState } from 'react';
import { sortMatrixRows } from '../stats.js';
import { cardsFilterHref } from '../links.js';
import { ExpansionBadge } from './bits.jsx';
import SortHeaders from './SortHeaders.jsx';

/* Card names of each printed type in each expansion, as one table so expansions and types can be compared. Click a heading
   to sort the expansions by it (a number column starts with the biggest); click a number to see those exact cards. The
   shading compares expansions WITHIN a column (each type has its own scale, since Action dwarfs everything else). */
export default function TypeMatrix({ matrix, names }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const rows = sortMatrixRows(matrix.rows, sort);
  const top = Object.fromEntries(matrix.types.map(t => [t, Math.max(1, ...matrix.rows.map(r => r.counts[t]))]));
  const columns = [['expansion', 'Expansion', 'l'], ['names', 'Card names', ''], ...matrix.types.map(t => ['t:' + t, t, ''])];
  const onSort = key => setSort(cur => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'expansion' ? 'asc' : 'desc' });
  const sortKey = sort.key === null ? null : (sort.key === 'expansion' || sort.key === 'names' ? sort.key : 't:' + sort.key);
  const show = (expansion, type, n, label) => (n === 0
    ? <span className="dn-zero" aria-label={`No ${type} cards in ${label}`}>0</span>
    : <a href={cardsFilterHref(expansion ? { expansions: [expansion], types: [type] } : { types: [type] })} title={`${n} ${type} ${n === 1 ? 'card' : 'cards'} in ${label} — show them`}>{n}</a>);
  const shade = (n, t) => (n ? { background: `color-mix(in srgb, var(--felt) ${Math.round(8 + 40 * (n / top[t]))}%, transparent)` } : undefined);

  return (
    <>
      <div className="tablewrap"><table className="plain dn-table dn-matrix">
        <caption className="dn-sr">Number of card names of each printed type in each expansion</caption>
        <SortHeaders columns={columns} sort={sortKey} dir={sort.dir} onSort={key => onSort(key.startsWith('t:') ? key.slice(2) : key)} />
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <th scope="row" className="l"><ExpansionBadge name={r.name} /></th>
              <td>{r.names}</td>
              {matrix.types.map(t => <td key={t} style={shade(r.counts[t], t)}>{show(r.name, t, r.counts[t], r.label)}</td>)}
            </tr>
          ))}
          <tr className="dn-total">
            <th scope="row" className="l">All expansions</th><td><b>{names}</b></td>
            {matrix.types.map(t => <td key={t}><b>{show(null, t, matrix.totals[t], 'all expansions')}</b></td>)}
          </tr>
        </tbody>
      </table></div>
      <p className="note">
        A card with several printed types counts once under each, so a row can add up to more than that expansion’s card names (“Card names” is the number of distinct names).
        {matrix.skipped.length > 0 && <>{matrix.skipped.join(' and ')} aren’t shown: they’re only the type of the Knights and Castles piles (still in the chart above and in the card filters). </>}
        Click a heading to sort the expansions by it, or a number to see those cards. Shading compares expansions within a column.
        {sort.key !== null && <> <button type="button" className="ghost" onClick={() => setSort({ key: null, dir: 'asc' })}>Reset to collection order</button></>}
      </p>
    </>
  );
}
