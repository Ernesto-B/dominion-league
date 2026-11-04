import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import Players from '../src/pages/Players.jsx';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';

const row = (f, d, o = {}) => ({ _line: 1, date: d, type: '', finish: f, sets: o.sets || '', landscapes: '', playerVP: o.vp || {}, minutes: o.minutes ?? '', kingdom: [], savedAt: null });
const draw = D => renderToString(createElement(PageContext.Provider, { value: { D, gid: 'a', arg: 'Ann', hashFor: (r, g, x) => `#/${r}/${g}/${x}`, me: null, catalog: null, allGroups: [{ id: 'a' }], enabledSets: new Set(['Base', 'Seaside']) } }, createElement(Players)));

describe('the Players page tiles', () => {
  it('shows average VP (not VP per minute)', () => {
    const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob'], seasons: [] }, [row('Ann > Bob', '2026-01-01', { sets: 'Base', vp: { Ann: 40, Bob: 20 } }), row('Ann > Bob', '2026-01-02', { vp: { Ann: 30, Bob: 25 } })], Eng.todayDay());
    const html = draw(D);
    expect(html).toContain('avg VP'); expect(html).toContain('>35<');
    expect(html).not.toContain('VP/min');
  });
  it('shows a dash with no VP entered', () => {
    const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob'], seasons: [] }, [row('Ann > Bob', '2026-01-01')], Eng.todayDay());
    expect(draw(D)).toContain('avg VP');
  });
});
