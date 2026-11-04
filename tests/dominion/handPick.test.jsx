import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { realCatalog } from './fixtures.js';
import { CatalogProvider } from '../../src/dominion/CatalogContext.jsx';
import { DominionView } from '../../src/dominion/DominionPage.jsx';
import { kingdomFromParams, kingdomToParams, stateFromItems, toGameItems } from '../../src/dominion/randomizer.js';

const catalog = realCatalog();
const card = name => catalog.cards.find(c => c.name === name).id;
const land = type => catalog.landscapes.find(l => l.type === type).id;

describe('a kingdom picked by hand', () => {
  const items = ['Village', 'Smithy', 'Market'].map(n => ({ kind: 'card', id: card(n) }));
  it('becomes a kingdom state with no seed, in the order picked', () => {
    const st = stateFromItems(catalog, items);
    expect(st.slots.map(s => s.name)).toEqual(['Village', 'Smithy', 'Market']); expect(st.seed).toBeNull();
  });
  it('ignores repeats, unknown ids and more than twelve cards, and is null with no card', () => {
    expect(stateFromItems(catalog, [...items, items[0], { kind: 'card', id: 'nope' }]).slots).toHaveLength(3);
    expect(stateFromItems(catalog, catalog.cards.slice(0, 40).map(c => ({ kind: 'card', id: c.id }))).slots.length).toBeLessThanOrEqual(12);
    expect(stateFromItems(catalog, [{ kind: 'landscape', id: land('Event') }])).toBeNull();
    expect(stateFromItems(catalog, [])).toBeNull();
  });
  it('keeps landscapes, and survives the trip through the link', () => {
    const st = stateFromItems(catalog, [...items, { kind: 'landscape', id: land('Event') }]);
    expect(st.landscapes).toHaveLength(1);
    const back = kingdomFromParams(catalog, kingdomToParams(st));
    expect(back.slots.map(s => s.name)).toEqual(['Village', 'Smithy', 'Market']); expect(back.landscapes).toHaveLength(1);
  });
  it('keeps a Young Witch\'s Bane while both are in, and asks for one when there is none', () => {
    const yw = { kind: 'card', id: card('Young Witch') }, bane = { kind: 'card', id: card('Village') };
    const withBane = stateFromItems(catalog, [yw, items[1], bane], bane.id);
    expect(withBane.setup.bane.name).toBe('Village'); expect(withBane.slots.map(s => s.name)).toEqual(['Young Witch', 'Smithy']);
    expect(toGameItems(withBane).map(i => i.id)).toContain(bane.id);
    expect(stateFromItems(catalog, [yw, items[1]]).setup.needsBane).toBe(true);
  });
});

describe('the Randomizer page', () => {
  const html = q => renderToStaticMarkup(<CatalogProvider catalog={catalog}><DominionView arg={'randomizer' + q} /></CatalogProvider>);
  it('offers hand-picking, closed to begin with', () => {
    const h = html(''); expect(h).toContain('Pick cards by hand'); expect(h).not.toContain('Add a card or landscape');
  });
});

import RandomizerPanel from '../../src/dominion/components/RandomizerPanel.jsx';
import { DEFAULT_OPTIONS } from '../../src/dominion/randomizer.js';

describe('hand-editing on the tiles', () => {
  const panel = (state, editing) => renderToStaticMarkup(<CatalogProvider catalog={catalog}><RandomizerPanel catalog={catalog} opts={DEFAULT_OPTIONS} setOpts={() => {}} state={state} onState={() => {}} onReset={() => {}} editing={editing} onEdit={() => {}} /></CatalogProvider>);
  const st = stateFromItems(catalog, ['Village', 'Smithy'].map(n => ({ kind: 'card', id: card(n) })));
  it('swaps Lock / Re-roll for Replace / Remove and ends each grid with an Add tile', () => {
    const h = panel(st, true);
    expect(h).toContain('Replace'); expect(h).toContain('Remove'); expect(h).not.toContain('Re-roll'); expect((h.match(/dn-rzadd/g) || []).length).toBe(2);
    const off = panel(st, false); expect(off).toContain('Re-roll'); expect(off).not.toContain('dn-rzadd');
  });
  it('starts from an empty kingdom, and shows a seed button only for a roll', () => {
    expect(panel(null, true)).toContain('dn-rzadd'); expect(panel(null, false)).not.toContain('dn-rzadd');
    expect(panel({ ...st, seed: 123456 }, false)).toMatch(/<button[^>]*dn-seed/);
  });
});

import { startKingdomPick, cancelKingdomPick, takeKingdomPick } from '../../src/dominion/kingdomPick.js';

describe('choosing a card for the kingdom from the full list', () => {
  const html = q => renderToStaticMarkup(<CatalogProvider catalog={catalog}><DominionView arg={q} /></CatalogProvider>);
  const village = card('Village');
  it('says so loudly, offers Add on every row and leaves out cards already in the kingdom', () => {
    startKingdomPick({ kind: 'card', index: null, label: null, taken: [village], returnHash: '#/dominion/randomizer' });
    const h = html('cards');
    expect(h).toContain('dn-kpbar'); expect(h).toContain('Choose a card to add to your kingdom'); expect(h).toContain('dn-addpill');
    expect(h).not.toContain('Compare cards'); expect(h).not.toContain(`href="#/dominion/cards/${encodeURIComponent(village)}"`);
    cancelKingdomPick();
    expect(html('cards')).not.toContain('dn-kpbar');
  });
  it('says what is being replaced, and landscapes have their own list', () => {
    startKingdomPick({ kind: 'landscape', index: 0, label: 'Gathering', taken: [], returnHash: '#/x' });
    const h = html('landscapes'); expect(h).toContain('Choose a landscape to replace'); expect(h).toContain('Gathering'); expect(h).toContain('Use this one instead');
    expect(html('cards')).not.toContain('dn-kpbar');   // the other list is untouched
    cancelKingdomPick();
  });
  it('has nothing waiting to take unless a choice was made', () => { expect(takeKingdomPick()).toBeNull(); });
});

import { clearResumeEditing, peekResumeEditing } from '../../src/dominion/kingdomPick.js';

describe('coming back from choosing a card', () => {
  it('reopens hand-editing after a cancel, once', () => {
    startKingdomPick({ kind: 'card', index: null, label: null, taken: [], returnHash: '#/x', scrollY: 0 });
    expect(peekResumeEditing()).toBe(false);
    cancelKingdomPick();
    expect(peekResumeEditing()).toBe(true);
    clearResumeEditing();
    expect(peekResumeEditing()).toBe(false);
  });
});

describe('the code beside a kingdom with no seed', () => {
  const panel = state => renderToStaticMarkup(<CatalogProvider catalog={catalog}><RandomizerPanel catalog={catalog} opts={DEFAULT_OPTIONS} setOpts={() => {}} state={state} onState={() => {}} onReset={() => {}} /></CatalogProvider>);
  const st = stateFromItems(catalog, ['Village', 'Smithy'].map(n => ({ kind: 'card', id: card(n) })));
  it('shows a Code for a hand-picked kingdom and a Seed for a roll', () => {
    expect(panel(st)).toMatch(/dn-seed[^>]*>Code <b>K-/);
    expect(panel({ ...st, seed: 424242 })).toMatch(/dn-seed[^>]*>Seed <b>424242/);
  });
});

describe('the banner while replacing a card', () => {
  it('shows the replaced card as a row: expansion, name, types, cost', () => {
    startKingdomPick({ kind: 'card', index: 0, label: 'Village', labelId: card('Village'), taken: [], returnHash: '#/x', scrollY: 0 });
    const h = renderToStaticMarkup(<CatalogProvider catalog={catalog}><DominionView arg="cards" /></CatalogProvider>);
    expect(h).toMatch(/dn-kpbar-table[^]*Village[^]*dn-types/);
    cancelKingdomPick();
  });
});

describe('the bare tiles used after a snake draft', () => {
  it('show only the tiles with Replace / Remove / Add: no options form, no bar, no setup notes', () => {
    const st2 = stateFromItems(catalog, ['Village', 'Smithy'].map(n => ({ kind: 'card', id: card(n) })));
    const h = renderToStaticMarkup(<CatalogProvider catalog={catalog}><RandomizerPanel bare editing catalog={catalog} opts={DEFAULT_OPTIONS} setOpts={() => {}} state={st2} onState={() => {}} onReset={() => {}} onEdit={() => {}} /></CatalogProvider>);
    expect(h).toContain('Replace'); expect(h).toContain('dn-rzadd'); expect(h).not.toContain('dn-rz-opts'); expect(h).not.toContain('dn-rz-bar'); expect(h).not.toContain('dn-rz-setup');
  });
});
