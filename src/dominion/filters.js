/* Pure filtering and sorting for the card and landscape browsers.

   Facets combine with AND. Inside a facet that can hold several values (printed types, mechanics) the user
   picks "all" (card must have every selected one) or "any". There is deliberately NO "without" / "exclude"
   operation anywhere: mechanic tags are positive-only and non-exhaustive, so "has no tag X" would claim
   something the data cannot support. */
import { expansionMeta, humanize } from './constants.js';
import { hasCoin } from './model.js';

export const DEFAULT_CARD_FILTERS = Object.freeze({
  q: '', text: false, expansions: [], types: [], typeMode: 'all', mechanics: [], mechanicMode: 'all',
  costs: [], debt: 'any', unplayed: false, sort: 'name', dir: 'asc',
});
export const DEFAULT_LANDSCAPE_FILTERS = Object.freeze({
  q: '', text: false, types: [], expansions: [], mechanics: [], mechanicMode: 'any', sort: 'name', dir: 'asc',
});

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const matchesText = (haystacks, q) => { const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return true; const hs = haystacks.filter(Boolean).map(norm); return toks.every(t => hs.some(h => h.includes(t))); };
const hits = (have, want, mode) => !want.length || (mode === 'any' ? want.some(w => have.includes(w)) : want.every(w => have.includes(w)));

export function debtMatches(debt, rule) {
  if (rule === 'any' || rule == null) return true;
  if (rule === 'none') return debt === 0;
  if (rule === 'has') return debt > 0;
  return debt === Number(rule);
}

// does the name alone (ignoring card text) match the search? Used to show a text excerpt only for text-only matches.
export const nameMatches = (item, q) => matchesText([item.name, item.previousName], q);

/* `ctx.plays` (optional) is the league's pile play counts, playStats().piles: a Map(pile key -> { games }). Without it,
   "not played yet" matches everything and "times played" sorts by name. */
export function filterCards(cards, f, ctx = {}) {
  return cards.filter(c =>
    matchesText([c.name, c.previousName, f.text && c.text], f.q)
    && (!f.expansions.length || f.expansions.includes(c.expansion))
    && hits(c.types, f.types, f.typeMode)
    && hits(c.mechanicIds, f.mechanics, f.mechanicMode)
    // coin cost: any of the chosen exact costs. A Debt-only card has no coin cost, so it never matches one.
    && (!f.costs.length || (hasCoin(c) && f.costs.includes(c.coins)))
    && debtMatches(c.debt, f.debt)
    && (!f.unplayed || !ctx.plays || !ctx.plays.has(c.pileKey)));
}

const byName = (a, b) => a.name.localeCompare(b.name);
export const CARD_SORTS = ['name', 'expansion', 'types', 'cost', 'copies', 'pile', 'plays'];
export function sortCards(cards, { sort = 'name', dir = 'asc' } = {}, ctx = {}) {
  const sign = dir === 'desc' ? -1 : 1;
  const text = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const cmp = {
    name: byName,
    expansion: (a, b) => expansionMeta(a.expansion).order - expansionMeta(b.expansion).order || byName(a, b),
    // multi-type cards sort by their types read together ("Action Attack" before "Action Duration")
    types: (a, b) => a.types.join(' ').localeCompare(b.types.join(' ')) || byName(a, b),
    copies: (a, b) => a.copies - b.copies || byName(a, b),
    plays: ctx.plays ? (a, b) => (ctx.plays.get(a.pileKey)?.games ?? 0) - (ctx.plays.get(b.pileKey)?.games ?? 0) || byName(a, b) : byName,
  }[sort];
  if (sort === 'cost') {
    // Coins and Debt are different currencies. A Debt-only card has no coin cost, so it can't be placed among the
    // coin costs: those cards go LAST in both directions, ordered among themselves by Debt.
    return cards.slice().sort((a, b) => {
      const ca = hasCoin(a), cb = hasCoin(b);
      if (ca !== cb) return ca ? -1 : 1;
      const d = ca ? (a.coins - b.coins) || (a.debt - b.debt) : a.debt - b.debt;
      return sign * d || byName(a, b);
    });
  }
  if (sort === 'pile') {
    // "no shared pile" isn't a value to order by, so those cards go last in BOTH directions
    return cards.slice().sort((a, b) => {
      if (!a.sharedPile !== !b.sharedPile) return a.sharedPile ? -1 : 1;
      return (a.sharedPile ? sign * text(a.sharedPile, b.sharedPile) : 0) || byName(a, b);
    });
  }
  const out = cards.slice().sort(cmp || byName);
  return sign < 0 ? out.reverse() : out;
}
export const browseCards = (cards, f, ctx = {}) => sortCards(filterCards(cards, f, ctx), f, ctx);

export function filterLandscapes(items, f) {
  return items.filter(l =>
    matchesText([l.name, f.text && l.text], f.q)
    && (!f.types.length || f.types.includes(l.type))
    && (!f.expansions.length || f.expansions.includes(l.expansion))
    && hits(l.mechanicIds, f.mechanics, f.mechanicMode));
}
export const LANDSCAPE_SORTS = ['name', 'type', 'expansion', 'trigger'];
export function sortLandscapes(items, { sort = 'name', dir = 'asc' } = {}) {
  const sign = dir === 'desc' ? -1 : 1;
  if (sort === 'trigger') {
    // sorted by the label people read ("Buy event"), not the raw id; landscapes with no trigger go last in BOTH directions
    const label = l => (l.trigger ? humanize(l.trigger) : '');
    return items.slice().sort((a, b) => {
      if (!a.trigger !== !b.trigger) return a.trigger ? -1 : 1;
      return sign * label(a).localeCompare(label(b)) || byName(a, b);
    });
  }
  const cmp = {
    name: byName,
    type: (a, b) => a.type.localeCompare(b.type) || byName(a, b),
    expansion: (a, b) => expansionMeta(a.expansion).order - expansionMeta(b.expansion).order || byName(a, b),
  }[sort] || byName;
  const out = items.slice().sort(cmp);
  return sign < 0 ? out.reverse() : out;
}
export const browseLandscapes = (items, f) => sortLandscapes(filterLandscapes(items, f), f);

// how many filters are narrowing the list (sorting doesn't count)
export function activeCardFilters(f) {
  return (f.q.trim() ? 1 : 0) + (f.expansions.length ? 1 : 0) + (f.types.length ? 1 : 0) + (f.mechanics.length ? 1 : 0)
    + (f.costs.length ? 1 : 0) + (f.debt !== 'any' ? 1 : 0) + (f.unplayed ? 1 : 0);
}
export const activeLandscapeFilters = f => (f.q.trim() ? 1 : 0) + (f.types.length ? 1 : 0) + (f.expansions.length ? 1 : 0) + (f.mechanics.length ? 1 : 0);

export const toggle = (arr, x) => (arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x]);

/* ---- the filters live in the URL: #/dominion/cards?type=Attack&exp=Empires ---------------------------------------
   Only values that differ from the default are written, repeated keys carry lists, and anything unrecognised is
   dropped on the way in (a hand-edited or stale link must never crash the page or invent a state). */
const oneOf = (v, ok, fallback) => (ok.includes(v) ? v : fallback);
const params = qs => new URLSearchParams(String(qs || '').replace(/^\?/, ''));
const many = (p, key) => p.getAll(key).filter(Boolean);
const wrap = p => { const s = p.toString(); return s ? '?' + s : ''; };

export function cardFiltersToQuery(f) {
  const d = DEFAULT_CARD_FILTERS, p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q);
  if (f.text) p.set('text', '1');
  f.expansions.forEach(v => p.append('exp', v));
  f.types.forEach(v => p.append('type', v));
  if (f.typeMode !== d.typeMode) p.set('tmode', f.typeMode);
  f.mechanics.forEach(v => p.append('mech', v));
  if (f.mechanicMode !== d.mechanicMode) p.set('mmode', f.mechanicMode);
  f.costs.forEach(v => p.append('cost', String(v)));
  if (f.debt !== d.debt) p.set('debt', f.debt);
  if (f.unplayed) p.set('unplayed', '1');
  if (f.sort !== d.sort) p.set('sort', f.sort);
  if (f.dir !== d.dir) p.set('dir', f.dir);
  return wrap(p);
}
export function cardFiltersFromQuery(qs) {
  const p = params(qs), d = DEFAULT_CARD_FILTERS, debt = p.get('debt');
  return {
    q: p.get('q') || '', text: p.get('text') === '1',
    expansions: many(p, 'exp'), types: many(p, 'type'), typeMode: oneOf(p.get('tmode'), ['all', 'any'], d.typeMode),
    mechanics: many(p, 'mech'), mechanicMode: oneOf(p.get('mmode'), ['all', 'any'], d.mechanicMode),
    costs: many(p, 'cost').filter(v => /^\d{1,2}$/.test(v)).map(Number),
    debt: debt && (['any', 'none', 'has'].includes(debt) || /^\d{1,2}$/.test(debt)) ? debt : d.debt,
    unplayed: p.get('unplayed') === '1',
    sort: oneOf(p.get('sort'), CARD_SORTS, d.sort), dir: oneOf(p.get('dir'), ['asc', 'desc'], d.dir),
  };
}
export function landscapeFiltersToQuery(f) {
  const d = DEFAULT_LANDSCAPE_FILTERS, p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q);
  if (f.text) p.set('text', '1');
  f.types.forEach(v => p.append('type', v));
  f.expansions.forEach(v => p.append('exp', v));
  f.mechanics.forEach(v => p.append('tag', v));
  if (f.mechanicMode !== d.mechanicMode) p.set('tmode', f.mechanicMode);
  if (f.sort !== d.sort) p.set('sort', f.sort);
  if (f.dir !== d.dir) p.set('dir', f.dir);
  return wrap(p);
}
export function landscapeFiltersFromQuery(qs) {
  const p = params(qs), d = DEFAULT_LANDSCAPE_FILTERS;
  return {
    q: p.get('q') || '', text: p.get('text') === '1',
    types: many(p, 'type'), expansions: many(p, 'exp'), mechanics: many(p, 'tag'),
    mechanicMode: oneOf(p.get('tmode'), ['all', 'any'], d.mechanicMode),
    sort: oneOf(p.get('sort'), LANDSCAPE_SORTS, d.sort), dir: oneOf(p.get('dir'), ['asc', 'desc'], d.dir),
  };
}

/* A short excerpt of `text` around the first search word it contains, for showing WHY a card matched when only its
   text did. null when no word is found. */
export function textSnippet(text, q, radius = 45) {
  if (!text) return null;
  const flat = String(text).replace(/\s+/g, ' ').trim();
  const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hay = plain(flat).length === flat.length ? plain(flat) : flat.toLowerCase();
  let at = -1, len = 0;
  for (const tok of norm(q).split(/\s+/).filter(Boolean)) {
    const i = hay.indexOf(tok);
    if (i >= 0 && (at < 0 || i < at)) { at = i; len = tok.length; }
  }
  if (at < 0) return null;
  const from = Math.max(0, at - radius), to = Math.min(flat.length, at + len + radius);
  return (from > 0 ? '…' : '') + flat.slice(from, to).trim() + (to < flat.length ? '…' : '');
}

/* Where `id` sits in an ordered list, and its neighbours (null at either end). index is -1 when it isn't in the list. */
export function neighbors(list, id) {
  const index = list.findIndex(x => x.id === id);
  return { index, total: list.length, prev: index > 0 ? list[index - 1] : null, next: index >= 0 && index < list.length - 1 ? list[index + 1] : null };
}
// a random item, never `exceptId` (unless it is the only one). `rand` is injectable so tests are deterministic.
export function pickRandom(list, exceptId = null, rand = Math.random) {
  const pool = list.length > 1 ? list.filter(x => x.id !== exceptId) : list;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] : null;
}
