/* Hash routing, group-aware once more than one group exists:
   #/<route>[/<group>][/<arg>]. Admin manages the whole site, so its URLs never
   carry a group segment even when other routes do — #/admin/season/edit/5
   always means exactly that, not "group 'season', page edit/5". */
export const ROUTES = ['home', 'season', 'players', 'h2h', 'records', 'games', 'admin'];

export function parseHash(hash, allGroups) {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const route = parts[0] || 'home';
  const multi = route !== 'admin' && allGroups.length > 1;
  const gid = allGroups.length ? (multi ? (parts[1] || allGroups[0].id) : allGroups[0].id) : null;
  const arg = (multi ? parts.slice(2) : parts.slice(1)).join('/');
  return { route, gid, arg };
}

export function hashFor(route, gid, rest, allGroups) {
  const multi = allGroups.length > 1;
  return '#/' + route + (multi && gid ? '/' + encodeURIComponent(gid) : '') + (rest != null && rest !== '' ? '/' + rest : '');
}
