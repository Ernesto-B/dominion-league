import { useState } from 'react';
import { sortMatrixRows } from '../stats.js';
import { cardsFilterHref } from '../links.js';
import { Chip, ExpansionBadge } from './bits.jsx';
import SunburstChart from './SunburstChart.jsx';
import SortHeaders from './SortHeaders.jsx';
import { DEFAULT_CHART } from '../sunburst.js';

/* Card names of each printed type in each expansion, as one table so expansions and types can be compared. Click a heading
   to sort the expansions by it (a number column starts with the biggest); click a number to see those exact cards. The
   shading compares expansions WITHIN a column (each type has its own scale, since Action dwarfs everything else). */
export default function TypeMatrix({ matrix, piles, cards = [], chart = DEFAULT_CHART, onChart = () => {} }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const [compact, setCompact] = useState(false);   // on a phone, once the table is scrolled sideways the expansion names give way to their icons, so the numbers get the room
  const { view, by, zoom } = chart;      // 'table' | 'sunburst'; the sunburst's inner ring; what it is zoomed into — all kept in the URL by the Overview
  const rows = sortMatrixRows(matrix.rows, sort);
  const top = Object.fromEntries(matrix.types.map(t => [t, Math.max(1, ...matrix.rows.map(r => r.counts[t]))]));
  const columns = [['expansion', 'Expansion', 'l'], ['piles', 'Piles', ''], ...matrix.types.map(t => ['t:' + t, t, ''])];
  const onSort = key => setSort(cur => cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'expansion' ? 'asc' : 'desc' });
  const sortKey = sort.key === null ? null : (sort.key === 'expansion' || sort.key === 'piles' ? sort.key : 't:' + sort.key);
  const show = (expansion, type, n, label) => (n === 0
    ? <span className="dn-zero" aria-label={`No ${type} cards in ${label}`}>0</span>
    : <a href={cardsFilterHref(expansion ? { expansions: [expansion], types: [type] } : { types: [type] })} title={`${n} ${type} ${n === 1 ? 'card' : 'cards'} in ${label} — show them`}>{n}</a>);
  const shade = (n, t) => (n ? { background: `color-mix(in srgb, var(--felt) ${Math.round(8 + 40 * (n / top[t]))}%, transparent)` } : undefined);

  return (
    <>
      <div className="dn-viewbar">
        <div className="dn-mode" role="group" aria-label="How to show the card types">
          <Chip pressed={view === 'table'} onClick={() => onChart({ view: 'table', zoom: null })}>Table</Chip>
          <Chip pressed={view === 'sunburst'} onClick={() => onChart({ view: 'sunburst' })}>Sunburst</Chip>
        </div>
        {view === 'sunburst' && (
          <div className="dn-mode" role="group" aria-label="What the inner ring shows">
            <span className="meta">Inner ring</span>
            <Chip pressed={by === 'expansion'} onClick={() => onChart({ by: 'expansion', zoom: null })}>Expansions</Chip>
            <Chip pressed={by === 'type'} onClick={() => onChart({ by: 'type', zoom: null })}>Card types</Chip>
          </div>
        )}
      </div>
      {view === 'sunburst' ? <SunburstChart key={`${by}|${zoom ?? ''}`} matrix={matrix} by={by} cards={cards} zoom={zoom} onZoom={z => onChart({ zoom: z })} /> : <>
      <div className="tablewrap" onScroll={e => { const x = e.currentTarget.scrollLeft; setCompact(c => (c ? x > 4 : x > 24)); }}><table className={'plain dn-table dn-matrix' + (compact ? ' compact' : '')}>
        <caption className="dn-sr">Number of card names of each printed type in each expansion</caption>
        <SortHeaders columns={columns} sort={sortKey} dir={sort.dir} onSort={key => onSort(key.startsWith('t:') ? key.slice(2) : key)} />
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <th scope="row" className="l"><ExpansionBadge name={r.name} /></th>
              <td>{r.piles}</td>
              {matrix.types.map(t => <td key={t} style={shade(r.counts[t], t)}>{show(r.name, t, r.counts[t], r.label)}</td>)}
            </tr>
          ))}
          <tr className="dn-total">
            <th scope="row" className="l">All<span className="dn-more"> expansions</span></th><td><b>{piles}</b></td>
            {matrix.types.map(t => <td key={t}><b>{show(null, t, matrix.totals[t], 'all expansions')}</b></td>)}
          </tr>
        </tbody>
      </table></div>
      {sort.key !== null && <p className="note"><button type="button" className="ghost" onClick={() => setSort({ key: null, dir: 'asc' })}>Reset to collection order</button></p>}
      </>}
    </>
  );
}
