import { describe, it, expect } from 'vitest';
import { MAX_PLAYERS, firstTimers, haveMet, metPairs, suggestSplit } from '../src/lib/seating.js';
import { blankNight, canAdvance } from '../src/lib/night.js';

const people = (...elos) => elos.map((elo, i) => ({ name: 'P' + (i + 1), elo }));

describe('who has met', () => {
  it('pairs everyone who sat at a table together, and finds the pairs who have not', () => {
    const met = metPairs([{ names: ['Ann', 'Bob', 'Cy'] }, { names: ['Dee'] }, { names: ['Dee', 'Ann'] }]);
    expect(haveMet(met, 'Bob', 'Ann')).toBe(true); expect(haveMet(met, 'Bob', 'Dee')).toBe(false);
    expect(firstTimers(['Ann', 'Bob', 'Dee'], met)).toEqual([['Bob', 'Dee']]);
  });
});

describe('splitting a crowd over two tables', () => {
  it('never seats more than six, keeps the sizes even and covers everyone once', () => {
    for (let n = 7; n <= 12; n++) {
      const s = suggestSplit(people(...Array.from({ length: n }, (_, i) => 900 + i * 37)), new Set());
      expect(s.a.length).toBe(Math.ceil(n / 2)); expect(s.b.length).toBe(Math.floor(n / 2));
      expect(Math.max(s.a.length, s.b.length)).toBeLessThanOrEqual(MAX_PLAYERS);
      expect([...s.a, ...s.b].sort()).toEqual(Array.from({ length: n }, (_, i) => 'P' + (i + 1)).sort());
    }
  });
  it('balances the average Elo, and says nothing for a table-sized group or for more than two tables', () => {
    const s = suggestSplit(people(1400, 1300, 1000, 900, 800, 700, 600), new Set());
    expect(Math.abs(s.avgA - s.avgB)).toBeLessThan(120);
    expect(suggestSplit(people(1, 2, 3, 4, 5, 6), new Set())).toBeNull(); expect(suggestSplit(people(...Array(13).fill(1000)), new Set())).toBeNull();
  });
  it('prefers seating people who have never met together when the balance is the same', () => {
    const ps = people(1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000);   // identical ratings: every split is equally fair
    const met = metPairs([{ names: ['P1', 'P2', 'P3', 'P4'] }, { names: ['P5', 'P6', 'P7', 'P8'] }]);   // two circles that have never mixed
    const s = suggestSplit(ps, met), crowd = new Set(['P1', 'P2', 'P3', 'P4']);
    expect(s.a.filter(n => crowd.has(n)).length).not.toBe(4);   // not simply the two old circles back again
    expect(suggestSplit(ps, met)).toEqual(s);                   // deterministic
  });
});

describe('Game night player limit', () => {
  it('lets a game go ahead with 2 to 6 players only', () => {
    const at = n => ({ ...blankNight(), picked: Array.from({ length: n }, (_, i) => 'P' + i) });
    expect([1, 2, 6, 7].map(n => canAdvance('players', at(n)))).toEqual([false, true, true, false]);
  });
});

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import SeatingHelp from '../src/components/SeatingHelp.jsx';
import { PageContext } from '../src/PageContext.js';

describe('the seating help on Game night', () => {
  const D = { games: [{ names: ['P1', 'P2'] }], preview: names => names.map((n, i) => ({ name: n, elo: 1000 + i * 10 })), byName: {} };
  const draw = (picked, canSeat = true) => renderToString(createElement(PageContext.Provider, { value: { D, me: null, gid: 'a', hashFor: () => '#', catalog: null, allGroups: [], enabledSets: null } }, createElement(SeatingHelp, { picked, canSeat, onSeat: () => {} }))).replace(/<!-- -->/g, '').replace(/&amp;/g, '&');
  it('warns about seven players, offers two tables, and can be blocked when the other table is under way', () => {
    const names = Array.from({ length: 8 }, (_, i) => 'P' + (i + 1));
    const h = draw(names);
    expect(h).toContain('A table seats at most 6 players'); expect(h).toContain('Table 1'); expect(h).toContain('Table 2'); expect(h).toContain('Seat them at two tables');
    expect(draw(names, false)).toContain('already under way');
    expect(draw(Array.from({ length: 13 }, (_, i) => 'P' + (i + 1)))).toContain('more than two tables can seat');
  });
  it('names the pairs who have never played each other at a table-sized group', () => {
    expect(draw(['P1', 'P2', 'P3'])).toContain('First time at a table together: P1 & P3, P2 & P3');
    expect(draw(['P1', 'P2'])).toBe('');
  });
});
