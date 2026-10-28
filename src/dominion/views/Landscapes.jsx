import { useMemo, useState } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { browseLandscapes, activeLandscapeFilters, DEFAULT_LANDSCAPE_FILTERS, landscapeFiltersFromQuery, landscapeFiltersToQuery, nameMatches, textSnippet, pickRandom, toggle, norm } from '../filters.js';
import { useUrlFilters, useListScroll } from '../useUrlFilters.js';
import { artifactHref, landscapeHref } from '../links.js';
import { PLURAL, humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import SortHeaders from '../components/SortHeaders.jsx';
import { Chip, ExpansionBadge, FilterFold, Section, ExternalLink, LandscapePill, statusLabel, rowLink } from '../components/bits.jsx';

const SORTS = [['name', 'Name'], ['type', 'Type'], ['expansion', 'Expansion'], ['trigger', 'When it applies']];
// table columns that sort: [sort key, heading, th class]
const COLUMNS = [['expansion', 'Expansion', 'l', 'Set'], ['name', 'Landscape', 'l'], ['type', 'Type', 'l'], ['trigger', 'When it applies', 'l dn-hide-sm']];

export default function Landscapes({ query = '' }) {
  const { catalog } = useCatalog();
  const { f, update, qText, onQ, clear: clearFilters } = useUrlFilters(query, { fromQuery: landscapeFiltersFromQuery, toQuery: landscapeFiltersToQuery, defaults: DEFAULT_LANDSCAPE_FILTERS });
  useListScroll();
  const [mq, setMq] = useState('');
  const qs = landscapeFiltersToQuery(f);   // carried into each landscape's page (Previous/Next, back to the list)
  // header clicks share state with the "Sort by" menu: the active column flips direction, another column starts ascending
  const sortBy = key => update(f.sort === key ? { dir: f.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  const clear = () => { clearFilters(); setMq(''); };
  const random = () => { const l = pickRandom(rows); if (l) window.location.hash = landscapeHref(l.id, qs); };

  const rows = useMemo(() => browseLandscapes(catalog.landscapes, f), [catalog, f]);
  const active = activeLandscapeFilters(f);
  const typeCount = t => catalog.landscapes.filter(l => l.type === t).length;
  const expansions = catalog.ownedExpansions.filter(e => catalog.landscapes.some(l => l.expansion === e.name));
  const expCount = n => catalog.landscapes.filter(l => l.expansion === n).length;
  // tags are the landscapes' OWN vocabulary (most are not Kingdom taxonomy ids), so they get no Kingdom definitions
  const tagCounts = useMemo(() => { const m = new Map(); catalog.landscapes.forEach(l => l.mechanicIds.forEach(t => m.set(t, (m.get(t) || 0) + 1))); return [...m].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)); }, [catalog]);
  const tags = tagCounts.filter(t => !mq.trim() || norm(`${humanize(t.id)} ${t.id}`).includes(norm(mq)));

  return (
    <>
      <div className="head"><div><h1>Landscapes</h1><p className="lede">Events, Landmarks, Projects, Ways and Traits. They sit beside the Kingdom and aren’t Kingdom cards.</p></div></div>

      <form className="builder dn-filters" role="search" aria-label="Filter landscapes" onSubmit={e => e.preventDefault()}>
        <div className="controls">
          <label className="f">Search <input type="search" value={qText} onChange={e => onQ(e.target.value)} placeholder="e.g. Way of the" autoComplete="off" /></label>
          <label className="f dn-check"><input type="checkbox" checked={f.text} onChange={e => update({ text: e.target.checked })} /> Include card text</label>
          <label className="f">Sort by <select value={f.sort} onChange={e => update({ sort: e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button type="button" className="ghost" onClick={() => update({ dir: f.dir === 'asc' ? 'desc' : 'asc' })} aria-label={`Sort direction: ${f.dir === 'asc' ? 'ascending' : 'descending'}. Activate to reverse.`}>{f.dir === 'asc' ? '↑ Ascending' : '↓ Descending'}</button>
        </div>
        <FilterFold active={active - (f.q.trim() ? 1 : 0)}>
        <fieldset className="dn-fieldset"><legend>Type</legend>
          <div className="dn-chips">{catalog.landscapeTypes.map(t => <Chip key={t} tone={t.toLowerCase()} pressed={f.types.includes(t)} count={typeCount(t)} onClick={() => update({ types: toggle(f.types, t) })}>{PLURAL[t] || t}</Chip>)}</div>
        </fieldset>
        <fieldset className="dn-fieldset"><legend>Expansion</legend>
          <div className="dn-chips">{expansions.map(e => <Chip key={e.name} pressed={f.expansions.includes(e.name)} count={expCount(e.name)} onClick={() => update({ expansions: toggle(f.expansions, e.name) })}><ExpansionBadge name={e.name} /></Chip>)}</div>
        </fieldset>
        <fieldset className="dn-fieldset"><legend>Recorded tags</legend>
          <details className="dn-mech" open={f.mechanics.length > 0 || undefined}>
            <summary>{f.mechanics.length ? `${f.mechanics.length} selected` : 'Choose tags'} · {tagCounts.length} tags recorded</summary>
            <label className="f" style={{ margin: '8px 0' }}>Find a tag <input type="search" value={mq} onChange={e => setMq(e.target.value)} placeholder="e.g. draw" autoComplete="off" /></label>
            <ul className="dn-mech-list">
              {tags.map(t => (
                <li key={t.id}><label><input type="checkbox" checked={f.mechanics.includes(t.id)} onChange={() => update({ mechanics: toggle(f.mechanics, t.id) })} />{humanize(t.id)} <span className="meta">{t.count}</span></label></li>
              ))}
              {!tags.length && <li className="meta">No recorded tag matches “{mq}”.</li>}
            </ul>
          </details>
          {f.mechanics.length > 1 && (
            <div className="dn-mode" role="group" aria-label="How to match the selected tags">
              <span className="meta">A landscape must be recorded with</span>
              <Chip pressed={f.mechanicMode === 'all'} onClick={() => update({ mechanicMode: 'all' })}>all selected</Chip>
              <Chip pressed={f.mechanicMode === 'any'} onClick={() => update({ mechanicMode: 'any' })}>any selected</Chip>
            </div>
          )}
        </fieldset>
        </FilterFold>
        <div className="controls" style={{ marginBottom: 0, marginTop: 6 }}>
          <button type="button" className="ghost" onClick={clear} disabled={!active}>Clear filters{active ? ` (${active})` : ''}</button>
          <button type="button" className="ghost" onClick={random} disabled={!rows.length}>Random landscape</button>
          <span className="meta" role="status" aria-live="polite">Showing <b>{rows.length}</b> of {catalog.landscapes.length} landscapes{active ? ' (filtered)' : ''}</span>
        </div>
      </form>

      {rows.length ? (
        <div className="tablewrap">
          <table className="plain dn-table dn-browse">
            <caption className="dn-sr">Landscapes matching the current filters</caption>
            <SortHeaders columns={COLUMNS} sort={f.sort} dir={f.dir} onSort={sortBy} />
            <tbody>{rows.map(l => (
              <tr key={l.id} {...rowLink(landscapeHref(l.id, qs))}>
                <td className="l"><ExpansionBadge name={l.expansion} size={18} /></td>
                <td className="l name"><a href={landscapeHref(l.id, qs)}>{l.name}</a>{f.text && f.q.trim() && !nameMatches(l, f.q) && <small className="meta dn-snippet">{textSnippet(l.text, f.q)}</small>}</td>
                <td className="l"><LandscapePill type={l.type} /></td>
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
              <tr key={a.id}>
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
