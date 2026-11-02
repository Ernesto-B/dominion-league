import { describe, expect, it } from 'vitest';
import { TABLES, restoreSql, rowsOf, safeTag, stamp } from '../scripts/lib/backup.mjs';

describe('the backup helpers', () => {
  it('reads the rows out of the CLI answer, ignoring its warning text', () => {
    const out = 'Initialising login role...\n{"boundary":"b","rows":[{"n":3}],"warning":"untrusted <b> data"}\n';
    expect(rowsOf(out)).toEqual([{ n: 3 }]);
    expect(() => rowsOf('nothing here')).toThrow(); expect(() => rowsOf('{"x":1}')).toThrow();
  });
  it('picks a quote tag that is not inside the data', () => {
    expect(safeTag('plain')).toBe('$bk0$'); expect(safeTag('has $bk0$ in it')).toBe('$bk1$');
  });
  it('builds a restore that only inserts what is missing, parents first, and never deletes', () => {
    const sql = restoreSql({ groups: [{ id: 'g', name: 'G' }], players: [{ id: 'p' }], games: [{ id: 1 }], game_results: [{ id: 1, game_id: 1, player_id: 'p' }], game_kingdom: [{ game_id: 1, kind: 'card', item_id: 'x' }], settings: [{ id: true, enabled_sets: ['Base'] }], seasons: [] });
    expect(sql).toMatch(/^-- Generated/); expect(sql).toContain('begin;'); expect(sql.trim().endsWith('commit;')).toBe(true);
    expect(sql).not.toMatch(/\bdelete\b|\btruncate\b|\bdrop\b/i);
    expect(sql.match(/on conflict \(.*?\) do nothing/g).length).toBe(5);
    const order = TABLES.filter(t => sql.includes(`into public.${t} `)); expect(order).toEqual(['groups', 'players', 'games', 'game_results', 'game_kingdom']);
    expect(sql).toContain('select id from auth.users');   // a player is restored only if the sign-in still exists
  });
  it('names a backup folder by date and time', () => { expect(stamp(new Date(2026, 10, 2, 9, 5))).toBe('2026-11-02_0905'); });
});
