import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import { useCatalog } from './CatalogContext.jsx';
import { playStats } from './playStats.js';

/* The viewer's league as the Collection needs it: the games of the group they last had selected (each with its kingdom),
   and the counts worked out from them. null outside the league (the unit tests render the views without one), and `stats`
   is null when no game in this group has a kingdom logged yet — then the Collection shows no play data at all rather than a
   column of zeros.
   `who` (a player's name) narrows the counts to the games that player sat at, and `mine` in each entry becomes THEIR record; a name that
   isn't a player of the group is ignored. `players` lists everyone who has sat at a game with a kingdom logged, for the picker. */
export function useLeagueGames(who = '') {
  const page = usePage();
  const { catalog } = useCatalog();
  return useMemo(() => {
    if (!page || !page.D || !page.D.games) return null;
    const games = page.D.games;
    const groupStats = playStats(catalog, games, page.me ? page.me.name : null);
    const players = [...new Set(games.filter(g => (g.kingdom || []).length).flatMap(g => g.names || []))].sort((a, b) => a.localeCompare(b));
    const by = players.includes(who) ? who : '';
    const stats = by ? playStats(catalog, games.filter(g => g.places && g.places[by] != null), by) : groupStats;
    return {
      games, gid: page.gid, hashFor: page.hashFor, me: page.me ? page.me.name : null, canLog: !!(page.me && page.me.is_admin),
      groupName: (page.allGroups.find(g => g.id === page.gid) || {}).name || null, multiGroup: page.allGroups.length > 1,
      stats: groupStats.withKingdom ? stats : null, totalGames: stats.totalGames, withKingdom: stats.withKingdom,
      who: by, players,
    };
  }, [page, catalog, who]);
}
