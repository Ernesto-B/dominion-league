#!/usr/bin/env node
/* Run after `npm run build`:  npm run check:build
   Confirms the production bundle is safe to publish on GitHub Pages: asset paths are relative (so it works under a
   /<repo>/ base path), the app mounts at #root, and no secret leaked into dist/. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/tables.mjs';

const dist = path.join(ROOT, 'dist');
if (!existsSync(path.join(dist, 'index.html'))) { console.error('dist/ not found — run `npm run build` first'); process.exit(2); }
const walk = d => readdirSync(d).flatMap(f => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let fail = 0;
const ok = (n, c, d = '') => { if (!c) fail++; console.log(`${c ? '  ok  ' : ' FAIL '} ${n}${!c && d ? '  -> ' + d : ''}`); };

const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:|#)/.test(u));
ok('index.html mounts at #root', /id="root"/.test(html));
ok('every local asset URL is relative (./…), so a /<repo>/ base path works', urls.length > 0 && urls.every(u => u.startsWith('./')), urls.filter(u => !u.startsWith('./')).join(', '));
ok('referenced JS and CSS files exist', urls.every(u => existsSync(path.join(dist, u))), urls.filter(u => !existsSync(path.join(dist, u))).join(', '));
const css = walk(path.join(dist, 'assets')).filter(f => f.endsWith('.css')).map(f => readFileSync(f, 'utf8')).join('');
ok('CSS keeps the standard backdrop-filter (the minifier once dropped it)', /[^-]backdrop-filter:/.test(css));

const text = walk(dist).filter(f => /\.(html|js|css|json|csv|txt|map)$/.test(f));
const bad = [];
for (const f of text) {
  const s = readFileSync(f, 'utf8');
  for (const [name, rx] of [['service-role', /service[_-]?role/i], ['secret key', /sb_secret_[A-Za-z0-9_-]{16,}/], ['JWT', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./], ['connection string', /postgres(ql)?:\/\//i], ['db password var', /SUPABASE_DB_PASSWORD|DATABASE_URL/]])
    if (rx.test(s)) bad.push(`${name} in ${path.relative(dist, f)}`);
}
ok('no service-role / secret key / JWT / connection string anywhere in dist/', !bad.length, bad.join('; '));
const keys = new Set(text.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/sb_publishable_[A-Za-z0-9_]+/g)].map(m => m[0])));
ok('the only Supabase key shipped is the one publishable key', keys.size === 1, [...keys].join(', ') || 'none found');
console.log(`\n${fail ? 'FAILED' : 'PASSED'}`);
process.exit(fail ? 1 : 0);
