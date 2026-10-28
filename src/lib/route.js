/* Hash routing, group-aware once more than one group exists:
   #/<route>[/<group>][/<arg>]. Admin manages the whole site, so its URLs never
   carry a group segment even when other routes do — #/admin/season/edit/5
   always means exactly that, not "group 'season', page edit/5".
   The Dominion collection is site-wide too (the same boxes whichever friend group is playing), so it also
   never carries a group segment: #/dominion/cards/<card id>. */
export const ROUTES = ['home', 'season', 'players', 'h2h', 'records', 'games', 'night', 'dominion', 'admin'];
export const GLOBAL_ROUTES = ['dominion', 'admin'];   // not scoped to a group
// What a route is called on screen when that isn't just its capitalised id (the browser tab title uses this)
export const ROUTE_TITLES = { dominion: 'Collection', night: 'Game night' };

/* `lastGid` is the group the viewer last picked. It stands in whenever the URL doesn't name one — a site-wide page
   (Dominion/Admin) or a bare #/records — so leaving to such a page and coming back doesn't reset the group.
   `explicit` says the URL itself carried the group, i.e. the viewer chose it just now. */
export function parseHash(hash, allGroups, lastGid) {
  // a query ("?chart=sunburst") belongs to the page, not to a path segment: peel it off first and hand it to the page with `arg`
  const raw = hash.replace(/^#\/?/, ''), qi = raw.indexOf('?');
  const query = qi >= 0 ? raw.slice(qi) : '';
  const parts = (qi >= 0 ? raw.slice(0, qi) : raw).split('/');
  const route = parts[0] || 'home';
  const multi = !GLOBAL_ROUTES.includes(route) && allGroups.length > 1;
  const known = id => allGroups.some(g => g.id === id);
  const fallback = known(lastGid) ? lastGid : allGroups[0]?.id;
  let named = multi && parts[1] ? parts[1] : null;
  try { if (named) named = decodeURIComponent(named); } catch { /* malformed: treated as unknown */ }
  const explicit = known(named);
  const gid = allGroups.length ? (explicit ? named : fallback) : null;
  const arg = (multi ? parts.slice(2) : parts.slice(1)).join('/') + query;
  return { route, gid, arg, explicit };
}

export function hashFor(route, gid, rest, allGroups) {
  const multi = !GLOBAL_ROUTES.includes(route) && allGroups.length > 1;
  return '#/' + route + (multi && gid ? '/' + encodeURIComponent(gid) : '') + (rest != null && rest !== '' ? '/' + rest : '');
}
