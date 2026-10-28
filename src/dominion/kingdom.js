/* Helpers for a game's Kingdom — the cards and landscapes it was played with. A kingdom item is
   { kind: 'card' | 'landscape', id: <catalog id>, on?: <card id> } ("on" is the Kingdom card a Plunder Trait sits on).
   Pure: no fetching, no DOM. */
import { expansionMeta, PLURAL, LANDSCAPE_TYPES } from './constants.js';
import { norm } from './filters.js';

export const MAX_CARDS = 12, MAX_LANDSCAPES = 6;   // the same caps write_game_kingdom enforces

// the shape add_game/edit_game take as p_kingdom
export const toPayload = items => items.map(i => ({ kind: i.kind, id: i.id, ...(i.on ? { on: i.on } : {}) }));

// "Dark Ages" etc. as the Add Game picker names the set (the catalog says "Dominion Base Game" where the picker says "Base")
export const setNameFor = expansion => expansionMeta(expansion).icon || expansion;
export const landscapeGroupFor = type => PLURAL[type] || type;

// the printed type that gives a card its colour, most distinctive first (an Action-Attack card reads as an Attack)
export const TYPE_PRIORITY = ['Attack', 'Duration', 'Reaction', 'Treasure', 'Victory', 'Action'];
// A card that sits in a shared pile (Knights, Gladiator / Fortune, ...) is shown as that pile: a game's kingdom stores one
// card id per pile, and the pile is what was in the kingdom.
export const displayName = obj => obj.sharedPile || obj.name;
export const primaryType = card => TYPE_PRIORITY.find(t => card.types.includes(t)) || null;

/* The catalog rows an item list refers to, in order. An id the catalog doesn't know (a card removed or renamed since the
   game was logged) comes back as { missing: true } so the page can still say something instead of dropping it. */
export function resolveKingdom(catalog, items) {
  return items.map(i => {
    const obj = i.kind === 'card' ? catalog.cardsById.get(i.id) : catalog.landscapesById.get(i.id);
    return obj ? { ...i, obj, onObj: i.on ? catalog.cardsById.get(i.on) || null : null } : { ...i, missing: true };
  });
}

/* The Sets and landscape groups a kingdom implies, for pre-filling the Add Game pills. A game's SETS are only ever implied by its
   Kingdom CARDS: a landscape (a Renaissance Project, a Menagerie Way...) can be added to any game, so it says nothing about
   which expansions were in play. A landscape only implies its group (Events, Ways, ...). */
export function impliedSets(resolved) {
  const sets = new Set(), groups = new Set();
  resolved.forEach(r => {
    if (r.missing) return;
    if (r.kind === 'card') sets.add(setNameFor(r.obj.expansion)); else groups.add(landscapeGroupFor(r.obj.type));
  });
  return { sets: [...sets], landscapes: [...groups] };
}

/* Type-ahead for the Add Game dialog: cards and landscapes whose name contains every word typed, names that START with
   the first word first. Items already in the kingdom are left out. */
export function searchKingdom(catalog, q, taken = [], limit = 8, kind = null) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  // what is already in: a landscape by id, a card by its PILE (so taking Knights rules out every Knight)
  const have = new Set(taken.map(t => (t.kind === 'card' ? `pile:${catalog.cardsById.get(t.id)?.pileKey ?? t.id}` : `landscape:${t.id}`)));
  const all = [...catalog.cards.map(c => ({ kind: 'card', obj: c, key: `pile:${c.pileKey}` })), ...catalog.landscapes.map(l => ({ kind: 'landscape', obj: l, key: `landscape:${l.id}` }))]
    .filter(x => !kind || x.kind === kind);
  const seen = new Set();
  return all
    .filter(x => !have.has(x.key))
    .map(x => ({ x, n: norm(x.obj.name) + (x.obj.sharedPile ? ' ' + norm(x.obj.sharedPile) : '') }))
    .filter(({ n }) => toks.every(t => n.includes(t)))
    .sort((a, b) => (b.n.startsWith(toks[0]) - a.n.startsWith(toks[0])) || a.n.localeCompare(b.n))
    .filter(({ x }) => !seen.has(x.key) && seen.add(x.key))   // one result per pile
    .slice(0, limit).map(({ x }) => x);
}

// landscape display order, for grouping a list of landscapes
export const landscapeRank = type => { const i = LANDSCAPE_TYPES.indexOf(type); return i < 0 ? 99 : i; };
