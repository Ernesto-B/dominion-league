import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { realCatalog } from './fixtures.js';
import { EXTRA_CARDS, EXTRA_PILES, EXTRA_PICTURES, relatedOf } from '../../src/dominion/extras.js';
import GivenCards from '../../src/dominion/components/GivenCards.jsx';

const catalog = realCatalog();
const item = name => catalog.cards.find(c => c.name === name) || catalog.landscapes.find(l => l.name === name);
const names = name => relatedOf(catalog, item(name)).map(r => r.name).sort();

describe('cards an item hands out, read from its own text', () => {
  it('finds the Horse, Spoils, Madman and Mercenary givers', () => {
    expect(names('Paddock')).toEqual(['Horse']); expect(names('Cavalry')).toEqual(['Horse']);
    expect(names('Bandit Camp')).toEqual(['Spoils']); expect(names('Hermit')).toEqual(['Madman']); expect(names('Urchin')).toEqual(['Mercenary']);
  });
  it('finds the Artifacts a card names, and an Event that gives a Horse', () => {
    expect(names('Swashbuckler')).toEqual(['Treasure Chest']); expect(names('Flag Bearer')).toEqual(['Flag']); expect(names('Treasurer')).toEqual(['Key']);
    expect(names('Border Guard')).toEqual(['Horn', 'Lantern']); expect(names('Ride')).toEqual(['Horse']);
    expect(relatedOf(catalog, item('Paddock'))[0]).toMatchObject({ kind: 'extra', id: 'extra:horse' });
    expect(relatedOf(catalog, item('Swashbuckler'))[0]).toMatchObject({ kind: 'artifact', id: 'renaissance:artifact:treasure-chest' });
  });
  it('says nothing for a card that mentions none, and an Artifact never relates to itself', () => {
    expect(names('Village')).toEqual([]); expect(names('Smithy')).toEqual([]);
    const lantern = catalog.artifacts.find(a => a.name === 'Lantern');
    expect(relatedOf(catalog, lantern).some(r => r.id === lantern.id)).toBe(false);
  });
  it('finds the piles a text hands out (Loot, Ruins, Rewards) and not a card that merely mentions them', () => {
    expect(names('Sack of Loot')).toEqual(['Loot']); expect(names('Looting')).toEqual(['Loot']); expect(names('Cursed')).toEqual(['Loot']);
    expect(names('Cultist')).toEqual(['Ruins']); expect(names('Death Cart')).toEqual(['Ruins']); expect(names('Marauder')).toEqual(['Ruins', 'Spoils']);
    expect(names('Vagrant')).toEqual([]);   // it only looks for Ruins
    expect(names('Joust')).toEqual(['Rewards']);
    const sizes = Object.fromEntries(EXTRA_PILES.map(p => [p.name, p.cards.length])); expect(sizes).toEqual({ Loot: 15, Ruins: 5, Rewards: 6, Shelters: 3, 'Platinum and Colony': 2 });   // the last two are shown by the setup notes, not by any card's text
    ['Hovel', 'Necropolis', 'Overgrown Estate', 'Platinum', 'Colony'].forEach(n => expect(names(n)).toEqual([]));
  });
  it('gives every picture a unique extra: id', () => { const ids = EXTRA_PICTURES.map(x => x.id); expect(new Set(ids).size).toBe(ids.length); ids.forEach(i => expect(i).toMatch(/^extra:[a-z-]+(:[a-z0-9-]+)?$/)); });
  it('registers each extra under an `extra:` id', () => { EXTRA_CARDS.forEach(x => expect(x.id).toBe('extra:' + x.name.toLowerCase())); });
  it('draws the section with names and a link for an Artifact, and nothing when there is nothing', () => {
    const h = renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Swashbuckler') }));
    expect(h).toContain('Cards it brings into play'); expect(h).toContain('Treasure Chest');   // (its name shows as text only while no picture exists) expect(h).toContain('href="#/dominion/artifacts/renaissance%3Aartifact%3Atreasure-chest"');
    expect(renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Village') }))).toBe('');
    expect(renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Paddock') }))).toContain('Horse');
    const two = renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Border Guard') }));
    expect(two).toContain('class="dn-wall"'); expect(two).toContain('Horn'); expect(two).toContain('Lantern');   // several: one wall of pictures
    const one = renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Paddock') }));
    expect(one).toContain('class="dn-wall one"'); expect(one).not.toContain('not a Kingdom card');            // one: just its picture, no caption underneath
    const loot = renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Sack of Loot') }));
    expect(loot).toContain('<details class="dn-pile"'); expect(loot).toContain('15 different cards'); expect(loot).not.toContain('Amphora');   // a closed pile shows no cards yet
  });
});

describe('the setup notes show the piles they tell you to add', () => {
  it('Shelters, Platinum and Colony and Ruins each appear as an openable pile next to their note', async () => {
    const { Setup } = await import('../../src/dominion/components/RandomizerPanel.jsx');
    const h = renderToStaticMarkup(createElement(Setup, { catalog, setup: { shelters: true, platinumColony: true, ruins: true } }));
    expect((h.match(/class="dn-pile"/g) || []).length).toBe(3);
    expect(h).toContain('3 different cards'); expect(h).toContain('2 different cards'); expect(h).toContain('5 different cards');
    const off = renderToStaticMarkup(createElement(Setup, { catalog, setup: { shelters: false, platinumColony: false } }));
    expect(off).not.toContain('dn-pile');   // "Use Estates" / "Don't use Platinum and Colony": nothing to show
  });
});

describe('a picture on the wall opens the large card', () => {
  it('is a button that says it enlarges the card, once the card has a picture', async () => {
    const { _setManifest } = await import('../../src/dominion/cardImages.js');
    _setManifest({ v: 2, items: { 'extra:horse': { w: 300, h: 480, bw: 500, bh: 800, k: 'x' } } });
    try {
      const h = renderToStaticMarkup(createElement(GivenCards, { catalog, item: item('Paddock') }));
      expect(h).toContain('Horse: show the card larger'); expect(h).toContain('<button');
    } finally { _setManifest(null); }
  });
});
