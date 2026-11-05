#!/usr/bin/env node
/* Merges one friend group into another, in the LINKED Supabase project.
     npm run merge-groups -- --from <group id> --into <group id> [--keep-spots] [--apply] [--yes]
   Without --apply it is a DRY RUN: it reads the league (read-only), prints what would happen and the SQL, and changes nothing. With --apply it needs a backup taken
   in the last hour (`npm run backup`), asks you to type "merge", runs the SQL in ONE transaction and then checks the counts.
   A merge cannot be undone by `npm run restore` (that only fills in what is missing); the backup is for a worst case, so take it and keep it.
   Not the Admin page's "delete group": that deletes the group's games. Details and the decision list: scripts/lib/mergeGroups.mjs. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ROOT } from './dominion/lib/tables.mjs';
import { rowsOf } from './lib/backup.mjs';
import { expectedAfter, planMerge } from './lib/mergeGroups.mjs';

const args = process.argv.slice(2), flag = f => args.includes(f), opt = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const from = opt('--from'), into = opt('--into');
if (!from || !into) { console.error('Usage: npm run merge-groups -- --from <group id> --into <group id> [--keep-spots] [--apply] [--yes]'); process.exit(2); }

const q = sql => {
  const r = spawnSync('supabase', ['db', 'query', '--linked', '--output-format', 'json', sql], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'supabase failed').trim().split('\n').slice(-3).join(' '));
  return rowsOf(r.stdout);
};
const load = () => ({
  groups: q('select * from public.groups order by id'), players: q('select id, name, group_id, group_ids from public.players'),
  seasons: q('select * from public.seasons order by id'), games: q('select id, group_id from public.games'),
});

const data = load();
const plan = planMerge(data, { from, into, keepSpots: flag('--keep-spots') });
console.log(`Merging "${from}" into "${into}" (${flag('--apply') ? 'APPLY' : 'dry run'})\n`);
plan.notes.forEach(n => console.log('  • ' + n));
if (plan.blockers.length) { console.log('\nCannot merge yet:'); plan.blockers.forEach(b => console.log('  ✗ ' + b)); process.exit(1); }
console.log('\n' + plan.sql);
if (!flag('--apply')) { console.log('(dry run: nothing was changed. Add --apply to run it.)'); process.exit(0); }

// a recent backup must exist
const dir = path.join(ROOT, 'backups');
const recent = existsSync(dir) ? readdirSync(dir).map(d => path.join(dir, d, 'manifest.json')).filter(existsSync).map(f => new Date(JSON.parse(readFileSync(f, 'utf8')).takenAt).getTime()).filter(t => Date.now() - t < 3600e3) : [];
if (!recent.length) { console.error('No backup from the last hour. Run `npm run backup` first.'); process.exit(2); }
if (!flag('--yes')) {
  if (!process.stdin.isTTY) { console.error('No terminal to confirm in. Re-run with --yes if you really mean it.'); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question('This changes the LIVE database and cannot be undone by restore. Type "merge" to continue: ')).trim(); rl.close();
  if (a !== 'merge') { console.log('Cancelled: nothing was changed.'); process.exit(1); }
}
const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'merge-')), 'merge.sql');
writeFileSync(file, plan.sql);
const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', file], { cwd: ROOT, stdio: 'inherit' });
if (r.status) process.exit(r.status);
const after = load(), want = expectedAfter(data, { from, into });
const games = after.games.filter(g => g.group_id === into).length, members = after.players.filter(p => (p.group_ids || []).includes(into)).length;
const gone = !after.groups.some(g => g.id === from), none = !after.games.some(g => g.group_id === from) && !after.players.some(p => (p.group_ids || []).includes(from));
console.log(`\nAfter: ${games} games in "${into}" (expected ${want.games}), ${members} players (expected ${want.members}), "${from}" ${gone && none ? 'removed' : 'STILL REFERENCED'}.`);
process.exit(games === want.games && members === want.members && gone && none ? 0 : 1);
