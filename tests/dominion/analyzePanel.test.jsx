import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Analyze from '../../src/dominion/components/AnalyzePanel.jsx';
import { realCatalog } from './fixtures.js';
import { generate, DEFAULT_OPTIONS, seededRng } from '../../src/dominion/randomizer.js';

describe('Analyze panel', () => {
  const catalog = realCatalog();
  const r = generate(catalog, DEFAULT_OPTIONS, { rng: seededRng(5) });
  it('draws the button, with the panel closed until asked for', () => {
    const html = renderToStaticMarkup(<Analyze catalog={catalog} slots={r.slots} />);
    expect(html).toContain('Analyze');
    expect(html).toContain('aria-expanded="false"');
  });
  it('an empty kingdom flags nothing', () => {
    const html = renderToStaticMarkup(<Analyze catalog={catalog} slots={[]} />);
    expect(html).toContain('dn-az-btn');
    expect(html).not.toContain('dn-az-dot');
  });
});
