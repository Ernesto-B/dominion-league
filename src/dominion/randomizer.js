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

export const REQUIRE_RULES = {
  village: { label: 'a Village (+Actions)', tags: ['village'] },
  draw: { label: 'card drawing', tags: ['draw', 'terminal_draw'] },
  trash: { label: 'trashing', tags: ['trashing_from_hand', 'trashing_from_deck', 'trashing_from_play', 'trashing_from_discard'] },
  buy: { label: 'a +Buy', tags: ['plus_buy'] },
};

export const MAX_ATTACK_CHOICES = [0, 1, 2, 3];   // "no Attacks", "at most 1"... ; null = any number
export const DEFAULT_OPTIONS = Object.freeze({
  expansions: [],          // empty = every owned expansion
  cards: 10,               // Kingdom piles
  landscapes: 0,           // how many Events/Landmarks/Projects/Ways/Traits
  landscapeTypes: [],      // empty = all five types
  maxAttacks: null,        // null = any number of Attack piles
  reaction: false,         // if there is an Attack, make sure there is a Reaction too
  require: [],             // keys of REQUIRE_RULES
  include: [],             // card ids that must be in (their pile is)
  exclude: [],             // card ids that must not be (their pile isn't)
  favor: false,            // weight the draw towards piles that have been played less (needs the `plays` option)
});
export const CARD_COUNTS = [10, 9, 8, 7, 6, 5, 11, 12];

// mulberry32: a tiny seeded generator, for tests
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
      attack: cards.some(c => c.types.includes('Attack')), reaction: cards.some(c => c.types.includes('Reaction')),
    };
  }).filter(i => i.cards.length);
  const out = { list: infos, byKey: new Map(infos.map(i => [i.key, i])), byCardId: new Map(infos.flatMap(i => i.ids.map(id => [id, i]))) };
  infoCache.set(catalog, out);
  return out;
}
export const pileKeyOf = (catalog, cardId) => pileInfos(catalog).byCardId.get(cardId)?.key ?? null;
const satisfies = (info, rule) => REQUIRE_RULES[rule].tags.some(t => info.tags.has(t));

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

const weightOf = (info, o, plays) => (o.favor && plays ? 1 / (1 + (plays.get(info.key) || 0)) : 1);   // plays: Map(pile key -> games)
function pick(candidates, o, plays, rng) {
  if (!o.favor || !plays) return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  const ws = candidates.map(c => weightOf(c, o, plays)); let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) { r -= ws[i]; if (r < 0) return candidates[i]; }
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------- the draw
/* generate(catalog, options, { rng, keep, keepLandscapes, plays })
     keep            pile keys that must stay (locked cards)        keepLandscapes   landscape ids that must stay
     plays           Map(pile key -> games played, see playStats.js pilesPlayed), used when options.favor is on
   Returns { ok: true, slots, landscapes: [{ landscape, on }], setup } or { ok: false, message }. */
export function generate(catalog, options = {}, { rng = Math.random, keep = [], keepLandscapes = [], plays = null } = {}) {
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
      const p = pick(cands, o, plays, rng); chosen.push(p); locked.push(p);
    }
    if (failed) return { ok: false, message: failed };
    while (chosen.length < o.cards) {
      const cands = eligible(chosen);
      if (!cands.length) return { ok: false, message: `The chosen expansions only have ${pool.length} cards that fit your rules, not ${o.cards}. Add an expansion or relax a rule.` };
      chosen.push(pick(cands, o, plays, rng));
    }
    // "a Reaction if there is an Attack": swap one free slot for a Reaction rather than rolling the whole kingdom again
    if (o.reaction && attackCount(chosen) > 0 && !chosen.some(i => i.reaction)) {
      const swappable = chosen.filter(i => !locked.includes(i)), rx = eligible(chosen).filter(i => i.reaction);
      if (swappable.length && rx.length) chosen[chosen.indexOf(swappable[Math.floor(rng() * swappable.length)])] = pick(rx, o, plays, rng);
    }
    const why = breaks(chosen, o, wanted);
    if (!why) return finish(catalog, o, chosen, keepLandscapes, plays, rng);
    last = `${why}, and no kingdom was found that meets all of the rules together — try relaxing one.`;
  }
  return { ok: false, message: last };
}

/* Landscapes and the setup notes for a chosen set of piles. */
function finish(catalog, o, chosen, keepLandscapes, plays, rng, prior = null) {
  const slots = sortSlots(chosen.map(toSlot));
  const picked = pickLandscapes(catalog, o, slots, keepLandscapes, rng, prior);
  return { ok: true, slots, landscapes: picked, setup: setupFor(catalog, o, slots, rng, prior?.setup) };
}

function pickLandscapes(catalog, o, slots, keepLandscapes, rng, prior) {
  const types = o.landscapeTypes.length ? o.landscapeTypes : LANDSCAPE_TYPES;
  const pool = catalog.landscapes.filter(l => types.includes(l.type) && (!o.expansions.length || o.expansions.includes(l.expansion)));
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
  return out;
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

// ---------------------------------------------------------------- re-rolling one thing
/* Swap one slot for another card that keeps every rule true. */
export function rerollSlot(catalog, options, state, index, { rng = Math.random, plays = null } = {}) {
  const o = normalize(options);
  const current = state.slots.map(s => infoOfSlot(catalog, s)), wanted = o.include.map(id => pileInfos(catalog).byCardId.get(id)).filter(Boolean);
  const pool = poolFor(catalog, o).filter(i => !current.includes(i));
  const order = []; const left = pool.slice();
  while (left.length) { const p = pick(left, o, plays, rng); order.push(p); left.splice(left.indexOf(p), 1); }   // a weighted shuffle
  for (const cand of order) {
    const next = current.slice(); next[index] = cand;
    if (!breaks(next, o, wanted)) {
      const replaced = state.slots[index];
      const res = finish(catalog, { ...o, landscapes: state.landscapes.length }, next, state.landscapes.map(l => l.landscape.id), plays, rng, {
        landscapes: state.landscapes.map(l => (l.on && replaced.cards.some(c => c.id === l.on) ? { ...l, on: null } : l)), setup: state.setup,
      });
      return res;
    }
  }
  return { ok: false, message: 'No other card fits the rules for that slot. Try relaxing a rule.' };
}

export function rerollLandscape(catalog, options, state, index, { rng = Math.random } = {}) {
  const o = normalize(options);
  const types = o.landscapeTypes.length ? o.landscapeTypes : LANDSCAPE_TYPES;
  const have = new Set(state.landscapes.map(l => l.landscape.id));
  const cands = catalog.landscapes.filter(l => types.includes(l.type) && !have.has(l.id) && (!o.expansions.length || o.expansions.includes(l.expansion)));
  if (!cands.length) return { ok: false, message: 'There is no other landscape to swap in.' };
  const swap = cands[Math.floor(rng() * cands.length)];
  const ids = state.landscapes.map((l, i) => (i === index ? swap.id : l.landscape.id));
  const slots = state.slots.map(s => infoOfSlot(catalog, s));
  return finish(catalog, { ...o, landscapes: ids.length }, slots, ids, null, rng, { landscapes: state.landscapes.filter((_, i) => i !== index), setup: state.setup });
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
    require: many(p, 'req').filter(r => REQUIRE_RULES[r]), include: many(p, 'inc'), exclude: many(p, 'exc'), favor: p.get('fav') === '1',
  };
}

/* The kingdom itself as query parameters: c = one card id per pile, l = landscapes, t = "trait~host card", bane, pc, sh. */
export function kingdomToParams(state, p = new URLSearchParams()) {
  state.slots.forEach(s => p.append('c', slotCardId(s)));
  state.landscapes.forEach(l => p.append('l', l.landscape.id));
  state.landscapes.forEach(l => { if (l.on) p.append('t', `${l.landscape.id}~${l.on}`); });
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
  const slots = sortSlots(infos.slice(0, 12).map(toSlot));
  const hosts = new Map(many(p, 't').map(t => t.split('~')).filter(t => t.length === 2));
  const landscapes = [...new Set(many(p, 'l'))].map(id => catalog.landscapesById.get(id)).filter(Boolean)
    .sort((a, b) => LANDSCAPE_TYPES.indexOf(a.type) - LANDSCAPE_TYPES.indexOf(b.type) || a.name.localeCompare(b.name))
    .map(landscape => { const on = hosts.get(landscape.id); return { landscape, on: landscape.type === 'Trait' && on && byCardId.get(on) && seen.has(byCardId.get(on).key) ? on : null }; });
  const baneInfo = byCardId.get(p.get('bane'));
  const flagOf = k => (p.get(k) === '1' ? true : p.get(k) === '0' ? false : null);
  return {
    slots, landscapes,
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
