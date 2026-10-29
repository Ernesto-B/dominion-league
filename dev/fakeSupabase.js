/* An in-memory stand-in for the Supabase client, for trying the site WITHOUT a login or the real database:
     npm run dev:fake        (a dev server on http://localhost:5199)
   You are signed in as "Ann" (the admin). The data is built from the committed seed CSVs plus a small made-up league (7 players,
   16 games, a season, a few logged kingdoms). add_game / edit_game / delete_game really change it, so logging a game shows up in
   the standings until you reload the page — and nothing ever leaves your machine. Swapped in for src/lib/supabase.js by
   vite.fake.config.js; it is never part of the real build. */
import { parseCsv } from '../scripts/dominion/lib/csv.mjs';

const csv = import.meta.glob('../supabase/dominion/seed_csv/*.csv', { query: '?raw', import: 'default', eager: true });
const T = n => parseCsv(csv[`../supabase/dominion/seed_csv/${n}.csv`]);
const nul = v => (v === '' ? null : v), int = v => (v === '' ? null : Number(v));
const N = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, nul(v)]));
const group = (rows, key) => rows.reduce((m, r) => (m.get(r[key]) || m.set(r[key], []).get(r[key])).push(r) && m, new Map());

const types = group(T('kingdom_printed_types'), 'card_id'), mech = group(T('kingdom_mechanics'), 'card_id'), lm = group(T('landscape_mechanics'), 'object_id');
const cards = T('kingdom_cards');
const cardId = name => cards.find(c => c.name === name).card_id;
const landId = name => T('landscapes').find(l => l.name === name).object_id;

const ME = 'u-ann';
const NAMES = ['Ann', 'Bob', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus'];
const players = NAMES.map((n, i) => ({ id: 'u-' + n.toLowerCase(), name: n, group_ids: ['g1'], is_admin: i === 0, must_change_password: false }));
const SETS = ['Base', 'Base; Intrigue', 'Seaside; Prosperity', 'Dark Ages; Empires', 'Renaissance; Menagerie; Plunder', 'Hinterlands'];
const games = Array.from({ length: 16 }, (_, i) => ({ id: i + 1, date: `2026-0${1 + Math.floor(i / 6)}-${String(1 + (i % 6) * 4).padStart(2, '0')}`, type: i === 15 ? 'Playoff' : '', sets: SETS[i % SETS.length], landscapes: i % 3 ? null : 'Ways; Events', group_id: 'g1', notes: i % 4 === 0 ? 'Long game with a lot of attacks' : '' }));
let rid = 1;
const results = games.flatMap(g => {
  const n = 3 + (g.id % 4), order = NAMES.slice().sort((a, b) => ((a.charCodeAt(0) * g.id) % 7) - ((b.charCodeAt(0) * g.id) % 7)).slice(0, n);
  return order.map((nm, k) => ({ id: rid++, game_id: g.id, player_id: 'u-' + nm.toLowerCase(), place: k + 1, vp: 40 - k * 6 }));
});
const KINGS = [
  ['Militia', 'Village', 'Moat', 'Smithy', 'Market', 'Witch', 'Cellar', 'Chapel', 'Festival', 'Laboratory'],
  ['Village', 'Smithy', 'Gardens', 'Bureaucrat', 'Council Room', 'Library', 'Mine', 'Remodel', 'Throne Room', 'Workshop'],
  ['Village', 'Militia', 'Gardens', 'Moneylender', 'Poacher', 'Sentry', 'Vassal', 'Harbinger', 'Merchant', 'Bandit'],
];
const kingdom = KINGS.flatMap((k, j) => k.map((n, position) => ({ game_id: j + 1, kind: 'card', item_id: cardId(n), position, on_id: null })))
  .concat([{ game_id: 1, kind: 'landscape', item_id: landId('Way of the Mole'), position: 10, on_id: null }]);

const tables = {
  players, groups: [{ id: 'g1', name: 'Friends' }], settings: [],
  seasons: [{ id: 1, group_id: 'g1', name: 'Season 1', start_date: '2026-01-01', weeks: 12, target_games: 8, qualify_pct: 0.6, playoff_spots: 4, champion_player_id: null, notes: '' }],
  games, game_results: results, game_kingdom: kingdom,
  dominion_card_catalog: cards.map(c => {
    const ms = (mech.get(c.card_id) || []).sort((a, b) => (a.mechanic_id < b.mechanic_id ? -1 : 1));
    return { ...N(c), cost_coins: int(c.cost_coins), cost_debt: int(c.cost_debt), physical_copies: int(c.physical_copies), printed_types_list: (types.get(c.card_id) || []).map(r => r.printed_type).sort(), mechanic_ids: ms.map(m => m.mechanic_id), mechanics_detail: ms.map(m => ({ id: m.mechanic_id, review_status: m.review_status })) };
  }),
  dominion_kingdom_piles: T('kingdom_piles').map(p => ({ ...p, distinct_names: int(p.distinct_names), physical_copies: int(p.physical_copies) })),
  dominion_landscape_catalog: T('landscapes').map(l => ({ ...N(l), physical_copies: int(l.physical_copies), mechanic_ids: (lm.get(l.object_id) || []).map(r => r.mechanic_id) })),
  dominion_artifacts: T('artifacts').map(a => ({ ...N(a), physical_copies: int(a.physical_copies), cost_coins: int(a.cost_coins) })),
  dominion_artifact_mechanics: T('artifact_mechanics'), dominion_taxonomy: T('taxonomy'), dominion_card_text: T('card_text'), dominion_kingdom_mechanics: T('kingdom_mechanics'),
};

// ---- the write RPCs, enough of them to log, edit and delete a game for real
const rows = a => a.map(r => ({ ...r }));
function writeGame(id, a) {
  Object.assign(tables.games.find(g => g.id === id) || tables.games[tables.games.push({ id }) - 1], { date: a.p_date, type: a.p_type || '', sets: a.p_sets, landscapes: a.p_landscapes, notes: a.p_notes || '', group_id: a.p_group_id });
  tables.game_results = tables.game_results.filter(r => r.game_id !== id);
  let next = Math.max(0, ...tables.game_results.map(r => r.id)) + 1;
  a.p_results.forEach(r => tables.game_results.push({ id: next++, game_id: id, player_id: r.player_id, place: r.place, vp: r.vp ?? null }));
  if (a.p_kingdom) {
    tables.game_kingdom = tables.game_kingdom.filter(k => k.game_id !== id);
    a.p_kingdom.forEach((k, position) => tables.game_kingdom.push({ game_id: id, kind: k.kind, item_id: k.id, position, on_id: k.on || null }));
  }
}
const rpcLog = []; window.__rpc = rpcLog; window.__failNext = null;
const rpc = async (name, a) => {
  rpcLog.push({ name, args: a });
  if (window.__failNext) { const message = window.__failNext; window.__failNext = null; return { data: null, error: { message } }; }
  if (name === 'add_game') { const id = Math.max(0, ...tables.games.map(g => g.id)) + 1; writeGame(id, a); return { data: id, error: null }; }
  if (name === 'edit_game') { writeGame(a.p_game_id, a); return { data: null, error: null }; }
  if (name === 'delete_game') { tables.games = tables.games.filter(g => g.id !== a.p_game_id); tables.game_results = tables.game_results.filter(r => r.game_id !== a.p_game_id); tables.game_kingdom = tables.game_kingdom.filter(k => k.game_id !== a.p_game_id); return { data: null, error: null }; }
  if (name === 'set_my_pinned_badges') { const me = tables.players.find(x => x.id === ME); if (me) me.pinned_badges = a.p_ids.slice(0, 3); return { data: null, error: null }; }
  return { data: null, error: null };
};

const sort = (list, cols) => list.slice().sort((a, b) => { for (const c of cols) if (a[c] !== b[c]) return a[c] < b[c] ? -1 : 1; return 0; });
export const sb = {
  auth: { getSession: async () => ({ data: { session: { user: { id: ME } } } }), signOut: async () => ({}), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  rpc,
  from(name) {
    const st = { orders: [], eq: [], opts: null, head: false };
    const result = (a, b) => {
      const list = tables[name];
      if (!list) return { data: null, error: { code: 'PGRST205', message: 'no table ' + name } };
      const out = sort(list.filter(r => st.eq.every(([k, v]) => r[k] === v)), st.orders);
      return { data: rows(out.slice(a, b + 1)), error: null, count: st.opts?.count ? out.length : undefined };
    };
    const q = {
      select(_c, opts) { st.opts = opts; st.head = !!opts?.head; return q; }, order(c) { st.orders.push(c); return q; }, eq(k, v) { st.eq.push([k, v]); return q; },
      range: async (a, b) => result(a, b),
      single: async () => { const r = result(0, 0); return { data: r.data?.[0] ?? null, error: r.data?.length ? null : { message: 'none' } }; },
      maybeSingle: async () => ({ data: result(0, 0).data?.[0] ?? null, error: null }),
      then: (res, rej) => Promise.resolve(st.head ? { data: null, error: tables[name] ? null : { code: 'PGRST205' }, count: tables[name] ? tables[name].length : null } : result(0, 9999)).then(res, rej),
    };
    return q;
  },
};
