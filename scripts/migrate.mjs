#!/usr/bin/env node
// One-time migration: creates the initial player accounts, the starting
// friend group and season, and imports the existing data/games.csv into
// Supabase. Run locally, never shipped to the site. Needs schema.sql already
// applied (see supabase/schema.sql).
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=paste-it-here-only-for-this-one-command \
//   node scripts/migrate.mjs
//
// The service-role key bypasses Row Level Security entirely. Never commit
// it, never put it in the browser bundle, never paste it into chat — pass
// it as an env var for this one local command and nothing else.
//
// Safe to re-run? No — it always creates fresh accounts and re-imports
// every row of games.csv. Running it twice means duplicate players/games.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as Eng from '../src/lib/engine.js';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PRESET_PASSWORD = 'dominion';

// Keep this identical to the slugify() in src/lib/format.js's login screen — it's
// how a typed name turns into this account's fixed, internal-only login
// email. Add a disambiguator (e.g. 'jose-m') here AND there if two players
// ever share a first name; never try to rename an email after the fact.
function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Who to create, their friend group(s) (a player can list more than one —
// e.g. someone who plays with two separate circles), and who's the admin.
const PLAYERS = [
  { name: 'Jose', group_ids: ['a'] },
  { name: 'Ernesto', group_ids: ['a'], is_admin: true },
  { name: 'Bassim', group_ids: ['a'] },
  { name: 'Geddy', group_ids: ['a'] },
  { name: 'Alessandro', group_ids: ['a'] },
  { name: 'Gabe', group_ids: ['a'] },
];

// The starting friend group and season. Add players to the UI by creating a
// group from the Admin page; this just seeds what config.json used to hold.
const GROUPS = [
  { id: 'a', name: 'Group A' },
];
const SEASONS = [
  { group_id: 'a', name: 'Season 1', start_date: '2026-10-08', weeks: 10, target_games: 8, qualify_pct: 0.6, playoff_spots: 4, champion_player_id: null, notes: null },
];

async function api(pathname, { method = 'GET', body, admin = false } = {}) {
  const base = admin ? `${SUPABASE_URL}/auth/v1/admin` : `${SUPABASE_URL}/rest/v1`;
  const res = await fetch(base + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(admin ? {} : { Prefer: 'return=representation' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function createAccount({ name, group_ids, is_admin }) {
  const email = `${slugify(name)}@dominion.local`;
  const user = await api('/users', {
    method: 'POST', admin: true,
    body: { email, password: PRESET_PASSWORD, email_confirm: true },
  });
  const [row] = await api('/players', {
    method: 'POST',
    body: { id: user.id, name, group_ids, is_admin: !!is_admin, must_change_password: true },
  });
  console.log(`created ${name} <${email}> groups=${group_ids.join(',')}${is_admin ? ' [admin]' : ''}`);
  return row.id;
}

function placesFromFinish(finishStr) {
  const groups = Eng.parseFinish(finishStr); // [[name,...], [name,...], ...]
  const places = [];
  let pos = 1;
  groups.forEach(g => { g.forEach(name => places.push({ name, place: pos })); pos += g.length; });
  return places;
}

// A game's group is whichever one every player at that table shares — same
// rule as the backfill in schema.sql, just computed here instead since this
// script writes games directly (service-role, bypassing add_game's RPC
// validation). Ambiguous (shares none or more than one) is left null, same
// as the backfill, for the admin to resolve via Edit Game afterward.
function sharedGroupFor(names, groupsByLowerName) {
  let shared = null;
  for (const n of names) {
    const mine = groupsByLowerName.get(n.toLowerCase()) || new Set();
    shared = shared === null ? new Set(mine) : new Set([...shared].filter(x => mine.has(x)));
  }
  return shared && shared.size === 1 ? [...shared][0] : null;
}

async function importGames(idByLowerName, groupsByLowerName, adminId) {
  const csvText = readFileSync(path.join(ROOT, 'public', 'data', 'games.csv'), 'utf8');
  const rows = Eng.parseCSV(csvText);
  let imported = 0, skipped = 0;
  for (const r of rows) {
    const day = Eng.parseISO(r.date);
    if (day == null) { console.warn(`skip line ${r._line}: bad date "${r.date}"`); skipped++; continue; }
    const places = placesFromFinish(r.finish);
    if (places.length < 2) { console.warn(`skip line ${r._line}: fewer than 2 players`); skipped++; continue; }
    const results = [];
    let bad = false;
    for (const { name, place } of places) {
      const id = idByLowerName.get(name.toLowerCase());
      if (!id) { console.warn(`skip line ${r._line}: unknown player "${name}" — add them to PLAYERS above first`); bad = true; break; }
      results.push({ player_id: id, place });
    }
    if (bad) { skipped++; continue; }
    let type = (r.type || '').trim().toLowerCase();
    type = type === 'playoff' ? 'Playoff' : type === 'friendly' ? 'Friendly' : '';
    const group_id = sharedGroupFor(places.map(p => p.name), groupsByLowerName);
    const [game] = await api('/games', {
      method: 'POST',
      body: {
        date: Eng.fmtDay(day), type, sets: r.sets || null, strategy: r.strategy || null,
        winner_vp: r.winner_vp ? +r.winner_vp : null, minutes: r.minutes ? +r.minutes : null,
        notes: r.notes || null, group_id, created_by: adminId,
      },
    });
    await api('/game_results', {
      method: 'POST',
      body: results.map(x => ({ game_id: game.id, player_id: x.player_id, place: x.place })),
    });
    imported++;
  }
  console.log(`imported ${imported} games, skipped ${skipped}`);
}

async function seedGroupsAndSeasons() {
  for (const g of GROUPS) {
    await api('/groups', { method: 'POST', body: g });
    console.log(`created group ${g.name} (${g.id})`);
  }
  for (const s of SEASONS) {
    await api('/seasons', { method: 'POST', body: s });
    console.log(`created season ${s.name}`);
  }
}

async function main() {
  const idByLowerName = new Map();
  const groupsByLowerName = new Map(PLAYERS.map(p => [p.name.toLowerCase(), new Set(p.group_ids || [])]));
  let adminId = null;
  for (const p of PLAYERS) {
    const id = await createAccount(p);
    idByLowerName.set(p.name.toLowerCase(), id);
    if (p.is_admin) adminId = id;
  }
  await seedGroupsAndSeasons();
  await importGames(idByLowerName, groupsByLowerName, adminId);
  console.log('Done. Everyone\'s preset password is "dominion" — tell players to log in and change it.');
}
main().catch(e => { console.error(e); process.exit(1); });
