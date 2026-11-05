import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import KingdomStep from '../../src/components/KingdomStep.jsx';
import { DEFAULT_OPTIONS } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const card = n => catalog.cards.find(c => c.name === n).id;
const draw = items => renderToStaticMarkup(<CatalogProvider catalog={catalog}><KingdomStep catalog={catalog} mode="manual" setMode={() => {}} players={['A', 'B']} roll={DEFAULT_OPTIONS} setRollOpts={() => {}} items={items} resolved={[]} onPick={() => {}} handEdited={false} /></CatalogProvider>);

describe('Game night Manual kingdom', () => {
  it('is the tile editor with a seed or code box, and no intro line', () => {
    const h = draw([]);
    expect(h).toContain('dn-rzadd'); expect(h).toContain('Seed or code'); expect(h).not.toContain('with the + tiles'); expect(h).not.toContain('Remove all');
  });
  it('offers Remove all once there is something to remove', () => {
    expect(draw([{ kind: 'card', id: card('Village') }])).toContain('Remove all');
  });
});

import ConfirmDialog from '../../src/components/ConfirmDialog.jsx';
describe('the confirm dialog', () => {
  it('asks in the site\'s own dialog, with a Cancel and a red confirm', () => {
    const h = renderToStaticMarkup(<ConfirmDialog danger title="Remove everything?" text="Every card goes." confirmLabel="Remove all" onCancel={() => {}} onConfirm={() => {}} />);
    expect(h).toContain('role="alertdialog"'); expect(h).toContain('Remove everything?'); expect(h).toContain('Cancel'); expect(h).toContain('dn-confirm-danger');
  });
});
