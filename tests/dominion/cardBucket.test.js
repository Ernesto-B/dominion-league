import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloads = [];
let bucketFiles = {};
vi.mock('../../src/lib/supabase.js', () => ({
  sb: { storage: { from: bucket => ({ download: async path => { downloads.push(`${bucket}/${path}`); const body = bucketFiles[path]; return body == null ? { data: null, error: { message: 'not found' } } : { data: new Blob([body]), error: null }; } }) } },
}));
const store = {};
beforeEach(() => { downloads.length = 0; bucketFiles = {}; Object.keys(store).forEach(k => delete store[k]); globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }; });
afterEach(async () => { vi.unstubAllGlobals(); const m = await import('../../src/dominion/cardImages.js'); m.stopBackgroundFill(); m._setManifest(null); });

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

describe('warming pictures', () => {
  it('downloads each once, ahead of use, and a repeat costs nothing', async () => {
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest({ v: 2, items: { 'a:one': { w: 300, h: 480, k: '1' }, 'a:two': { w: 300, h: 480, bw: 500, bh: 800, k: '2' } } }, 'bucket');
    bucketFiles['a/one.webp'] = 'x'; bucketFiles['a/two.webp'] = 'y'; bucketFiles['a/two@big.webp'] = 'z';
    await m.warmPictures(['a:one', 'a:two', 'a:one', 'a:missing']);
    await m.warmPictures(['a:one', 'a:two'], 'small');
    expect(downloads.sort()).toEqual(['card-images/a/one.webp', 'card-images/a/two.webp']);
    await m.warmPictures(['a:two'], 'big');
    expect(downloads).toContain('card-images/a/two@big.webp');
    expect(m.recentKingdomIds([{ kingdom: [{ id: 'a:one' }] }, { kingdom: [{ id: 'a:two' }, { id: 'a:one' }] }, { kingdom: null }], 2)).toEqual(['a:two', 'a:one']);
  });
});

describe('filling the device in the background', () => {
  const fakeCaches = () => { const store = new Map(); return { open: async () => ({ match: async k => store.get(k) || undefined, put: async (k, v) => { store.set(k, v); } }), store }; };
  const items = { 'a:one': { w: 300, h: 480, k: '1' }, 'a:two': { w: 300, h: 480, k: '2' }, 'a:three': { w: 300, h: 480, k: '3' } };
  const now = fn => setTimeout(fn, 0);

  it('saves every small picture once, first the ones asked for first, and keeps nothing in memory', async () => {
    vi.stubGlobal('caches', fakeCaches());
    const m = await import('../../src/dominion/cardImages.js');
    await m.clearCardCache();   // forget the saved-store handle of an earlier test
    m._setManifest({ v: 2, items }, 'bucket');
    Object.keys(items).forEach(id => { bucketFiles[id.replace(':', '/') + '.webp'] = 'x'; });
    await m.startBackgroundFill(['a:three'], { wait: now, pause: () => false });
    expect(downloads[0]).toBe('card-images/a/three.webp'); expect([...downloads].sort()).toEqual(['card-images/a/one.webp', 'card-images/a/three.webp', 'card-images/a/two.webp']);
    expect(globalThis.caches.store.size).toBe(3);
    downloads.length = 0;
    m.stopBackgroundFill();
    await m.startBackgroundFill([], { wait: now, pause: () => false });   // a second pass finds them all already saved
    expect(downloads).toEqual([]);
  });
  it('waits while paused (hidden tab, data saver) and does nothing for a site not using the bucket', async () => {
    vi.stubGlobal('caches', fakeCaches());
    const m = await import('../../src/dominion/cardImages.js');
    m._setManifest({ v: 2, items }, 'local');
    await m.startBackgroundFill([], { wait: now, pause: () => false });
    expect(downloads).toEqual([]);
    vi.stubGlobal('navigator', { connection: { saveData: true } }); expect(m.shouldPauseFill()).toBe(true);
    vi.stubGlobal('navigator', { connection: { effectiveType: '2g' } }); expect(m.shouldPauseFill()).toBe(true);
    vi.stubGlobal('navigator', { connection: { effectiveType: '4g' } }); expect(m.shouldPauseFill()).toBe(false);
  });
  it('asks the browser to keep the saved pictures once a bucket list arrives', async () => {
    let asked = 0;
    vi.stubGlobal('navigator', { storage: { persist: () => { asked++; return Promise.resolve(true); } } });
    const m = await import('../../src/dominion/cardImages.js');
    await m.clearCardCache(); m._setManifest(null);
    bucketFiles['manifest.json'] = MANIFEST;
    await m.loadManifest(() => Promise.resolve({ ok: false })); await m.loadManifest(() => Promise.resolve({ ok: false }));
    expect(asked).toBe(1);
  });
});
