import { useCatalog } from '../CatalogContext.jsx';
import { dominionHref } from '../links.js';
import { humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { CardText, ExpansionBadge, Section, Stat } from '../components/bits.jsx';

// A Renaissance Artifact: not a Kingdom card and not a landscape, so it has its own small page (reached from the
// Artifacts lists on the Overview and the Landscapes page).
export default function ArtifactDetail({ id }) {
  const { catalog } = useCatalog();
  const a = catalog.artifactsById.get(id);
  if (!a) return (
    <>
      <h1>Artifact not found</h1>
      <EmptyState>There’s no Artifact with that id in the collection.</EmptyState>
      <p><a href={dominionHref('landscapes')}>← Back to landscapes</a></p>
    </>
  );
  return (
    <>
      <p style={{ margin: '0 0 12px' }}><a href={dominionHref('landscapes')}>← Landscapes and Artifacts</a></p>
      <div className="head">
        <div>
          <h1>{a.name}</h1>
          <p className="lede dn-line"><span className="pill">Artifact</span><span className="dn-sep" aria-hidden="true">·</span><ExpansionBadge name={a.expansion} /></p>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Artifact facts">
        <Stat value={a.copies} label={a.copies === 1 ? 'physical card' : 'physical cards'} />
        {a.behaviour && <Stat value={humanize(a.behaviour)} label="how it’s held" />}
      </div>

      <Section title="Card text" id="ar-text">
        <div className="builder"><CardText text={a.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>
      </Section>

      {a.tags.length > 0 && (
        <Section title="Recorded tags" id="ar-tags">
          <div className="builder"><ul className="dn-plain-list">{a.tags.map(t => <li key={t}><b>{humanize(t)}</b></li>)}</ul></div>
        </Section>
      )}

      <p className="note">Artifacts are tracked on their own — they are neither Kingdom cards nor landscapes. <a href={dominionHref('landscapes')}>See them with the landscapes</a>.</p>
    </>
  );
}
