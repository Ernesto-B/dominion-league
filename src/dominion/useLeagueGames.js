import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import { useCatalog } from './CatalogContext.jsx';
import { playStats } from './playStats.js';

/* The viewer's league as the Collection needs it: the games of the group they last had selected (each with its kingdom),
   and the counts worked out from them. null outside the league (the unit tests render the views without one), and `stats`
   is null when no game in this group has a kingdom logged yet — then the Collection shows no play data at all rather than a
   column of zeros. */
export function useLeagueGames() {
  const page = usePage();
  const { catalog } = useCatalog();
  return useMemo(() => {
    if (!page || !page.D || !page.D.games) return null;
    const stats = playStats(catalog, page.D.games, page.me ? page.me.name : null);
    return {
      games: page.D.games, gid: page.gid, hashFor: page.hashFor, me: page.me ? page.me.name : null, canLog: !!(page.me && page.me.is_admin),
      groupName: (page.allGroups.find(g => g.id === page.gid) || {}).name || null, multiGroup: page.allGroups.length > 1,
      stats: stats.withKingdom ? stats : null, totalGames: stats.totalGames, withKingdom: stats.withKingdom,
    };
  }, [page, catalog]);
}
