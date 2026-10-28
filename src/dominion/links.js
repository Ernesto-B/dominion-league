/* URLs for the Dominion section: #/dominion[/<view>[/<id>]]. Ids contain ':' and '_' (e.g. "intrigue:courtyard",
   "menagerie:way:way_of_the_frog"), so they are encoded on the way out and decoded on the way in. */
import { DEFAULT_CARD_FILTERS, DEFAULT_LANDSCAPE_FILTERS, cardFiltersToQuery, landscapeFiltersToQuery } from './filters.js';

// `query` is the filter state ("?type=Attack"), carried through to a card's page so Previous/Next and "back to the list" keep it
export const dominionHref = (view = '', id = null, query = '') => '#/dominion' + (view ? '/' + view : '') + (id != null ? '/' + encodeURIComponent(id) : '') + query;
export const cardHref = (id, query = '') => dominionHref('cards', id, query);
export const landscapeHref = (id, query = '') => dominionHref('landscapes', id, query);
export const artifactHref = id => dominionHref('artifacts', id);
// the browser, already filtered: cardsFilterHref({ types: ['Attack'] })
export const cardsFilterHref = patch => dominionHref('cards', null, cardFiltersToQuery({ ...DEFAULT_CARD_FILTERS, ...patch }));
export const landscapesFilterHref = patch => dominionHref('landscapes', null, landscapeFiltersToQuery({ ...DEFAULT_LANDSCAPE_FILTERS, ...patch }));

export const VIEWS = [
  { view: 'overview', label: 'Overview', href: dominionHref() },
  { view: 'cards', label: 'Kingdom cards', href: dominionHref('cards') },
  { view: 'landscapes', label: 'Landscapes', href: dominionHref('landscapes') },
  { view: 'randomizer', label: 'Randomizer', href: dominionHref('randomizer') },
  { view: 'insights', label: 'Insights', href: dominionHref('insights') },
];

// `arg` is everything after "dominion/" in the hash: '' | 'cards' | 'cards/<id>' | 'landscapes' | 'landscapes/<id>' (old: 'stats' → Overview)
export function parseDominionArg(arg) {
  const [path, ...rest] = String(arg || '').split('?');   // an id never contains a raw '?', it is encoded
  const query = rest.length ? '?' + rest.join('?') : '';
  return { ...parsePath(path), query };
}
function parsePath(path) {
  const parts = path.split('/');
  const view = parts[0] || 'overview';
  let id = null;
  if (parts.length > 1 && parts.slice(1).join('/')) {
    try { id = decodeURIComponent(parts.slice(1).join('/')); } catch { return { view: 'notfound', id: null }; }
  }
  // the Statistics tab was merged into the Overview; keep old #/dominion/stats links working
  if (view === 'overview' || view === 'stats') return id == null ? { view: 'overview', id: null } : { view: 'notfound', id: null };
  if (view === 'cards') return id == null ? { view: 'cards', id: null } : { view: 'card', id };
  if (view === 'landscapes') return id == null ? { view: 'landscapes', id: null } : { view: 'landscape', id };
  if (view === 'artifacts') return id == null ? { view: 'notfound', id: null } : { view: 'artifact', id };   // there is no list of Artifacts: they sit on the Landscapes page
  if (view === 'insights') return id == null ? { view: 'insights', id: null } : { view: 'notfound', id: null };
  if (view === 'randomizer') return id == null ? { view: 'randomizer', id: null } : { view: 'notfound', id: null };
  return { view: 'notfound', id: null };
}
// which top-level tab a view belongs to (a card's detail page lives under "Kingdom cards")
export const tabFor = view => ({ card: 'cards', landscape: 'landscapes', artifact: 'landscapes' }[view] || view);
