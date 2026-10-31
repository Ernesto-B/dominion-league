/* Pure filtering and sorting for the card and landscape browsers.

   Facets combine with AND. Inside a facet that can hold several values (printed types, mechanics) the user
   picks "all" (card must have every selected one) or "any". There is deliberately NO "without" / "exclude"
   operation anywhere: mechanic tags are positive-only and non-exhaustive, so "has no tag X" would claim
   something the data cannot support. */
import { expansionMeta, humanize } from './constants.js';
import { hasCoin } from './model.js';

export const DEFAULT_CARD_FILTERS = Object.freeze({
  q: '', text: false, expansions: [], expMode: 'any', types: [], typeMode: 'all', mechanics: [], mechanicMode: 'all',
  costs: [], costMode: 'any', debt: 'any', played: 'any', sort: 'name', dir: 'asc',
});
export const DEFAULT_LANDSCAPE_FILTERS = Object.freeze({
  q: '', text: false, types: [], typeMode: 'any', expansions: [], expMode: 'any', mechanics: [], mechanicMode: 'any', costs: [], costMode: 'any', debt: 'any', played: 'any', sort: 'name', dir: 'asc',
});

export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const matchesText = (haystacks, q) => { const toks = norm(q).split(/\s+/).filter(Boolean); if (!toks.length) return true; const hs = haystacks.filter(Boolean).map(norm); return toks.every(t => hs.some(h => h.includes(t))); };
// 'none' = the card has none of the chosen values (only offered where the data is complete: printed types, expansions, coin costs, landscape types; never for mechanic tags)
// 'exact' = the card's printed types are precisely the chosen ones (what a row of "Most common type combinations" counts)
const hits = (have, want, mode) => !want.length || (mode === 'none' ? !want.some(w => have.includes(w)) : mode === 'any' ? want.some(w => have.includes(w)) : mode === 'exact' ? want.length === have.length && want.every(w => have.includes(w)) : want.every(w => have.includes(w)));

// a value a card has exactly one of (its expansion, a landscape's type): in the list, or with 'none' not in it
const hitsOne = (v, want, mode) => !want.length || (mode === 'none' ? !want.includes(v) : want.includes(v));

export function debtMatches(debt, rule) {
  if (rule === 'any' || rule == null) return true;
  if (rule === 'none') return debt === 0;
  if (rule === 'has') return debt > 0;
  return debt === Number(rule);
}

// does the name alone (ignoring card text) match the search? Used to show a text excerpt only for text-only matches.
export const nameMatches = (item, q) => matchesText([item.name, item.previousName], q);

/* `ctx.plays` (optional) is the league's pile play counts, playStats().piles: a Map(pile key -> { games }). Without it,
   "played"/"not played yet" match everything and "times played" sorts by name. */
export function filterCards(cards, f, ctx = {}) {
  return cards.filter(c =>
    matchesText([c.name, c.previousName, f.text && c.text], f.q)
    && hitsOne(c.expansion, f.expansions, f.expMode)
    && hits(c.types, f.types, f.typeMode)
    && hits(c.mechanicIds, f.mechanics, f.mechanicMode)
    // coin cost: any of the chosen exact costs. A Debt-only card has no coin cost, so it never matches one.
    && (!f.costs.length || (hasCoin(c) && f.costs.includes(c.coins)) === (f.costMode !== 'none'))
    && debtMatches(c.debt, f.debt)
    && (f.played === 'any' || !ctx.plays || (f.played === 'yes') === ctx.plays.has(c.pileKey)));
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

/* What a landscape's cost chip is: its coin cost, or 'none' for one with no printed cost (Landmarks, Ways, Traits). A Debt-only cost has no coin cost, so it is
   neither (null) and only the Debt chips find it, as with the Kingdom cards. */
export const NO_COST = 'none';
export const landscapeCostKey = l => (l.coins == null ? NO_COST : hasCoin(l) ? l.coins : null);

/* `ctx.plays` (optional) is the league's landscape play counts, playStats().landscapes: a Map(landscape id -> { games }). */
export function filterLandscapes(items, f, ctx = {}) {
  return items.filter(l =>
    matchesText([l.name, f.text && l.text], f.q)
    && hitsOne(l.type, f.types, f.typeMode)
    && hitsOne(l.expansion, f.expansions, f.expMode)
    && hits(l.mechanicIds, f.mechanics, f.mechanicMode)
    && (!f.costs.length || f.costs.includes(landscapeCostKey(l)) === (f.costMode !== 'none'))
    && debtMatches(l.debt, f.debt)
    && (f.played === 'any' || !ctx.plays || (f.played === 'yes') === ctx.plays.has(l.id)));
}
export const LANDSCAPE_SORTS = ['name', 'type', 'expansion', 'trigger', 'cost'];
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
  if (sort === 'cost') {
    // coins, then Debt; the landscapes with no cost (Landmarks, Ways, Traits) go last in BOTH directions
    return items.slice().sort((a, b) => {
      if ((a.coins == null) !== (b.coins == null)) return a.coins != null ? -1 : 1;
      if (a.coins == null) return byName(a, b);
      return sign * (a.coins - b.coins || a.debt - b.debt) || byName(a, b);
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
export const browseLandscapes = (items, f, ctx = {}) => sortLandscapes(filterLandscapes(items, f, ctx), f);

/* The number beside a filter chip: how many items the list would show if that value were chosen, with every OTHER filter as it is now. A facet that takes
   "any of" its values (expansions, costs, landscape types, or a mode set to 'any') counts the items that pass the other filters and have this value; a facet
   that takes "all of" them ('all' / 'exact' mode) keeps what is already chosen and adds this value; single-choice facets (debt, played) swap in this value.
   `filterFn` is filterCards or filterLandscapes. */
export function facetCount(items, f, filterFn, ctx, facet, value, mode) {
  let patch;
  if (facet === 'debt' || facet === 'played') patch = { [facet]: value };
  else { const cur = f[facet] || []; patch = { [facet]: mode && mode !== 'any' ? (cur.includes(value) ? cur : [...cur, value]) : [value] }; }
  return filterFn(items, { ...f, ...patch }, ctx).length;
}

/* ONE "Match: all of / any of / none of" row drives every group of chips at once (the per-group modes below stay in the filter state and the link).
   "none of" excludes printed types, expansions, coin costs and landscape types, whose data is complete. A card has exactly one expansion and one coin
   cost, so "all of" can only mean "any of" for those. Recorded mechanics / tags are positive-only (a missing tag proves nothing), so they never
   exclude: under "none of" they stay "any of". */
export const cardMatchOf = f => f.typeMode;                                          // 'all' | 'any' | 'none' (| 'exact', from a link)
export const cardMatchPatch = m => ({ typeMode: m, expMode: m === 'none' ? 'none' : 'any', costMode: m === 'none' ? 'none' : 'any', mechanicMode: m === 'none' ? 'any' : m });
export const landscapeMatchOf = f => (f.typeMode === 'none' ? 'none' : f.mechanicMode);
export const landscapeMatchPatch = m => ({ typeMode: m === 'none' ? 'none' : 'any', expMode: m === 'none' ? 'none' : 'any', costMode: m === 'none' ? 'none' : 'any', mechanicMode: m === 'none' ? 'any' : m });

// how many filters are narrowing the list (sorting doesn't count)
export function activeCardFilters(f) {
  return (f.q.trim() ? 1 : 0) + (f.expansions.length ? 1 : 0) + (f.types.length ? 1 : 0) + (f.mechanics.length ? 1 : 0)
    + (f.costs.length ? 1 : 0) + (f.debt !== 'any' ? 1 : 0) + (f.played !== 'any' ? 1 : 0);
}
export const activeLandscapeFilters = f => (f.q.trim() ? 1 : 0) + (f.types.length ? 1 : 0) + (f.expansions.length ? 1 : 0) + (f.mechanics.length ? 1 : 0) + (f.costs.length ? 1 : 0) + (f.debt !== 'any' ? 1 : 0) + (f.played !== 'any' ? 1 : 0);

/* One short label per active filter group, for the "what is filtering this list" strip (components/FilterSummary.jsx). `clear` is the patch that
   switches that group off. The search box is not listed (it is on screen and shows its own text). The same shape serves the Kingdom cards and the Landscapes (they share these field names). */
export function describeFilters(f, label = v => String(v)) {
  const out = [], list = (key, name, modeKey) => {
    if (!f[key] || !f[key].length) return;
    const none = f[modeKey] === 'none';
    out.push({ key, text: `${none ? 'Not ' : ''}${name}: ${f[key].map(label).join(', ')}`, clear: { [key]: [] } });
  };
  list('types', 'Type', 'typeMode'); list('expansions', 'Set', 'expMode'); list('mechanics', 'Tag', 'mechanicMode');
  if (f.costs && f.costs.length) out.push({ key: 'costs', text: `${f.costMode === 'none' ? 'Not ' : ''}Cost: ${f.costs.map(c => (c === NO_COST ? 'none' : '$' + c)).join(', ')}`, clear: { costs: [] } });
  if (f.debt && f.debt !== 'any') out.push({ key: 'debt', text: f.debt === 'none' ? 'No debt' : f.debt === 'has' ? 'Has debt' : `${f.debt} debt`, clear: { debt: 'any' } });
  if (f.played && f.played !== 'any') out.push({ key: 'played', text: f.played === 'yes' ? 'Played' : 'Not played yet', clear: { played: 'any' } });
  return out;
}

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
  if (f.expMode !== d.expMode) p.set('emode', f.expMode);
  f.types.forEach(v => p.append('type', v));
  if (f.typeMode !== d.typeMode) p.set('tmode', f.typeMode);
  f.mechanics.forEach(v => p.append('mech', v));
  if (f.mechanicMode !== d.mechanicMode) p.set('mmode', f.mechanicMode);
  f.costs.forEach(v => p.append('cost', String(v)));
  if (f.costMode !== d.costMode) p.set('cmode', f.costMode);
  if (f.debt !== d.debt) p.set('debt', f.debt);
  if (f.played !== d.played) p.set('played', f.played);
  if (f.sort !== d.sort) p.set('sort', f.sort);
  if (f.dir !== d.dir) p.set('dir', f.dir);
  return wrap(p);
}
export function cardFiltersFromQuery(qs) {
  const p = params(qs), d = DEFAULT_CARD_FILTERS, debt = p.get('debt');
  return {
    q: p.get('q') || '', text: p.get('text') === '1',
    expansions: many(p, 'exp'), expMode: oneOf(p.get('emode'), ['any', 'none'], d.expMode), types: many(p, 'type'), typeMode: oneOf(p.get('tmode'), ['all', 'any', 'none', 'exact'], d.typeMode),
    mechanics: many(p, 'mech'), mechanicMode: oneOf(p.get('mmode'), ['all', 'any'], d.mechanicMode),
    costs: many(p, 'cost').filter(v => /^\d{1,2}$/.test(v)).map(Number), costMode: oneOf(p.get('cmode'), ['any', 'none'], d.costMode),
    debt: debt && (['any', 'none', 'has'].includes(debt) || /^\d{1,2}$/.test(debt)) ? debt : d.debt,
    played: oneOf(p.get('played'), ['yes', 'no'], p.get('unplayed') === '1' ? 'no' : d.played),   // ?unplayed=1 is the older spelling of ?played=no
    sort: oneOf(p.get('sort'), CARD_SORTS, d.sort), dir: oneOf(p.get('dir'), ['asc', 'desc'], d.dir),
  };
}
export function landscapeFiltersToQuery(f) {
  const d = DEFAULT_LANDSCAPE_FILTERS, p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q);
  if (f.text) p.set('text', '1');
  f.types.forEach(v => p.append('type', v));
  if (f.typeMode !== d.typeMode) p.set('ltmode', f.typeMode);
  f.expansions.forEach(v => p.append('exp', v));
  if (f.expMode !== d.expMode) p.set('emode', f.expMode);
  f.mechanics.forEach(v => p.append('tag', v));
  if (f.mechanicMode !== d.mechanicMode) p.set('tmode', f.mechanicMode);
  f.costs.forEach(v => p.append('cost', String(v)));
  if (f.costMode !== d.costMode) p.set('cmode', f.costMode);
  if (f.debt !== d.debt) p.set('debt', f.debt);
  if (f.played !== d.played) p.set('played', f.played);
  if (f.sort !== d.sort) p.set('sort', f.sort);
  if (f.dir !== d.dir) p.set('dir', f.dir);
  return wrap(p);
}
export function landscapeFiltersFromQuery(qs) {
  const p = params(qs), d = DEFAULT_LANDSCAPE_FILTERS, debt = p.get('debt');
  return {
    q: p.get('q') || '', text: p.get('text') === '1',
    types: many(p, 'type'), typeMode: oneOf(p.get('ltmode'), ['any', 'none'], d.typeMode), expansions: many(p, 'exp'), expMode: oneOf(p.get('emode'), ['any', 'none'], d.expMode), mechanics: many(p, 'tag'),
    mechanicMode: oneOf(p.get('tmode'), ['all', 'any'], d.mechanicMode),
    costs: many(p, 'cost').filter(v => v === NO_COST || /^\d{1,2}$/.test(v)).map(v => (v === NO_COST ? v : Number(v))), costMode: oneOf(p.get('cmode'), ['any', 'none'], d.costMode),
    debt: debt && (['any', 'none', 'has'].includes(debt) || /^\d{1,2}$/.test(debt)) ? debt : d.debt, played: oneOf(p.get('played'), ['yes', 'no'], d.played),
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
