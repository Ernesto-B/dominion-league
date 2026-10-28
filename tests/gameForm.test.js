import { describe, it, expect } from 'vitest';
import { resortByVP, buildResults, buildGameArgs, toggle } from '../src/lib/gameForm.js';

const ids = new Map([['Ann', 'u-ann'], ['Bob', 'u-bob'], ['Cy', 'u-cy'], ['Dee', 'u-dee']]);
const bs = (over = {}) => ({ date: '2026-02-03', type: '', picked: [], tie: {}, sets: [], landscapes: [], kingdom: [], kingdomTouched: false, vp: {}, notes: '', editId: null, ...over });

describe('re-sorting by VP', () => {
  it('does nothing until a score has been entered', () => { const b = bs({ picked: ['Ann', 'Bob'] }); expect(resortByVP(b)).toBe(b); });
  it('puts the highest VP first, blanks last in their old order, and marks equal scores as ties', () => {
    const r = resortByVP(bs({ picked: ['Ann', 'Bob', 'Cy', 'Dee'], vp: { Ann: '20', Bob: '', Cy: '35', Dee: '20' } }));
    expect(r.picked).toEqual(['Cy', 'Ann', 'Dee', 'Bob']); expect(r.tie).toEqual({ Dee: true });
  });
  it('treats junk as no score', () => { expect(resortByVP(bs({ picked: ['Ann', 'Bob'], vp: { Ann: 'x', Bob: '5' } })).picked).toEqual(['Bob', 'Ann']); });
});

describe('results and the RPC arguments', () => {
  it('ties share the better place, and the next player skips ahead', () => {
    const r = buildResults(bs({ picked: ['Cy', 'Ann', 'Dee', 'Bob'], tie: { Dee: true }, vp: { Cy: '35', Ann: '20', Dee: '20', Bob: '' } }), ids);
    expect(r).toEqual([{ player_id: 'u-cy', place: 1, vp: 35 }, { player_id: 'u-ann', place: 2, vp: 20 }, { player_id: 'u-dee', place: 2, vp: 20 }, { player_id: 'u-bob', place: 4, vp: null }]);
  });
  it('leaves out a name the database does not know', () => { expect(buildResults(bs({ picked: ['Ann', 'Zed'] }), ids)).toEqual([{ player_id: 'u-ann', place: 1, vp: null }]); });
  it('builds the add_game arguments: sets in the picker\'s order, nulls when empty, Regular as an empty type', () => {
    const a = buildGameArgs(bs({ picked: ['Ann', 'Bob'], sets: ['Seaside', 'Base'], landscapes: ['Ways', 'Events'], notes: 'n' }), 'g1', ids);
    expect(a).toMatchObject({ p_date: '2026-02-03', p_type: '', p_sets: 'Base; Seaside', p_landscapes: 'Events; Ways', p_notes: 'n', p_group_id: 'g1', p_strategy: null, p_winner_vp: null, p_minutes: null });
    const e = buildGameArgs(bs({ picked: ['Ann', 'Bob'] }), 'g1', ids); expect(e.p_sets).toBeNull(); expect(e.p_landscapes).toBeNull(); expect(e.p_notes).toBeNull();
  });
  it('sends p_kingdom only when there is something to say, so an older database keeps working', () => {
    const k = [{ kind: 'card', id: 'a:b' }, { kind: 'landscape', id: 'c:d', on: 'a:b' }];
    expect('p_kingdom' in buildGameArgs(bs({ picked: ['Ann'] }), 'g1', ids)).toBe(false);                       // a new game with no kingdom
    expect(buildGameArgs(bs({ picked: ['Ann'], kingdom: k }), 'g1', ids).p_kingdom).toEqual(k);               // a new game with one
    expect('p_kingdom' in buildGameArgs(bs({ editId: 5, kingdom: k }), 'g1', ids)).toBe(false);                // an edit that never touched it
    expect(buildGameArgs(bs({ editId: 5, kingdom: [], kingdomTouched: true }), 'g1', ids).p_kingdom).toEqual([]);   // ...and one that cleared it
  });
  it('toggles membership', () => { expect(toggle(['a'], 'b')).toEqual(['a', 'b']); expect(toggle(['a', 'b'], 'a')).toEqual(['b']); });
});
