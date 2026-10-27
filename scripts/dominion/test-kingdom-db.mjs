#!/usr/bin/env node
/* Tests the game-kingdom part of supabase/schema.sql (game_kingdom, add_game/edit_game's p_kingdom, RLS) against a
   THROWAWAY local Postgres — never your Supabase project. Supabase's auth schema and roles are stubbed.
     npm run kingdom:test-db
   Needs initdb / pg_ctl / psql (PATH or a Homebrew postgresql@N). Always tears the cluster down. */
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT } from './lib/tables.mjs';

function binDir() {
  const probe = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return null; } };
  const p = probe('initdb'); if (p) return path.dirname(p);
  for (const root of ['/opt/homebrew/opt', '/usr/local/opt', '/usr/lib/postgresql'])
    if (existsSync(root)) for (const d of readdirSync(root).filter(x => /postgres/.test(x)).sort().reverse())
      if (existsSync(path.join(root, d, 'bin', 'initdb'))) return path.join(root, d, 'bin');
  return null;
}
const BIN = binDir();
if (!BIN) { console.error('SKIP: no local PostgreSQL (initdb/pg_ctl/psql) found.'); process.exit(2); }
const tmp = mkdtempSync(path.join(tmpdir(), 'kingdom-pg-'));
const DATA = path.join(tmp, 'data'), PORT = String(54000 + Math.floor(Math.random() * 900));
const bin = n => path.join(BIN, n);
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const psql = (db, sql, { role, uid, file } = {}) => {
  const body = sql == null ? null : (uid ? `set test.uid = '${uid}'; ` : '') + sql;
  const args = ['-X', '-q', '-t', '-A', '-h', tmp, '-p', PORT, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', ...(file ? ['-f', file] : ['-c', body])];
  const r = run(bin('psql'), args, { env: { ...process.env, ...(role ? { PGOPTIONS: `-c role=${role}` } : {}) } });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const must = (db, sql, o) => { const r = psql(db, sql, o); if (!r.ok) throw new Error(`psql failed: ${r.err}\n${sql.slice(0, 200)}`); return r.out; };
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${!cond && detail ? '  -> ' + detail : ''}`); };
process.on('exit', () => { run(bin('pg_ctl'), ['-D', DATA, '-m', 'immediate', 'stop']); rmSync(tmp, { recursive: true, force: true }); });

const ADMIN = '00000000-0000-0000-0000-00000000000a', P1 = '00000000-0000-0000-0000-000000000001', P2 = '00000000-0000-0000-0000-000000000002', P3 = '00000000-0000-0000-0000-000000000003';
const addGame = (kingdom, over = '') => `select add_game(p_date => '2026-01-02', p_type => '', p_sets => 'Base', p_landscapes => null, p_strategy => null, p_winner_vp => null, p_minutes => null, p_notes => null, p_group_id => 'g1', p_results => '[{"player_id":"${P1}","place":1},{"player_id":"${P2}","place":2}]'${kingdom === undefined ? '' : `, p_kingdom => '${kingdom}'::jsonb`}${over})`;
const k = (...items) => JSON.stringify(items);
const card = id => ({ kind: 'card', id }), land = (id, on) => ({ kind: 'landscape', id, ...(on ? { on } : {}) });

try {
  let r = run(bin('initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-locale']); if (r.status) throw new Error(r.stderr);
  r = run(bin('pg_ctl'), ['-D', DATA, '-o', `-p ${PORT} -k ${tmp} -c listen_addresses=''`, '-w', '-l', path.join(tmp, 'pg.log'), 'start']); if (r.status) throw new Error(r.stderr);
  const legacyPg = Number(must('postgres', 'show server_version_num')) < 150000;
  must('postgres', 'create database db');
  must('db', `
    create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  const load = file => {
    let sql = readFileSync(file, 'utf8');
    if (legacyPg) sql = sql.replace(/\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)/gi, '');
    const f = path.join(tmp, path.basename(file)); writeFileSync(f, sql); return psql('db', null, { file: f });
  };
  const dom = p => path.join(ROOT, 'supabase', 'dominion', p);
  let x = load(dom('01_schema_and_rls.sql')); check('catalog schema applies', x.ok, x.err);
  x = load(dom('02_seed_data.sql')); check('catalog seed applies', x.ok, x.err);
  x = load(path.join(ROOT, 'supabase', 'schema.sql')); check('schema.sql applies', x.ok, x.err);
  x = load(path.join(ROOT, 'supabase', 'schema.sql')); check('schema.sql re-run is a no-op (idempotent)', x.ok, x.err);
  check('only one add_game and one edit_game exist (the old signatures were dropped)', must('db', `select count(*) from pg_proc where proname in ('add_game','edit_game')`) === '2');

  must('db', `
    insert into auth.users values ('${ADMIN}'), ('${P1}'), ('${P2}'), ('${P3}');
    insert into groups values ('g1','One'), ('g2','Two');
    insert into players (id, name, group_id, is_admin, group_ids) values
      ('${ADMIN}','Admin','g1',true,'{g1,g2}'), ('${P1}','Ann','g1',false,'{g1}'), ('${P2}','Bob','g1',false,'{g1}'), ('${P3}','Cy','g2',false,'{g2}');`);
  const admin = { role: 'authenticated', uid: ADMIN };
  const A = id => `dominion-base-game:${id}`;
  const ids = must('db', `select string_agg(card_id, ',') from (select card_id from dominion_kingdom_cards order by card_id limit 13) s`).split(',');
  const L = must('db', `select string_agg(object_id, ',') from (select object_id from dominion_landscapes order by object_id limit 3) s`).split(',');
  const trait = 'plunder:trait:cheap';
  const count = sql => Number(must('db', sql));

  // ---- writing
  const oldClient = psql('db', addGame(), admin);
  check('an older client (no p_kingdom) can still add a game', oldClient.ok && count(`select count(*) from game_kingdom`) === 0, oldClient.err);
  const g = psql('db', addGame(k(card(ids[0]), card(ids[1]), land(L[0]), land(trait, ids[1]))), admin);
  check('add_game with a kingdom stores it', g.ok && count(`select count(*) from game_kingdom`) === 4, g.err);
  const gid = Number(g.out);
  check('it keeps the order and the Trait\'s card', must('db', `select string_agg(item_id || coalesce('>' || on_id, ''), ' ' order by position) from game_kingdom where game_id = ${gid}`) === `${ids[0]} ${ids[1]} ${L[0]} ${trait}>${ids[1]}`);

  const games0 = count(`select count(*) from games`);
  const bad = (name, kingdom, rx) => { const z = psql('db', addGame(kingdom), admin); check(name, !z.ok && rx.test(z.err) && count(`select count(*) from games`) === games0, z.ok ? 'was accepted' : z.err.split('\n')[0]); };
  bad('an unknown card is rejected, and the whole game with it (atomic)', k(card('nope:nothing')), /unknown card or landscape/);
  bad('an unknown landscape is rejected', k(land('nope:event:nothing')), /unknown card or landscape/);
  bad('a bad kind is rejected', k({ kind: 'spell', id: ids[0] }), /needs a kind/);
  bad('an empty id is rejected', k({ kind: 'card', id: '' }), /needs a kind/);
  bad('more than 12 cards is rejected', k(...ids.map(card)), /too many/);
  bad('a kingdom that is not a list is rejected', '{"kind":"card"}', /must be a list/);
  const dup = psql('db', addGame(k(card(ids[2]), card(ids[2]))), admin);
  check('a duplicate card is collapsed, not an error', dup.ok && count(`select count(*) from game_kingdom where game_id = ${Number(dup.out)}`) === 1, dup.err);

  const edit = kingdom => psql('db', `select edit_game(p_game_id => ${gid}, p_date => '2026-01-02', p_type => '', p_sets => 'Base', p_landscapes => null, p_strategy => null, p_winner_vp => null, p_minutes => null, p_notes => 'x', p_group_id => 'g1', p_results => '[{"player_id":"${P1}","place":1},{"player_id":"${P2}","place":2}]'${kingdom === undefined ? '' : `, p_kingdom => '${kingdom}'::jsonb`})`, admin);
  check('edit_game without p_kingdom leaves the kingdom alone', edit().ok && count(`select count(*) from game_kingdom where game_id = ${gid}`) === 4);
  check('edit_game with a new list replaces it', edit(k(card(ids[5]))).ok && must('db', `select string_agg(item_id, ',') from game_kingdom where game_id = ${gid}`) === ids[5]);
  check('edit_game with [] clears it', edit('[]').ok && count(`select count(*) from game_kingdom where game_id = ${gid}`) === 0);
  edit(k(card(ids[0]), land(L[1])));

  // ---- who may write
  const asPlayer = psql('db', addGame(k(card(ids[0]))), { role: 'authenticated', uid: P1 });
  check('a non-admin cannot add a game', !asPlayer.ok && /only the admin/.test(asPlayer.err), asPlayer.err);
  const direct = psql('db', `insert into game_kingdom values (${gid}, 'card', '${ids[7]}', 9, null)`, { role: 'authenticated', uid: P1 });
  check('a non-admin cannot write game_kingdom directly (RLS)', !direct.ok && /row-level security/.test(direct.err), direct.err);
  const helper = psql('db', `select write_game_kingdom(${gid}, '[]')`, admin);
  check('the internal helper is not callable by a client, not even the admin', !helper.ok && /permission denied/.test(helper.err), helper.err);
  const anon = psql('db', `select count(*) from game_kingdom`, { role: 'anon' });
  check('anon sees nothing', !anon.ok || anon.out === '0', anon.err);

  // ---- who may read: the same visibility as the game itself
  const seen = uid => Number(must('db', `select count(*) from game_kingdom where game_id = ${gid}`, { role: 'authenticated', uid }));
  check('a player in the game\'s group sees its kingdom', seen(P1) === 2);
  check('a player in ANOTHER group sees none of it', seen(P3) === 0);
  check('the admin sees it', seen(ADMIN) === 2);

  // ---- the catalog can still be re-seeded while games point at it (no foreign key)
  x = load(dom('02_seed_data.sql')); check('re-seeding the catalog is not blocked by logged kingdoms', x.ok, x.err);
  check('and the logged kingdom is untouched', seen(ADMIN) === 2);

  // ---- cleanup paths
  must('db', `select delete_game(${gid})`, admin);
  check('delete_game removes its kingdom rows (cascade)', count(`select count(*) from game_kingdom where game_id = ${gid}`) === 0);
  const g2 = Number(must('db', addGame(k(card(ids[3]))), admin));
  must('db', `select delete_group('g1')`, admin);
  check('delete_group removes its games\' kingdom rows too', count(`select count(*) from game_kingdom where game_id = ${g2}`) === 0);
} catch (e) { fail++; console.error('\nERROR:', e.message); }
console.log(`\n${fail ? 'FAILED' : 'PASSED'}: ${pass} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
