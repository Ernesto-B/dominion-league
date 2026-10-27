/* URLs for the Dominion section: #/dominion[/<view>[/<id>]]. Ids contain ':' and '_' (e.g. "intrigue:courtyard",
   "menagerie:way:way_of_the_frog"), so they are encoded on the way out and decoded on the way in. */
export const dominionHref = (view = '', id = null) => '#/dominion' + (view ? '/' + view : '') + (id != null ? '/' + encodeURIComponent(id) : '');
export const cardHref = id => dominionHref('cards', id);
export const landscapeHref = id => dominionHref('landscapes', id);

export const VIEWS = [
  { view: 'overview', label: 'Overview', href: dominionHref() },
  { view: 'cards', label: 'Kingdom cards', href: dominionHref('cards') },
  { view: 'landscapes', label: 'Landscapes', href: dominionHref('landscapes') },
];

// `arg` is everything after "dominion/" in the hash: '' | 'cards' | 'cards/<id>' | 'landscapes' | 'landscapes/<id>' (old: 'stats' → Overview)
export function parseDominionArg(arg) {
  const parts = String(arg || '').split('/');
  const view = parts[0] || 'overview';
  let id = null;
  if (parts.length > 1 && parts.slice(1).join('/')) {
    try { id = decodeURIComponent(parts.slice(1).join('/')); } catch { return { view: 'notfound', id: null }; }
  }
  // the Statistics tab was merged into the Overview; keep old #/dominion/stats links working
  if (view === 'overview' || view === 'stats') return id == null ? { view: 'overview', id: null } : { view: 'notfound', id: null };
  if (view === 'cards') return id == null ? { view: 'cards', id: null } : { view: 'card', id };
  if (view === 'landscapes') return id == null ? { view: 'landscapes', id: null } : { view: 'landscape', id };
  return { view: 'notfound', id: null };
}
// which top-level tab a view belongs to (a card's detail page lives under "Kingdom cards")
export const tabFor = view => ({ card: 'cards', landscape: 'landscapes' }[view] || view);
