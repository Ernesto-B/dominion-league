import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import PlayerHud from '../src/components/PlayerHud.jsx';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';

const row = (f, d) => ({ _line: 1, date: d, type: '', finish: f, sets: '', landscapes: '', playerVP: {}, minutes: '', kingdom: [], savedAt: null });
const draw = (D, name) => renderToString(createElement(PageContext.Provider, { value: { D, me: { name }, gid: 'a', hashFor: (r, g, x) => `#/${r}/${g}/${x}`, catalog: null } }, createElement(PlayerHud)));

describe('the player HUD', () => {
  const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob', 'New'], seasons: [] }, [row('Ann > Bob', '2026-01-01')], Eng.todayDay());
  it('shows an empty HUD, never a bare number, for a player with no games', () => {
    const html = draw(D, 'New');
    expect(html).toContain('Lv');
    expect(html).toContain('hud-none');
    expect(html).toContain('icons/stats/elo.png');
    expect(html).not.toMatch(/>0</);
  });
  it('shows level and Elo once they have played', () => {
    const html = draw(D, 'Ann');
    expect(html).not.toContain('hud-none');
    expect(html).toMatch(/Lv <b>\d+/);
  });
});
