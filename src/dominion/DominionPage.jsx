import { useEffect, useRef } from 'react';
import { DominionData } from './CatalogContext.jsx';
import { VIEWS, parseDominionArg, tabFor } from './links.js';
import { PageShortcuts } from '../components/Shortcuts.jsx';
import { EmptyState } from './components/States.jsx';
import Overview from './views/Overview.jsx';
import Cards from './views/Cards.jsx';
import CardDetail from './views/CardDetail.jsx';
import Landscapes from './views/Landscapes.jsx';
import LandscapeDetail from './views/LandscapeDetail.jsx';
import Randomizer from './views/Randomizer.jsx';
import Insights from './views/Insights.jsx';
import ArtifactDetail from './views/ArtifactDetail.jsx';

/* The Collection's five sections as a real tab bar, not chips: big enough to find, unlike the filter chips below it, a line saying what each one is (on a wide screen), and the open one
   underlined. It stays in view while a long list scrolls. On a phone it is one row that scrolls sideways, with the open tab brought into view. */
export function DominionNav({ active }) {
  const ref = useRef(null);
  useEffect(() => {
    const on = ref.current && ref.current.querySelector('[aria-current=true]');
    if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);
  return (
    // a landmark div, not <nav>: the site's header styles are keyed on the nav TAG and would restyle these links
    <div className="dn-tabbar" role="navigation" aria-label="Collection sections" ref={ref}>
      <PageShortcuts bindings={VIEWS.map((v, k) => ({ key: String(k + 1), label: v.label, run: () => { window.location.hash = v.href; } }))} />
      {VIEWS.map(v => <a key={v.view} href={v.href} aria-current={v.view === active ? 'true' : undefined}><b>{v.label}</b><small>{v.hint}</small></a>)}
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
