#!/usr/bin/env node
/* Proves the backup can really be restored, against a THROWAWAY local Postgres (never your Supabase project): fill the league tables, take a backup the way
   scripts/backup.mjs does, wipe the data, restore it with scripts/lib/backup.mjs restoreSql, and compare everything.
     npm run backup:test-db
   Also checks the safety rules: a second restore changes nothing, a restore never overwrites a row that is there, and a player whose sign-in is gone is skipped
   (with everything that points at them), not half-restored. Always tears the cluster down. */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT } from './dominion/lib/tables.mjs';
import { TABLES, restoreSql, rowsOf } from './lib/backup.mjs';

function binDir() {
  const probe = n => { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch { return null; } };
  const p = probe('initdb'); if (p) return path.dirname(p);
  for (const root of ['/opt/homebrew/opt', '/usr/local/opt', '/usr/lib/postgresql'])
    if (existsSync(root)) for (const d of readdirSync(root).filter(x => /postgres/.test(x)).sort().reverse()) if (existsSync(path.join(root, d, 'bin', 'initdb'))) return path.join(root, d, 'bin');
  return null;
}
const BIN = binDir();
if (!BIN) { console.error('SKIP: no local PostgreSQL (initdb/pg_ctl/psql) found.'); process.exit(2); }
const tmp = mkdtempSync(path.join(tmpdir(), 'restore-pg-')), DATA = path.join(tmp, 'data'), PORT = String(54000 + Math.floor(Math.random() * 900));
const bin = n => path.join(BIN, n), run = (c, a, o = {}) => spawnSync(c, a, { encoding: 'utf8', ...o });
const psql = (db, sql, file) => { const r = run(bin('psql'), ['-X', '-q', '-t', '-A', '-h', tmp, '-p', PORT, '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', ...(file ? ['-f', file] : ['-c', sql])]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (db, sql) => { const r = psql(db, sql); if (!r.ok) throw new Error(`psql: ${r.err}\n${sql.slice(0, 160)}`); return r.out; };
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${!ok && detail ? '  -> ' + detail : ''}`); };
process.on('exit', () => { run(bin('pg_ctl'), ['-D', DATA, '-m', 'immediate', 'stop']); rmSync(tmp, { recursive: true, force: true }); });

try {
  let r = run(bin('initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-locale']); if (r.status) throw new Error(r.stderr);
  r = run(bin('pg_ctl'), ['-D', DATA, '-o', `-p ${PORT} -k ${tmp} -c listen_addresses=''`, '-w', '-l', path.join(tmp, 'pg.log'), 'start']); if (r.status) throw new Error(r.stderr);
  const legacy = Number(must('postgres', 'show server_version_num')) < 150000;
  must('postgres', 'create database db');
  must('db', `create role anon nologin noinherit; create role authenticated nologin noinherit; create role service_role nologin noinherit bypassrls;
    grant usage on schema public to anon, authenticated, service_role; alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create schema auth; create table auth.users (id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  const load = file => { let sql = readFileSync(file, 'utf8'); if (legacy) sql = sql.replace(/\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)/gi, ''); const f = path.join(tmp, path.basename(file)); writeFileSync(f, sql); return psql('db', null, f); };
  for (const f of ['supabase/dominion/01_schema_and_rls.sql', 'supabase/dominion/02_seed_data.sql', 'supabase/schema.sql']) { const x = load(path.join(ROOT, f)); if (!x.ok) throw new Error(`${f}: ${x.err}`); }

  const U = n => `00000000-0000-0000-0000-00000000000${n}`;
  must('db', `insert into auth.users values ('${U(1)}'), ('${U(2)}'), ('${U(3)}');
    insert into groups values ('g1','One');
    insert into players (id, name, group_id, is_admin, group_ids) values ('${U(1)}','Ann','g1',true,'{g1}'), ('${U(2)}','Bob','g1',false,'{g1}'), ('${U(3)}','Cy','g1',false,'{g1,g2}');
    insert into seasons (group_id, name, start_date, weeks, champion_player_id, notes) values ('g1','S1','2026-01-01',8,'${U(1)}','a note with ''quotes'' and $$ dollars $$ and “smart” text');
    insert into games (date, type, sets, group_id, notes, minutes, landscapes) values ('2026-01-02','','Base','g1','game one; with ''quotes''',41,'Ways; Events'), ('2026-01-09','Friendly','Base; Seaside','g1',null,null,null);
    insert into game_results (game_id, player_id, place, vp) select g.id, p.id, row_number() over (partition by g.id order by p.name), 10 from games g cross join players p;
    insert into game_kingdom (game_id, kind, item_id, position, on_id) select id, 'card', 'dominion-base-game:village', 0, null from games;
    update settings set enabled_sets = array['Base','Seaside'];`);
  const snap = () => TABLES.map(t => `${t}:${must('db', `select md5(coalesce(json_agg(x order by x::text)::text, '')) from public.${t} x`)}`).join('|');
  const data = Object.fromEntries(TABLES.map(t => [t, rowsOf(`{"rows": ${must('db', `select coalesce(json_agg(x), '[]') from public.${t} x`)}}`)]));   // the same shape backup.mjs reads
  const before = snap();
  check('the data was read back whole', data.games.length === 2 && data.game_results.length === 6 && data.game_kingdom.length === 2 && data.players.length === 3);

  const sql = restoreSql(data), file = path.join(tmp, 'restore.sql'); writeFileSync(file, sql);
  must('db', `truncate game_kingdom, game_results, games, seasons, players, groups restart identity cascade; update settings set enabled_sets = array['x'];`);
  check('the tables are empty before the restore', must('db', 'select (select count(*) from games) + (select count(*) from players)') === '0');
  let x = psql('db', null, file); check('the restore runs', x.ok, x.err);
  check('every table is identical to what was backed up (including awkward text, arrays, dates, settings)', snap() === before);
  const seq = Number(must('db', `insert into games (date, type, group_id) values ('2026-02-01','','g1') returning id`));
  check('new games keep numbering after the restored ones', seq > 2, String(seq));

  x = psql('db', null, file); check('restoring again is harmless', x.ok);
  must('db', `delete from games where id = ${seq}`);
  check('and changes nothing', snap() === before);

  must('db', `update players set name = 'Robert' where id = '${U(2)}'; update games set notes = 'edited' where id = 1;`);
  x = psql('db', null, file);
  check('it never overwrites a row that is there', must('db', `select (select name from players where id = '${U(2)}') || '/' || (select notes from games where id = 1)`) === 'Robert/edited', x.err);

  must('db', `truncate game_kingdom, game_results, games, seasons, players, groups cascade; delete from auth.users where id = '${U(3)}';`);
  x = psql('db', null, file); check('with one sign-in gone it still restores the rest', x.ok, x.err);
  check('that player and everything pointing at them are skipped, nothing half-restored', must('db', `select (select count(*) from players) || '/' || (select count(*) from game_results where player_id = '${U(3)}') || '/' || (select count(*) from game_results)`) === '2/0/4');
} catch (e) { fail++; console.log(' FAIL ', e.message.split('\n')[0]); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
