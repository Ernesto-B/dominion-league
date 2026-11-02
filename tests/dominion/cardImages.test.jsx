import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { _setManifest, cardImage, loadManifest, pileImageId, slotFaceId, slugOf } from '../../src/dominion/cardImages.js';
import CardFace from '../../src/dominion/components/CardFace.jsx';
import { nameOfFile, normName } from '../../scripts/dominion/lib/cardImageNames.mjs';

afterEach(() => _setManifest(null));
const M = items => ({ v: 2, items });

describe('card pictures', () => {
  it('finds the three sizes of a picture by catalog id, and nothing for an id without one', () => {
    _setManifest(M({ 'plunder:crew': { w: 300, h: 480, bw: 500, bh: 800, k: 'abc' }, 'plunder:event:foray': { w: 400, h: 250, k: 'def' } }));
    const c = cardImage('plunder:crew');
    expect(c.small).toEqual({ path: 'plunder/crew.webp', key: 'plunder/crew.webp?k=abc', width: 300, height: 480 });
    expect(c.big).toEqual({ path: 'plunder/crew@big.webp', key: 'plunder/crew@big.webp?k=abc', width: 500, height: 800 });
    expect(c.thumb).toMatchObject({ path: 'plunder/crew@t.webp', width: 96, height: 154 });
    expect(cardImage('plunder:event:foray').big).toBeNull();
    expect(cardImage('plunder:event:foray').thumb).toMatchObject({ width: 160, height: 100 });
    expect(cardImage('plunder:cage')).toBeNull();
  });
  it('a site without pictures has none (a missing manifest is not an error)', async () => {
    _setManifest(null);
    const m = await loadManifest(() => Promise.resolve({ ok: false }));
    expect(m.items).toEqual({}); expect(cardImage('plunder:crew')).toBeNull();
  });
  it('draws the picture with its size reserved, or nothing at all', () => {
    _setManifest(M({ 'plunder:crew': { w: 300, h: 480, k: 'a' }, 'plunder:event:foray': { w: 400, h: 250, k: 'b' } }));
    const html = renderToString(createElement(CardFace, { id: 'plunder:crew', name: 'Crew' }));
    expect(html).toContain('width="300"'); expect(html).toContain('height="480"'); expect(html).toContain('loading="lazy"'); expect(html).toContain('alt="Crew"'); expect(html).toContain('cards/plunder/crew.webp?k=a');
    expect(renderToString(createElement(CardFace, { id: 'plunder:event:foray', name: 'Foray', onOpen: () => {} }))).toContain('dn-face wide');
    expect(renderToString(createElement(CardFace, { id: 'plunder:crew', name: 'Crew', size: 'thumb' }))).toContain('crew@t.webp');
    expect(renderToString(createElement(CardFace, { id: 'plunder:cage', name: 'Cage' }))).toBe('');
  });
  it('waits for a private picture (a reserved space, no <img>) until it has been downloaded', () => {
    _setManifest(M({ 'plunder:crew': { w: 300, h: 480, k: 'a' } }), 'bucket');
    const html = renderToString(createElement(CardFace, { id: 'plunder:crew', name: 'Crew' }));
    expect(html).toContain('dn-face-wait'); expect(html).not.toContain('<img'); expect(html).toContain('aspect-ratio:300 / 480'); expect(html).toContain('Loading…');   // it says so while it waits
  });
});

describe('the enlarge view', () => {
  it('uses the big copy when there is one, and the small one otherwise', () => {
    _setManifest(M({ 'a:b': { w: 300, h: 480, bw: 500, bh: 800, k: 'x' }, 'a:c': { w: 200, h: 320, k: 'y' } }));
    expect(renderToString(createElement(CardFace, { id: 'a:b', name: 'B', className: 'big' }))).toContain('a/b@big.webp');
    expect(renderToString(createElement(CardFace, { id: 'a:b', name: 'B' }))).not.toContain('@big');
    expect(renderToString(createElement(CardFace, { id: 'a:c', name: 'C', className: 'big' }))).toContain('a/c.webp');
  });
});

describe('matching a file name to a card name', () => {
  it('reads the name out of the wiki-style file names', () => {
    expect(nameOfFile('200px-Buried_Treasure~English~2022.jpg')).toBe('Buried_Treasure');
    expect(nameOfFile('320px-Journey~English~2023.jpg')).toBe('Journey');
    expect(nameOfFile("200px-King's_Cache~English~2022.jpg")).toBe("King's_Cache");
    expect(nameOfFile('Crew.png')).toBe('Crew'); expect(nameOfFile('notes.txt')).toBeNull();
  });
  it('compares names without case, accents, underscores or apostrophe style', () => {
    expect(normName('Buried_Treasure')).toBe(normName('Buried Treasure')); expect(normName("King’s Cache")).toBe(normName("King's_Cache")); expect(normName('Crèche')).toBe(normName('creche'));
  });
});

describe('pictures for piles that hold several names', () => {
  const knights = { key: 'Dark Ages::Knights', name: 'Knights', cards: [{ id: 'dark-ages:dame-anna' }, { id: 'dark-ages:sir-martin' }] };
  it('names the pile picture by expansion and pile', () => {
    expect(slugOf('Catapult / Rocks')).toBe('catapult-rocks');
    expect(pileImageId(knights)).toBe('dark-ages:pile:knights');
    expect(pileImageId({ key: 'Base::Village', name: 'Village', cards: [{ id: 'base:village' }] })).toBeNull();
  });
  it('shows the pile picture when there is one, else the first card that has a picture, else none', () => {
    _setManifest(M({ 'dark-ages:pile:knights': { w: 300, h: 480, k: '1' }, 'dark-ages:sir-martin': { w: 300, h: 480, k: '2' } }));
    expect(slotFaceId(knights)).toBe('dark-ages:pile:knights');
    _setManifest(M({ 'dark-ages:sir-martin': { w: 300, h: 480, k: '2' } }));
    expect(slotFaceId(knights)).toBe('dark-ages:sir-martin');
    _setManifest(M({}));
    expect(slotFaceId(knights)).toBeNull();
  });
});

import { placeBeside, hoverHandlers } from '../../src/dominion/components/CardHover.jsx';
describe('the card beside the mouse', () => {
  it('sits to the right of the pointer, flips left at the edge, and stays inside the window', () => {
    expect(placeBeside({ x: 100, y: 400 }, 260, 416, 1200, 800)).toEqual({ left: 122, top: 192 });
    expect(placeBeside({ x: 1100, y: 400 }, 260, 416, 1200, 800).left).toBe(818);       // no room on the right: to the left of the pointer
    expect(placeBeside({ x: 100, y: 10 }, 260, 416, 1200, 800).top).toBe(8);            // not above the window
    expect(placeBeside({ x: 100, y: 790 }, 260, 416, 1200, 800).top).toBe(376);         // not below it
  });
  it('gives a chip the handlers it needs, and shows nothing without a mouse or a picture', () => {
    const h = hoverHandlers('plunder:crew');
    expect(Object.keys(h).sort()).toEqual(['onMouseDown', 'onMouseEnter', 'onMouseLeave', 'onMouseMove']);
    h.onMouseEnter({ clientX: 5, clientY: 5 });   // no matchMedia here (Node): nothing is scheduled, nothing throws
  });
});

describe('hovering a table row', () => {
  it('can name its picture lazily, and a row with no picture shows nothing', () => {
    const h = hoverHandlers(() => null);
    h.onMouseEnter({ clientX: 1, clientY: 1 });   // no picture, no mouse here: nothing scheduled, nothing thrown
    expect(typeof hoverHandlers('a:b').onMouseEnter).toBe('function');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { KingdomChip } from '../../src/dominion/components/KingdomChips.jsx';
import { realCatalog } from './fixtures.js';
describe('a plain chip (Game night)', () => {
  const cat = realCatalog(), village = cat.cardsById.get('dominion-base-game:village');
  const r = { kind: 'card', id: village.id, obj: village };
  it('opens the enlarged card when it has a catalog to open it with, and stays plain text otherwise', () => {
    const tap = renderToStaticMarkup(<KingdomChip r={r} plain expansion catalog={cat} />);
    expect(tap).toContain('role="button"'); expect(tap).toContain('show the card larger'); expect(tap).toContain('tap');
    const plain = renderToStaticMarkup(<KingdomChip r={r} plain expansion />);
    expect(plain).not.toContain('role="button"');
  });
});
