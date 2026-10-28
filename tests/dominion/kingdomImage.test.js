import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { realCatalog } from './fixtures.js';
import { generate, seededRng } from '../../src/dominion/randomizer.js';
import { kingdomImageLayout, shareKingdomImage, TONE_RGB, W, PAD, ROW_H } from '../../src/dominion/kingdomImage.js';
import { ROOT } from '../../scripts/dominion/lib/tables.mjs';

const catalog = realCatalog();
const roll = (opts, seed = 1) => generate(catalog, opts, { rng: seededRng(seed) });

describe('the kingdom picture layout', () => {
  it('puts every card in a two-column grid inside the canvas, with no overlaps', () => {
    const r = roll({}), L = kingdomImageLayout(r);
    expect(L.cards).toHaveLength(10); expect(L.width).toBe(W);
    for (const c of L.cards) { expect(c.x).toBeGreaterThanOrEqual(PAD); expect(c.x + c.w).toBeLessThanOrEqual(W - PAD + 0.001); expect(c.y + c.h).toBeLessThanOrEqual(L.height); expect(c.h).toBe(ROW_H); }
    const boxes = L.cards.map(c => `${c.x},${c.y}`); expect(new Set(boxes).size).toBe(10);
    expect(new Set(L.cards.map(c => c.x)).size).toBe(2); expect(new Set(L.cards.map(c => c.y)).size).toBe(5);
  });
  it('is taller for a bigger kingdom, and adds the Landscapes and Setup sections only when there is something to say', () => {
    const plain = kingdomImageLayout(roll({ expansions: ['Seaside'] })), big = kingdomImageLayout(roll({ cards: 12, expansions: ['Seaside'] }));
    expect(plain.landHeading).toBeNull(); expect(plain.notes).toBeNull();
    expect(big.height).toBeGreaterThan(plain.height);
    const withLand = kingdomImageLayout(roll({ landscapes: 3, expansions: ['Seaside'] }));
    expect(withLand.lands).toHaveLength(3); expect(withLand.landHeading.text).toBe('Landscapes'); expect(withLand.height).toBeGreaterThan(plain.height);
    withLand.lands.forEach(l => expect(l.y).toBeGreaterThan(withLand.landHeading.y));
  });
  it('shows the Bane, a Trait\'s card, and the setup lines', () => {
    const witch = catalog.cards.find(c => c.name === 'Young Witch');
    const r = roll({ include: [witch.id], landscapes: 4, landscapeTypes: ['Trait'], expansions: ['Cornucopia & Guilds', 'Prosperity'] }, 4);
    const L = kingdomImageLayout(r);
    expect(L.cards).toHaveLength(11); expect(L.cards.at(-1)).toMatchObject({ tag: 'BANE', sub: 'Bane for Young Witch' });
    expect(L.lands.every(l => /on /.test(l.sub))).toBe(true);
    expect(L.notes.lines.map(l => l.text).join(' ')).toMatch(/Platinum|Colony/);
  });
  it('shows a split pile once, under its pile name, with all its types', () => {
    const r = roll({ include: [catalog.cards.find(c => c.name === 'Fortune').id] }), row = kingdomImageLayout(r).cards.find(c => c.name === 'Gladiator / Fortune');
    expect(row.sub).toMatch(/Action/); expect(row.sub).toMatch(/Treasure/);
  });
  it('colours rows with the same type colours as the site (a test keeps the two in step)', () => {
    const css = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    for (const [t, [r, g, b]] of Object.entries(TONE_RGB)) expect(css, t).toContain(`--t-${t}:${r},${g},${b}`);
    expect(kingdomImageLayout(roll({ include: [catalog.cards.find(c => c.name === 'Militia').id] })).cards.some(c => c.tone === 'attack')).toBe(true);
  });
});

describe('sharing the picture', () => {
  const blob = new Blob(['x'], { type: 'image/png' });
  const doc = () => { const a = { click: vi.fn(), remove: vi.fn() }; return { a, d: { createElement: () => a, body: { appendChild: vi.fn() } } }; };
  it('uses the phone\'s share sheet when files can be shared', async () => {
    const nav = { canShare: () => true, share: vi.fn(async () => {}) }, { d } = doc();
    expect(await shareKingdomImage(blob, { nav, doc: d })).toBe('shared'); expect(nav.share).toHaveBeenCalledOnce();
    expect(nav.share.mock.calls[0][0].files[0].name).toBe('kingdom.png');
  });
  it('closing the sheet is not an error, and not a download either', async () => {
    const nav = { canShare: () => true, share: vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); }) }, { a, d } = doc();
    expect(await shareKingdomImage(blob, { nav, doc: d })).toBe('cancelled'); expect(a.click).not.toHaveBeenCalled();
  });
  it('downloads the picture where files cannot be shared, or sharing fails for another reason', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    for (const nav of [null, {}, { canShare: () => false }, { canShare: () => true, share: async () => { throw new Error('NotAllowedError'); } }]) {
      const { a, d } = doc(); expect(await shareKingdomImage(blob, { nav, doc: d })).toBe('downloaded'); expect(a.click).toHaveBeenCalledOnce(); expect(a.download).toBe('kingdom.png');
    }
  });
});
