#!/usr/bin/env node
/* Read-only check of the LIVE Supabase project, using only the public (anon/publishable) key — exactly what the
   website itself can do. It never needs, and never uses, a service-role key.
     npm run dominion:check-live
   It reads row counts, then confirms that writes are REFUSED. Every write probe is built so it cannot change data
   even if the database wrongly allowed it (a filter that matches nothing, or a row that violates a CHECK).
   Exit 0 = all good, 1 = a check failed, 2 = the catalog isn't installed yet. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sb } from '../../src/lib/supabase.js';
import { ROOT } from './lib/tables.mjs';

const expected = JSON.parse(readFileSync(path.join(ROOT, 'supabase', 'dominion', 'expected_counts.json'), 'utf8'));
const tables = Object.keys(expected).filter(k => k.startsWith('dominion_'));
let fail = 0;
const ok = (name, cond, detail = '') => { if (!cond) fail++; console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${!cond && detail ? '  -> ' + detail : ''}`); };

const count = async t => { const { count: n, error } = await sb.from(t).select('*', { count: 'exact', head: true }); return { n, error }; };

const probe = await count('dominion_kingdom_cards');
if (probe.error && (probe.error.code === 'PGRST205' || probe.error.code === '42P01' || /schema cache/i.test(probe.error.message || ''))) {
  console.log('The Dominion catalog is not installed on the live database yet.\nApply it with the steps in supabase/dominion/README.md, then run this again.');
  process.exit(2);
}

console.log('Row counts (anon key, live project):');
for (const t of tables) { const { n, error } = await count(t); ok(`${t} = ${expected[t]}`, !error && n === expected[t], error ? error.message : `got ${n}`); }
for (const [v, n] of [['dominion_card_catalog', expected.dominion_kingdom_cards], ['dominion_landscape_catalog', expected.dominion_landscapes]]) {
  const r = await count(v); ok(`view ${v} readable = ${n}`, !r.error && r.n === n, r.error ? r.error.message : `got ${r.n}`);
}
const { data: cat } = await sb.from('dominion_card_catalog').select('mechanic_ids').limit(1000);
ok('view carries the mechanic links (sum = 1366)', Array.isArray(cat) && cat.reduce((s, r) => s + r.mechanic_ids.length, 0) === expected.dominion_kingdom_mechanics);

console.log('\nWrites must be refused for the public key (probes that cannot change data even if allowed):');
const refused = e => !!e && (e.code === '42501' || /permission denied|row-level security|not allowed|JWT|401|403/i.test(`${e.message} ${e.code} ${e.status}`));
const tries = {
  'UPDATE (matches no row)':      sb.from('dominion_kingdom_cards').update({ name: 'x' }).eq('card_id', '__no_such_card__'),
  'DELETE (matches no row)':      sb.from('dominion_kingdom_cards').delete().eq('card_id', '__no_such_card__'),
  'INSERT (violates a CHECK)':    sb.from('dominion_kingdom_cards').insert({ card_id: 'zz:probe', expansion: 'x', edition: 'First Edition', name: 'x', cost_raw: '0', cost_coins: 0, overpay: 'no', printed_types: 'x', type_verification: 'x', physical_copies: 1, pile_id: 'x', mechanics_verification: 'x' }),
  'INSERT into taxonomy (invalid)': sb.from('dominion_taxonomy').insert({ mechanic_id: null }),
};
for (const [name, p] of Object.entries(tries)) { const { error, status } = await p; ok(`${name} is refused`, refused(error) || status === 401 || status === 403, error ? `${error.code}: ${error.message}` : `status ${status}: it was ACCEPTED`); }
const after = await count('dominion_kingdom_cards'); ok('card count unchanged afterwards', after.n === expected.dominion_kingdom_cards);

console.log(`\n${fail ? 'FAILED' : 'PASSED'}: ${fail} problem(s)`);
process.exit(fail ? 1 : 0);
