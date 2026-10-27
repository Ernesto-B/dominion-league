/* Pure filtering and sorting for the card and landscape browsers.

   Facets combine with AND. Inside a facet that can hold several values (printed types, mechanics) the user
   picks "all" (card must have every selected one) or "any". There is deliberately NO "without" / "exclude"
   operation anywhere: mechanic tags are positive-only and non-exhaustive, so "has no tag X" would claim
   something the data cannot support. */
import { expansionMeta, humanize } from './constants.js';
import { hasCoin } from './model.js';

export const DEFAULT_CARD_FILTERS = Object.freeze({
  q: '', expansions: [], types: [], typeMode: 'all', mechanics: [], mechanicMode: 'all',
  costs: [], debt: 'any', sort: 'name', dir: 'asc',
});
export const DEFAULT_LANDSCAPE_FILTERS = Object.freeze({
  q: '', types: [], expansions: [], mechanics: [], mechanicMode: 'any', sort: 'name', dir: 'asc',
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

export function filterCards(cards, f) {
  return cards.filter(c =>
    matchesText([c.name, c.previousName], f.q)
    && (!f.expansions.length || f.expansions.includes(c.expansion))
    && hits(c.types, f.types, f.typeMode)
    && hits(c.mechanicIds, f.mechanics, f.mechanicMode)
    // coin cost: any of the chosen exact costs. A Debt-only card has no coin cost, so it never matches one.
    && (!f.costs.length || (hasCoin(c) && f.costs.includes(c.coins)))
    && debtMatches(c.debt, f.debt));
}

const byName = (a, b) => a.name.localeCompare(b.name);
export const CARD_SORTS = ['name', 'expansion', 'types', 'cost', 'copies', 'pile'];
export function sortCards(cards, { sort = 'name', dir = 'asc' } = {}) {
  const sign = dir === 'desc' ? -1 : 1;
  const text = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const cmp = {
    name: byName,
    expansion: (a, b) => expansionMeta(a.expansion).order - expansionMeta(b.expansion).order || byName(a, b),
    // multi-type cards sort by their types read together ("Action Attack" before "Action Duration")
    types: (a, b) => a.types.join(' ').localeCompare(b.types.join(' ')) || byName(a, b),
    copies: (a, b) => a.copies - b.copies || byName(a, b),
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
export const browseCards = (cards, f) => sortCards(filterCards(cards, f), f);

export function filterLandscapes(items, f) {
  return items.filter(l =>
    matchesText([l.name], f.q)
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
    + (f.costs.length ? 1 : 0) + (f.debt !== 'any' ? 1 : 0);
}
export const activeLandscapeFilters = f => (f.q.trim() ? 1 : 0) + (f.types.length ? 1 : 0) + (f.expansions.length ? 1 : 0) + (f.mechanics.length ? 1 : 0);

export const toggle = (arr, x) => (arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x]);
