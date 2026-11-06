import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PlayerPick, { recentPlayers, recentTables } from '../src/components/PlayerPick.jsx';
import { PageContext } from '../src/PageContext.js';

const roster = ['Ann', 'Bob', 'Cara', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
const games = [{ names: ['Ann', 'Bob'] }, { names: ['Cara', 'Dan', 'Eve'] }, { names: ['Bob', 'Ann'] }, { names: ['Cara', 'Dan', 'Eve'] }];

describe('Game night player picker', () => {
  it('lists recent players newest first and the distinct recent tables', () => {
    expect(recentPlayers(games, roster)).toEqual(['Cara', 'Dan', 'Eve', 'Bob', 'Ann']);
    expect(recentTables(games, roster)).toEqual([['Cara', 'Dan', 'Eve'], ['Ann', 'Bob']]);
  });
  it('draws tiles, the recent section, the table shortcuts and a search box for a long roster', () => {
    const html = renderToStaticMarkup(<PageContext.Provider value={{ D: { byName: {} } }}><PlayerPick roster={roster} games={games} picked={['Ann']} busy={['Bob']} max={12} onToggle={() => {}} onSet={() => {}} /></PageContext.Provider>);
    expect(html).toContain('Played lately'); expect(html).toContain('Everyone else'); expect(html).toContain('Cara · Dan · Eve'); expect(html).toContain('Find a player');
    expect(html).toMatch(/aria-pressed="true"[^>]*><[^]*?Ann/); expect(html).toContain('aria-disabled="true"');
  });
});
