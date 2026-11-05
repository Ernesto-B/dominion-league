/* The pure part of the group merge (scripts/merge-groups.mjs): given the league's rows, work out what merging group `from` INTO group `into` would do, and the SQL that does it.
   Nothing here touches a database. Decisions:
     games     every game of `from` moves to `into`
     players   anyone in `from` is put in `into` instead (someone in both just keeps one entry); a name that two different people would share is a blocker
     seasons   a `from` season that overlaps an `into` season is FOLDED into it (the earlier start, the later end, the larger game target; playoffs off unless keepSpots),
               one that overlaps nothing just moves over; a season that overlaps several, or two champions who differ, are blockers (settle those by hand first)
     groups    `from` is removed last, once nothing points at it (the Admin page's "delete group" would delete its games: never use that for a merge)
   Returns { blockers, notes, sql } — sql is null while there are blockers. */
const DAY = 86400000;
const day = s => Date.UTC(+String(s).slice(0, 4), +String(s).slice(5, 7) - 1, +String(s).slice(8, 10)) / DAY;
const iso = d => new Date(d * DAY).toISOString().slice(0, 10);
const lit = v => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const endOf = s => day(s.start_date) + 7 * Number(s.weeks) - 1;

export function planMerge(data, { from, into, keepSpots = false }) {
  const blockers = [], notes = [];
  const groups = data.groups || [], players = data.players || [], seasons = data.seasons || [], games = data.games || [];
  if (!from || !into || from === into) return { blockers: ['Name two different groups: --from <id> --into <id>.'], notes, sql: null };
  const gf = groups.find(g => g.id === from), gi = groups.find(g => g.id === into);
  if (!gf) blockers.push(`No group with id "${from}".`);
  if (!gi) blockers.push(`No group with id "${into}".`);
  if (blockers.length) return { blockers, notes, sql: null };

  // ---- players: the same name for two different people would become one entry in the engine
  const inF = p => (p.group_ids || []).includes(from), inI = p => (p.group_ids || []).includes(into);
  const members = players.filter(p => inF(p) || inI(p));
  const byName = new Map();
  members.forEach(p => { const k = p.name.trim().toLowerCase(); byName.set(k, [...(byName.get(k) || []), p]); });
  byName.forEach(list => { if (list.length > 1) blockers.push(`Two different players are both called "${list[0].name}" (${list.map(p => p.id).join(', ')}). Rename one before merging.`); });
  const both = players.filter(p => inF(p) && inI(p)), onlyF = players.filter(p => inF(p) && !inI(p));
  notes.push(`${members.length} players will be in ${gi.name || into}: ${onlyF.length} from ${gf.name || from} move over, ${both.length} are already in both.`);

  // ---- games
  const moved = games.filter(g => g.group_id === from).length;
  notes.push(`${moved} game${moved === 1 ? '' : 's'} move from ${gf.name || from} to ${gi.name || into} (${games.filter(g => g.group_id === into).length} already there).`);

  // ---- seasons
  const sf = seasons.filter(s => s.group_id === from).sort((a, b) => day(a.start_date) - day(b.start_date)), si = seasons.filter(s => s.group_id === into);
  const stmts = [], folded = new Map();   // into-season id -> its updated fields
  for (const s of sf) {
    const hits = si.filter(t => day(s.start_date) <= endOf(t) && day(t.start_date) <= endOf(s));
    if (hits.length > 1) { blockers.push(`"${s.name}" overlaps more than one season in ${gi.name || into}. Settle those seasons by hand first.`); continue; }
    if (!hits.length) { stmts.push(`update public.seasons set group_id = ${lit(into)} where id = ${lit(s.id)};`); notes.push(`Season "${s.name}" overlaps nothing in ${gi.name || into}: it moves over as it is.`); continue; }
    const t = hits[0], cur = folded.get(t.id) || { ...t };
    if (folded.has(t.id)) { blockers.push(`Two seasons of ${gf.name || from} overlap "${t.name}". Settle them by hand first.`); continue; }
    if (s.champion_player_id && cur.champion_player_id && s.champion_player_id !== cur.champion_player_id) { blockers.push(`"${s.name}" and "${t.name}" both have a champion, and they differ.`); continue; }
    const start = Math.min(day(s.start_date), day(t.start_date)), end = Math.max(endOf(s), endOf(t));
    const upd = {
      start_date: iso(start), weeks: Math.ceil((end - start + 1) / 7), target_games: Math.max(Number(s.target_games), Number(t.target_games)),
      playoff_spots: keepSpots ? Number(t.playoff_spots) : 0, champion_player_id: cur.champion_player_id || s.champion_player_id || null,
    };
    folded.set(t.id, { ...cur, ...upd });
    stmts.push(`update public.seasons set start_date = ${lit(upd.start_date)}, weeks = ${upd.weeks}, target_games = ${upd.target_games}, playoff_spots = ${upd.playoff_spots}, champion_player_id = ${upd.champion_player_id ? lit(upd.champion_player_id) : 'null'} where id = ${lit(t.id)};`);
    stmts.push(`delete from public.seasons where id = ${lit(s.id)};`);
    notes.push(`Season "${s.name}" folds into "${t.name}": ${upd.start_date} for ${upd.weeks} weeks (it was ${t.start_date} for ${t.weeks}), target ${upd.target_games} games, ${upd.playoff_spots ? upd.playoff_spots + ' playoff spots' : 'no playoffs: the top of the table wins'}.`);
  }
  if (!sf.length) notes.push(`${gf.name || from} has no seasons.`);
  if (blockers.length) return { blockers, notes, sql: null };

  const sql = [
    `-- Merge group ${from} into ${into}. Generated by scripts/merge-groups.mjs.`,
    'begin;',
    `update public.games set group_id = ${lit(into)} where group_id = ${lit(from)};`,
    `update public.players set group_ids = (select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(group_ids, ${lit(from)}, ${lit(into)})) x) where ${lit(from)} = any(group_ids);`,
    `update public.players set group_id = ${lit(into)} where group_id = ${lit(from)};`,
    ...stmts,
    `delete from public.groups where id = ${lit(from)};`,
    'commit;',
  ].join('\n') + '\n';
  return { blockers, notes, sql };
}

// what the database should hold after the merge, for a check once it has run
export function expectedAfter(data, { from, into }) {
  const games = (data.games || []).filter(g => g.group_id === from || g.group_id === into).length;
  const members = (data.players || []).filter(p => (p.group_ids || []).includes(from) || (p.group_ids || []).includes(into)).length;
  return { games, members };
}
