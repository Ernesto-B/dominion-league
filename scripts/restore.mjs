#!/usr/bin/env node
/* Puts a backup (from `npm run backup`) back into the LINKED Supabase project, with a confirmation first.
     npm run restore -- backups/2026-11-02_1530            # asks first
     npm run restore -- backups/2026-11-02_1530 --dry-run  # shows what is in it and what would run
   Non-destructive: it only inserts rows that are missing (`on conflict do nothing`) and never overwrites or deletes. Players come back only if their sign-in still exists in Supabase
   (a password cannot be stored in a backup); if the accounts are gone, recreate them from Admin > New player first, then run this again. Uses the Supabase CLI's own login. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ROOT } from './dominion/lib/tables.mjs';

const args = process.argv.slice(2), flag = f => args.includes(f);
const dir = args.find(a => !a.startsWith('--'));
if (!dir) { console.error('Usage: npm run restore -- backups/<folder> [--dry-run] [--yes]'); process.exit(2); }
const folder = path.resolve(ROOT, dir), sql = path.join(folder, 'restore.sql'), manifest = path.join(folder, 'manifest.json');
if (!existsSync(sql) || !existsSync(manifest)) { console.error(`${dir} is not a backup folder (restore.sql / manifest.json missing).`); process.exit(2); }
const m = JSON.parse(readFileSync(manifest, 'utf8'));
const refFile = path.join(ROOT, 'supabase', '.temp', 'project-ref');
const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : '(not linked)';
console.log(`Backup of ${m.project}, taken ${m.takenAt}\n  ${Object.entries(m.counts).map(([t, n]) => `${t} ${n}`).join(' · ')}\nLinked project now: ${ref}`);
if (m.project !== ref) console.log('  NOTE: this backup was taken from a different project than the linked one.');
console.log(`This will run: supabase db query --linked -f ${path.relative(ROOT, sql)}   (inserts missing rows only)`);
if (flag('--dry-run')) { console.log('\n(dry run: nothing was executed)'); process.exit(0); }
if (!flag('--yes')) {
  if (!process.stdin.isTTY) { console.error('\nNo terminal to confirm in. Re-run with --yes if you really mean it.'); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question('\nThis changes the LIVE database. Type "restore" to continue: ')).trim(); rl.close();
  if (a !== 'restore') { console.log('Cancelled: nothing was changed.'); process.exit(1); }
}
const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', sql], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status || 0);
