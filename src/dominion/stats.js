/* Counts and distributions for the Overview and Statistics pages. Pure functions of the catalog.
   Every number states what it counts — see the vocabulary at the top of model.js. */
import { hasCoin } from './model.js';
import { MATRIX_SKIPPED_TYPES } from './constants.js';

const tally = (items, key) => { const m = new Map(); items.forEach(i => { const k = key(i); m.set(k, (m.get(k) || 0) + 1); }); return m; };
const sortDesc = (m, tie = (a, b) => String(a.key).localeCompare(String(b.key))) =>
  [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || tie(a, b));
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function summarize(catalog) {
  const { cards, piles, landscapes, artifacts, taxonomy } = catalog;
  const names = new Set(cards.map(c => c.name)).size;                       // distinct card NAMES
  const copies = sum(piles, p => p.copies);                                 // PHYSICAL cards (from the pile totals)
  const copiesFromCards = sum(cards, c => c.copies);

  const byExpansion = catalog.ownedExpansions.map(e => {
    const cs = cards.filter(c => c.expansion === e.name), ps = piles.filter(p => p.expansion === e.name);
    const editions = [...new Set(cs.map(c => c.edition))];
    return {
      ...e, names: cs.length, piles: ps.length, copies: sum(ps, p => p.copies),
      avgCoins: avg(cs.filter(hasCoin).map(c => c.coins)), attacks: cs.filter(c => c.types.includes('Attack')).length,
      landscapes: landscapes.filter(l => l.expansion === e.name).length, artifacts: artifacts.filter(a => a.expansion === e.name).length,
      editions,
    };
  });

  // printed types: a card with several types counts once under EACH, so these add up to more than the names
  const typeCounts = new Map();
  cards.forEach(c => c.types.forEach(t => typeCounts.set(t, (typeCounts.get(t) || 0) + 1)));
  const byType = sortDesc(typeCounts);
  const combos = sortDesc(tally(cards.filter(c => c.types.length > 1), c => c.types.join(' + ')));

  // How many card NAMES of each printed type each expansion has. A multi-type card counts under each of its types,
  // so a row can add up to more than that expansion's names; the columns are ordered by overall frequency.
  const matrixTypes = byType.filter(t => !MATRIX_SKIPPED_TYPES.includes(t.key));
  const typeMatrix = {
    types: matrixTypes.map(t => t.key), skipped: MATRIX_SKIPPED_TYPES.filter(t => typeCounts.has(t)),
    rows: byExpansion.map(e => {
      const counts = Object.fromEntries(matrixTypes.map(t => [t.key, cards.filter(c => c.expansion === e.name && c.types.includes(t.key)).length]));
      return { name: e.name, label: e.label, icon: e.icon, names: e.names, counts };
    }),
    totals: Object.fromEntries(matrixTypes.map(t => [t.key, t.count])),
  };

  const landscapeByType = catalog.landscapeTypes.map(t => ({ key: t, count: landscapes.filter(l => l.type === t).length }));
  const landscapeByExpansion = catalog.ownedExpansions.map(e => ({ key: e.name, count: landscapes.filter(l => l.expansion === e.name).length })).filter(x => x.count);

  const multiNamePiles = piles.filter(p => p.names > 1);
  const pileSizes = sortDesc(tally(piles, p => p.names), (a, b) => a.key - b.key).sort((a, b) => a.key - b.key);   // key = names in the pile
  const pileCopies = sortDesc(tally(piles, p => p.copies), (a, b) => a.key - b.key).sort((a, b) => a.key - b.key);   // key = physical cards in the pile

  // coin cost counts only cards that HAVE a coin cost; the Debt-only cards (no coin part) are reported separately
  const coinCosts = [...tally(cards.filter(hasCoin), c => c.coins)].map(([key, count]) => ({ key, count })).sort((a, b) => a.key - b.key);
  const debtOnly = cards.filter(c => !hasCoin(c)).sort((a, b) => a.name.localeCompare(b.name));
  // sorted by name: these are printed as lists, and the order must not depend on the database's row/collation order
  const byName = (a, b) => a.name.localeCompare(b.name);
  const debtCards = cards.filter(c => c.debt > 0).sort(byName), overpayCards = cards.filter(c => c.overpay).sort(byName);

  const mechCounts = new Map();
  cards.forEach(c => c.mechanicIds.forEach(m => mechCounts.set(m, (mechCounts.get(m) || 0) + 1)));
  const frequency = sortDesc(mechCounts).map(x => ({ ...x, id: x.key, definition: taxonomy.get(x.key)?.definition ?? null }));
  const relationships = sum(cards, c => c.mechanicIds.length);
  const verification = sortDesc(tally(cards, c => c.mechanicsVerification));
  const typeVerification = sortDesc(tally(cards, c => c.typeVerification));

  return {
    names, piles: piles.length, copies, copiesFromCards,
    expansions: catalog.ownedExpansions.length, landscapes: landscapes.length, artifacts: artifacts.length,
    byExpansion, byType, typeMatrix, combos, multiType: cards.filter(c => c.types.length > 1).length,
    landscapeByType, landscapeByExpansion,
    multiNamePiles, extraNames: names - piles.length, pileSizes, pileCopies,
    coinCosts, debtOnly, debtCards, overpayCards,
    avgCoins: avg(cards.filter(hasCoin).map(c => c.coins)), attacks: cards.filter(c => c.types.includes('Attack')).length,
    mechanics: {
      relationships, expectedRelationships: catalog.meta.mechanicRelationshipCount,
      cardsWithTag: cards.filter(c => c.mechanicIds.length).length, distinct: mechCounts.size, taxonomySize: taxonomy.size,
      frequency, verification, pending: cards.filter(c => /pending/i.test(c.mechanicsVerification)).length,
    },
    typeVerification,
    // internal consistency flags the UI can surface as a data-quality note
    checks: {
      copiesAgree: copies === copiesFromCards,
      relationshipsAgree: catalog.meta.mechanicRelationshipCount == null || catalog.meta.mechanicRelationshipCount === relationships,
      pileNamesAgree: piles.every(p => p.names === p.cardIds.length),
    },
  };
}

/* Orders the expansion rows of the type matrix. key: null = the collection's own order; 'expansion' = A–Z by name;
   'names' = card names; otherwise a printed type (its count in that expansion). Ties fall back to A–Z, whichever
   direction, so equal counts never reshuffle. */
export function sortMatrixRows(rows, { key = null, dir = 'asc' } = {}) {
  if (!key) return rows;
  const sign = dir === 'desc' ? -1 : 1;
  const val = r => (key === 'names' ? r.names : r.counts[key]);
  return rows.slice().sort((a, b) => (key === 'expansion'
    ? sign * a.label.localeCompare(b.label)
    : sign * (val(a) - val(b)) || a.label.localeCompare(b.label)));
}
