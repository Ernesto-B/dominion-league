import { describe, it, expect } from 'vitest';
import * as Eng from '../src/lib/engine.js';
import { seasonAwards } from '../src/lib/seasonAwards.js';

let line = 0;
const g = (finish, date, type = '') => ({ _line: ++line, date, type, finish, sets: '', landscapes: '', playerVP: {} });
const run = rows => Eng.compute({ title: 't', players: ['Ann', 'Bob'], seasons: [{ name: 'S1', start: '2026-01-01', weeks: 40, targetGames: 2, playoffSpots: 1 }], elo: {}, season: {} }, rows, Eng.todayDay());

describe('seasonAwards', () => {
  const D = run([g('Ann > Bob', '2026-01-10'), g('Ann > Bob', '2026-01-11'), g('Bob > Ann', '2026-01-12', 'Friendly'), g('Ann > Bob', '2026-01-13'), g('Bob > Ann', '2026-01-14')]);
  const a = seasonAwards(D.seasonStandings(1));

  it('finds the longest Regular win streak; a friendly in between does not break it', () => {
    expect(a.streak).toEqual({ name: 'Ann', value: 3 });
  });
  it('names the player with the most wins', () => { expect(a.mostWins).toEqual({ name: 'Ann', value: 3 }); });
  it('finds the single biggest Elo gain', () => {
    expect(a.bigGain.value).toBeGreaterThan(0); expect(a.bigGain.line).toBeDefined();
  });
  it('is all null for no standings', () => { expect(seasonAwards(null)).toEqual({ streak: null, mostWins: null, bigGain: null }); });
});
