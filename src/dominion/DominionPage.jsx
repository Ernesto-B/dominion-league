import { DominionData } from './CatalogContext.jsx';
import { VIEWS, parseDominionArg, tabFor } from './links.js';
import { EmptyState } from './components/States.jsx';
import Overview from './views/Overview.jsx';
import Cards from './views/Cards.jsx';
import CardDetail from './views/CardDetail.jsx';
import Landscapes from './views/Landscapes.jsx';
import LandscapeDetail from './views/LandscapeDetail.jsx';
import Randomizer from './views/Randomizer.jsx';
import Insights from './views/Insights.jsx';
import ArtifactDetail from './views/ArtifactDetail.jsx';

export function DominionNav({ active }) {
  return (
    // a landmark div, not <nav>: the site's header styles are keyed on the nav TAG and would restyle these links
    <div className="pills dn-tabs" role="navigation" aria-label="Collection sections">
      {VIEWS.map(v => <a key={v.view} href={v.href} aria-current={v.view === active ? 'true' : undefined}>{v.label}</a>)}
    </div>
  );
}

// The view for a route. Needs a catalog in context (see CatalogProvider / DominionData).
export function DominionView({ arg }) {
  const r = parseDominionArg(arg);
  switch (r.view) {
    case 'overview': return <Overview query={r.query} />;
    case 'cards': return <Cards query={r.query} />;
    case 'card': return <CardDetail id={r.id} query={r.query} />;
    case 'landscapes': return <Landscapes query={r.query} />;
    case 'landscape': return <LandscapeDetail id={r.id} query={r.query} />;
    case 'randomizer': return <Randomizer query={r.query} />;
    case 'insights': return <Insights />;
    case 'artifact': return <ArtifactDetail id={r.id} />;
    default: return <><h1>Not found</h1><EmptyState>There’s no such page in the collection.</EmptyState></>;
  }
}

// Navigation always shows (even while loading or after an error); the data loads once and is shared by every view.
export default function DominionPage({ arg, client }) {
  const r = parseDominionArg(arg);
  return (
    <>
      <DominionNav active={tabFor(r.view)} />
      <DominionData client={client}><DominionView arg={arg} /></DominionData>
    </>
  );
}
