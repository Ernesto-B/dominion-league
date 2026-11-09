import { useMemo, useState } from 'react';
import SearchInput from '../../components/SearchInput.jsx';
import { useCatalog } from '../CatalogContext.jsx';
import { browseLandscapes, filterLandscapes, facetCount, landscapeMatchOf, landscapeMatchPatch, activeLandscapeFilters, DEFAULT_LANDSCAPE_FILTERS, landscapeFiltersFromQuery, landscapeFiltersToQuery, landscapeCostKey, NO_COST, nameMatches, textSnippet, pickRandom, toggle, norm } from '../filters.js';
import { useUrlFilters, useListScroll } from '../useUrlFilters.js';
import { useLeagueGames } from '../useLeagueGames.js';
import ScopePicker from '../components/ScopePicker.jsx';
import KingdomPickBar from '../components/KingdomPickBar.jsx';
import { choosePick, useKingdomPick } from '../kingdomPick.js';
import { artifactHref, landscapeHref } from '../links.js';
import { PLURAL, humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { hoverHandlers } from '../components/CardHover.jsx';
import DrawnPick from '../components/DrawnPick.jsx';
import FacetBar from '../components/FacetBar.jsx';
import FilterSummary from '../components/FilterSummary.jsx';
import SortHeaders from '../components/SortHeaders.jsx';
import { PageShortcuts } from '../../components/Shortcuts.jsx';
import CostIcons, { CoinIcon, DebtIcon, PlainDebtIcon } from '../components/Cost.jsx';
import { Chip, ExpansionBadge, ModeRow, Section, ExternalLink, LandscapePill, statusLabel, rowLink } from '../components/bits.jsx';

const SORTS = [['name', 'Name'], ['type', 'Type'], ['expansion', 'Expansion'], ['cost', 'Cost'], ['trigger', 'When it applies']];
// table columns that sort: [sort key, heading, th class]
const COLUMNS = [['expansion', 'Expansion', 'l', 'Set'], ['name', 'Landscape', 'l'], ['type', 'Type', 'l'], ['cost', 'Cost', ''], ['trigger', 'When it applies', 'l dn-hide-sm']];

export default function Landscapes({ query = '' }) {
  const { catalog } = useCatalog();
  const { f, update, qText, onQ, clear: clearFilters } = useUrlFilters(query, { fromQuery: landscapeFiltersFromQuery, toQuery: landscapeFiltersToQuery, defaults: DEFAULT_LANDSCAPE_FILTERS });
  useListScroll();
  const [mq, setMq] = useState('');
  const lg = useLeagueGames(f.by);
  const plays = lg && lg.stats ? lg.stats.landscapes : null;   // landscape id -> { games }; null until a kingdom has been logged
  const qs = landscapeFiltersToQuery(f);   // carried into each landscape's page (Previous/Next, back to the list)
  // header clicks share state with the "Sort by" menu: the active column flips direction, another column starts ascending
  const sortBy = key => update(f.sort === key ? { dir: f.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  const clear = () => { clearFilters(); setMq(''); };
  const [drawn, setDrawn] = useState(null);   // while choosing for a kingdom: the id Random drew, shown here to use or redraw (see DrawnPick)
  const random = () => {
    const pool = choosing ? rows.filter(x => !blockedL.has(x.id) && x.id !== drawn) : rows, l = pickRandom(pool.length ? pool : rows);
    if (!l) return;
    if (choosing) setDrawn(l.id); else window.location.hash = landscapeHref(l.id, qs);
  };

  const kp = useKingdomPick(), choosing = !!kp && kp.kind === 'landscape';   // choosing a landscape FOR a kingdom, not browsing
  const blockedL = useMemo(() => new Set(choosing ? kp.blocked || [] : []), [choosing, kp]);   // in play at the other table: greyed, not pickable
  const rows = useMemo(() => browseLandscapes(catalog.landscapes, f, { plays }).filter(l => !(choosing && kp.taken.includes(l.id))), [catalog, f, plays, choosing, kp]);
  const active = activeLandscapeFilters(f);
  const drawnItem = drawn && rows.find(r => r.id === drawn);   // gone from the list (a filter changed): nothing is shown
  const expansions = catalog.ownedExpansions.filter(e => catalog.landscapes.some(l => l.expansion === e.name));
  // tags are the landscapes' OWN vocabulary (most are not Kingdom taxonomy ids), so they get no Kingdom definitions
  // the costs the landscapes actually have (Events and Projects; the rest have none), and the Debt amounts
  const coinCosts = useMemo(() => [...new Set(catalog.landscapes.map(landscapeCostKey).filter(k => typeof k === 'number'))].sort((a, b) => a - b), [catalog]);
  const debts = useMemo(() => [...new Set(catalog.landscapes.map(l => l.debt).filter(d => d > 0))].sort((a, b) => a - b), [catalog]);
  const tagCounts = useMemo(() => { const m = new Map(); catalog.landscapes.forEach(l => l.mechanicIds.forEach(t => m.set(t, (m.get(t) || 0) + 1))); return [...m].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)); }, [catalog]);
  // the small number on every chip follows the other filters (see facetCount): "how many would show if I picked this"
  const fc = useMemo(() => {
    const n = (facet, v, mode) => facetCount(catalog.landscapes, f, filterLandscapes, { plays }, facet, v, mode);
    return {
      types: Object.fromEntries(catalog.landscapeTypes.map(t => [t, n('types', t, f.typeMode)])),
      exp: Object.fromEntries(expansions.map(e => [e.name, n('expansions', e.name, f.expMode)])),
      costs: Object.fromEntries([...coinCosts, NO_COST].map(c => [c, n('costs', c, f.costMode)])),
      debt: Object.fromEntries(debts.map(d => [d, n('debt', String(d))])),
      yes: n('played', 'yes'), no: n('played', 'no'),
      tag: Object.fromEntries(tagCounts.map(t => [t.id, n('mechanics', t.id, f.mechanicMode)])),
    };
  }, [catalog, f, plays, tagCounts, coinCosts, debts]);   // eslint-disable-line react-hooks/exhaustive-deps
  const tags = tagCounts.filter(t => !mq.trim() || norm(`${humanize(t.id)} ${t.id}`).includes(norm(mq)));

  const modeRow = <>
    <ModeRow show={f.types.length + f.expansions.length + f.costs.length + (f.debt !== 'any' ? 1 : 0) > 0} ariaLabel="How to match the selected filters" value={landscapeMatchOf(f)} options={[['all'], ['any'], ['none']]} onChange={m => update(landscapeMatchPatch(m))} />
    {f.typeMode === 'none' && f.mechanics.length > 0 && <p className="meta dn-mode-note">Recorded tags stay “any of”: a missing tag doesn’t prove a landscape lacks it.</p>}
  </>;

  return (
    <>
      <PageShortcuts bindings={rows.length ? [{ key: 'r', label: 'Open a random landscape', run: random }] : []} />
      {choosing && <KingdomPickBar target={kp} />}
      <div className="head"><div>{choosing ? <h1>{kp.label ? 'Replace a landscape' : 'Add a landscape'}</h1> : <><h1>Landscapes</h1><p className="lede">Events, Landmarks, Projects, Ways and Traits. They sit beside the Kingdom and aren’t Kingdom cards.</p></>}</div></div>

      <form className="builder dn-filters" role="search" aria-label="Filter landscapes" onSubmit={e => e.preventDefault()}>
        <div className="controls">
          <label className="f">Search <SearchInput value={qText} onChange={onQ} placeholder="e.g. Way of the" autoComplete="off" /></label>
          <label className="f dn-check"><input type="checkbox" checked={f.text} onChange={e => update({ text: e.target.checked })} /> Include card text</label>
        </div>
        <FacetBar facets={[
          { id: 'exp', label: 'Expansion', n: f.expansions.length, children: <>
          <div className="dn-chips">{expansions.map(e => <Chip key={e.name} pressed={f.expansions.includes(e.name)} count={fc.exp[e.name]} onClick={() => update({ expansions: toggle(f.expansions, e.name) })}><ExpansionBadge name={e.name} /></Chip>)}</div>
        </> },
          { id: 'type', label: 'Type', n: f.types.length, children: <>
          <div className="dn-chips">{catalog.landscapeTypes.map(t => <Chip key={t} tone={t.toLowerCase()} pressed={f.types.includes(t)} count={fc.types[t]} onClick={() => update({ types: toggle(f.types, t) })}>{PLURAL[t] || t}</Chip>)}</div>
        </> },
          { id: 'cost', label: 'Cost', n: f.costs.length + (f.debt !== 'any' ? 1 : 0), children: <>
          <div className="dn-costrow">
            <div className="dn-chips" role="group" aria-label="Cost (pick one or more)">
              {coinCosts.map(c => (
                <Chip key={c} pressed={f.costs.includes(c)} count={fc.costs[c]} label={`${c} ${c === 1 ? 'coin' : 'coins'} — ${fc.costs[c]} landscapes`} onClick={() => update({ costs: toggle(f.costs, c) })}>
                  <CoinIcon coins={c} size={26} />
                </Chip>
              ))}
              <Chip pressed={f.costs.includes(NO_COST)} count={fc.costs[NO_COST]} label={`No cost — ${fc.costs[NO_COST]} landscapes`} onClick={() => update({ costs: toggle(f.costs, NO_COST) })}>No cost</Chip>
            </div>
          </div>
          {debts.length > 0 && (
            <div className="dn-costrow">
              <div className="dn-chips" role="group" aria-label="Debt cost">
                <Chip pressed={f.debt === 'has'} label="Any Debt cost" onClick={() => update({ debt: f.debt === 'has' ? 'any' : 'has' })}><PlainDebtIcon size={22} />Any Debt</Chip>
                {debts.map(d => (
                  <Chip key={d} pressed={f.debt === String(d)} count={fc.debt[d]} label={`Exactly ${d} Debt — ${fc.debt[d]} landscapes`} onClick={() => update({ debt: f.debt === String(d) ? 'any' : String(d) })}>
                    <DebtIcon debt={d} size={26} />
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </> },
          { id: 'tags', label: 'Tags', n: f.mechanics.length, children: <>
          <div className="dn-mech">
            <label className="f" style={{ margin: '8px 0' }}>Find a tag <SearchInput value={mq} onChange={setMq} placeholder="e.g. draw" autoComplete="off" /></label>
            <ul className="dn-mech-list">
              {tags.map(t => (
                <li key={t.id}><label><input type="checkbox" checked={f.mechanics.includes(t.id)} onChange={() => update({ mechanics: toggle(f.mechanics, t.id) })} />{humanize(t.id)} <span className="meta">{fc.tag[t.id]}</span></label></li>
              ))}
              {!tags.length && <li className="meta">No recorded tag matches “{mq}”.</li>}
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
          <button type="button" className="ghost" onClick={random} disabled={!rows.length}>Random landscape</button>
          <span className="meta" role="status" aria-live="polite">Showing <b>{rows.length}</b> of {catalog.landscapes.length} landscapes{active ? ' (filtered)' : ''}</span>
        </div>
      </form>

      {choosing && drawnItem && <DrawnPick item={drawnItem} kind="landscape" replacing={!!kp.label} onAgain={random} times={plays ? (plays.get(drawnItem.id)?.games || 0) : null} who={lg && lg.who} />}

      {rows.length ? (
        <div className="tablewrap">
          <table className={'plain dn-table dn-browse' + (choosing ? ' dn-aligned' : '')}>
            <caption className="dn-sr">Landscapes matching the current filters</caption>
            <SortHeaders columns={COLUMNS} sort={f.sort} dir={f.dir} onSort={sortBy} />
            <tbody>{rows.map(l => (
              <tr key={l.id} {...(choosing ? (blockedL.has(l.id) ? { className: 'dn-blocked', 'aria-disabled': true } : { className: 'dn-rowlink dn-pickrow', onClick: e => { if (!e.target.closest('a, button, input, select, textarea')) choosePick(l.id, e.currentTarget); } }) : rowLink(landscapeHref(l.id, qs)))} {...hoverHandlers(l.id)}>
                <td className="l">{choosing && blockedL.has(l.id) && <span className="dn-inplay" title="This landscape is in play at the other table">In play</span>}{choosing && !blockedL.has(l.id) && <button type="button" className="dn-addpill" onClick={e => choosePick(l.id, e.currentTarget)} aria-label={kp.label ? `Use ${l.name} instead` : `Add ${l.name} to your kingdom`} title={kp.label ? 'Use this one instead' : 'Add to your kingdom'}>{kp.label ? '✓' : '+'}</button>}<ExpansionBadge name={l.expansion} size={18} /></td>
                <td className="l name"><a href={landscapeHref(l.id, qs)}>{l.name}</a>{f.text && f.q.trim() && !nameMatches(l, f.q) && <small className="meta dn-snippet">{textSnippet(l.text, f.q)}</small>}</td>
                <td className="l"><LandscapePill type={l.type} /></td>
                <td className="dn-cost-cell">{l.coins != null ? <CostIcons coins={l.coins} debt={l.debt} size={26} /> : <span className="dn-nocost" role="img" aria-label="No cost" title={`${PLURAL[l.type] || l.type} have no cost`} />}</td>
                <td className="l dn-hide-sm">{l.trigger ? humanize(l.trigger) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No landscapes match these filters. {active ? <button type="button" className="ghost" onClick={clear}>Clear filters</button> : null}</EmptyState>
      )}

      <Section title="Artifacts" id="ls-artifacts">
        <p className="note" style={{ marginTop: 0 }}>Artifacts are their own kind of component. They are not landscapes and not Kingdom cards, so the filters above don’t apply to them.</p>
        <div className="tablewrap">
          <table className="plain dn-table">
            <caption className="dn-sr">Artifacts in the collection</caption>
            <thead><tr><th className="l" scope="col">Artifact</th><th className="l" scope="col">Expansion</th><th className="dn-hide-sm" scope="col">Copies</th><th className="l dn-hide-sm" scope="col">Behaviour</th><th className="l dn-hide-sm" scope="col">Recorded tags</th></tr></thead>
            <tbody>{catalog.artifacts.map(a => (
              <tr key={a.id} {...hoverHandlers(a.id)}>
                <td className="l name"><a href={artifactHref(a.id)}><b>{a.name}</b></a></td>
                <td className="l"><ExpansionBadge name={a.expansion} size={14} /></td>
                <td className="dn-hide-sm">{a.copies}</td>
                <td className="l dn-hide-sm">{a.behaviour ? humanize(a.behaviour) : '—'}</td>
                <td className="l dn-hide-sm">{a.tags.length ? a.tags.map(humanize).join(', ') : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="note">{catalog.artifacts.length} Artifacts · tags are recorded positives, not exhaustive. Source: {catalog.artifacts[0] && <ExternalLink href={catalog.artifacts[0].sourceUrl}>Renaissance rulebook ↗</ExternalLink>}</p>
      </Section>
    </>
  );
}
