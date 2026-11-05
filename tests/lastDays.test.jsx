import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import LastNight from '../src/components/LastNight.jsx';
import { PageContext } from '../src/PageContext.js';

const g = (line, day) => ({ line, day, date: `2026-11-${String(day).padStart(2, '0')}`, n: 2, type: 'Regular', names: ['Ann', 'Bob'], places: { Ann: 1, Bob: 2 }, finish: 'Ann > Bob', elo: { Ann: { before: 1000, after: 1010 }, Bob: { before: 1000, after: 990 } }, playerVP: {}, sets: [], landscapes: [], kingdom: [] });
const draw = games => renderToString(createElement(PageContext.Provider, { value: { D: { tierAt: () => null, byName: {}, playerPlace: () => null }, gid: 'a', hashFor: (r, x, y) => `#/${r}/${x}/${y}`, me: null, catalog: null, allGroups: [], enabledSets: null } }, createElement(LastNight, { games })));

describe('Rankings: the last two nights', () => {
  it('groups the two most recent game days by date, newest first', () => {
    const h = draw([1, 2, 3, 4, 5, 6, 7].map(d => g(d, d)));
    expect(h).toContain('Last 2 nights'); expect((h.match(/class="recent-date"/g) || []).length).toBe(2);
    expect(h.indexOf('Nov 7, 2026')).toBeLessThan(h.indexOf('Nov 6, 2026')); expect(h).not.toContain('Nov 5, 2026');
  });
  it('says so for fewer days, and lists several tables of one day under it', () => {
    expect(draw([g(1, 1), g(2, 1)])).toContain('Last night');
    const h = draw([g(1, 1), g(2, 2), g(3, 2)]); expect(h).toContain('Last 2 nights'); expect((h.match(/data-g="3"/g) || []).length).toBeGreaterThan(0);
  });
});
