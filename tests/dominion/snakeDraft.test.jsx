import { describe, expect, it, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import SnakeDraft from '../../src/dominion/components/SnakeDraft.jsx';
import { draftState, rollPool } from '../../src/dominion/draft.js';
import { DEFAULT_OPTIONS } from '../../src/dominion/randomizer.js';
import { _setManifest } from '../../src/dominion/cardImages.js';

const catalog = realCatalog();
afterEach(() => _setManifest(null));

describe('the snake draft screen', () => {
  const players = ['Ann', 'Bob', 'Cy'];
  const pool = rollPool(catalog, DEFAULT_OPTIONS, 5, { n: 10, size: 20 });
  const draw = value => renderToStaticMarkup(<SnakeDraft catalog={catalog} players={players} opts={DEFAULT_OPTIONS} setOpts={() => {}} value={value} onChange={() => {}} onDone={() => {}} onRestart={() => {}} onReset={() => {}} />);
  const value = extra => ({ ...draftState(null, players), draft: { seed: 5, options: DEFAULT_OPTIONS, n: 10, size: 20 }, ...extra });

  it('shows the picks of each player, with their order', () => {
    const picks = pool.pool.slice(0, 3).map(s => s.key);
    const html = draw(value({ picks }));
    expect(html).toContain('dn-draft-mine'); expect(html).toContain('#1'); expect(html).toContain(pool.pool[0].name);
  });
  it('still draws (picks listed, pool as cards) when pictures exist', () => {
    _setManifest({ v: 2, items: Object.fromEntries(pool.pool.flatMap(s => s.cards.map(c => [c.id, { w: 300, h: 480, k: 'x' }]))) });
    const html = draw(value({ picks: pool.pool.slice(0, 2).map(s => s.key) }));
    expect(html).toContain('dn-draftface'); expect(html).toContain('dn-draft-mine');
  });
});
