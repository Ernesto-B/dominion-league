import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planFor, TARGETS } from '../../scripts/lib/dbApply.mjs';
import { ROOT } from '../../scripts/dominion/lib/tables.mjs';

describe('npm run db:apply', () => {
  it('runs the Collection before the league schema, since the league validates kingdoms against it', () => {
    const files = planFor('all').map(p => p.file);
    expect(files).toEqual(['supabase/dominion/01_schema_and_rls.sql', 'supabase/dominion/02_seed_data.sql', 'supabase/schema.sql']);
    expect(planFor('league').map(p => p.file)).toEqual(['supabase/schema.sql']);
  });
  it('only ever points at SQL files that exist, through the linked project (no keys involved)', () => {
    for (const t of Object.keys(TARGETS)) for (const p of planFor(t)) { expect(existsSync(path.join(ROOT, p.file)), p.file).toBe(true); expect(p.args.slice(0, 3)).toEqual(['db', 'query', '--linked']); }
  });
  it('rejects an unknown target', () => { expect(() => planFor('everything')).toThrow(/Unknown target/); });
  it('a dry run prints the plan and executes nothing; without a terminal it refuses to run for real', () => {
    const dry = spawnSync('node', ['scripts/db-apply.mjs', 'league', '--dry-run'], { cwd: ROOT, encoding: 'utf8' });
    expect(dry.status).toBe(0); expect(dry.stdout).toMatch(/supabase db query --linked -f supabase\/schema\.sql/); expect(dry.stdout).toMatch(/nothing was executed/);
    const real = spawnSync('node', ['scripts/db-apply.mjs', 'league'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(real.status).toBe(2); expect(real.stderr).toMatch(/No terminal to confirm/);
    expect(spawnSync('node', ['scripts/db-apply.mjs'], { cwd: ROOT, encoding: 'utf8' }).status).toBe(2);
  });
});
