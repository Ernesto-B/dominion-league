import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../scripts/dominion/lib/tables.mjs';
import { parseHash, hashFor, ROUTES, GLOBAL_ROUTES } from '../../src/lib/route.js';
import { PAGES } from '../../src/pages/index.js';
import viteConfig from '../../vite.config.js';

const groups2 = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], group1 = [{ id: 'a', name: 'A' }];

describe('existing routes still work (nothing about the league pages changed)', () => {
  it('parses every pre-existing URL form exactly as before', () => {
    expect(parseHash('', group1)).toMatchObject({ route: 'home', gid: 'a', arg: '' });
    expect(parseHash('#/players/Jose', group1)).toMatchObject({ route: 'players', gid: 'a', arg: 'Jose' });
    expect(parseHash('#/players/b/Jose', groups2)).toMatchObject({ route: 'players', gid: 'b', arg: 'Jose' });
    expect(parseHash('#//b', groups2)).toMatchObject({ route: 'home', gid: 'b', arg: '' });
    expect(parseHash('#/games/b/12', groups2)).toMatchObject({ route: 'games', gid: 'b', arg: '12' });
    expect(parseHash('#/admin/season/edit/5', groups2)).toMatchObject({ route: 'admin', gid: 'a', arg: 'season/edit/5' });
    expect(parseHash('#/games', [])).toMatchObject({ route: 'games', gid: null, arg: '' });
    expect(hashFor('players', 'b', 'Jose', groups2)).toBe('#/players/b/Jose');
    expect(hashFor('players', 'b', 'Jose', group1)).toBe('#/players/Jose');
    expect(hashFor('admin', null, undefined, groups2)).toBe('#/admin');
    expect(hashFor('games', 'b', 12, groups2)).toBe('#/games/b/12');
  });
  it('still has a page for every route, the old ones included', () => {
    for (const r of ['home', 'season', 'players', 'h2h', 'records', 'games', 'admin']) expect(PAGES[r], r).toBeTypeOf('function');
    for (const r of ROUTES) expect(PAGES[r], `a page for ${r}`).toBeTypeOf('function');
  });
});

describe('the Dominion route', () => {
  it('is registered and site-wide (never takes a group segment)', () => {
    expect(ROUTES).toContain('dominion'); expect(GLOBAL_ROUTES).toContain('dominion'); expect(PAGES.dominion).toBeTypeOf('function');
  });
  it('does not mistake the first path part for a group when several groups exist', () => {
    expect(parseHash('#/dominion', groups2)).toMatchObject({ route: 'dominion', gid: 'a', arg: '' });
    expect(parseHash('#/dominion/cards', groups2)).toMatchObject({ route: 'dominion', gid: 'a', arg: 'cards' });
    expect(parseHash('#/dominion/cards/intrigue%3Acourtyard', groups2).arg).toBe('cards/intrigue%3Acourtyard');
    expect(parseHash('#/dominion/landscapes/menagerie%3Away%3Away_of_the_frog', group1).arg).toBe('landscapes/menagerie%3Away%3Away_of_the_frog');
    expect(hashFor('dominion', 'b', 'cards', groups2)).toBe('#/dominion/cards');
  });
  it('remembers the last-picked group across site-wide pages (so Dominion → back to the league keeps it)', () => {
    expect(parseHash('#/dominion/cards', groups2, 'b')).toMatchObject({ route: 'dominion', gid: 'b', arg: 'cards', explicit: false });
    expect(parseHash('#/records', groups2, 'b')).toMatchObject({ route: 'records', gid: 'b', explicit: false });
    expect(parseHash('#/records/a', groups2, 'b')).toMatchObject({ gid: 'a', explicit: true });   // the URL's own group wins
    expect(parseHash('#/dominion', groups2, 'nope')).toMatchObject({ gid: 'a' });                  // an unknown remembered group is ignored
  });
});

describe('GitHub Pages compatibility', () => {
  it('builds with relative asset URLs, so it works from /<repo>/ or a custom domain', () => { expect(viteConfig.base).toBe('./'); });
  it('uses hash routing, so a refresh on any Dominion URL is served by index.html with no server fallback', () => {
    expect(readFileSync(path.join(ROOT, 'src/useHash.js'), 'utf8')).toMatch(/hashchange/);
    expect(readFileSync(path.join(ROOT, 'src/lib/route.js'), 'utf8')).not.toMatch(/pushState|BrowserRouter/);
    expect(parseHash('#/dominion/stats', group1).route).toBe('dominion');
  });
  it('references assets relatively in index.html (nothing starts with an absolute /path except the module entry Vite rewrites)', () => {
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect([...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map(m => m[1])).toEqual(['/src/main.jsx']);
  });
});

describe('no secrets in browser code', () => {
  const walk = d => readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const browserFiles = [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'index.html'), ...walk(path.join(ROOT, 'public')).filter(f => /\.(js|json|html)$/.test(f))];
  it('contains no service-role key, secret key, JWT, or connection string', () => {
    for (const f of browserFiles) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/service[_-]?role/i);
      expect(s, f).not.toMatch(/sb_secret_[A-Za-z0-9_-]{16,}/);   // a real key; the bare prefix is just the library's own format check
      expect(s, f).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./);   // a JWT (the legacy anon/service keys)
      expect(s, f).not.toMatch(/postgres(ql)?:\/\//i);
      expect(s, f).not.toMatch(/SUPABASE_DB_PASSWORD|DATABASE_URL/);
    }
  });
  it('the only Supabase key in the client is the publishable one', () => {
    const s = readFileSync(path.join(ROOT, 'src/lib/supabase.js'), 'utf8');
    expect(s).toMatch(/sb_publishable_/);
  });
  it('the Dominion code reuses the existing client instead of making its own', () => {
    for (const f of walk(path.join(ROOT, 'src/dominion'))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/createClient/);
  });
});

describe('the Dominion SQL', () => {
  const dir = path.join(ROOT, 'supabase/dominion');
  const schema = readFileSync(path.join(dir, '01_schema_and_rls.sql'), 'utf8');
  const seed = readFileSync(path.join(dir, '02_seed_data.sql'), 'utf8');
  const tables = [...schema.matchAll(/create table if not exists public\.(\w+)/g)].map(m => m[1]);
  it('creates nine tables, all dominion_ prefixed', () => { expect(tables).toHaveLength(9); tables.forEach(t => expect(t).toMatch(/^dominion_/)); });
  it('puts every table through the RLS loop (enable RLS, revoke all, SELECT-only policy)', () => {
    for (const t of tables) expect(schema, t).toContain(`'${t}'`);
    expect(schema).toMatch(/enable row level security/); expect(schema).toMatch(/revoke all on public\.%I from anon, authenticated/);
  });
  it('creates only SELECT policies and grants only SELECT to the public roles', () => {
    const policies = [...schema.matchAll(/create policy[^;]*/gi)].map(m => m[0]);
    expect(policies.length).toBeGreaterThan(0);
    policies.forEach(p => expect(p).toMatch(/for select/i));
    expect([...schema.matchAll(/grant\s+(\w+)[^;]*?to\s+anon/gi)].map(m => m[1].toLowerCase())).toEqual(Array.from({ length: [...schema.matchAll(/grant\s+(\w+)[^;]*?to\s+anon/gi)].length }, () => 'select'));
    expect(schema).not.toMatch(/for\s+(insert|update|delete|all)\b/i);
  });
  it('makes both views security_invoker, so they inherit RLS', () => { expect([...schema.matchAll(/with \(security_invoker = true\)/g)]).toHaveLength(2); });
  it('only ever touches dominion_ tables — never the Elo/league tables', () => {
    // look at what each STATEMENT targets (not at words in the seed's text data)
    const target = /\b(?:insert\s+into|delete\s+from|update|alter\s+table|truncate|references|create\s+table(?:\s+if\s+not\s+exists)?|create\s+(?:or\s+replace\s+)?view|(?:from|join))\s+(?:only\s+)?public\.("?\w+"?)/gi;
    for (const [name, sql] of [['schema', schema], ['seed', seed]]) {
      const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
      const targets = [...code.matchAll(target)].map(m => m[1].replace(/"/g, ''));
      expect(targets.length, name).toBeGreaterThan(10);
      targets.filter(t => !t.startsWith('dominion_') && t !== '%I').forEach(t => { throw new Error(`${name} references a non-dominion table: ${t}`); });
    }
    expect(schema + seed).not.toMatch(/\b(game_results|seasons)\b\s*(\(|;|where\b)/i);
  });
  it('is migration-safe: no DROP TABLE / TRUNCATE / ALTER of existing data, and the seed is one transaction', () => {
    expect(schema).not.toMatch(/drop\s+table|truncate|drop\s+schema/i);
    expect(seed).not.toMatch(/drop\s+table|truncate|drop\s+schema/i);
    expect(seed.match(/^begin;/gm)).toHaveLength(1); expect(seed.match(/^commit;/gm)).toHaveLength(1);
    expect(seed).toMatch(/Dominion seed row-count mismatch/);
  });
  it('exists with its apply instructions', () => { expect(existsSync(path.join(dir, 'README.md'))).toBe(true); });
});
