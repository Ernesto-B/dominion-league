import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageContext } from '../src/PageContext.js';
import Welcome from '../src/components/Welcome.jsx';
import * as Eng from '../src/lib/engine.js';
import cfg from '../public/data/config.json';

const row = (f, d) => ({ _line: 1, date: d, type: '', finish: f, sets: '', landscapes: '', playerVP: {}, minutes: '', kingdom: [], savedAt: null });
const D = Eng.compute({ ...cfg, players: ['Ann', 'Bob', 'New'], seasons: [] }, [row('Ann > Bob', '2026-01-01')], Eng.todayDay());
const draw = (name, storage) => {
  vi.stubGlobal('window', { localStorage: storage });
  try { return renderToStaticMarkup(createElement(PageContext.Provider, { value: { D, me: { name }, gid: 'a', hashFor: (r, g, x) => `#/${r}/${g}/${x}`, catalog: null } }, createElement(Welcome))); } finally { vi.unstubAllGlobals(); }
};

describe('the first-run walkthrough', () => {
  const empty = { getItem: () => null, setItem: () => {} };
  it('opens on step 1 of 4 with the player\'s own start, and offers Next and Skip', () => {
    const html = draw('New', empty);
    expect(html).toContain('Welcome, New'); expect(html).toContain('1 of 4'); expect(html).toContain(`${D.E.start} Elo`);
    expect(html).toContain('Your first rated game puts you on the ladder');   // a player with no games is told so
    expect(html).toContain('>Next<'); expect(html).toContain('>Skip<'); expect(html).not.toContain('>Back<');
  });
  it('does not repeat itself for a player who has seen it on this device', () => {
    expect(draw('New', { getItem: k => (k === 'dl.welcome.New' ? '1' : null), setItem: () => {} })).toBe('');
  });
});
