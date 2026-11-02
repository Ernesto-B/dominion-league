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

import { readFileSync } from 'node:fs';
describe('the private bucket for the card pictures', () => {
  const sql = readFileSync(path.join(ROOT, 'supabase/dominion/03_card_images_bucket.sql'), 'utf8').replace(/--.*$/gm, '');
  it('is its own db:apply step, never part of `all`', () => {
    expect(planFor('images').map(p => p.file)).toEqual(['supabase/dominion/03_card_images_bucket.sql']);
    expect(planFor('all').map(p => p.file)).not.toContain('supabase/dominion/03_card_images_bucket.sql');
  });
  it('makes a private bucket that signed-in members can read and nobody can write to from a browser', () => {
    expect(sql).toMatch(/'card-images', 'card-images', false/);                       // public = false
    expect(sql).toMatch(/drop policy if exists "card_images_read" on storage\.objects/);
    expect(sql).toMatch(/for select to authenticated\s+using \(bucket_id = 'card-images'\)/);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/i);                         // only the owner's tools write
    expect(sql).not.toMatch(/\bto (anon|public)\b/i);
    expect(sql).toMatch(/on conflict \(id\) do update/);                                // safe to run again
  });
});
