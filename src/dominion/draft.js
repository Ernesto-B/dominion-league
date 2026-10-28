/* The snake draft: instead of rolling the kingdom, the table takes turns choosing it from a pool the randomizer rolled.
   Pure (the random source is a seed, like a roll), so it is tested.

   The pool is twice the kingdom size: the first half follows ALL of the randomizer's rules (so requirements like "a +Buy card" are
   in the pool), the second half is plain extra choice from the same expansions. Landscapes are rolled with the first half and are not
   drafted: they go with whatever kingdom comes out. Picking runs in snake order, 1-2-3-3-2-1-1-2-3-3... so the last seat of a round
   picks again at once and the first seat doesn't get all the best cards. */
import { DEFAULT_OPTIONS, generate, seededRng, sortSlots } from './randomizer.js';

// whose turn is pick number `i` (0-based) at a table of `players` seats: the seat index
export function snakeSeat(i, players) {
  const round = Math.floor(i / players), at = i % players;
  return round % 2 === 0 ? at : players - 1 - at;
}
export const snakeOrder = (names, picks) => Array.from({ length: picks }, (_, i) => names[snakeSeat(i, names.length)]);

export function shuffled(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* Roll the pool. Returns { ok, pool, landscapes, n, seed, options } or { ok: false, message }. */
export function rollPool(catalog, options, seed, { plays = null } = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options }, rng = seededRng(seed), n = Math.max(1, Math.min(12, Number(o.cards) || 10));
  const use = plays && o.favor ? plays : null;
  const first = generate(catalog, { ...o, cards: n }, { rng, plays: use });
  if (!first.ok) return first;
  const taken = first.slots.flatMap(s => s.cards.map(c => c.id));
  const more = generate(catalog, { ...o, cards: n, landscapes: 0, require: [], include: [], reaction: false, exclude: [...o.exclude, ...taken] }, { rng, plays: use });
  if (!more.ok) return { ok: false, message: 'There aren’t enough cards in the chosen expansions to draft from. Add an expansion or relax a rule.' };
  return { ok: true, pool: sortSlots([...first.slots, ...more.slots]), landscapes: first.landscapes, n, seed, options: o };
}

/* The kingdom that comes out of a finished draft, in the same shape as a roll (slots, landscapes, setup), with its setup notes
   (Bane, Platinum / Colony, Shelters, Ruins) worked out from the cards actually chosen. */
export function finishDraft(catalog, draft, pickedKeys) {
  const o = { ...DEFAULT_OPTIONS, cards: draft.n, landscapes: draft.landscapes.length, landscapeTypes: draft.options.landscapeTypes, expansions: draft.options.expansions };
  const res = generate(catalog, o, { rng: seededRng(draft.seed + 1), keep: pickedKeys, keepLandscapes: draft.landscapes.map(l => l.landscape.id) });
  return res.ok ? { ...res, seed: null } : res;
}
