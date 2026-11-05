/* The Player page's tabs: Overview (the tiles and a shelf of badges), Badges (the whole collection), Cards (the kingdom cards and landscapes they have played) and History (rating chart, matchups, games).
   The tab lives in the address (#/players/<group>/<name>?tab=badges), so Back, a bookmark and a shared link all land on the same tab. A link to one badge
   (?badge=<id>) always opens the Badges tab. Pure. */
export const PROFILE_TABS = [['overview', 'Overview'], ['badges', 'Badges'], ['cards', 'Cards'], ['history', 'History']];

export function tabFromQuery(query) {
  const q = new URLSearchParams(query || '');
  if (q.get('badge')) return 'badges';
  const t = q.get('tab');
  return PROFILE_TABS.some(([id]) => id === t) ? t : 'overview';
}
// the query for a tab (nothing for the default one)
export const tabQuery = (tab, extra = {}) => {
  const q = new URLSearchParams(extra);
  if (tab && tab !== 'overview') q.set('tab', tab);
  const s = q.toString();
  return s ? '?' + s : '';
};
