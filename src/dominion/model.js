/* Turns the raw rows from api.js into one normalized catalog object. No fetching, no DOM — pure, so it is
   tested directly against the CSVs. The vocabulary here matters, because the numbers are easy to confuse:

     card NAMES     one per row of dominion_kingdom_cards (331)
     supply PILES   one per row of dominion_kingdom_piles (310) — a split pile or Knights/Castles is ONE pile
                    holding several names, so names >= piles
     PHYSICAL cards the copies in the box: the sum of piles' physical_copies (3,132)
     LANDSCAPES     Events/Landmarks/Projects/Ways/Traits — NOT Kingdom cards
     ARTIFACTS      Renaissance tokens — neither Kingdom cards nor landscapes                                   */
import { expansionMeta, list, LANDSCAPE_TYPES } from './constants.js';

const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

function normalizeCard(r) {
  const types = Array.isArray(r.printed_types_list) && r.printed_types_list.length ? r.printed_types_list : list(r.printed_types);
  const detail = Array.isArray(r.mechanics_detail) ? r.mechanics_detail : [];
  const mechanicIds = Array.isArray(r.mechanic_ids) ? r.mechanic_ids : detail.map(d => d.id);
  const status = new Map(detail.map(d => [d.id, d.review_status]));
  return {
    id: r.card_id, name: r.name, expansion: r.expansion, edition: r.edition,
    costRaw: r.cost_raw, coins: num(r.cost_coins) ?? 0, debt: num(r.cost_debt) ?? 0, overpay: r.overpay === 'yes',
    types, typeVerification: r.type_verification,
    copies: num(r.physical_copies) ?? 0, pileId: r.pile_id, pileKey: `${r.expansion}::${r.pile_id}`,
    addedInEdition: r.edition_added === 'True' ? true : r.edition_added === 'False' ? false : null,
    previousName: r.previous_name || null,
    mechanicsVerification: r.mechanics_verification,
    typeSourceUrl: r.type_source_url || null, typeReviewNote: r.type_review_note || null, reviewPriority: r.review_priority || null,
    mechanicIds, mechanics: mechanicIds.map(id => ({ id, reviewStatus: status.get(id) ?? null })),
  };
}

function normalizeLandscape(r) {
  return {
    id: r.object_id, name: r.name, expansion: r.expansion, type: r.object_type, copies: num(r.physical_copies) ?? 1,
    effectCategories: list(r.effect_category), trigger: r.trigger || null, verification: r.verification_status,
    note: r.notes || null, sourceUrl: r.source_url || null, scope: r.classification_scope || null,
    mechanicIds: Array.isArray(r.mechanic_ids) ? r.mechanic_ids : [],
  };
}

export function buildCatalog(raw) {
  const cards = raw.cards.map(normalizeCard);
  const piles = raw.piles.map(p => ({
    expansion: p.expansion, id: p.pile_id, key: `${p.expansion}::${p.pile_id}`,
    names: num(p.distinct_names), copies: num(p.physical_copies), cardIds: list(p.card_ids),
  }));
  // a card in a split/mixed pile (Knights, Castles, "Catapult / Rocks", ...) carries that pile's name; otherwise null
  const pilesByKey0 = new Map(piles.map(p => [p.key, p]));
  cards.forEach(c => { const p = pilesByKey0.get(c.pileKey); c.sharedPile = p && p.names > 1 ? p.id : null; });
  const landscapes = raw.landscapes.map(normalizeLandscape);
  const artifactTags = new Map();
  (raw.artifactMechanics || []).forEach(m => { (artifactTags.get(m.object_id) || artifactTags.set(m.object_id, []).get(m.object_id)).push(m.mechanic_id); });
  const artifacts = raw.artifacts.map(a => ({
    id: a.object_id, name: a.name, expansion: a.expansion, kind: a.object_kind, copies: num(a.physical_copies) ?? 1,
    behaviour: a.persistent_or_contested || null, sourceUrl: a.source_url || null, verification: a.verification_status,
    tags: artifactTags.get(a.object_id) || list(a.initial_effect_tags),
  }));
  const taxonomy = new Map(raw.taxonomy.map(t => [t.mechanic_id, { id: t.mechanic_id, definition: t.definition, status: t.status }]));

  const expansionNames = [...new Set([...cards.map(c => c.expansion), ...landscapes.map(l => l.expansion), ...artifacts.map(a => a.expansion)])];
  const expansions = expansionNames.map(name => ({ name, ...expansionMeta(name) })).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  // the owned expansions are those that actually have Kingdom cards in the catalog
  const owned = new Set(cards.map(c => c.expansion));

  return {
    cards, cardsById: new Map(cards.map(c => [c.id, c])),
    piles, pilesByKey: new Map(piles.map(p => [p.key, p])),
    landscapes, landscapesById: new Map(landscapes.map(l => [l.id, l])),
    artifacts, taxonomy, expansions,
    ownedExpansions: expansions.filter(e => owned.has(e.name)),
    landscapeTypes: LANDSCAPE_TYPES.filter(t => landscapes.some(l => l.type === t)),
    meta: { mechanicRelationshipCount: raw.mechanicRelationshipCount ?? null },
  };
}

export const pileOf = (catalog, card) => catalog.pilesByKey.get(card.pileKey) || null;
export const pileMembers = (catalog, pile) => pile.cardIds.map(id => catalog.cardsById.get(id)).filter(Boolean);

/* Cards that share recorded mechanics with `card`, most overlap first. Tags are positive-only, so this means
   "recorded the same tags", never "plays the same". Needs at least `min` shared tags. */
export function sharedMechanicCards(catalog, card, { min = 2, limit = 8 } = {}) {
  const mine = new Set(card.mechanicIds);
  if (!mine.size) return [];
  const need = Math.min(min, mine.size);
  return catalog.cards
    .filter(c => c.id !== card.id)
    .map(c => { const shared = c.mechanicIds.filter(m => mine.has(m)); const union = new Set([...mine, ...c.mechanicIds]).size; return { card: c, shared, score: shared.length / union }; })
    .filter(x => x.shared.length >= need)
    .sort((a, b) => b.shared.length - a.shared.length || b.score - a.score || a.card.name.localeCompare(b.card.name))
    .slice(0, limit);
}

/* Does the cost have a COIN part? Cards that cost only Debt (Engineer, City Quarter, ...) are stored with
   cost_coins = 0 but have no coin cost at all — they must not be counted as "$0" cards. */
export const hasCoin = card => card.coins > 0 || card.debt === 0;

/* Spoken form of a cost, for screen readers and tooltips: "4 coins", "2 coins or more (overpay)", "4 Debt",
   "8 coins and 8 Debt". Takes anything with { coins, debt, overpay }. */
export function costLabel({ coins, debt = 0, overpay = false }) {
  const c = `${coins} ${coins === 1 ? 'coin' : 'coins'}`;
  if (debt > 0 && coins === 0) return `${debt} Debt`;
  const base = overpay ? `${c} or more (overpay)` : c;
  return debt > 0 ? `${base} and ${debt} Debt` : base;
}

/* "$4", "$2+", "4 Debt", "$8 + 4 Debt" — built from the stored fields, never guessed. */
export function formatCost(card) {
  const coins = card.overpay ? `$${card.coins}+` : `$${card.coins}`;
  if (card.debt > 0 && card.coins === 0) return `${card.debt} Debt`;
  if (card.debt > 0) return `${coins} + ${card.debt} Debt`;
  return coins;
}
