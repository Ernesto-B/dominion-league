import * as Eng from './engine.js';

export const NOGROUP = '__nogroup__';  // bucket key when no groups are configured at all

/* Turns what loadData() fetched into the per-group computed models.

   Each group is its own completely independent league: a separate
   Eng.compute() call seeing only that group's players, games, and
   seasons, so a player in two groups gets two unrelated results
   rather than one shared Elo/stat track. RLS has already done the
   real access-control work (rows for groups this viewer can't see
   never arrive here at all) — this just organizes what came back. */
export function buildLeague(cfg, loaded, me) {
  const { rows, players, groups, seasons, enabledSets } = loaded;
  const allGroups = groups.map(g => ({ id: g.id, name: g.name }));
  const computedByGroup = {};
  if (!allGroups.length) {
    // No groups configured anywhere: the whole site is one league, same
    // as before groups existed at all.
    const c = Object.assign({}, cfg, { players: players.map(p => p.name), seasons, groups: undefined });
    const cd = Eng.compute(c, rows);
    cd.byName = Object.fromEntries(cd.players.map(p => [p.name, p]));
    computedByGroup[NOGROUP] = cd;
  } else {
    allGroups.forEach(g => {
      const groupPlayers = players.filter(p => (p.group_ids || []).includes(g.id)).map(p => p.name);
      const groupRows = rows.filter(r => r.group_id === g.id);
      const groupSeasons = seasons.filter(s => s.group === g.id);
      const c = Object.assign({}, cfg, { players: groupPlayers, seasons: groupSeasons, groups: undefined });
      const cd = Eng.compute(c, groupRows);
      cd.byName = Object.fromEntries(cd.players.map(p => [p.name, p]));
      computedByGroup[g.id] = cd;
    });
    const unassigned = rows.filter(r => r.group_id == null).length;
    if (unassigned && me.is_admin) {
      const firstD = computedByGroup[allGroups[0].id];
      firstD.warnings.push(`${unassigned} game${unassigned === 1 ? '' : 's'} logged before groups existed (or genuinely spanning groups) ${unassigned === 1 ? 'has' : 'have'} no group assigned — only visible to you as admin, and not counted toward anyone's standings until fixed via Edit Game.`);
    }
  }
  return {
    allGroups,
    computedByGroup,
    rawPlayers: players,          // every player row this viewer can see — for the Admin page
    rawSeasons: seasons,          // every season row this viewer can see, unparsed — for the Admin page
    playerIdByName: new Map(players.map(p => [p.name, p.id])),   // name -> uuid, for admin writes
    seasonDbIds: seasons.map(s => s._id),                        // rawSeasons[i] -> seasons.id, for admin edit links
    enabledSets: new Set(enabledSets),                           // sets the admin has marked as owned
  };
}

// The computed model for the group being viewed. Pages read this as `D` and never
// filter by group themselves — it's already scoped (see buildLeague).
export function pickD(league, gid) {
  const { computedByGroup, allGroups } = league;
  return computedByGroup[gid == null ? NOGROUP : gid]
    || computedByGroup[NOGROUP] || computedByGroup[allGroups[0] && allGroups[0].id] || Object.values(computedByGroup)[0];
}
