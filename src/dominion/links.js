/* URLs for the Dominion section: #/dominion[/<view>[/<id>]]. Ids contain ':' and '_' (e.g. "intrigue:courtyard",
   "menagerie:way:way_of_the_frog"), so they are encoded on the way out and decoded on the way in. */
import { DEFAULT_CARD_FILTERS, DEFAULT_LANDSCAPE_FILTERS, cardFiltersToQuery, landscapeFiltersToQuery } from './filters.js';

// `query` is the filter state ("?type=Attack"), carried through to a card's page so Previous/Next and "back to the list" keep it
export const dominionHref = (view = '', id = null, query = '') => '#/dominion' + (view ? '/' + view : '') + (id != null ? '/' + encodeURIComponent(id) : '') + query;
export const cardHref = (id, query = '') => dominionHref('cards', id, query);
export const landscapeHref = (id, query = '') => dominionHref('landscapes', id, query);
// the card comparison: #/dominion/compare?cards=<id>,<id>… (at most MAX_COMPARE; ids are encoded, so a ',' only ever separates)
export const MAX_COMPARE = 4;
export const compareHref = (ids = []) => dominionHref('compare') + (ids.length ? '?cards=' + ids.map(encodeURIComponent).join(',') : '');
export function compareIdsFromQuery(query = '') {
  const m = /[?&]cards=([^&]*)/.exec(query);
  if (!m || !m[1]) return [];
  const out = [];
  for (const part of m[1].split(',')) {
    let id; try { id = decodeURIComponent(part); } catch { continue; }
    if (id && !out.includes(id)) out.push(id);
  }
  return out.slice(0, MAX_COMPARE);
}
export const artifactHref = id => dominionHref('artifacts', id);
// the browser, already filtered: cardsFilterHref({ types: ['Attack'] })
export const cardsFilterHref = patch => dominionHref('cards', null, cardFiltersToQuery({ ...DEFAULT_CARD_FILTERS, ...patch }));
export const landscapesFilterHref = patch => dominionHref('landscapes', null, landscapeFiltersToQuery({ ...DEFAULT_LANDSCAPE_FILTERS, ...patch }));

export const VIEWS = [
  { view: 'randomizer', label: 'Randomizer', hint: 'Roll a kingdom', href: dominionHref('randomizer') },   // the most used tab, so the bare #/dominion opens it too
  { view: 'cards', label: 'Kingdom cards', hint: 'Browse every card', href: dominionHref('cards') },
  { view: 'landscapes', label: 'Landscapes', hint: 'Events, Ways, Projects…', href: dominionHref('landscapes') },
  { view: 'overview', label: 'Overview', hint: 'At a glance', href: dominionHref('overview') },
  { view: 'insights', label: 'Insights', hint: 'What we play most', href: dominionHref('insights') },
];

// `arg` is everything after "dominion/" in the hash: '' | 'cards' | 'cards/<id>' | 'landscapes' | 'landscapes/<id>' (old: 'stats' → Overview)
export function parseDominionArg(arg) {
  const [path, ...rest] = String(arg || '').split('?');   // an id never contains a raw '?', it is encoded
  const query = rest.length ? '?' + rest.join('?') : '';
  const r = parsePath(path, query);
  return { ...r, query };
}
function parsePath(path, query = '') {
  const parts = path.split('/');
  // a bare #/dominion opens the Randomizer (its roll may sit in the query); only the old chart links (#/dominion?chart=sunburst) were the Overview
  const view = parts[0] || (/[?&]chart=/.test(query) ? 'overview' : 'randomizer');
  let id = null;
  if (parts.length > 1 && parts.slice(1).join('/')) {
    try { id = decodeURIComponent(parts.slice(1).join('/')); } catch { return { view: 'notfound', id: null }; }
  }
  // the Statistics tab was merged into the Overview; keep old #/dominion/stats links working
  if (view === 'overview' || view === 'stats') return id == null ? { view: 'overview', id: null } : { view: 'notfound', id: null };
  if (view === 'cards') return id == null ? { view: 'cards', id: null } : { view: 'card', id };
  if (view === 'landscapes') return id == null ? { view: 'landscapes', id: null } : { view: 'landscape', id };
  if (view === 'artifacts') return id == null ? { view: 'notfound', id: null } : { view: 'artifact', id };   // there is no list of Artifacts: they sit on the Landscapes page
  if (view === 'compare') return id == null ? { view: 'compare', id: null } : { view: 'notfound', id: null };
  if (view === 'insights') return id == null ? { view: 'insights', id: null } : { view: 'notfound', id: null };
  if (view === 'randomizer') return id == null ? { view: 'randomizer', id: null } : { view: 'notfound', id: null };
  return { view: 'notfound', id: null };
}
// which top-level tab a view belongs to (a card's detail page lives under "Kingdom cards")
export const tabFor = view => ({ compare: 'cards', card: 'cards', landscape: 'landscapes', artifact: 'landscapes' }[view] || view);
