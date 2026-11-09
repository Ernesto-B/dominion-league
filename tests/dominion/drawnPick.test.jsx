import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DrawnPick from '../../src/dominion/components/DrawnPick.jsx';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import { realCatalog } from './fixtures.js';

describe('the card Random drew while choosing for a kingdom', () => {
  const catalog = realCatalog();
  const show = (item, kind, replacing, times = null) => renderToStaticMarkup(<CatalogProvider catalog={catalog}><DrawnPick item={item} kind={kind} replacing={replacing} times={times} onAgain={() => {}} /></CatalogProvider>);
  it('shows the card with a way to use it or draw another, and says whether it replaces one', () => {
    const c = catalog.cards[0], add = show(c, 'card', false), rep = show(c, 'card', true);
    expect(add).toContain('Drawn at random'); expect(add).toContain(`Add ${c.name}`); expect(add).toContain('Draw another');
    expect(rep).toContain(`Use ${c.name}`);
  });
  it('wears the "New" corner only when it was never played', () => {
    const c = catalog.cards[0];
    expect(show(c, 'card', false, 0)).toContain('gr-newtag'); expect(show(c, 'card', false, 3)).not.toContain('gr-newtag'); expect(show(c, 'card', false, null)).not.toContain('gr-newtag');
  });
  it('works for a landscape too, with or without a cost', () => {
    const l = catalog.landscapes.find(x => x.coins == null), h = show(l, 'landscape', false);
    expect(h).toContain(l.name); expect(h).toContain('Draw another');
  });
});
