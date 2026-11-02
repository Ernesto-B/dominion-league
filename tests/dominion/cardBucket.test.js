import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloads = [];
let bucketFiles = {};
vi.mock('../../src/lib/supabase.js', () => ({
  sb: { storage: { from: bucket => ({ download: async path => { downloads.push(`${bucket}/${path}`); const body = bucketFiles[path]; return body == null ? { data: null, error: { message: 'not found' } } : { data: new Blob([body]), error: null }; } }) } },
}));
const store = {};
beforeEach(() => { downloads.length = 0; bucketFiles = {}; Object.keys(store).forEach(k => delete store[k]); globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }; });
afterEach(async () => { const m = await import('../../src/dominion/cardImages.js'); m._setManifest(null); });

const MANIFEST = JSON.stringify({ v: 2, items: { 'plunder:crew': { w: 300, h: 480, k: 'abc' } } });

describe('the private bucket', () => {
  it('reads the manifest from the bucket when the site has no local folder of pictures', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest(null); bucketFiles['manifest.json'] = MANIFEST;
    const out = await m.loadManifest(() => Promise.resolve({ ok: false }));
    expect(out.items['plunder:crew'].k).toBe('abc'); expect(m.cardImageMode()).toBe('bucket'); expect(downloads).toEqual(['card-images/manifest.json']);
    expect(JSON.parse(store['dl.cards.manifest']).mode).toBe('bucket');   // kept on the device, so the next page opens with it at once
  });
  it('has no pictures, and no error, when the bucket and the local folder both come up empty', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest(null);
    const out = await m.loadManifest(() => Promise.reject(new Error('offline')));
    expect(out.items).toEqual({}); expect(m.anyCardImages()).toBe(false);
  });
  it('downloads a private picture once, however many times it is asked for, and hands back an object URL', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest({ v: 2, items: { 'plunder:crew': { w: 300, h: 480, k: 'abc' } } }, 'bucket');
    bucketFiles['plunder/crew.webp'] = 'webp-bytes';
    const p = m.cardImage('plunder:crew').small;
    const [a, b] = await Promise.all([m.pictureSrc(p), m.pictureSrc(p)]);
    expect(a).toMatch(/^blob:/); expect(b).toBe(a);
    expect(downloads).toEqual(['card-images/plunder/crew.webp']);
  });
  it('gives null (and tries again next time) when a picture is not in the bucket', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest({ v: 2, items: { 'plunder:crew': { w: 300, h: 480, k: 'abc' } } }, 'bucket');
    const p = m.cardImage('plunder:crew').small;
    expect(await m.pictureSrc(p)).toBeNull();
    bucketFiles['plunder/crew.webp'] = 'now-there';
    expect(await m.pictureSrc(p)).toMatch(/^blob:/);
  });
  it('forgets the manifest on sign-out', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    store['dl.cards.manifest'] = '{}'; m._setManifest({ v: 2, items: {} }, 'bucket');
    await m.clearCardCache();
    expect(store['dl.cards.manifest']).toBeUndefined(); expect(m.anyCardImages()).toBe(false);
  });
});

describe('a load before sign-in', () => {
  it('finding nothing is not remembered: the next ask tries again and finds the pictures', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest(null);
    const first = await m.loadManifest(() => Promise.resolve({ ok: false }));   // signed out: the bucket refuses, there is no local folder
    expect(first.items).toEqual({});
    bucketFiles['manifest.json'] = MANIFEST;                                      // signed in now
    const second = await m.loadManifest(() => Promise.resolve({ ok: false }));
    expect(second.items['plunder:crew']).toBeTruthy();
  });
});

describe('a list saved from another source', () => {
  it('is replaced at once, not kept for hours, when this build prefers a different source', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest(null);
    store['dl.cards.manifest'] = JSON.stringify({ m: JSON.parse(MANIFEST), mode: 'bucket', at: Date.now() });   // saved just now, but by the bucket: this (dev) build prefers the local folder
    bucketFiles['manifest.json'] = JSON.stringify({ v: 2, items: { 'a:new': { w: 1, h: 1, k: 'z' } } });
    const out = await m.loadManifest(() => Promise.resolve({ ok: false }));
    expect(out.items['a:new']).toBeTruthy();   // fetched again
  });
});
