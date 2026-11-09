import { useMemo, useState } from 'react';
import { insights } from '../playStats.js';
import { cardsFilterHref } from '../links.js';
import { ExpansionBadge } from './bits.jsx';
import SortHeaders from './SortHeaders.jsx';

/* Kingdom supply piles played and not played yet, by expansion (with a total row): Kingdom insights' table, and the Player page's Cards tab with that player's own stats.
   It sorts like the other tables: a click on the open column flips it, another column starts ascending (Expansion is the box order). */
export default function PlayedByExpansion({ catalog, stats, who = '' }) {
  const [nsort, setNsort] = useState({ key: 'expansion', dir: 'asc' });
  const onSort = key => setNsort(o => (o.key === key ? { key, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const ins = useMemo(() => insights(catalog, stats, { top: Infinity }), [catalog, stats]);
  const rows = useMemo(() => {
    const val = x => (nsort.key === 'played' ? x.total - x.never : x[nsort.key]);
    const list = ins.neverByExpansion.map((x, i) => ({ x, i }));
    if (nsort.key !== 'expansion') list.sort((a, b) => val(a.x) - val(b.x) || a.i - b.i);   // ties keep the box order
    if (nsort.dir === 'desc') list.reverse();
    return list.map(r => r.x);
  }, [ins, nsort]);
  return (
    <div className="tablewrap"><table className="plain dn-table dn-pcttable">
      <caption className="dn-sr">Kingdom supply piles played and not played yet, by expansion</caption>
      <SortHeaders columns={[['expansion', 'Expansion', 'l'], ['total', 'Piles', 'dn-hide-sm'], ['played', 'Played', ''], ['never', 'Not played', '']]} sort={nsort.key} dir={nsort.dir} onSort={onSort} />
      <tbody>{rows.map(x => (
        <tr key={x.expansion}>
          <td className="l"><a href={cardsFilterHref({ expansions: [x.expansion], by: who })}><ExpansionBadge name={x.expansion} /></a></td>
          <Counts total={x.total} played={x.total - x.never} patch={{ expansions: [x.expansion], by: who }} />
        </tr>
      ))}</tbody>
      <tfoot><tr>
        <th className="l" scope="row">Total</th>
        <Counts total={catalog.piles.length} played={catalog.piles.length - ins.neverTotal} patch={{ by: who }} />
      </tr></tfoot>
    </table></div>
  );
}

// Piles / Played / Not played cells: each number opens the Kingdom cards table with that expansion (or all) and that play history filtered
function Counts({ total, played, patch }) {
  const never = total - played;
  // the number and its percentage are one link, so the whole cell is the target
  const cell = (n, extra, showShare = true) => {
    const inner = <><span className="dn-num">{n}</span>{showShare && <span className="dn-pct">{total ? Math.round(n / total * 100) : 0}%</span>}</>;
    return n ? <a className="dn-cell-link" href={cardsFilterHref({ ...patch, ...extra })}>{inner}</a> : <span className="dn-cell-link off">{inner}</span>;
  };
  return (
    <>
      <td className="dn-hide-sm">{cell(total, {}, false)}</td>
      <td>{cell(played, { played: 'yes' })}</td>
      <td>{cell(never, { played: 'no' })}</td>
    </>
  );
}
