#!/usr/bin/env node
/* A backup of the league's data, to a dated folder on this computer.
     npm run backup
   Reads every league table (players, groups, seasons, games, results, kingdoms, settings) from the LINKED Supabase project with the Supabase CLI's own login (no key is read or stored here),
   checks each table's row count against the database, and writes backups/<date>/<table>.json plus manifest.json and restore.sql (what `npm run restore` runs).
   READ-ONLY: it changes nothing in the database. The folder holds players' names and sign-in emails, so backups/ is gitignored and never leaves this computer unless you move it.
   The Collection catalog (cards, landscapes) is not backed up: it is rebuilt from supabase/dominion/seed_csv. The card pictures are rebuilt from your folder of originals. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './dominion/lib/tables.mjs';
import { TABLES, restoreSql, rowsOf, stamp } from './lib/backup.mjs';

const q = sql => {
  const r = spawnSync('supabase', ['db', 'query', '--linked', '--output-format', 'json', sql], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'supabase failed').trim().split('\n').slice(-3).join(' '));
  return rowsOf(r.stdout);
};
const refFile = path.join(ROOT, 'supabase', '.temp', 'project-ref');
const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : '(not linked: run `supabase link` first)';
console.log(`Backing up project ${ref} (read-only)…`);

const data = {}, counts = {};
for (const t of TABLES) {
  data[t] = q(`select * from public.${t}${t === 'game_kingdom' ? ' order by game_id, position' : t === 'settings' ? '' : ' order by id'}`);
  const [{ n }] = q(`select count(*)::int as n from public.${t}`);
  if (n !== data[t].length) throw new Error(`${t}: read ${data[t].length} rows but the table has ${n}. Nothing was written; run it again.`);   // a truncated read must never pass for a backup
  counts[t] = n;
  console.log(`  ${t.padEnd(13)} ${String(n).padStart(6)} rows`);
}
const accounts = q('select id, email, created_at from auth.users order by created_at');   // who could sign in (no passwords exist outside the database)

const dir = path.join(ROOT, 'backups', stamp());
mkdirSync(dir, { recursive: true });
for (const t of TABLES) writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(data[t], null, 1));
writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify(accounts, null, 1));
writeFileSync(path.join(dir, 'restore.sql'), restoreSql(data));
writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ project: ref, takenAt: new Date().toISOString(), counts, accounts: accounts.length }, null, 1));
console.log(`\nSaved to ${path.relative(ROOT, dir)}/  (${TABLES.length} tables, ${accounts.length} accounts). Keep a copy somewhere else too (a cloud drive, a USB stick).`);
