#!/usr/bin/env node
/* Applies the SQL files to the LINKED Supabase project, with a confirmation first — this changes the live database.
     npm run db:apply -- catalog          # Collection schema + seed
     npm run db:apply -- league           # the league schema (game kingdoms, RPCs)
     npm run db:apply -- all              # both, Collection first
   Add --dry-run to see what would run, --yes to skip the prompt (needed when there is no terminal).
   Afterwards it runs the read-only live check. Uses the Supabase CLI's own login — no keys are read or stored here. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ROOT } from './dominion/lib/tables.mjs';
import { planFor, TARGETS } from './lib/dbApply.mjs';

const args = process.argv.slice(2), flag = f => args.includes(f);
const target = args.find(a => !a.startsWith('--'));
if (!target || !TARGETS[target]) { console.error(`Usage: npm run db:apply -- <${Object.keys(TARGETS).join('|')}> [--dry-run] [--yes]`); process.exit(2); }

const plan = planFor(target);
const missing = plan.filter(p => !existsSync(path.join(ROOT, p.file)));
if (missing.length) { console.error('Missing file(s): ' + missing.map(m => m.file).join(', ')); process.exit(2); }

const refFile = path.join(ROOT, 'supabase', '.temp', 'project-ref');
const ref = existsSync(refFile) ? readFileSync(refFile, 'utf8').trim() : '(not linked — run `supabase link` first)';
console.log(`Target: ${target}\nLinked Supabase project: ${ref}\nThis will run, in order:`);
plan.forEach(p => console.log(`  supabase ${p.args.join(' ')}`));
if (flag('--dry-run')) { console.log('\n(dry run — nothing was executed)'); process.exit(0); }

if (!flag('--yes')) {
  if (!process.stdin.isTTY) { console.error('\nNo terminal to confirm in. Re-run with --yes if you really mean it.'); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nThis changes the LIVE database. Type "apply" to continue: ')).trim();
  rl.close();
  if (answer !== 'apply') { console.log('Cancelled — nothing was changed.'); process.exit(1); }
}

for (const p of plan) {
  console.log(`\n→ ${p.file}`);
  const r = spawnSync('supabase', p.args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { console.error(`\nStopped: ${p.file} failed (exit ${r.status}). The files after it were NOT run.`); process.exit(r.status || 1); }
}
console.log('\nApplied. Checking the live project (read-only)…');
process.exit(spawnSync('npm', ['run', '--silent', 'dominion:check-live'], { cwd: ROOT, stdio: 'inherit' }).status || 0);
