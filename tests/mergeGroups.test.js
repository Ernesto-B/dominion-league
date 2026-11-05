import { describe, it, expect } from 'vitest';
import { expectedAfter, planMerge } from '../scripts/lib/mergeGroups.mjs';

const base = () => ({
  groups: [{ id: 'a', name: 'Group A' }, { id: 'b', name: 'Group B' }],
  players: [
    { id: 'p1', name: 'Ann', group_ids: ['a'] }, { id: 'p2', name: 'Bob', group_ids: ['a', 'b'] },
    { id: 'p3', name: 'Cy', group_ids: ['b'] }, { id: 'p4', name: 'Dee', group_ids: ['b'] },
  ],
  seasons: [
    { id: 1, group_id: 'a', name: 'Season 1', start_date: '2026-10-01', weeks: 12, target_games: 8, playoff_spots: 4, champion_player_id: null },
    { id: 2, group_id: 'b', name: 'Season 1', start_date: '2026-10-15', weeks: 12, target_games: 10, playoff_spots: 4, champion_player_id: null },
  ],
  games: [{ id: 1, group_id: 'a' }, { id: 2, group_id: 'a' }, { id: 3, group_id: 'b' }],
});
const plan = (d, o = {}) => planMerge(d, { from: 'b', into: 'a', ...o });

describe('merging one group into another', () => {
  it('moves the games and players, folds overlapping seasons into one, then removes the group, all in one transaction', () => {
    const r = plan(base());
    expect(r.blockers).toEqual([]);
    expect(r.sql).toMatch(/^-- Merge group b into a/); expect(r.sql).toContain('begin;'); expect(r.sql.trim().endsWith('commit;')).toBe(true);
    expect(r.sql).toContain("update public.games set group_id = 'a' where group_id = 'b';");
    expect(r.sql).toContain("array_replace(group_ids, 'b', 'a')");
    // the season runs from the earlier start to the later end (Oct 1 + 12 weeks = Dec 23; Oct 15 + 12 weeks = Jan 6), with the larger target and no playoffs
    expect(r.sql).toContain("update public.seasons set start_date = '2026-10-01', weeks = 14, target_games = 10, playoff_spots = 0, champion_player_id = null where id = '1';");
    expect(r.sql).toContain("delete from public.seasons where id = '2';");
    expect(r.sql.indexOf("delete from public.groups where id = 'b'")).toBeGreaterThan(r.sql.indexOf('update public.games'));
  });
  it('can keep the playoffs, and moves a season that overlaps nothing as it is', () => {
    expect(plan(base(), { keepSpots: true }).sql).toContain('playoff_spots = 4');
    const d = base(); d.seasons[1].start_date = '2027-03-01';
    const r = plan(d); expect(r.sql).toContain("update public.seasons set group_id = 'a' where id = '2';"); expect(r.sql).not.toContain('delete from public.seasons');
  });
  it('refuses what it cannot decide: unknown groups, two people with one name, two different champions, a season overlapping several', () => {
    expect(planMerge(base(), { from: 'x', into: 'a' }).blockers[0]).toMatch(/No group with id "x"/);
    expect(planMerge(base(), { from: 'a', into: 'a' }).sql).toBeNull();
    const dup = base(); dup.players.push({ id: 'p5', name: 'ann', group_ids: ['b'] });
    expect(plan(dup).blockers[0]).toMatch(/Two different players are both called "Ann"/); expect(plan(dup).sql).toBeNull();
    const champs = base(); champs.seasons[0].champion_player_id = 'p1'; champs.seasons[1].champion_player_id = 'p3';
    expect(plan(champs).blockers[0]).toMatch(/both have a champion/);
    const many = base(); many.seasons.push({ id: 3, group_id: 'a', name: 'Season 2', start_date: '2026-12-01', weeks: 12, target_games: 8, playoff_spots: 4, champion_player_id: null });
    expect(plan(many).blockers[0]).toMatch(/overlaps more than one season/);
  });
  it('quotes ids, and reports what it expects the database to hold afterwards', () => {
    const d = base(); d.groups[1].id = "o'b"; d.games[2].group_id = "o'b"; d.players[2].group_ids = ["o'b"]; d.players[3].group_ids = ["o'b"]; d.players[1].group_ids = ['a', "o'b"]; d.seasons[1].group_id = "o'b";
    expect(planMerge(d, { from: "o'b", into: 'a' }).sql).toContain("where group_id = 'o''b';");
    expect(expectedAfter(base(), { from: 'b', into: 'a' })).toEqual({ games: 3, members: 4 });
  });
});
