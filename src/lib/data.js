import { sb } from './supabase.js';
import { SET_NAMES } from './sets.js';

export async function fetchConfig() {
  const res = await fetch(import.meta.env.BASE_URL + 'data/config.json?v=' + Date.now());
  if (!res.ok) throw new Error('Could not load data/config.json (' + res.status + ').');
  return res.json();
}

export async function loadData() {
  // PostgREST caps a response at 1000 rows by default, and game_results
  // has one row per player per game, so page through it (and games) rather
  // than silently truncating once the league grows past that.
  const fetchAll = async (table, order) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      // a stable, unique order, or pages could overlap or skip rows (game_kingdom has no single-column key)
      let q = sb.from(table).select('*');
      for (const col of [].concat(order)) q = q.order(col);
      const { data, error } = await q.range(from, from + 999);
      if (error) return { data: null, error };
      out.push(...data);
      if (data.length < 1000) return { data: out, error: null };
    }
  };
  const [pr, gr, rr, grp, sr, stg, kr] = await Promise.all([
    sb.from('players').select('*'),
    fetchAll('games', 'id'),
    fetchAll('game_results', 'id'),
    sb.from('groups').select('*'),
    sb.from('seasons').select('*'),
    sb.from('settings').select('*').maybeSingle(),
    // the games' kingdoms are an add-on: if the table isn't installed yet, the league still loads without them
    fetchAll('game_kingdom', ['game_id', 'kind', 'item_id']),
  ]);
  if (pr.error) throw pr.error;
  if (gr.error) throw gr.error;
  if (rr.error) throw rr.error;
  if (grp.error) throw grp.error;
  if (sr.error) throw sr.error;
  const missingTable = e => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /schema cache|does not exist/i.test(e.message || ''));
  if (kr.error && !missingTable(kr.error)) throw kr.error;
  const kingdomByGame = new Map();
  (kr.data || []).slice().sort((a, b) => a.position - b.position).forEach(k => {
    if (!kingdomByGame.has(k.game_id)) kingdomByGame.set(k.game_id, []);
    kingdomByGame.get(k.game_id).push({ kind: k.kind, id: k.item_id, ...(k.on_id ? { on: k.on_id } : {}) });
  });
  // Missing row/table (e.g. schema.sql not yet re-run) just means every
  // known set is treated as owned — never blocks the rest of the site.
  const enabled = stg.data && stg.data.enabled_sets ? stg.data.enabled_sets : SET_NAMES;
  const nameById = new Map(pr.data.map(p => [p.id, p.name]));
  const byGame = new Map();
  rr.data.forEach(r => { if (!byGame.has(r.game_id)) byGame.set(r.game_id, []); byGame.get(r.game_id).push(r); });
  const rows = gr.data.map(g => {
    const byPlace = new Map();
    const playerVP = {};
    (byGame.get(g.id) || []).forEach(r => {
      const nm = nameById.get(r.player_id); if (!nm) return;
      if (!byPlace.has(r.place)) byPlace.set(r.place, []);
      byPlace.get(r.place).push(nm);
      if (r.vp != null) playerVP[nm] = r.vp;
    });
    const finish = [...byPlace.keys()].sort((a, b) => a - b).map(p => byPlace.get(p).join(' = ')).join(' > ');
    return {
      _line: g.id, date: g.date, type: g.type, finish,
      sets: g.sets || '', landscapes: g.landscapes || '', playerVP, group_id: g.group_id || null,
      kingdom: kingdomByGame.get(g.id) || [],
      winner_vp: g.winner_vp ?? '', minutes: g.minutes ?? '', notes: g.notes || '',
    };
  });
  const seasonRows = sr.data.slice().sort((a, b) => a.id - b.id).map(s => ({
    _id: s.id, name: s.name, group: s.group_id, start: s.start_date, weeks: s.weeks,
    targetGames: s.target_games, qualifyPct: s.qualify_pct, playoffSpots: s.playoff_spots,
    champion: s.champion_player_id ? (nameById.get(s.champion_player_id) || '') : '', notes: s.notes || '',
  }));
  return { rows, players: pr.data, groups: grp.data, seasons: seasonRows, enabledSets: enabled };
}
