// Rebuilds, from the committed CSVs, exactly what the two Supabase views and tables return — so the tests run
// against the REAL dataset, not hand-made samples. (An empty CSV cell is a NULL in the database.)
import { readAll } from '../../scripts/dominion/lib/tables.mjs';
import { buildCatalog } from '../../src/dominion/model.js';

const nul = v => (v === '' ? null : v);
const int = v => (v === '' ? null : Number(v));

export function rawFromCsv() {
  const t = readAll();
  const types = new Map(), mech = new Map(), lmech = new Map();
  t.dominion_kingdom_printed_types.forEach(r => (types.get(r.card_id) || types.set(r.card_id, []).get(r.card_id)).push(r.printed_type));
  t.dominion_kingdom_mechanics.forEach(r => (mech.get(r.card_id) || mech.set(r.card_id, []).get(r.card_id)).push(r));
  t.dominion_landscape_mechanics.forEach(r => (lmech.get(r.object_id) || lmech.set(r.object_id, []).get(r.object_id)).push(r.mechanic_id));
  const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  const cards = t.dominion_kingdom_cards.map(c => {
    const ms = (mech.get(c.card_id) || []).slice().sort((a, b) => byId(a.mechanic_id, b.mechanic_id));
    return {
      ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, nul(v)])),
      cost_coins: int(c.cost_coins), cost_debt: int(c.cost_debt), physical_copies: int(c.physical_copies),
      printed_types_list: (types.get(c.card_id) || []).slice().sort(byId),
      mechanic_ids: ms.map(m => m.mechanic_id),
      mechanics_detail: ms.map(m => ({ id: m.mechanic_id, review_status: m.review_status })),
    };
  });
  const landscapes = t.dominion_landscapes.map(l => ({
    ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, nul(v)])), physical_copies: int(l.physical_copies),
    mechanic_ids: (lmech.get(l.object_id) || []).slice().sort(byId),
  }));
  return {
    cards,
    piles: t.dominion_kingdom_piles.map(p => ({ ...p, distinct_names: int(p.distinct_names), physical_copies: int(p.physical_copies) })),
    landscapes,
    artifacts: t.dominion_artifacts.map(a => ({ ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, nul(v)])), physical_copies: int(a.physical_copies), cost_coins: int(a.cost_coins) })),
    artifactMechanics: t.dominion_artifact_mechanics,
    taxonomy: t.dominion_taxonomy,
    cardText: t.dominion_card_text,
    mechanicRelationshipCount: t.dominion_kingdom_mechanics.length,
  };
}
export const realCatalog = () => buildCatalog(rawFromCsv());

/* A stand-in for the Supabase client that mimics PostgREST's behaviour, including its per-response row cap
   and the exact `count`. `serverMax` is what a real project's `max-rows` does: it silently truncates. */
export function fakeClient(tables, { serverMax = 1000, lieAboutCount = null } = {}) {
  const calls = [];
  return {
    calls,
    from(name) {
      const rows = tables[name];
      return {
        select(cols, opts) {
          const state = { orders: [], opts };
          const q = {
            order(c) { state.orders.push(c); return q; },
            async range(a, b) {
              calls.push({ name, a, b });
              if (!rows) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${name}'` } };
              let sorted = rows.slice();
              state.orders.forEach(c => { sorted = sorted.sort((x, y) => (x[c] < y[c] ? -1 : x[c] > y[c] ? 1 : 0)); });
              const data = sorted.slice(a, Math.min(b + 1, a + serverMax));
              const count = state.opts?.count ? (lieAboutCount ?? rows.length) : undefined;
              return { data, error: null, count };
            },
            then(res, rej) {   // head-only count query (no .range)
              return Promise.resolve(rows ? { data: null, error: null, count: rows.length } : { data: null, error: { code: 'PGRST205' }, count: null }).then(res, rej);
            },
          };
          return q;
        },
      };
    },
  };
}
export function tablesFromRaw(raw) {
  return {
    dominion_card_catalog: raw.cards, dominion_kingdom_piles: raw.piles, dominion_landscape_catalog: raw.landscapes,
    dominion_artifacts: raw.artifacts, dominion_artifact_mechanics: raw.artifactMechanics, dominion_taxonomy: raw.taxonomy, dominion_card_text: raw.cardText,
    dominion_kingdom_mechanics: Array.from({ length: raw.mechanicRelationshipCount }, (_, i) => ({ card_id: 'x' + i })),
  };
}
