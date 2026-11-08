/* What is in a kingdom, for the Randomizer's Analyze panel: how many cards do each job, which ones, what they give, and the cost shape. Pure.
   Like every mechanic rule it reads RECORDED tags only (positive-only, see AGENTS.md), so a count is a floor and a zero means "none recorded", never "none exist".
   A role is counted for every pile that does it (a drawer that also attacks counts under both). The "more than usual" hint is the Balance rule's own limit
   (BALANCE_LIMIT) on pure specialists, so the panel and the roll agree on what too many means. */
import { BALANCE_LIMIT, GIVES, GIVES_KEYS, givesTest, pileInfos, rolesOfInfo, specialistOf } from './randomizer.js';

export const ANALYSIS_ROLES = [
  { key: 'draw', label: 'Drawing', short: 'drawer' },
  { key: 'village', label: 'Villages (+Actions)', short: 'village' },
  { key: 'trash', label: 'Trashing', short: 'trasher' },
  { key: 'buy', label: '+Buy', short: '+Buy card' },
  { key: 'coins', label: '+Coins', short: '+Coins card' },
  { key: 'gain', label: 'Gaining', short: 'gainer' },
  { key: 'attack', label: 'Attacks', short: 'Attack' },
];
// a kingdom with none of these on record is worth a word; the others are fine at zero
export const WANTED = ['draw', 'village', 'trash', 'buy'];
export const COST_BINS = [{ label: '$2 or less', test: c => c <= 2 }, { label: '$3', test: c => c === 3 }, { label: '$4', test: c => c === 4 }, { label: '$5', test: c => c === 5 }, { label: '$6+', test: c => c >= 6 }];

export function analyseKingdom(catalog, slots) {
  const { byKey } = pileInfos(catalog);
  const infos = (slots || []).map(s => byKey.get(s.key)).filter(Boolean);
  const entry = i => ({ id: i.cards[0].id, name: i.name, pile: i.key });
  const rows = ANALYSIS_ROLES.map(r => {
    const has = infos.filter(i => rolesOfInfo(i).has(r.key));
    const limit = BALANCE_LIMIT[r.key] ?? null;
    const pure = limit == null ? 0 : infos.filter(i => specialistOf(i, r.key)).length;
    return { key: r.key, label: r.label, short: r.short, count: has.length, cards: has.map(entry), limit, pure, heavy: limit != null && pure > limit, fix: WANTED.includes(r.key) && has.length === 0 ? r.key : (limit != null && pure > limit ? 'heavy:' + r.key : null) };
  });
  const gives = GIVES_KEYS.map(k => ({ key: k, chip: GIVES[k].chip, cards: infos.filter(givesTest(k)).map(entry) })).filter(g => g.cards.length);
  const priced = infos.map(i => i.cards[0]).filter(c => c && c.debt === 0 && c.coins != null);
  const avg = priced.length ? priced.reduce((t, c) => t + c.coins, 0) / priced.length : null;
  const cost = { avg, bins: COST_BINS.map(b => ({ label: b.label, count: priced.filter(c => b.test(c.coins)).length })), debt: infos.filter(i => i.cards[0] && i.cards[0].debt > 0).length };
  // the boxes the Kingdom cards come from (landscapes are not counted), most cards first
  const byBox = new Map(); for (const i of infos) byBox.set(i.expansion, (byBox.get(i.expansion) || 0) + 1);
  const expansions = [...byBox].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const missing = rows.filter(r => WANTED.includes(r.key) && r.count === 0).map(r => r.label);
  const heavy = rows.filter(r => r.heavy);
  const flags = infos.length ? missing.length + heavy.length : 0;
  return { n: infos.length, rows, gives, cost, expansions, missing, heavy, flags };
}

// what stands out, as short sentences (the verdict joins them; the Game night check lists them)
export function concernsOf(a) {
  if (!a.n) return [];
  const out = [];
  for (const r of a.rows) if (WANTED.includes(r.key) && r.count === 0) out.push(`No ${r.key === 'buy' ? '+Buy card' : r.label.replace(' (+Actions)', '').toLowerCase()} on record`);
  for (const r of a.heavy) out.push(`${r.pure} pure ${r.short}s (the usual is ${r.limit})`);
  return out;
}

// the one-line verdict at the top of the panel
export function verdictOf(a) {
  if (!a.n) return 'Nothing to look at yet.';
  const bits = [];
  if (a.missing.length) bits.push(`None recorded: ${a.missing.join(', ').replace('Villages (+Actions)', 'villages')}`);
  for (const r of a.heavy) bits.push(`${r.pure} pure ${r.short}s (the usual is ${r.limit})`);
  return bits.length ? bits.join('. ') + '.' : 'Covers drawing, villages, trashing and +Buy.';
}
