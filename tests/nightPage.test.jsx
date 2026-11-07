import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import Night, { MatchTime } from '../src/pages/Night.jsx';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';

describe('the Game night page', () => {
  it('renders for an admin (the Players step, both tables\' parts) and says so for anyone else', () => {
    const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob', 'Cy'] }, [{ _line: 1, date: '2026-10-10', type: '', finish: 'Ann > Bob > Cy', sets: '', landscapes: '', playerVP: {}, minutes: '', kingdom: [] }], Eng.todayDay());
    const page = admin => ({ D, gid: 'a', me: { name: 'Ann', is_admin: admin }, allGroups: [{ id: 'a', name: 'A' }], enabledSets: new Set(), playerIdByName: {}, hashFor: (r, g) => `#/${r}/${g}`, reload: async () => {} });
    const draw = admin => renderToString(createElement(PageContext.Provider, { value: page(admin) }, createElement(Night)));
    const html = draw(true);
    expect(html).toContain('Who’s playing?'); expect(html).toContain('+ A second table'); expect(html).toContain('Ann');
    const player = draw(false);   // any signed-in player can host a table: its result goes to the admin to approve
    expect(player).toContain('Who’s playing?'); expect(player).not.toContain('Only the admin');
    expect(renderToString(createElement(PageContext.Provider, { value: { ...page(false), me: null } }, createElement(Night)))).toContain('Sign in to host a table.');
  });
});

describe('the Save step\'s match time', () => {
  it('shows what the timer measured, and the way back to it once edited', () => {
    expect(renderToString(createElement(MatchTime, { clock: 47, value: null, onChange: () => {} }))).toContain('value="47"');
    expect(renderToString(createElement(MatchTime, { clock: null, value: null, onChange: () => {} }))).toContain('placeholder="—"');
    expect(renderToString(createElement(MatchTime, { clock: 47, value: 30, onChange: () => {} })).replace(/<!-- -->/g, '')).toContain('use the timer (47 min)');
  });
});
