import { useMemo, useState } from 'react';
import SearchInput from '../../components/SearchInput.jsx';
import { useCatalog } from '../CatalogContext.jsx';
import { browseCards, filterCards, facetCount, cardMatchOf, cardMatchPatch, activeCardFilters, DEFAULT_CARD_FILTERS, cardFiltersFromQuery, cardFiltersToQuery, nameMatches, textSnippet, pickRandom, toggle, norm, ROLE_KEYS, roleLabel } from '../filters.js';
import { useUrlFilters, useListScroll } from '../useUrlFilters.js';
import { useLeagueGames } from '../useLeagueGames.js';
import ScopePicker from '../components/ScopePicker.jsx';
import { cardHref, MAX_COMPARE, compareHref } from '../links.js';
import KingdomPickBar from '../components/KingdomPickBar.jsx';
import { choosePick, useKingdomPick } from '../kingdomPick.js';
import { useCompareBasket, startPicking, stopPicking, togglePick, removePick } from '../compareBasket.js';
import { humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { hoverHandlers } from '../components/CardHover.jsx';
import FilterSummary from '../components/FilterSummary.jsx';
import DrawnPick from '../components/DrawnPick.jsx';
import FacetBar from '../components/FacetBar.jsx';
import SortHeaders from '../components/SortHeaders.jsx';
import { PageShortcuts } from '../../components/Shortcuts.jsx';
import { Chip, ExpansionBadge, ModeRow, TypePills, rowLink } from '../components/bits.jsx';
import CostIcons, { CoinIcon, DebtIcon, PlainDebtIcon } from '../components/Cost.jsx';

const SORTS = [['name', 'Name'], ['expansion', 'Expansion'], ['types', 'Printed type'], ['cost', 'Cost'], ['pile', 'Shared pile']];
const PLAYED_SORT = ['plays', 'Times played'];
// table columns that sort: [sort key, heading, th class]
const COLUMNS = [['expansion', 'Expansion', 'l', 'Set'], ['name', 'Card', 'l'], ['types', 'Types', 'l'], ['cost', 'Cost', ''], ['pile', 'Shared Pile', 'l dn-hide-sm']];
const PLAYED_COLUMN = ['plays', 'Played', 'dn-hide-sm'];   // only once games with a kingdom are logged

export default function Cards({ query = '' }) {
  const { catalog, summary: s } = useCatalog();
  const { f, update, qText, onQ, clear: clearFilters } = useUrlFilters(query, { fromQuery: cardFiltersFromQuery, toQuery: cardFiltersToQuery, defaults: DEFAULT_CARD_FILTERS });
  useListScroll();
  const lg = useLeagueGames(f.by);
  const basket = useCompareBasket();
  const kp = useKingdomPick(), choosing = !!kp && kp.kind === 'card';   // choosing a card FOR a kingdom (the Randomizer's Add / Replace), not browsing
  const picking = basket.picking, picked = new Set(basket.ids);
  const plays = lg && lg.stats ? lg.stats.piles : null;   // pile key -> { games, ... }; null until a kingdom has been logged
  const [mq, setMq] = useState('');
  const qs = cardFiltersToQuery(f);   // carried into each card's page, so Previous/Next and "back to the list" keep the filters
  // a header click uses the same sort state as the "Sort by" menu: the active column flips direction, another column starts ascending
  const sortBy = key => update(f.sort === key ? { dir: f.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  const clear = () => { clearFilters(); setMq(''); };
  const [drawn, setDrawn] = useState(null);   // while choosing for a kingdom: the id Random drew, shown here to use or redraw (see DrawnPick)
  const random = () => {
    const pool = choosing ? rows.filter(x => !blocked.has(x.pileKey) && x.id !== drawn) : rows, c = pickRandom(pool.length ? pool : rows);
    if (!c) return;
    if (choosing) setDrawn(c.id); else window.location.hash = cardHref(c.id, qs);
  };

  const taken = useMemo(() => new Set(choosing ? kp.taken.map(id => catalog.cardsById.get(id)?.pileKey).filter(Boolean) : []), [catalog, choosing, kp]);
  const rows = useMemo(() => browseCards(catalog.cards, f, { plays }).filter(c => !taken.has(c.pileKey)), [catalog, f, plays, taken]);   // a pile already in the kingdom is not offered
  const blocked = useMemo(() => new Set(choosing ? (kp.blocked || []).map(id => catalog.cardsById.get(id)?.pileKey).filter(Boolean) : []), [catalog, choosing, kp]);   // in play at the other table: shown greyed, not pickable
  const active = activeCardFilters(f);
  const drawnItem = drawn && rows.find(r => r.id === drawn);   // gone from the list (a filter changed): nothing is shown
  const debts = [...new Set(catalog.cards.map(c => c.debt).filter(d => d > 0))].sort((a, b) => a - b);
  // the small number on every chip follows the other filters (see facetCount): "how many would show if I picked this"
  const fc = useMemo(() => {
    const n = (facet, v, mode) => facetCount(catalog.cards, f, filterCards, { plays }, facet, v, mode);
    return {
      exp: Object.fromEntries(catalog.ownedExpansions.map(e => [e.name, n('expansions', e.name, f.expMode)])),
      types: Object.fromEntries(s.byType.map(t => [t.key, n('types', t.key, f.typeMode)])),
      costs: Object.fromEntries(s.coinCosts.map(c => [c.key, n('costs', c.key, f.costMode)])),
      debt: Object.fromEntries(debts.map(d => [d, n('debt', String(d))])),
      role: Object.fromEntries(ROLE_KEYS.map(k => [k, n('roles', k)])),
      yes: n('played', 'yes'), no: n('played', 'no'),
      mech: Object.fromEntries(s.mechanics.frequency.map(m => [m.id, n('mechanics', m.id, f.mechanicMode)])),
    };
  }, [catalog, f, plays, s]);   // eslint-disable-line react-hooks/exhaustive-deps
  const mechs = s.mechanics.frequency.filter(m => !mq.trim() || norm(`${humanize(m.id)} ${m.id} ${m.definition || ''}`).includes(norm(mq)));

  const modeRow = <>
    <ModeRow show={f.expansions.length + f.types.length + f.costs.length + (f.debt !== 'any' ? 1 : 0) > 0} ariaLabel="How to match the selected filters" value={cardMatchOf(f)} options={[['all'], ['any'], ['none'], ...(cardMatchOf(f) === 'exact' ? [['exact', 'only these types']] : [])]} onChange={m => update(cardMatchPatch(m))} />
    {f.typeMode === 'none' && f.mechanics.length > 0 && <p className="meta dn-mode-note">Recorded mechanics stay “any of”: a missing tag doesn’t prove a card lacks the mechanic.</p>}
  </>;

  return (
    <>
      <PageShortcuts bindings={rows.length ? [{ key: 'r', label: 'Open a random card', run: random }] : []} />
      {choosing && <KingdomPickBar target={kp} plays={plays} />}
      <div className="head"><div>{choosing ? <><h1>{kp.label ? 'Replace a card' : 'Add a card'}</h1></> : <><h1>Kingdom cards</h1><p className="lede">Every Kingdom card name in the collection. Search, then narrow by expansion, printed type, cost or recorded mechanic.</p></>}</div></div>
      {picking && <p className="dn-pickhint" role="status">Pick up to {MAX_COMPARE} cards to compare: tap a row to add or remove it.</p>}

      <form className="builder dn-filters" role="search" aria-label="Filter Kingdom cards" onSubmit={e => e.preventDefault()}>
        <div className="controls">
          <label className="f">Search <SearchInput value={qText} onChange={onQ} placeholder="e.g. Village" autoComplete="off" /></label>
          <label className="f dn-check"><input type="checkbox" checked={f.text} onChange={e => update({ text: e.target.checked })} /> Include card text</label>
        </div>

        <FacetBar facets={[
          { id: 'exp', label: 'Expansion', n: f.expansions.length, children: <>
          <div className="dn-chips">{catalog.ownedExpansions.map(e => (
            <Chip key={e.name} pressed={f.expansions.includes(e.name)} count={fc.exp[e.name]} onClick={() => update({ expansions: toggle(f.expansions, e.name) })}><ExpansionBadge name={e.name} /></Chip>
          ))}</div>
        </> },
          { id: 'type', label: 'Type', n: f.types.length, children: <>
          <div className="dn-chips">{s.byType.map(t => (
            <Chip key={t.key} tone={t.key.toLowerCase()} pressed={f.types.includes(t.key)} count={fc.types[t.key]} onClick={() => update({ types: toggle(f.types, t.key) })}>{t.key}</Chip>
          ))}</div>
        </> },
          { id: 'cost', label: 'Cost', n: f.costs.length + (f.debt !== 'any' ? 1 : 0), children: <>
          <div className="dn-costrow">
            <div className="dn-chips" role="group" aria-label="Coin cost (pick one or more)">
              {s.coinCosts.map(c => (
                <Chip key={c.key} pressed={f.costs.includes(c.key)} count={fc.costs[c.key]} label={`${c.key} ${c.key === 1 ? 'coin' : 'coins'} — ${fc.costs[c.key]} cards`} onClick={() => update({ costs: toggle(f.costs, c.key) })}>
                  <CoinIcon coins={c.key} size={26} />
                </Chip>
              ))}
            </div>
          </div>
          <div className="dn-costrow">
            <div className="dn-chips" role="group" aria-label="Debt cost">
              <Chip pressed={f.debt === 'has'} label="Any Debt cost" onClick={() => update({ debt: f.debt === 'has' ? 'any' : 'has' })}><PlainDebtIcon size={22} />Any Debt</Chip>
              {debts.map(d => (
                <Chip key={d} pressed={f.debt === String(d)} count={fc.debt[d]} label={`Exactly ${d} Debt — ${fc.debt[d]} cards`} onClick={() => update({ debt: f.debt === String(d) ? 'any' : String(d) })}>
                  <DebtIcon debt={d} size={26} />
                </Chip>
              ))}
            </div>
          </div>
          </> },
          { id: 'role', label: 'Role', n: f.roles.length, children: <>
          <p className="meta dn-facet-note">What the Randomizer's rules look for. A card with any of these jobs shows.</p>
          <div className="dn-chips">{ROLE_KEYS.map(k => <Chip key={k} pressed={f.roles.includes(k)} count={fc.role[k]} onClick={() => update({ roles: toggle(f.roles, k) })}>{roleLabel(k)}</Chip>)}</div></> },
          { id: 'mech', label: 'Mechanics', n: f.mechanics.length, children: <>
          <div className="dn-mech">
            <label className="f" style={{ margin: '8px 0' }}>Find a mechanic <SearchInput value={mq} onChange={setMq} placeholder="e.g. trashing" autoComplete="off" /></label>
            <ul className="dn-mech-list">
              {mechs.map(m => (
                <li key={m.id}><label title={m.definition || undefined}>
                  <input type="checkbox" checked={f.mechanics.includes(m.id)} onChange={() => update({ mechanics: toggle(f.mechanics, m.id) })} />
                  {humanize(m.id)} <span className="meta">{fc.mech[m.id]}</span>
                </label></li>
              ))}
              {!mechs.length && <li className="meta">No recorded mechanic matches “{mq}”.</li>}
            </ul>
          </div>
        </> },
          ...(plays ? [{ id: 'played', label: 'Play history', n: f.played !== 'any' ? 1 : 0, children: <>
          <ScopePicker who={lg.who} players={lg.players} onPick={n => update({ by: n })} label="Counted for" />
          <div className="dn-chips">
            <Chip pressed={f.played === 'yes'} count={fc.yes} onClick={() => update({ played: f.played === 'yes' ? 'any' : 'yes' })}>Played</Chip>
            <Chip pressed={f.played === 'no'} count={fc.no} onClick={() => update({ played: f.played === 'no' ? 'any' : 'no' })}>Not played yet</Chip>
          </div>
        </> }] : []),
        ]} />
        {modeRow}

        <FilterSummary f={f} update={update} />
        <div className="controls" style={{ marginBottom: 0, marginTop: 6 }}>
          <button type="button" className="ghost" onClick={clear} disabled={!active}>Clear filters{active ? ` (${active})` : ''}</button>
          <button type="button" className="ghost" onClick={random} disabled={!rows.length}>Random card</button>
          {!choosing && <button type="button" className="ghost dn-toggle" aria-pressed={picking} onClick={() => (picking ? stopPicking() : startPicking())}>{picking ? 'Cancel comparing' : 'Compare cards'}</button>}
          <span className="meta" role="status" aria-live="polite">Showing <b>{rows.length}</b> of {catalog.cards.length} card names{active ? ' (filtered)' : ''}</span>
        </div>
      </form>

      {choosing && drawnItem && <DrawnPick item={drawnItem} kind="card" replacing={!!kp.label} onAgain={random} times={plays ? (plays.get(drawnItem.pileKey)?.games || 0) : null} who={lg && lg.who} />}

      {rows.length ? (
        <div className="tablewrap">
          <table className={'plain dn-table dn-browse' + (choosing ? ' dn-aligned' : '')}>
            <caption className="dn-sr">Kingdom cards matching the current filters</caption>
            <SortHeaders columns={plays ? [...COLUMNS, PLAYED_COLUMN] : COLUMNS} sort={f.sort} dir={f.dir} onSort={sortBy} />
            <tbody>{rows.map(c => {
              return (
                <tr key={c.id} {...(choosing ? (blocked.has(c.pileKey) ? blockedRow : chooseRow(c.id)) : picking ? pickRow(c.id, picked) : rowLink(cardHref(c.id, qs)))} {...hoverHandlers(c.id)}>
                  <td className="l">{choosing && blocked.has(c.pileKey) && <span className="dn-inplay" title="This card is in play at the other table">In play</span>}{choosing && !blocked.has(c.pileKey) && <button type="button" className="dn-addpill" onClick={e => choosePick(c.id, e.currentTarget)} aria-label={kp.label ? `Use ${c.name} instead` : `Add ${c.name} to your kingdom`} title={kp.label ? 'Use this one instead' : 'Add to your kingdom'}>{kp.label ? '✓' : '+'}</button>}{!choosing && picking && <span className={'dn-pickbox' + (picked.has(c.id) ? ' on' : '')} aria-hidden="true">{picked.has(c.id) ? '✓' : ''}</span>}<ExpansionBadge name={c.expansion} size={18} /></td>
                  <td className="l name"><a href={cardHref(c.id, qs)}>{c.name}</a>{c.previousName && <small className="meta"> (was {c.previousName})</small>}{f.text && f.q.trim() && !nameMatches(c, f.q) && <small className="meta dn-snippet">{textSnippet(c.text, f.q)}</small>}</td>
                  <td className="l"><TypePills types={c.types} /></td>
                  <td className="dn-cost-cell"><CostIcons coins={c.coins} debt={c.debt} overpay={c.overpay} size={26} /></td>
                  <td className="l dn-hide-sm">{c.sharedPile || '—'}</td>
                  {plays && <td className="dn-hide-sm">{plays.get(c.pileKey)?.games || '—'}</td>}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No cards match these filters. {active ? <button type="button" className="ghost" onClick={clear}>Clear filters</button> : null}</EmptyState>
      )}
      {picking && !choosing && <CompareTray ids={basket.ids} catalog={catalog} />}
    </>
  );
}

// choosing for a kingdom: a click anywhere on the row picks it (the name stays a real link, for a look at the card first)
const chooseRow = id => ({
  className: 'dn-rowlink dn-pickrow',
  onClick: e => { if (e.target.closest('a, button, input, select, textarea')) return; choosePick(id, e.currentTarget); },
});

// a card at the other table: greyed out and not clickable (its name stays a link)
const blockedRow = { className: 'dn-blocked', 'aria-disabled': true };

// in pick mode a row toggles instead of opening the card (its name stays a real link); a fifth card is refused by the store
const pickRow = (id, picked) => ({
  className: 'dn-rowlink dn-pickrow' + (picked.has(id) ? ' picked' : picked.size >= MAX_COMPARE ? ' full' : ''),
  'aria-selected': picked.has(id),
  onClick: e => { if (e.target.closest('a, button, input, select, textarea')) return; togglePick(id); },
});

/* The picks so far, always in reach at the bottom of the list: each card with a ✕, and the button that opens the comparison once there are two. */
function CompareTray({ ids, catalog }) {
  const cards = ids.map(id => catalog.cardsById.get(id)).filter(Boolean);
  const ready = cards.length >= 2;
  return (
    <div className="dn-tray" role="region" aria-label="Cards to compare">
      <span className="dn-tray-n">{cards.length} of {MAX_COMPARE}</span>
      <span className="dn-tray-cards">{cards.length ? cards.map(c => (
        <button type="button" key={c.id} className="dn-tray-chip" onClick={() => removePick(c.id)} aria-label={`Remove ${c.name}`} title="Remove">{c.name} <span aria-hidden="true">✕</span></button>
      )) : <span className="meta">None picked yet</span>}</span>
      <a className={'dn-tray-go' + (ready ? '' : ' off')} href={ready ? compareHref(ids) : undefined} aria-disabled={!ready}
        onClick={e => { if (!ready) e.preventDefault(); else stopPicking(); }}>{ready ? `Compare ${cards.length}` : 'Pick 2 or more'}</a>
    </div>
  );
}

