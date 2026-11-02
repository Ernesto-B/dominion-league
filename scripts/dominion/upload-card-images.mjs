#!/usr/bin/env node
/* Uploads the built card pictures (public/cards, from `npm run cards:build`) to the private `card-images` bucket of the LINKED Supabase project, with a confirmation first.
     npm run cards:upload              # asks first
     npm run cards:upload -- --dry-run # shows what would go up
   Needs the bucket to exist (`npm run db:apply -- images`). Uses the Supabase CLI's own login, so no key is read or stored here. The pictures go up folder by folder and the
   manifest goes LAST, so a member's browser never sees a manifest that names a picture which is not there yet. Re-running replaces what is there (same names, same pictures). */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ROOT } from './lib/tables.mjs';

const args = process.argv.slice(2), flag = f => args.includes(f);
const dir = path.join(ROOT, 'public', 'cards');
if (!existsSync(path.join(dir, 'manifest.json'))) { console.error('No pictures built yet: run `npm run cards:build -- <folder of card images>` first.'); process.exit(2); }

const walk = d => readdirSync(d).flatMap(n => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dir), bytes = files.reduce((n, f) => n + statSync(f).size, 0);
const folders = readdirSync(dir).filter(n => statSync(path.join(dir, n)).isDirectory());
const refFile = path.join(ROOT, 'supabase', '.temp', 'project-ref');
const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : '(not linked — run `supabase link` first)';
// `storage cp` is still marked experimental by the Supabase CLI, which refuses to run it without the flag
const cp = (src, dst, recursive) => ['storage', 'cp', ...(recursive ? ['-r'] : []), '--experimental', '--linked', '--jobs', '4', '--cache-control', 'max-age=3600', src, dst];
// A folder is copied INTO the bucket root (the trailing slash): the CLI then always keeps the folder's own name. Copying to `ss:///card-images/<folder>` is flat the first time but nests
// `<folder>/<folder>/` once that folder exists, so a retry or a re-run would have doubled it up.
const plan = [...folders.map(f => cp(path.join('public', 'cards', f), 'ss:///card-images/', true)), cp(path.join('public', 'cards', 'manifest.json'), 'ss:///card-images/manifest.json', false)];

console.log(`Linked Supabase project: ${ref}\n${files.length} files, ${(bytes / 1048576).toFixed(1)} MB, to the private bucket "card-images". This will run, in order:`);
plan.forEach(a => console.log('  supabase ' + a.join(' ')));
if (flag('--dry-run')) { console.log('\n(dry run — nothing was uploaded)'); process.exit(0); }

if (!flag('--yes')) {
  if (!process.stdin.isTTY) { console.error('\nNo terminal to confirm in. Re-run with --yes if you really mean it.'); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nThis uploads to the LIVE project. Type "upload" to continue: ')).trim();
  rl.close();
  if (answer !== 'upload') { console.log('Cancelled — nothing was uploaded.'); process.exit(1); }
}
for (const a of plan) {
  console.log(`\n→ supabase storage cp … ${a[a.length - 2].replace(/^.*public\/cards\//, '')}`);
  let r;
  for (let attempt = 1; attempt <= 4; attempt++) {   // a dropped connection part-way through is retried: the copy overwrites what is there, so it is safe to repeat
    r = spawnSync('supabase', a, { cwd: ROOT, stdio: 'inherit' });
    if (r.status === 0) break;
    if (attempt < 4) console.log(`\n(attempt ${attempt} failed, exit ${r.status}; trying again)`);
  }
  if (r.status !== 0) { console.error(`\nStopped (exit ${r.status}). The manifest is only uploaded at the very end, so the site is not affected by a partial upload.`); process.exit(r.status || 1); }
}
console.log('\nUploaded. Signed-in members now get the pictures from the bucket.');
