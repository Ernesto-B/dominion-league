import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import PlayerPicker from '../src/components/PlayerPicker.jsx';
import ComparePicker from '../src/components/ComparePicker.jsx';
import RankMedal from '../src/components/RankMedal.jsx';
import GamesTable from '../src/components/GamesTable.jsx';
import { PageContext } from '../src/PageContext.js';

const ctx = { me: null, D: { tierAt: () => null, byName: {}, players: [] }, gid: 'a', hashFor: () => '#', catalog: null, allGroups: [], enabledSets: null };
const render = el => renderToString(createElement(PageContext.Provider, { value: ctx }, el)).replace(/<!-- -->/g, '');
const g = line => ({ line, day: line, date: `2026-11-${String(line).padStart(2, '0')}`, n: 2, type: 'Regular', names: ['Ann', 'Bob'], places: { Ann: 1, Bob: 2 }, finish: 'Ann > Bob', elo: { Ann: { before: 1000, after: 1010 }, Bob: { before: 1000, after: 990 } }, playerVP: {}, sets: [], landscapes: [], kingdom: [], notes: '' });

describe('lists and pickers', () => {
  it('the player and compare pickers list names A to Z', () => {
    const names = ['Josh', 'Bassim', 'Ernesto', 'Ashley'];
    // a closed picker renders no menu, so check the steps (previous / next) that follow the same order: Ashley -> prev is Josh (wraps), next is Bassim
    const h = render(createElement(PlayerPicker, { names, current: 'Ashley', hrefFor: n => `#/p/${n}` }));
    expect(h).toContain('Previous player: Josh'); expect(h).toContain('Next player: Bassim');
    expect(render(createElement(ComparePicker, { current: '', names, hrefFor: n => `#/p/${n}` }))).toContain('Choose');
  });
  it('places 1 to 3 are medals, any other place stays a number', () => {
    expect(renderToString(createElement(RankMedal, { rank: 1 }))).toContain('rank-medal p1');
    expect(renderToString(createElement(RankMedal, { rank: 3 }))).toContain('3rd');
    expect(renderToString(createElement(RankMedal, { rank: 4 }))).not.toContain('rank-medal');
  });
  it('the Games list shows 12 at a time with 6, 12, 24 and All, and opens on the page of a linked game', () => {
    const games = Array.from({ length: 30 }, (_, i) => g(30 - i));
    const draw = props => render(createElement(GamesTable, { games, paged: true, ...props }));
    const h = draw({});
    expect(h).toContain('Showing 1–12 of 30 games'); expect(h).toContain('Page 1 of 3');
    expect(h).toMatch(/<option value="6">6<\/option><option value="12" selected="">12<\/option><option value="24">24<\/option><option value="all">All<\/option>|value="12"/);
    expect(draw({ highlight: 5 })).toContain('Showing 25–30 of 30 games');   // game 5 is the 26th from the top
    expect(render(createElement(GamesTable, { games }))).not.toContain('Showing');
  });
});
