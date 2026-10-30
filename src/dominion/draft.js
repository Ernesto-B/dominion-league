/* The snake draft: instead of rolling the kingdom, the table takes turns choosing it from a pool the randomizer rolled.
   Pure (the random source is a seed, like a roll), so it is tested.

   The pool is twice the kingdom size: the first half follows ALL of the randomizer's rules (so requirements like "a +Buy card" are
   in the pool), the second half is plain extra choice from the same expansions. Landscapes are rolled with the first half and are not
   drafted: they go with whatever kingdom comes out. Picking runs in snake order, 1-2-3-3-2-1-1-2-3-3... so the last seat of a round
   picks again at once and the first seat doesn't get all the best cards. */
import { DEFAULT_OPTIONS, generate, playsFor, seededRng, sortSlots } from './randomizer.js';

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

/* How many cards a Game night draft rolls to choose from, by the number of players: enough to leave the last pick a real choice (4 to 6
   cards) even after everyone has banned one, but few enough that the table is not scanning forever. The table can overwrite it. */
export const DRAFT_PICKS = 10;
export const POOL_SIZES = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
export const poolSizeFor = players => (players >= 5 ? 20 : players === 4 ? 17 : players === 3 ? 16 : 15);

/* The state of a Game night draft, kept in the saved night: { seats, bans, poolSize, draft, picks, banned, finished, error }.
   `showText` is the desktop's "show card text on every card" switch. `draft` is null on the options page, else { seed, options, n, size }, from which the pool is rolled again (a roll is repeatable).
   `picks` and `banned` are pile keys in the order taken (a skipped ban is a null in `banned`: the seat's turn passes with nothing banned). A saved draft for different players is ignored. */
export function draftState(saved, players) {
  const base = { seats: players, bans: true, showText: false, poolSize: null, draft: null, picks: [], banned: [], finished: false, error: '' };
  if (!saved || saved.seats?.length !== players.length || !players.every(p => saved.seats.includes(p))) return base;
  return { ...base, ...saved };
}
// one ban each, in seating order, before the picks (when bans are on)
export const bansNeeded = st => (st.bans ? st.seats.length : 0);

/* What picking by hand after a finished draft changed, from the card ids the draft produced and the ones in the kingdom now: the ids taken out,
   the ids put in, and which put-in card took the place of which taken-out one (in order; extra removals or additions stay unpaired). */
export function handSwaps(original, current) {
  const was = new Set(original), now = new Set(current);
  const removed = original.filter(id => !now.has(id)), added = current.filter(id => !was.has(id));
  return { removed, added, replacedBy: new Map(removed.slice(0, added.length).map((id, i) => [id, added[i]])), extra: added.slice(removed.length) };
}

/* Roll the pool: `n` kingdom cards to pick (default the options' card count) from `size` cards (default twice n). The first n follow ALL the
   randomizer's rules, the rest are plain extra choice. Returns { ok, pool, landscapes, n, size, seed, options } or { ok: false, message }. */
export function rollPool(catalog, options, seed, { plays = null, n: wantN = null, size = null } = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options }, rng = seededRng(seed), n = Math.max(1, Math.min(12, Number(wantN ?? o.cards) || 10));
  const total = Math.max(n, Number(size) || n * 2);
  const use = playsFor(o, plays);
  const first = generate(catalog, { ...o, cards: n }, { rng, plays: use });
  if (!first.ok) return first;
  let rest = [];
  if (total > n) {
    const taken = first.slots.flatMap(s => s.cards.map(c => c.id));
    const more = generate(catalog, { ...o, cards: total - n, landscapes: 0, require: [], include: [], reaction: false, junkTrash: false, exclude: [...o.exclude, ...taken] }, { rng, plays: use });
    if (!more.ok) return { ok: false, message: 'There aren’t enough cards in the chosen expansions to draft from. Add an expansion or relax a rule.' };
    rest = more.slots;
  }
  return { ok: true, pool: sortSlots([...first.slots, ...rest]), landscapes: first.landscapes, n, size: total, seed, options: o };
}

/* The kingdom that comes out of a finished draft, in the same shape as a roll (slots, landscapes, setup), with its setup notes
   (Bane, Platinum / Colony, Shelters, Ruins) worked out from the cards actually chosen. */
export function finishDraft(catalog, draft, pickedKeys) {
  const o = { ...DEFAULT_OPTIONS, cards: draft.n, landscapes: draft.landscapes.length, landscapeTypes: draft.options.landscapeTypes, expansions: draft.options.expansions };
  const res = generate(catalog, o, { rng: seededRng(draft.seed + 1), keep: pickedKeys, keepLandscapes: draft.landscapes.map(l => l.landscape.id) });
  return res.ok ? { ...res, seed: null } : res;
}
