/* The Kingdom randomizer: picks Kingdom cards (and landscapes) for a game, under rules the players choose.
   Pure — no fetching, no DOM, and the random source is injected, so every rule is testable with a seeded generator.

   A "slot" is one SUPPLY PILE: a split or mixed pile (Knights, Castles, Gladiator / Fortune, ...) is ONE slot that shows
   all of its names, so those piles can't use up several of the ten places.

   What the rules may rely on (see AGENTS.md — the mechanic tags are positive-only and non-exhaustive):
     - EXCLUDING things (no Attacks, at most N Attacks, "a Reaction if there is an Attack") uses PRINTED TYPES only, which
       are complete and reliable.
     - REQUIRING things ("at least one Village / draw / trashing / +Buy") uses mechanic tags. A card that has the effect but
       no tag may be skipped, but a card that is picked for it certainly has the tag, so a requirement is never "satisfied"
       by a wrong card.
   A rule that applies to a pile applies if ANY of its names has the property. Excluding or requiring a name in a split pile
   concerns the whole pile, since the piles come as one. */
import { pileMembers } from './model.js';
import { LANDSCAPE_TYPES } from './constants.js';

/* `tags` rules need a recorded mechanic (positive-only, see above); `coins` rules need a card whose PRINTED cost is that many coins
   (no Debt), which is complete data, so those can't miss a card. */
export const REQUIRE_RULES = {
  village: { label: 'a +Actions card (a Village)', box: 'Require +2 Actions', chip: '+2 Actions', tags: ['village'] },
  draw: { label: 'card drawing', box: 'Require a Drawer', chip: 'Drawer', tags: ['draw', 'terminal_draw'] },
  trash: { label: 'trashing', box: 'Require Trashing', chip: 'Trashing', tags: ['trashing_from_hand', 'trashing_from_deck', 'trashing_from_play', 'trashing_from_discard'] },
  buy: { label: 'a +Buy card', box: 'Require +Buy', chip: '+Buy', tags: ['plus_buy'] },
  scoring: { label: 'a card with variable scoring, an alternate victory or VP tokens', box: 'Require variable scoring, alternate victory or VP tokens', chip: 'Variable / Alt. Victory / VP', tags: ['variable_scoring', 'alternate_victory', 'vp_token_generation'] },
  cost2: { label: 'a card costing $2', chip: '$2', coins: 2 },
  cost3: { label: 'a card costing $3', chip: '$3', coins: 3 },
  cost4: { label: 'a card costing $4', chip: '$4', coins: 4 },
  cost5: { label: 'a card costing $5', chip: '$5', coins: 5 },
  cost6: { label: 'a card costing $6 or more', chip: '$6+', atLeast: 6 },
};
export const ruleIsExact = rule => REQUIRE_RULES[rule].coins != null || REQUIRE_RULES[rule].atLeast != null;   // by printed cost, not by a recorded mechanic

/* "Distribute cost": how the draw spreads the kingdom over the cost levels. Each mode is the share of the cards wanted at $2 or less, $3, $4,
   $5 and $6 or more; a pile's chance is its level's share, divided by 1 + how many of that level are already in, so the kingdom spreads
   out instead of piling up on one level. 'standard' is an even spread, 'high' leans to $5 and up, 'low' to $3 and under. */
export const COST_SPREADS = {
  standard: { label: 'Standard', share: [0.20, 0.25, 0.25, 0.20, 0.10] },
  high: { label: 'High average', share: [0.10, 0.15, 0.25, 0.30, 0.20] },
  low: { label: 'Low average', share: [0.30, 0.35, 0.20, 0.10, 0.05] },
};
const costLevel = info => Math.min(6, Math.max(2, (info.cards[0].coins || 0) + (info.cards[0].debt || 0))) - 2;   // 0 ($2 or less) .. 4 ($6 or more)

export const MAX_ATTACK_CHOICES = [0, 1, 2, 3];   // "no Attacks", "at most 1"... ; null = any number
export const DEFAULT_OPTIONS = Object.freeze({
  expansions: [],          // empty = every owned expansion
  cards: 10,               // Kingdom piles
  landscapes: 0,           // how many Events/Landmarks/Projects/Ways/Traits (from ANY expansion — independent of `expansions`)
  landscapeTypes: [],      // empty = all five types
  maxAttacks: null,        // null = any number of Attack piles
  reaction: false,         // if there is an Attack, make sure there is a Reaction too
  require: [],             // keys of REQUIRE_RULES
  include: [],             // card ids that must be in (their pile is)
  exclude: [],             // card ids that must not be (their pile isn't)
  excludeLandscapes: [],   // landscape ids that must not be (kept out of the link: it is only ever set by withAvoid, for a second table)
  favor: false,            // weight the draw towards piles that have been played less (needs the `plays` option)
  favorPlayed: false,      // ...or towards piles that have been played more (the same `plays` option)
  junkTrash: false,        // if an Attack that gives opponents junk is in, make sure there is a trashing card too
  costSpread: null,        // null = off, else a key of COST_SPREADS
});
export const CARD_COUNTS = [10, 9, 8, 7, 6, 5, 11, 12];

// mulberry32: a tiny seeded generator, for tests
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------------------------------------------------------------- seeds
   A roll is reproducible: the same options and the same seed always give the same kingdom (every random choice comes from one seeded
   generator). The seed is a number of up to six digits, shown with the kingdom, kept in its link and used in the picture's file name.
   It only means something for a FRESH roll: a roll that keeps locked cards starts from the previous kingdom, a single re-roll changes one
   card, and "favor cards we've played less" depends on the games logged so far, so none of those carry a seed. */
export const newSeed = (rnd = Math.random) => Math.floor(rnd() * 1000000);
export const parseSeed = v => { const s = String(v ?? '').trim(); return /^\d{1,9}$/.test(s) ? Number(s) : null; };
export const formatSeed = n => String(n).padStart(6, '0');

/* generate(), but from a seed. The result carries `seed` when it can be reproduced from it, otherwise `seed: null`. */
export function rollSeeded(catalog, options, seed, extra = {}) {
  const res = generate(catalog, options, { ...extra, rng: seededRng(seed) });
  if (!res.ok) return res;
  const fresh = !(extra.keep && extra.keep.length) && !(extra.keepLandscapes && extra.keepLandscapes.length) && !extra.plays;
  return { ...res, seed: fresh ? seed : null };
}

// ---------------------------------------------------------------- piles
const infoCache = new WeakMap();
function pileInfos(catalog) {
  if (infoCache.has(catalog)) return infoCache.get(catalog);
  const infos = catalog.piles.map(pile => {
    const cards = pileMembers(catalog, pile);
    const tags = new Set(); cards.forEach(c => c.mechanicIds.forEach(t => tags.add(t)));
    return {
      key: pile.key, pile, cards, tags,
      name: pile.names > 1 ? pile.id : (cards[0]?.name ?? pile.id),
      expansion: pile.expansion, ids: cards.map(c => c.id),
      junking: tags.has('opponent_junking'), attack: cards.some(c => c.types.includes('Attack')), reaction: cards.some(c => c.types.includes('Reaction')),
    };
  }).filter(i => i.cards.length);
  const out = { list: infos, byKey: new Map(infos.map(i => [i.key, i])), byCardId: new Map(infos.flatMap(i => i.ids.map(id => [id, i]))) };
  infoCache.set(catalog, out);
  return out;
}
export const pileKeyOf = (catalog, cardId) => pileInfos(catalog).byCardId.get(cardId)?.key ?? null;
export const satisfiesRule = (info, rule) => {
  const r = REQUIRE_RULES[rule];
  if (r.atLeast != null) return info.cards.some(c => c.coins >= r.atLeast && c.debt === 0);
  return r.coins != null ? info.cards.some(c => c.coins === r.coins && c.debt === 0) : r.tags.some(t => info.tags.has(t));
};
const satisfies = satisfiesRule;

// a slot is what callers and the UI see
const toSlot = info => ({ key: info.key, name: info.name, expansion: info.expansion, cards: info.cards });
const infoOfSlot = (catalog, slot) => pileInfos(catalog).byKey.get(slot.key);

// the representative card id of a pile (its first name), for URLs and for a Trait's host
export const slotCardId = slot => slot.cards[0].id;

// display order: cheapest first, then Debt, then name
export function sortSlots(slots) {
  const cost = s => s.cards[0];
  return slots.slice().sort((a, b) => cost(a).coins - cost(b).coins || cost(a).debt - cost(b).debt || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- rules
/* The options with a kingdom's cards and landscapes kept out of the draw: for a second table playing at the same time, when the group owns only one copy of
   each pile. A card that was to be included is dropped from `include`. `items` are kingdom items ({ kind, id }). */
export function withAvoid(options, items) {
  if (!items || !items.length) return options;
  const cards = items.filter(i => i.kind === 'card').map(i => i.id), lands = items.filter(i => i.kind === 'landscape').map(i => i.id);
  const o = { ...DEFAULT_OPTIONS, ...options };
  return { ...o, exclude: [...new Set([...o.exclude, ...cards])], include: o.include.filter(id => !cards.includes(id)), excludeLandscapes: [...new Set([...(o.excludeLandscapes || []), ...lands])] };
}
const normalize = opts => {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  o.cards = Math.max(1, Math.min(12, Number(o.cards) || 10));
  o.landscapes = Math.max(0, Math.min(6, Number(o.landscapes) || 0));
  return o;
};
const attackCount = infos => infos.filter(i => i.attack).length;

/* Does a chosen set of piles obey every rule? Returns null when it does, otherwise a short sentence for the first rule broken. */
function breaks(chosen, o, wanted) {
  if (o.maxAttacks != null && attackCount(chosen) > o.maxAttacks) return o.maxAttacks === 0 ? 'No Attacks was asked for' : `At most ${o.maxAttacks} Attack${o.maxAttacks === 1 ? '' : 's'} was asked for`;
  if (o.reaction && attackCount(chosen) > 0 && !chosen.some(i => i.reaction)) return 'A Reaction is required when there is an Attack';
  if (o.junkTrash && chosen.some(i => i.junking) && !chosen.some(i => satisfies(i, 'trash'))) return 'A trashing card is required when an Attack gives opponents junk';
  for (const r of o.require) if (!chosen.some(i => satisfies(i, r))) return `The kingdom needs ${REQUIRE_RULES[r].label}`;
  for (const w of wanted) if (!chosen.includes(w)) return 'A card you asked to include is missing';
  return null;
}

/* The piles the draw may use: in the chosen expansions, not excluded, and (for "no Attacks") not Attacks. */
function poolFor(catalog, o) {
  const { list, byCardId } = pileInfos(catalog);
  const banned = new Set(o.exclude.map(id => byCardId.get(id)?.key).filter(Boolean));
  return list.filter(i => (!o.expansions.length || o.expansions.includes(i.expansion)) && !banned.has(i.key) && !(o.maxAttacks === 0 && i.attack));
}

// the played-count weighting: plays is Map(pile key -> games). Piles played less get more chance ('favor'), or those played more ('favorPlayed').
const usesPlays = o => !!(o.favor || o.favorPlayed);
export const playsFor = (o, plays) => (plays && usesPlays(o) ? plays : null);
const weightOf = (info, o, plays, chosen) => {
  let w = 1;
  if (plays && o.favor) w /= 1 + (plays.get(info.key) || 0);
  else if (plays && o.favorPlayed) w *= 1 + (plays.get(info.key) || 0);
  if (o.costSpread && COST_SPREADS[o.costSpread]) {
    const lv = costLevel(info);
    w *= COST_SPREADS[o.costSpread].share[lv] / (1 + chosen.filter(c => costLevel(c) === lv).length);
  }
  return w;
};
// `chosen` is what is already in the kingdom (the cost spread looks at it); without any weighting this is a plain random pick
function pick(candidates, o, plays, rng, chosen = []) {
  if (!(plays && usesPlays(o)) && !o.costSpread) return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  const ws = candidates.map(c => weightOf(c, o, plays, chosen)); let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) { r -= ws[i]; if (r < 0) return candidates[i]; }
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------- the draw
/* generate(catalog, options, { rng, keep, keepLandscapes, plays })
     keep            pile keys that must stay (locked cards)        keepLandscapes   landscape ids that must stay
     lockedAt        Map(pile key -> position): a locked card also keeps its PLACE on the table; the rest fill the other places cheapest first
     lockedLandscapeAt  the same for landscapes (id -> position)
     plays           Map(pile key -> games played, see playStats.js pilesPlayed), used when options.favor is on
   Returns { ok: true, slots, landscapes: [{ landscape, on }], setup } or { ok: false, message }. */
export function generate(catalog, options = {}, { rng = Math.random, keep = [], keepLandscapes = [], plays = null, lockedAt = null, lockedLandscapeAt = null } = {}) {
  const o = normalize(options);
  const { byKey, byCardId } = pileInfos(catalog);
  const pool = poolFor(catalog, o);
  const wanted = [...new Set(o.include.map(id => byCardId.get(id)).filter(Boolean))];
  const kept = [...new Set(keep.map(k => byKey.get(k)).filter(Boolean))];
  const fixed = [...new Set([...kept, ...wanted])];

  if (fixed.length > o.cards) return { ok: false, message: `You asked to keep or include ${fixed.length} cards, but the kingdom has only ${o.cards}.` };
  const fixedBreak = o.maxAttacks != null && attackCount(fixed) > o.maxAttacks;
  if (fixedBreak) return { ok: false, message: `The cards you included or locked already have more Attacks than your limit (${o.maxAttacks}).` };

  const eligible = chosen => pool.filter(i => !chosen.includes(i) && !(o.maxAttacks != null && i.attack && attackCount(chosen) >= o.maxAttacks));
  let last = 'Couldn’t satisfy these rules together — try relaxing one.';
  for (let attempt = 0; attempt < 300; attempt++) {
    const chosen = fixed.slice(), locked = fixed.slice();
    let failed = null;
    for (const r of o.require) {
      if (chosen.some(i => satisfies(i, r))) continue;
      const cands = eligible(chosen).filter(i => satisfies(i, r));
      if (!cands.length) { failed = `None of the chosen expansions has ${REQUIRE_RULES[r].label} left to add.`; break; }
      if (chosen.length >= o.cards) { failed = `There isn’t room for ${REQUIRE_RULES[r].label} — the kingdom is already full of locked or included cards.`; break; }
      const p = pick(cands, o, plays, rng, chosen); chosen.push(p); locked.push(p);
    }
    if (failed) return { ok: false, message: failed };
    while (chosen.length < o.cards) {
      const cands = eligible(chosen);
      if (!cands.length) return { ok: false, message: `The chosen expansions only have ${pool.length} cards that fit your rules, not ${o.cards}. Add an expansion or relax a rule.` };
      chosen.push(pick(cands, o, plays, rng, chosen));
    }
    // "a Reaction if there is an Attack": swap one free slot for a Reaction rather than rolling the whole kingdom again
    if (o.reaction && attackCount(chosen) > 0 && !chosen.some(i => i.reaction)) {
      const swappable = chosen.filter(i => !locked.includes(i)), rx = eligible(chosen).filter(i => i.reaction);
      if (swappable.length && rx.length) chosen[chosen.indexOf(swappable[Math.floor(rng() * swappable.length)])] = pick(rx, o, plays, rng, chosen);
    }
    // the same for "a trashing card if an Attack gives opponents junk"
    if (o.junkTrash && chosen.some(i => i.junking) && !chosen.some(i => satisfies(i, 'trash'))) {
      const swappable = chosen.filter(i => !locked.includes(i) && !i.junking), tr = eligible(chosen).filter(i => satisfies(i, 'trash'));
      if (swappable.length && tr.length) chosen[chosen.indexOf(swappable[Math.floor(rng() * swappable.length)])] = pick(tr, o, plays, rng, chosen);
    }
    const why = breaks(chosen, o, wanted);
    if (!why) return finish(catalog, o, chosen, keepLandscapes, plays, rng, null, { lockedAt, lockedLandscapeAt });
    last = `${why}, and no kingdom was found that meets all of the rules together — try relaxing one.`;
  }
  return { ok: false, message: last };
}

/* Put sorted items in the table's places: an item with an entry in `lockedAt` takes that place (if it is free and in range), and the others
   fill the remaining places in their sorted order. With no locks this is just the sorted list. */
function placeLocked(sorted, keyOf, lockedAt) {
  if (!lockedAt || !lockedAt.size) return sorted;
  const n = sorted.length, out = new Array(n).fill(null), rest = [];
  sorted.forEach(x => { const at = lockedAt.get(keyOf(x)); if (at != null && at >= 0 && at < n && !out[at]) out[at] = x; else rest.push(x); });
  let r = 0;
  return out.map(x => x || rest[r++]);
}

/* Landscapes and the setup notes for a chosen set of piles.
   layout.keepOrder      the piles (and landscapes) are already in the order to show, so a re-roll of ONE card changes only that card
                         and nothing around it moves;
   layout.lockedAt, .lockedLandscapeAt   places held by locked cards (see generate). */
function finish(catalog, o, chosen, keepLandscapes, plays, rng, prior = null, layout = {}) {
  const slots = layout.keepOrder ? chosen.map(toSlot) : placeLocked(sortSlots(chosen.map(toSlot)), s => s.key, layout.lockedAt);
  const picked = pickLandscapes(catalog, o, slots, keepLandscapes, rng, prior, layout);
  return { ok: true, slots, landscapes: picked, setup: setupFor(catalog, o, slots, rng, prior?.setup) };
}

function pickLandscapes(catalog, o, slots, keepLandscapes, rng, prior, layout = {}) {
  const types = o.landscapeTypes.length ? o.landscapeTypes : LANDSCAPE_TYPES;
  // Landscapes come from every expansion that has them, whatever expansions the Kingdom cards are drawn from: the expansion
  // choice is about the Kingdom, and a landscape can be added to any game. Only the landscape TYPES chosen narrow them.
  const pool = catalog.landscapes.filter(l => types.includes(l.type) && !o.excludeLandscapes.includes(l.id));
  const kept = keepLandscapes.map(id => catalog.landscapesById.get(id)).filter(Boolean);
  const chosen = kept.slice();
  while (chosen.length < o.landscapes) {
    const cands = pool.filter(l => !chosen.includes(l));
    if (!cands.length) break;
    chosen.push(cands[Math.floor(rng() * cands.length)]);
  }
  // a Trait sits on one Kingdom pile (never two on one pile); a kept Trait keeps its host while that pile is still there
  const hosts = new Set(), out = [];
  const order = [...chosen].sort((a, b) => LANDSCAPE_TYPES.indexOf(a.type) - LANDSCAPE_TYPES.indexOf(b.type) || a.name.localeCompare(b.name));
  for (const l of order) {
    let on = null;
    if (l.type === 'Trait') {
      const before = prior?.landscapes.find(p => p.landscape.id === l.id)?.on;
      const free = slots.filter(s => !hosts.has(s.key));
      const host = (before && free.find(s => s.cards.some(c => c.id === before))) || free[Math.floor(rng() * free.length)];
      if (host) { on = slotCardId(host); hosts.add(host.key); }
    }
    out.push({ landscape: l, on });
  }
  if (layout.keepOrder) { const pos = new Map(chosen.map((l, i) => [l.id, i])); return out.sort((a, b) => pos.get(a.landscape.id) - pos.get(b.landscape.id)); }
  return placeLocked(out, x => x.landscape.id, layout.lockedLandscapeAt);
}

/* The things players forget at setup, derived from the kingdom. All of these follow the official rules:
   - Young Witch needs a Bane: one more Kingdom card costing $2 or $3 (never one that costs Debt).
   - Platinum & Colony (Prosperity) and Shelters (Dark Ages) are used when a random Kingdom card is from that expansion,
     so with n of the cards from it the chance is n / cards. Decided once here (and kept in the link), so everyone sees the same.
   - A Looter needs the Ruins pile. */
function setupFor(catalog, o, slots, rng, prior = null) {
  const setup = { bane: null, platinumColony: null, shelters: null, ruins: false };
  const cards = slots.flatMap(s => s.cards);
  const { list } = pileInfos(catalog);
  const inKingdom = new Set(slots.map(s => s.key));
  if (cards.some(c => c.name === 'Young Witch')) {
    const kept = prior?.bane && !inKingdom.has(prior.bane.key) ? list.find(i => i.key === prior.bane.key) : null;
    const cands = list.filter(i => i.cards.length === 1 && i.cards[0].coins >= 2 && i.cards[0].coins <= 3 && i.cards[0].debt === 0 && !i.cards[0].overpay
      && !inKingdom.has(i.key) && (!o.expansions.length || o.expansions.includes(i.expansion)) && !o.exclude.includes(i.ids[0]));
    const bane = kept && cands.includes(kept) ? kept : cands[Math.floor(rng() * cands.length)];
    if (bane) setup.bane = toSlot(bane);
  }
  const share = exp => slots.filter(s => s.expansion === exp).length / Math.max(1, slots.length);
  const inPlay = exp => !o.expansions.length || o.expansions.includes(exp);
  const roll = (exp, was) => (!inPlay(exp) ? null : (was != null ? was : rng() < share(exp)));
  setup.platinumColony = roll('Prosperity', prior?.platinumColony ?? null);
  setup.shelters = roll('Dark Ages', prior?.shelters ?? null);
  setup.ruins = cards.some(c => c.types.includes('Looter'));
  return setup;
}

/* The setup notes for a kingdom that was changed by hand (or typed in), worked out from the cards in it now, so they always match what is on the
   table. A roll decides Platinum / Colony and Shelters by chance in proportion to the cards (and keeps the answer); a kingdom the players chose
   uses them when half or more of its cards are from Prosperity (Platinum and Colony) or Dark Ages (Shelters), so adding or removing cards moves the answer.
   `baneId` is the Bane the kingdom already had: kept while Young Witch and that card are still in it, else `needsBane` says one must be added. */
export function setupForHand(catalog, cardIds, baneId = null) {
  const { byCardId } = pileInfos(catalog);
  const seen = new Set(), infos = [];
  for (const id of cardIds) { const i = byCardId.get(id); if (i && !seen.has(i.key)) { seen.add(i.key); infos.push(i); } }
  const hasYoungWitch = infos.some(i => i.cards.some(c => c.name === 'Young Witch'));
  const baneInfo = hasYoungWitch && baneId ? byCardId.get(baneId) : null, bane = baneInfo && seen.has(baneInfo.key) ? baneInfo : null;
  const real = infos.filter(i => i !== bane), total = real.length, from = exp => real.filter(i => i.expansion === exp).length;
  const prosperity = from('Prosperity'), darkAges = from('Dark Ages');
  return {
    bane: bane ? toSlot(bane) : null, needsBane: hasYoungWitch && !bane,
    platinumColony: prosperity > 0 && prosperity * 2 >= total, shelters: darkAges > 0 && darkAges * 2 >= total,
    ruins: infos.some(i => i.cards.some(c => c.types.includes('Looter'))), hand: { total, prosperity, darkAges },
  };
}

// ---------------------------------------------------------------- re-rolling one thing
/* Swap one slot for another card that keeps every rule true. */
export function rerollSlot(catalog, options, state, index, { rng = Math.random, plays = null } = {}) {
  const o = normalize(options);
  const current = state.slots.map(s => infoOfSlot(catalog, s)), wanted = o.include.map(id => pileInfos(catalog).byCardId.get(id)).filter(Boolean);
  const pool = poolFor(catalog, o).filter(i => !current.includes(i));
  const order = []; const left = pool.slice();
  const others = current.filter((_, k) => k !== index);
  while (left.length) { const p = pick(left, o, plays, rng, others); order.push(p); left.splice(left.indexOf(p), 1); }   // a weighted shuffle
  for (const cand of order) {
    const next = current.slice(); next[index] = cand;
    if (!breaks(next, o, wanted)) {
      const replaced = state.slots[index];
      const res = finish(catalog, { ...o, landscapes: state.landscapes.length }, next, state.landscapes.map(l => l.landscape.id), plays, rng, {
        landscapes: state.landscapes.map(l => (l.on && replaced.cards.some(c => c.id === l.on) ? { ...l, on: null } : l)), setup: state.setup,
      }, { keepOrder: true });   // the new card takes the old one's place; nothing else moves
      return res;
    }
  }
  return { ok: false, message: 'No other card fits the rules for that slot. Try relaxing a rule.' };
}

export function rerollLandscape(catalog, options, state, index, { rng = Math.random } = {}) {
  const o = normalize(options);
  const types = o.landscapeTypes.length ? o.landscapeTypes : LANDSCAPE_TYPES;
  const have = new Set(state.landscapes.map(l => l.landscape.id));
  const cands = catalog.landscapes.filter(l => types.includes(l.type) && !have.has(l.id) && !o.excludeLandscapes.includes(l.id));
  if (!cands.length) return { ok: false, message: 'There is no other landscape to swap in.' };
  const swap = cands[Math.floor(rng() * cands.length)];
  const ids = state.landscapes.map((l, i) => (i === index ? swap.id : l.landscape.id));
  const slots = state.slots.map(s => infoOfSlot(catalog, s));
  return finish(catalog, { ...o, landscapes: ids.length }, slots, ids, null, rng, { landscapes: state.landscapes.filter((_, i) => i !== index), setup: state.setup }, { keepOrder: true });
}

// ---------------------------------------------------------------- the link
const flag = v => (v ? '1' : '0');

export function optionsToParams(opts, p = new URLSearchParams()) {
  const o = { ...DEFAULT_OPTIONS, ...opts }, d = DEFAULT_OPTIONS;
  o.expansions.forEach(v => p.append('exp', v));
  if (o.cards !== d.cards) p.set('n', String(o.cards));
  if (o.landscapes !== d.landscapes) p.set('nl', String(o.landscapes));
  o.landscapeTypes.forEach(v => p.append('lt', v));
  if (o.maxAttacks != null) p.set('atk', String(o.maxAttacks));
  if (o.reaction) p.set('rx', '1');
  o.require.forEach(v => p.append('req', v));
  o.include.forEach(v => p.append('inc', v));
  o.exclude.forEach(v => p.append('exc', v));
  if (o.favor) p.set('fav', '1');
  if (o.favorPlayed) p.set('fp', '1');
  if (o.junkTrash) p.set('jt', '1');
  if (o.costSpread) p.set('cs', o.costSpread);
  return p;
}
const many = (p, k) => p.getAll(k).filter(Boolean);
const intIn = (v, lo, hi, fallback) => (/^\d{1,2}$/.test(v ?? '') && +v >= lo && +v <= hi ? +v : fallback);
export function optionsFromParams(p) {
  const d = DEFAULT_OPTIONS;
  return {
    expansions: many(p, 'exp'), cards: intIn(p.get('n'), 1, 12, d.cards), landscapes: intIn(p.get('nl'), 0, 6, d.landscapes),
    landscapeTypes: many(p, 'lt').filter(t => LANDSCAPE_TYPES.includes(t)),
    maxAttacks: intIn(p.get('atk'), 0, 12, null), reaction: p.get('rx') === '1',
    require: many(p, 'req').filter(r => REQUIRE_RULES[r]), include: many(p, 'inc'), exclude: many(p, 'exc'), excludeLandscapes: [], favor: p.get('fav') === '1',
    favorPlayed: p.get('fp') === '1', junkTrash: p.get('jt') === '1', costSpread: COST_SPREADS[p.get('cs')] ? p.get('cs') : null,
  };
}

/* The kingdom itself as query parameters: c = one card id per pile, l = landscapes, t = "trait~host card", bane, pc, sh. */
export function kingdomToParams(state, p = new URLSearchParams()) {
  state.slots.forEach(s => p.append('c', slotCardId(s)));
  state.landscapes.forEach(l => p.append('l', l.landscape.id));
  state.landscapes.forEach(l => { if (l.on) p.append('t', `${l.landscape.id}~${l.on}`); });
  if (state.seed != null) p.set('seed', String(state.seed));
  if (state.setup.bane) p.set('bane', slotCardId(state.setup.bane));
  if (state.setup.platinumColony != null) p.set('pc', flag(state.setup.platinumColony));
  if (state.setup.shelters != null) p.set('sh', flag(state.setup.shelters));
  return p;
}
/* Reads a kingdom back from a link, trusting nothing: ids the catalog doesn't know are dropped, a pile named twice counts
   once, and there are never more than 12. Null when no usable card is left. */
export function kingdomFromParams(catalog, p) {
  const { byCardId } = pileInfos(catalog);
  const seen = new Set(), infos = [];
  for (const id of many(p, 'c')) { const i = byCardId.get(id); if (i && !seen.has(i.key)) { seen.add(i.key); infos.push(i); } }
  if (!infos.length) return null;
  const slots = infos.slice(0, 12).map(toSlot);   // in the order written: a locked card's place is part of the kingdom
  const hosts = new Map(many(p, 't').map(t => t.split('~')).filter(t => t.length === 2));
  const landscapes = [...new Set(many(p, 'l'))].map(id => catalog.landscapesById.get(id)).filter(Boolean)
    .map(landscape => { const on = hosts.get(landscape.id); return { landscape, on: landscape.type === 'Trait' && on && byCardId.get(on) && seen.has(byCardId.get(on).key) ? on : null }; });
  const baneInfo = byCardId.get(p.get('bane'));
  const flagOf = k => (p.get(k) === '1' ? true : p.get(k) === '0' ? false : null);
  return {
    slots, landscapes, seed: parseSeed(p.get('seed')),
    setup: {
      bane: baneInfo && !seen.has(baneInfo.key) ? toSlot(baneInfo) : null, platinumColony: flagOf('pc'), shelters: flagOf('sh'),
      ruins: slots.some(s => s.cards.some(c => c.types.includes('Looter'))),
    },
  };
}

// the kingdom as the items the game log stores (the bane is a Kingdom card of the game too)
export function toGameItems(state) {
  return [
    ...state.slots.map(s => ({ kind: 'card', id: slotCardId(s) })),
    ...(state.setup.bane ? [{ kind: 'card', id: slotCardId(state.setup.bane) }] : []),
    ...state.landscapes.map(l => ({ kind: 'landscape', id: l.landscape.id, ...(l.on ? { on: l.on } : {}) })),
  ];
}
