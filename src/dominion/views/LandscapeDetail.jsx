import { useCatalog } from '../CatalogContext.jsx';
import { dominionHref, landscapeHref } from '../links.js';
import { presetLandscapeFilters } from '../filterStore.js';
import { MECHANICS_NOTE, humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, Section, Stat, ExternalLink, statusLabel } from '../components/bits.jsx';

export default function LandscapeDetail({ id }) {
  const { catalog } = useCatalog();
  const l = catalog.landscapesById.get(id);
  if (!l) return (
    <>
      <h1>Landscape not found</h1>
      <EmptyState>There’s no landscape with that id in the collection.</EmptyState>
      <p><a href={dominionHref('landscapes')}>← Back to landscapes</a></p>
    </>
  );
  const mine = new Set(l.mechanicIds);
  const related = catalog.landscapes.filter(o => o.id !== l.id).map(o => ({ o, shared: o.mechanicIds.filter(t => mine.has(t)) }))
    .filter(x => x.shared.length).sort((a, b) => b.shared.length - a.shared.length || a.o.name.localeCompare(b.o.name)).slice(0, 8);

  return (
    <>
      <p style={{ margin: '0 0 12px' }}><a href={dominionHref('landscapes')}>← All landscapes</a></p>
      <div className="head">
        <div>
          <h1>{l.name}</h1>
          <p className="lede dn-line"><span className="pill">{l.type}</span><span className="dn-sep" aria-hidden="true">·</span><ExpansionBadge name={l.expansion} /></p>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Landscape facts">
        <Stat value={l.type} label="landscape type" />
        <Stat value={l.copies} label={l.copies === 1 ? 'physical card' : 'physical cards'} />
        {l.trigger && <Stat value={humanize(l.trigger)} label="when it applies" />}
      </div>

      <div className="grid2">
        <Section title="Recorded tags" id="ld-tags">
          <div className="builder">
            {l.mechanicIds.length ? (
              <ul className="dn-mech-detail">{l.mechanicIds.map(t => {
                const def = catalog.taxonomy.get(t);   // only a few landscape tags exist in the Kingdom taxonomy
                return (
                  <li key={t}>
                    <a href={dominionHref('landscapes')} onClick={() => presetLandscapeFilters({ mechanics: [t] })} title="See every landscape recorded with this tag"><b>{humanize(t)}</b></a>
                    {def && <span className="meta dn-def">{def.definition}</span>}
                  </li>
                );
              })}</ul>
            ) : <p style={{ margin: 0 }}>No tags are recorded for this landscape yet.</p>}
            {l.effectCategories.length > 0 && <p className="meta" style={{ marginBottom: 0 }}>Effect categories: {l.effectCategories.map(humanize).join(' · ')}</p>}
            <p className="note" style={{ marginBottom: 0 }}>{MECHANICS_NOTE}</p>
          </div>
        </Section>

        <Section title="Verification" id="ld-verify">
          <div className="builder">
            <dl className="dn-dl">
              <dt>Status</dt><dd>{statusLabel(l.verification)}</dd>
              {l.scope && <><dt>Classification</dt><dd>{statusLabel(l.scope)}</dd></>}
              {l.sourceUrl && <><dt>Source</dt><dd><ExternalLink href={l.sourceUrl}>Open reference ↗</ExternalLink></dd></>}
            </dl>
          </div>
        </Section>
      </div>

      {l.note && (
        <Section title="Classification note" id="ld-note">
          <div className="builder"><p style={{ margin: 0 }}>{l.note}</p><p className="note" style={{ marginBottom: 0 }}>A short summary written for this collection’s classification — not the official card text.</p></div>
        </Section>
      )}

      {related.length > 0 && (
        <Section title="Landscapes recorded with the same tags" id="ld-related">
          <div className="tablewrap"><table className="plain dn-table">
            <caption className="dn-sr">Landscapes that share recorded tags with {l.name}</caption>
            <thead><tr><th className="l" scope="col">Landscape</th><th className="l" scope="col">Type</th><th className="l" scope="col">Recorded in common</th></tr></thead>
            <tbody>{related.map(({ o, shared }) => (
              <tr key={o.id}><td className="l name"><a href={landscapeHref(o.id)}>{o.name}</a></td><td className="l"><span className="pill">{o.type}</span></td><td className="l">{shared.map(humanize).join(', ')}</td></tr>
            ))}</tbody>
          </table></div>
        </Section>
      )}
      <p className="note">Card text and artwork aren’t part of this collection data, so they aren’t shown here.</p>
    </>
  );
}
