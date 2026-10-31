import { useCatalog } from '../CatalogContext.jsx';
import { dominionHref, landscapeHref, landscapesFilterHref } from '../links.js';
import { DEFAULT_LANDSCAPE_FILTERS, browseLandscapes, landscapeFiltersFromQuery, landscapeFiltersToQuery, neighbors, pickRandom } from '../filters.js';
import ItemNav from '../components/ItemNav.jsx';
import PlayHistory from '../components/PlayHistory.jsx';
import { useLeagueGames } from '../useLeagueGames.js';
import { PLURAL, humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, LandscapePill, Section, Stat, CardText } from '../components/bits.jsx';
import CostIcons from '../components/Cost.jsx';
import { formatCost } from '../model.js';

export default function LandscapeDetail({ id, query = '' }) {
  const { catalog } = useCatalog();
  const lg = useLeagueGames();
  const l = catalog.landscapesById.get(id);
  if (!l) return (
    <>
      <h1>Landscape not found</h1>
      <EmptyState>There’s no landscape with that id in the collection.</EmptyState>
      <p><a href={dominionHref('landscapes', null, query)}>← Back to landscapes</a></p>
    </>
  );
  const filters = landscapeFiltersFromQuery(query);
  let list = browseLandscapes(catalog.landscapes, filters), qs = landscapeFiltersToQuery(filters);
  if (!list.some(o => o.id === l.id)) { list = browseLandscapes(catalog.landscapes, DEFAULT_LANDSCAPE_FILTERS); qs = ''; }
  const nav = neighbors(list, l.id);
  const random = () => { const o = pickRandom(list, l.id); if (o) window.location.hash = landscapeHref(o.id, qs); };
  const mine = new Set(l.mechanicIds);
  const related = catalog.landscapes.filter(o => o.id !== l.id).map(o => ({ o, shared: o.mechanicIds.filter(t => mine.has(t)) }))
    .filter(x => x.shared.length).sort((a, b) => b.shared.length - a.shared.length || a.o.name.localeCompare(b.o.name)).slice(0, 8);

  return (
    <>
      <ItemNav backHref={dominionHref('landscapes', null, qs)} backLabel="← All landscapes" nav={nav} hrefFor={o => landscapeHref(o.id, qs)} onRandom={random} randomLabel="Random landscape" />
      <div className="head">
        <div>
          <h1>{l.name}</h1>
          <p className="lede dn-line"><LandscapePill type={l.type} /><span className="dn-sep" aria-hidden="true">·</span><ExpansionBadge name={l.expansion} /></p>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Landscape facts">
        <Stat value={l.type} label="landscape type" />
        {l.coins != null
          ? <Stat value={<CostIcons coins={l.coins} debt={l.debt} size={40} />} label="cost" title={`Printed cost: ${formatCost(l)}`} />
          : <Stat value="None" label="cost" title={`${PLURAL[l.type] || l.type} have no cost`} />}
        <Stat value={l.copies} label={l.copies === 1 ? 'physical card' : 'physical cards'} />
        {l.trigger && <Stat value={humanize(l.trigger)} label="when it applies" />}
        {lg && lg.stats && <Stat value={(lg.stats.landscapes.get(l.id) || { games: 0 }).games} label="logged games" title="Logged games this landscape was in" />}
      </div>

      <Section title="Card text" id="ld-text">
        <div className="builder"><CardText text={l.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>
      </Section>

      {lg && lg.stats && (
        <Section title="In our games" id="ld-plays">
          <div className="builder"><PlayHistory entry={lg.stats.landscapes.get(l.id)} lg={lg} /></div>
        </Section>
      )}

      <Section title="Recorded tags" id="ld-tags">
        <div className="builder">
          {l.mechanicIds.length ? (
            <ul className="dn-mech-detail">{l.mechanicIds.map(t => {
              const def = catalog.taxonomy.get(t);   // only a few landscape tags exist in the Kingdom taxonomy
              return (
                <li key={t}>
                  <a href={landscapesFilterHref({ mechanics: [t] })} title="See every landscape recorded with this tag"><b>{humanize(t)}</b></a>
                  {def && <span className="meta dn-def">{def.definition}</span>}
                </li>
              );
            })}</ul>
          ) : <p style={{ margin: 0 }}>No tags are recorded for this landscape yet.</p>}
        </div>
      </Section>

      {l.note && (
        <Section title="Classification note" id="ld-note">
          <div className="builder"><p style={{ margin: 0 }}>{l.note}</p></div>
        </Section>
      )}

      {related.length > 0 && (
        <Section title="Landscapes recorded with the same tags" id="ld-related">
          <div className="tablewrap"><table className="plain dn-table">
            <caption className="dn-sr">Landscapes that share recorded tags with {l.name}</caption>
            <thead><tr><th className="l" scope="col">Landscape</th><th className="l" scope="col">Type</th><th className="l" scope="col">Recorded in common</th></tr></thead>
            <tbody>{related.map(({ o, shared }) => (
              <tr key={o.id}><td className="l name"><a href={landscapeHref(o.id)}>{o.name}</a></td><td className="l"><LandscapePill type={o.type} /></td><td className="l">{shared.map(humanize).join(', ')}</td></tr>
            ))}</tbody>
          </table></div>
        </Section>
      )}
    </>
  );
}
