import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import Night from '../src/pages/Night.jsx';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';

describe('the Game night page', () => {
  it('renders for an admin (the Players step, both tables\' parts) and says so for anyone else', () => {
    const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob', 'Cy'] }, [{ _line: 1, date: '2026-10-10', type: '', finish: 'Ann > Bob > Cy', sets: '', landscapes: '', playerVP: {}, minutes: '', kingdom: [] }], Eng.todayDay());
    const page = admin => ({ D, gid: 'a', me: { name: 'Ann', is_admin: admin }, allGroups: [{ id: 'a', name: 'A' }], enabledSets: new Set(), playerIdByName: {}, hashFor: (r, g) => `#/${r}/${g}`, reload: async () => {} });
    const draw = admin => renderToString(createElement(PageContext.Provider, { value: page(admin) }, createElement(Night)));
    const html = draw(true);
    expect(html).toContain('Who’s playing?'); expect(html).toContain('+ A second table'); expect(html).toContain('Ann');
    expect(draw(false)).toContain('Only the admin can log a game.');
  });
});
