import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as Eng from '../src/lib/engine.js';
import { trustedMinutes, usualMinutes, pendingToForm, previewPending } from '../src/lib/pending.js';

const MIN = 60000;
describe('pending games: the time to trust', () => {
  it('knows what a usual game takes, with enough games to say', () => {
    expect(usualMinutes([{ minutes: 30 }, { minutes: 40 }])).toBeNull();
    expect(usualMinutes([30, 40, 50, 60].map(minutes => ({ minutes })))).toBe(45);
    expect(usualMinutes([{ minutes: '' }, { minutes: null }, ...[30, 40, 50, 60].map(minutes => ({ minutes }))])).toBe(45);
  });
  it('keeps a clock that ran about as long as a game, and drops one left running', () => {
    const t0 = 1_000_000_000_000;
    expect(trustedMinutes(t0, t0 + 38 * MIN, 40)).toEqual({ clock: 38, minutes: 38 });
    expect(trustedMinutes(t0, t0 + 95 * MIN, 40)).toEqual({ clock: 95, minutes: 95 });           // within 2.5 x the usual
    expect(trustedMinutes(t0, t0 + 190 * MIN, 40)).toEqual({ clock: 190, minutes: null });        // forgotten: no time rather than a wrong one
    expect(trustedMinutes(t0, t0 + 200 * MIN, null)).toEqual({ clock: 200, minutes: null });      // nothing to compare with: three hours is the limit
    expect(trustedMinutes(null, t0, 40)).toEqual({ clock: null, minutes: null });
  });
});

describe('pending games: back into the dialog', () => {
  it('rebuilds the finishing order, ties and VP', () => {
    const names = new Map([['a', 'Ann'], ['b', 'Bob'], ['c', 'Cy']]);
    const f = pendingToForm({ id: 7, date: '2026-11-07', type: '', sets: 'Base; Seaside', landscapes: null, notes: 'x', minutes: 41, started_at: null, ended_at: null,
      results: [{ player_id: 'c', place: 2, vp: 20 }, { player_id: 'a', place: 1, vp: 30 }, { player_id: 'b', place: 2, vp: 20 }], kingdom: [{ kind: 'card', id: 'x:y' }] }, names);
    expect(f.picked).toEqual(['Ann', 'Cy', 'Bob']); expect(f.tie).toEqual({ Bob: true }); expect(f.vp).toEqual({ Ann: '30', Cy: '20', Bob: '20' });
    expect(f.sets).toEqual(['Base', 'Seaside']); expect(f.kingdomTouched).toBe(true); expect(f.pendingId).toBe(7); expect(f.minutes).toBe(41);
  });
});

describe('pending games: the schema', () => {
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  it('has no write policy (only the two functions write), limits who can read, and keeps the checks', () => {
    expect(sql).toMatch(/alter table pending_games enable row level security/);
    expect(sql).toMatch(/create policy pending_select on pending_games for select[^;]*is_admin\(\) or created_by = auth\.uid\(\)/);
    expect(sql).not.toMatch(/create policy \w+ on pending_games for (insert|update|delete|all)/);
    const fn = sql.slice(sql.indexOf('create or replace function submit_pending_game'), sql.indexOf('create or replace function discard_pending_game'));
    for (const check of ["not in that group|you are not in that group", 'a table seats 2 to 6 players', 'every player must belong to the selected group', 'set search_path = public, pg_temp', 'security definer']) expect(fn).toMatch(new RegExp(check));
    const logged = sql.slice(sql.indexOf('create or replace function set_game_logged_at'), sql.indexOf('revoke execute on function set_game_logged_at'));
    expect(logged).toMatch(/is_admin\(\)/); expect(logged).toMatch(/security definer/); expect(logged).toMatch(/p_at <= now\(\)/);   // admin only, and never a time in the future
    expect(sql).toMatch(/revoke execute on function set_game_logged_at[^;]*from anon/);
    expect(sql).toMatch(/revoke execute on function submit_pending_game[^;]*from anon/); expect(sql).toMatch(/revoke execute on function discard_pending_game[^;]*from anon/);
  });
});

describe('pending games: the preview', () => {
  const cfg = JSON.parse(readFileSync(new URL('../public/data/config.json', import.meta.url)));
  const row = (n, finish) => ({ _line: n, date: '2026-10-0' + n, type: '', finish, sets: '', landscapes: '', playerVP: {}, group_id: 'g', kingdom: [], winner_vp: '', minutes: 40, notes: '' });
  const config = { ...cfg, players: ['Ann', 'Bob', 'Cy'], seasons: [], groups: undefined };
  const D = { input: { config, rows: [row(1, 'Ann > Bob > Cy'), row(2, 'Bob > Cy > Ann')] } };
  const names = new Map([['a', 'Ann'], ['b', 'Bob'], ['c', 'Cy']]);
  const pending = { id: 3, date: '2026-10-09', type: '', group_id: 'g', sets: null, landscapes: null, notes: null, minutes: 33, results: [{ player_id: 'c', place: 1, vp: 30 }, { player_id: 'a', place: 2, vp: 20 }, { player_id: 'b', place: 3, vp: 10 }], kingdom: [{ kind: 'card', id: 'x:y' }] };
  it('runs the game through the same maths, with Elo before and after, without touching the real games', () => {
    const g = previewPending(Eng, D, pending, names);
    expect(g.names.slice().sort()).toEqual(['Ann', 'Bob', 'Cy']); expect(g.places.Cy).toBe(1);
    expect(g.elo.Cy.after).toBeGreaterThan(g.elo.Cy.before); expect(g.elo.Bob.after).toBeLessThan(g.elo.Bob.before);
    expect(g.playerVP.Cy).toBe(30); expect(g.kingdom).toEqual([{ kind: 'card', id: 'x:y' }]);
    expect(D.input.rows).toHaveLength(2);
  });
  it('has nothing to show without the group\'s input', () => { expect(previewPending(Eng, {}, pending, names)).toBeNull(); expect(previewPending(Eng, null, pending, names)).toBeNull(); });
});
