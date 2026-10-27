#!/usr/bin/env node
/* Validates the Dominion schema + seed against a THROWAWAY local Postgres cluster (never your Supabase project).
     node scripts/dominion/test-db.mjs
   Needs initdb / pg_ctl / psql on PATH (or in a Homebrew postgresql@N/bin). Builds the cluster in a temp dir,
   stubs the Supabase roles, runs the checks, and ALWAYS tears the cluster down afterwards.
   Optional: DOMINION_BUNDLE_DIR=<the original bundle dir> also proves the data equals what the bundle's own
   schema and seed produce. */
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { ROOT } from './lib/tables.mjs';

const DIR = path.join(ROOT, 'supabase', 'dominion');
const expected = JSON.parse(readFileSync(path.join(DIR, 'expected_counts.json'), 'utf8'));
const BUNDLE = process.env.DOMINION_BUNDLE_DIR || path.join(homedir(), 'Downloads', 'dominion_supabase_react_bundle_v1');

// ---- locate postgres binaries
function binDir() {
  const probe = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return null; } };
  const p = probe('initdb'); if (p) return path.dirname(p);
  for (const root of ['/opt/homebrew/opt', '/usr/local/opt', '/usr/lib/postgresql'])
    if (existsSync(root)) for (const d of readdirSync(root).filter(x => /postgres/.test(x)).sort().reverse()) {
      const b = existsSync(path.join(root, d, 'bin', 'initdb')) ? path.join(root, d, 'bin') : path.join(root, d, 'bin');
      if (existsSync(path.join(b, 'initdb'))) return b;
    }
  return null;
}
const BIN = binDir();
if (!BIN) { console.error('SKIP: no local PostgreSQL (initdb/pg_ctl/psql) found. Install postgresql or run these SQL files in a scratch Supabase project.'); process.exit(2); }

const tmp = mkdtempSync(path.join(tmpdir(), 'dominion-pg-'));
const DATA = path.join(tmp, 'data'), SOCK = tmp, PORT = String(54000 + Math.floor(Math.random() * 900));
const bin = n => path.join(BIN, n);
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });

function psql(db, sql, { role, file } = {}) {
  const args = ['-X', '-q', '-t', '-A', '-h', SOCK, '-p', PORT, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'];
  args.push(...(file ? ['-f', file] : ['-c', sql]));
  const env = { ...process.env, ...(role ? { PGOPTIONS: `-c role=${role}` } : {}) };
  const r = run(bin('psql'), args, { env });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const must = (db, sql, o) => { const r = psql(db, sql, o); if (!r.ok) throw new Error(`psql failed: ${r.err}\n${sql.slice(0, 200)}`); return r.out; };

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${!cond && detail ? '  -> ' + detail : ''}`); };

function cleanup() { run(bin('pg_ctl'), ['-D', DATA, '-m', 'immediate', 'stop']); rmSync(tmp, { recursive: true, force: true }); }
process.on('exit', cleanup); process.on('SIGINT', () => process.exit(130));

try {
  // ---- throwaway cluster
  let r = run(bin('initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-locale']);
  if (r.status !== 0) throw new Error('initdb failed: ' + r.stderr);
  r = run(bin('pg_ctl'), ['-D', DATA, '-o', `-p ${PORT} -k ${SOCK} -c listen_addresses=''`, '-w', '-l', path.join(tmp, 'pg.log'), 'start']);
  if (r.status !== 0) throw new Error('pg_ctl start failed: ' + r.stderr);
  const ver = Number(must('postgres', 'show server_version_num'));
  console.log(`local PostgreSQL ${ver} (throwaway cluster in ${tmp})`);
  const legacyPg = ver < 150000;
  if (legacyPg) console.log('NOTE: PostgreSQL < 15 — `security_invoker` views are unsupported here, so that one option is stripped for this local run.\n      Table RLS/privileges ARE fully tested; the views\' security_invoker behaviour is NOT (verify on the real project).\n');

  // ---- stub Supabase's roles and grants. ALTER DEFAULT PRIVILEGES reproduces Supabase's behaviour of
  // granting ALL on every new public table to anon/authenticated — which the schema must then revoke.
  const stubs = `
    create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`;
  const prep = (db) => { must('postgres', `create database ${db}`); if (db === 'dn') must(db, stubs); else must(db, `grant usage on schema public to public;`); };
  const loadSql = (db, file) => {
    let sql = readFileSync(file, 'utf8');
    if (legacyPg) sql = sql.replace(/\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)/gi, '');
    const f = path.join(tmp, `${db}-${path.basename(file)}`); writeFileSync(f, sql);
    const res = psql(db, null, { file: f });
    return res;
  };

  // ---- 1. apply schema, seed, then BOTH again (repeatability)
  must('postgres', 'create database dn'); must('dn', stubs);
  const s1 = loadSql('dn', path.join(DIR, '01_schema_and_rls.sql')); check('01_schema_and_rls.sql applies cleanly', s1.ok, s1.err);
  const d1 = loadSql('dn', path.join(DIR, '02_seed_data.sql'));      check('02_seed_data.sql applies cleanly', d1.ok, d1.err);
  const s2 = loadSql('dn', path.join(DIR, '01_schema_and_rls.sql')); check('schema re-run is a no-op (idempotent)', s2.ok, s2.err);
  const d2 = loadSql('dn', path.join(DIR, '02_seed_data.sql'));      check('seed re-run replaces data cleanly (repeatable)', d2.ok, d2.err);

  // ---- 2. row counts == the bundle's reference counts (never silently adjusted)
  const tableKeys = Object.keys(expected).filter(k => k.startsWith('dominion_'));
  for (const t of tableKeys) {
    const n = Number(must('dn', `select count(*) from public.${t}`));
    check(`${t} has ${expected[t]} rows`, n === expected[t], `got ${n}`);
  }
  check('3,132 physical Kingdom copies (cards) == (piles)', must('dn', `select (select sum(physical_copies) from dominion_kingdom_cards)||'/'||(select sum(physical_copies) from dominion_kingdom_piles)`) === '3132/3132');
  check('distinct names (331) minus piles (310) == extra names in multi-name piles (21)', must('dn', `select (select count(*) from dominion_kingdom_cards)-(select count(*) from dominion_kingdom_piles) = (select sum(distinct_names-1) from dominion_kingdom_piles)`) === 't');
  check('every pile\'s card_ids exist and match distinct_names', must('dn', `select count(*) from dominion_kingdom_piles p where (select count(*) from unnest(string_to_array(p.card_ids,'|')) x join dominion_kingdom_cards c on c.card_id=x and c.expansion=p.expansion) <> p.distinct_names`) === '0');
  check('landscapes are only the five types, Artifacts separate (5)', must('dn', `select string_agg(distinct object_type, ',' order by object_type) from dominion_landscapes`) === 'Event,Landmark,Project,Way,Trait'.split(',').sort().join(','));
  check('no First Edition card stored', must('dn', `select count(*) from dominion_kingdom_cards where edition ilike '%first%'`) === '0');

  // ---- 3. constraints reject bad data
  const bad = (name, sql, rx) => { const x = psql('dn', sql); check(name, !x.ok && rx.test(x.err), x.ok ? 'was accepted' : x.err.split('\n')[0]); };
  const row = (over = {}) => { const v = { card_id: "'zz:probe'", expansion: "'Intrigue'", edition: "'Second Edition'", name: "'Probe'", cost_raw: "'2'", cost_coins: 2, cost_debt: 0, overpay: "'no'", printed_types: "'Action'", type_verification: "'x'", physical_copies: 10, pile_id: "'Courtyard'", mechanics_verification: "'x'", ...over }; return `insert into dominion_kingdom_cards (${Object.keys(v).join(',')}) values (${Object.values(v).join(',')})`; };
  bad('a First Edition card is rejected by the schema', row({ edition: "'First Edition'" }), /check constraint/i);
  bad('a card pointing at a missing pile is rejected (foreign key)', row({ pile_id: "'No Such Pile'" }), /foreign key/i);
  bad('a negative cost is rejected', row({ cost_coins: -1 }), /check constraint/i);
  bad('a duplicate (expansion, name) is rejected', row({ name: "'Courtyard'" }), /unique|duplicate/i);
  bad('an unknown landscape type is rejected', `insert into dominion_landscapes (object_id,expansion,name,object_type,physical_copies,verification_status) values ('zz:probe','Empires','Probe','Spell',1,'x')`, /check constraint/i);
  bad('a mechanic tag not in the taxonomy is rejected (Kingdom)', `insert into dominion_kingdom_mechanics (card_id,expansion,name,mechanic_id,review_status) values ('intrigue:courtyard','Intrigue','Courtyard','not_a_real_tag','x')`, /foreign key/i);

  // ---- 4. RLS + privileges: the public can read, nobody can write through the API
  for (const role of ['anon', 'authenticated']) {
    const n = psql('dn', 'select count(*) from public.dominion_kingdom_cards', { role });
    check(`${role} can read the catalog (331 cards)`, n.ok && n.out === '331', n.err);
    const v = psql('dn', 'select count(*) from public.dominion_card_catalog', { role });
    check(`${role} can read the card view`, v.ok && v.out === '331', v.err);
    const lv = psql('dn', 'select count(*) from public.dominion_landscape_catalog', { role });
    check(`${role} can read the landscape view`, lv.ok && lv.out === '124', lv.err);
  }
  const writes = (t, set) => [`insert into public.${t} select * from public.${t} limit 0`, `update public.${t} set ${set}`, `delete from public.${t}`, `truncate public.${t}`];
  let denied = 0, total = 0;
  for (const role of ['anon', 'authenticated']) for (const t of ['dominion_taxonomy', 'dominion_kingdom_piles', 'dominion_kingdom_cards', 'dominion_kingdom_printed_types', 'dominion_kingdom_mechanics', 'dominion_landscapes', 'dominion_landscape_mechanics', 'dominion_artifacts', 'dominion_artifact_mechanics']) {
    const set = { dominion_taxonomy: "status='x'", dominion_kingdom_piles: "card_ids='x'", dominion_kingdom_cards: "name='x'", dominion_kingdom_printed_types: "verification_status='x'", dominion_kingdom_mechanics: "scope_note='x'", dominion_landscapes: "name='x'", dominion_landscape_mechanics: "source_url='x'", dominion_artifacts: "name='x'", dominion_artifact_mechanics: "source_url='x'" }[t];
    for (const sql of writes(t, set)) { total++; const x = psql('dn', sql, { role }); if (!x.ok && /permission denied/i.test(x.err)) denied++; else console.log(`      UNEXPECTED (${role}): ${sql} -> ${x.ok ? 'allowed' : x.err}`); }
  }
  check(`anon/authenticated: INSERT/UPDATE/DELETE/TRUNCATE all denied on all 9 tables (${total} attempts)`, denied === total, `${denied}/${total} denied`);
  check('catalog row counts unchanged after the write attempts', must('dn', 'select count(*) from dominion_kingdom_cards') === '331');
  // defence in depth: even if someone later GRANTs write, RLS (no write policy) still blocks it
  const rls = psql('dn', `begin; grant insert on public.dominion_taxonomy to anon; set local role anon; insert into public.dominion_taxonomy values ('zz','zz','zz'); rollback;`);
  check('even with INSERT granted, RLS blocks anon (no write policy)', !rls.ok && /row-level security/i.test(rls.err), rls.err.split('\n')[0]);
  check('every dominion_* table has RLS enabled', must('dn', `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'dominion\\_%' and not c.relrowsecurity`) === '0');
  check('the only policies are SELECT', must('dn', `select count(*) from pg_policies where schemaname='public' and tablename like 'dominion\\_%' and cmd <> 'SELECT'`) === '0');
  check('anon/authenticated hold only SELECT on dominion tables', must('dn', `select count(*) from information_schema.role_table_grants where table_schema='public' and table_name like 'dominion\\_%' and grantee in ('anon','authenticated') and privilege_type <> 'SELECT'`) === '0');
  check('service_role is untouched (still able to write, for admin loads)', psql('dn', `begin; insert into public.dominion_taxonomy values ('zz','zz','zz'); rollback;`, { role: 'service_role' }).ok);

  // ---- 5. view contents agree with the tables
  check('card view: multi-type cards carry several printed types', Number(must('dn', `select count(*) from dominion_card_catalog where cardinality(printed_types_list) > 1`)) === 122);
  check('card view: recorded mechanic links total 1,366', must('dn', `select sum(cardinality(mechanic_ids)) from dominion_card_catalog`) === '1366');
  check('card view: printed_types text matches the printed-types table', must('dn', `select count(*) from dominion_card_catalog where array_to_string(printed_types_list,'|') <> printed_types and (select string_agg(x,'|' order by x) from unnest(string_to_array(printed_types,'|')) x) <> array_to_string(printed_types_list,'|')`) === '0');

  // ---- 6. equals what the bundle's own schema + seed produce (proof the data wasn't altered)
  if (existsSync(path.join(BUNDLE, 'supabase', '02_seed_data.sql'))) {
    must('postgres', 'create database bundle'); must('bundle', 'grant usage on schema public to public');
    const b1 = loadSql('bundle', path.join(BUNDLE, 'supabase', '01_schema_and_rls.sql')), b2 = loadSql('bundle', path.join(BUNDLE, 'supabase', '02_seed_data.sql'));
    if (!b1.ok || !b2.ok) check('bundle schema/seed load for comparison', false, (b1.err || b2.err).split('\n')[0]);
    else for (const t of tableKeys) {
      const h = db => must(db, `select md5(coalesce(string_agg(x::text, E'\\n' order by x::text), '')) from public.${t} x`);
      check(`${t}: contents identical to the bundle's own import`, h('dn') === h('bundle'));
    }
  } else console.log(`  skip  bundle comparison (no bundle at ${BUNDLE}; set DOMINION_BUNDLE_DIR)`);
} catch (e) {
  fail++; console.error('\nERROR:', e.message);
}
console.log(`\n${fail ? 'FAILED' : 'PASSED'}: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
