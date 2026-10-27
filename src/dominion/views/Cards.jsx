import { useMemo, useState } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { browseCards, activeCardFilters, DEFAULT_CARD_FILTERS, toggle, norm } from '../filters.js';
import { getCardFilters, setCardFilters } from '../filterStore.js';
import { cardHref } from '../links.js';
import { MECHANICS_NOTE, humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import SortHeaders from '../components/SortHeaders.jsx';
import { Chip, ExpansionBadge, TypePills, rowLink } from '../components/bits.jsx';
import CostIcons, { CoinIcon, DebtIcon, PlainDebtIcon } from '../components/Cost.jsx';

const SORTS = [['name', 'Name'], ['expansion', 'Expansion'], ['types', 'Printed type'], ['cost', 'Cost'], ['copies', 'Copies'], ['pile', 'Shared pile']];
// table columns that sort: [sort key, heading, th class]
const COLUMNS = [['name', 'Card', 'l'], ['types', 'Types', 'l'], ['cost', 'Cost', ''], ['copies', 'Copies', 'dn-hide-sm'], ['pile', 'Shared pile', 'l dn-hide-sm']];

export default function Cards() {
  const { catalog, summary: s } = useCatalog();
  const [f, setF] = useState(getCardFilters);
  const [mq, setMq] = useState('');
  const update = patch => { const next = { ...f, ...patch }; setCardFilters(next); setF(next); };
  // a header click uses the same sort state as the "Sort by" menu: the active column flips direction, another column starts ascending
  const sortBy = key => update(f.sort === key ? { dir: f.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  const clear = () => { const next = { ...DEFAULT_CARD_FILTERS }; setCardFilters(next); setF(next); setMq(''); };

  const rows = useMemo(() => browseCards(catalog.cards, f), [catalog, f]);
  const active = activeCardFilters(f);
  const nameCount = Object.fromEntries(s.byExpansion.map(e => [e.name, e.names]));
  const debtCount = d => catalog.cards.filter(c => c.debt === d).length;
  const debts = [...new Set(catalog.cards.map(c => c.debt).filter(d => d > 0))].sort((a, b) => a - b);
  const mechs = s.mechanics.frequency.filter(m => !mq.trim() || norm(`${humanize(m.id)} ${m.id} ${m.definition || ''}`).includes(norm(mq)));

  return (
    <>
      <div className="head"><div><h1>Kingdom cards</h1><p className="lede">Every Kingdom card name in the collection. Search, then narrow by expansion, printed type, cost or recorded mechanic.</p></div></div>

      <form className="builder dn-filters" role="search" aria-label="Filter Kingdom cards" onSubmit={e => e.preventDefault()}>
        <div className="controls">
          <label className="f">Search by name <input type="search" value={f.q} onChange={e => update({ q: e.target.value })} placeholder="e.g. Village" autoComplete="off" /></label>
          <label className="f">Sort by <select value={f.sort} onChange={e => update({ sort: e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button type="button" className="ghost" onClick={() => update({ dir: f.dir === 'asc' ? 'desc' : 'asc' })} aria-label={`Sort direction: ${f.dir === 'asc' ? 'ascending' : 'descending'}. Activate to reverse.`}>{f.dir === 'asc' ? '↑ Ascending' : '↓ Descending'}</button>
        </div>

        <fieldset className="dn-fieldset"><legend>Expansion</legend>
          <div className="dn-chips">{catalog.ownedExpansions.map(e => (
            <Chip key={e.name} pressed={f.expansions.includes(e.name)} count={nameCount[e.name]} onClick={() => update({ expansions: toggle(f.expansions, e.name) })}><ExpansionBadge name={e.name} /></Chip>
          ))}</div>
        </fieldset>

        <fieldset className="dn-fieldset"><legend>Printed type</legend>
          <div className="dn-chips">{s.byType.map(t => (
            <Chip key={t.key} pressed={f.types.includes(t.key)} count={t.count} onClick={() => update({ types: toggle(f.types, t.key) })}>{t.key}</Chip>
          ))}</div>
          {f.types.length > 1 && (
            <div className="dn-mode" role="group" aria-label="How to match the selected printed types">
              <span className="meta">A card must have</span>
              <Chip pressed={f.typeMode === 'all'} onClick={() => update({ typeMode: 'all' })}>all selected types</Chip>
              <Chip pressed={f.typeMode === 'any'} onClick={() => update({ typeMode: 'any' })}>any selected type</Chip>
            </div>
          )}
        </fieldset>

        <fieldset className="dn-fieldset"><legend>Cost</legend>
          <div className="dn-costrow"><span className="meta dn-rowlabel">Coins</span>
            <div className="dn-chips" role="group" aria-label="Coin cost (pick one or more)">
              {s.coinCosts.map(c => (
                <Chip key={c.key} pressed={f.costs.includes(c.key)} count={c.count} label={`${c.key} ${c.key === 1 ? 'coin' : 'coins'} — ${c.count} cards`} onClick={() => update({ costs: toggle(f.costs, c.key) })}>
                  <CoinIcon coins={c.key} size={26} />
                </Chip>
              ))}
            </div>
          </div>
          <div className="dn-costrow"><span className="meta dn-rowlabel">Debt</span>
            <div className="dn-chips" role="group" aria-label="Debt cost">
              <Chip pressed={f.debt === 'none'} label="No Debt cost" onClick={() => update({ debt: f.debt === 'none' ? 'any' : 'none' })}>No Debt</Chip>
              <Chip pressed={f.debt === 'has'} label="Any Debt cost" onClick={() => update({ debt: f.debt === 'has' ? 'any' : 'has' })}><PlainDebtIcon size={22} />Any Debt</Chip>
              {debts.map(d => (
                <Chip key={d} pressed={f.debt === String(d)} count={debtCount(d)} label={`Exactly ${d} Debt — ${debtCount(d)} cards`} onClick={() => update({ debt: f.debt === String(d) ? 'any' : String(d) })}>
                  <DebtIcon debt={d} size={26} />
                </Chip>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset className="dn-fieldset"><legend>Recorded mechanics</legend>
          <details className="dn-mech" open={f.mechanics.length > 0 || undefined}>
            <summary>{f.mechanics.length ? `${f.mechanics.length} selected` : 'Choose mechanics'} · {s.mechanics.distinct} tags recorded</summary>
            <label className="f" style={{ margin: '8px 0' }}>Find a mechanic <input type="search" value={mq} onChange={e => setMq(e.target.value)} placeholder="e.g. trashing" autoComplete="off" /></label>
            <ul className="dn-mech-list">
              {mechs.map(m => (
                <li key={m.id}><label title={m.definition || undefined}>
                  <input type="checkbox" checked={f.mechanics.includes(m.id)} onChange={() => update({ mechanics: toggle(f.mechanics, m.id) })} />
                  {humanize(m.id)} <span className="meta">{m.count}</span>
                </label></li>
              ))}
              {!mechs.length && <li className="meta">No recorded mechanic matches “{mq}”.</li>}
            </ul>
          </details>
          {f.mechanics.length > 1 && (
            <div className="dn-mode" role="group" aria-label="How to match the selected mechanics">
              <span className="meta">A card must be recorded with</span>
              <Chip pressed={f.mechanicMode === 'all'} onClick={() => update({ mechanicMode: 'all' })}>all selected</Chip>
              <Chip pressed={f.mechanicMode === 'any'} onClick={() => update({ mechanicMode: 'any' })}>any selected</Chip>
            </div>
          )}
          <p className="note dn-mech-note">{MECHANICS_NOTE}</p>
        </fieldset>

        <div className="controls" style={{ marginBottom: 0, marginTop: 6 }}>
          <button type="button" className="ghost" onClick={clear} disabled={!active}>Clear filters{active ? ` (${active})` : ''}</button>
          <span className="meta" role="status" aria-live="polite">Showing <b>{rows.length}</b> of {catalog.cards.length} card names{active ? ' (filtered)' : ''}</span>
        </div>
      </form>

      {rows.length ? (
        <div className="tablewrap">
          <table className="plain dn-table">
            <caption className="dn-sr">Kingdom cards matching the current filters</caption>
            <SortHeaders columns={COLUMNS} sort={f.sort} dir={f.dir} onSort={sortBy} />
            <tbody>{rows.map(c => {
              return (
                <tr key={c.id} {...rowLink(cardHref(c.id))}>
                  <td className="l name"><a href={cardHref(c.id)}>{c.name}</a>{c.previousName && <small className="meta"> (was {c.previousName})</small>}<br /><small className="meta"><ExpansionBadge name={c.expansion} size={14} /></small></td>
                  <td className="l"><TypePills types={c.types} /></td>
                  <td className="dn-cost-cell"><CostIcons coins={c.coins} debt={c.debt} overpay={c.overpay} size={26} /></td>
                  <td className="dn-hide-sm">{c.copies}</td>
                  <td className="l dn-hide-sm">{c.sharedPile || '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No cards match these filters. {active ? <button type="button" className="ghost" onClick={clear}>Clear filters</button> : null}</EmptyState>
      )}
    </>
  );
}
