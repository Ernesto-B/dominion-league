import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rawFromCsv } from './fixtures.js';
import { createCatalogStore, readCache, writeCache, fingerprint, CACHE_KEY, MAX_AGE_MS } from '../../src/dominion/catalogStore.js';

const raw = rawFromCsv();
const memory = (init = {}) => { const m = { ...init }; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; }, m }; };
const flush = () => new Promise(r => setTimeout(r, 0));
const changed = () => ({ ...raw, cards: raw.cards.map((c, i) => (i === 0 ? { ...c, name: c.name + ' (renamed)' } : c)) });
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe('the saved copy', () => {
  it('round-trips, and survives a JSON trip intact', () => {
    const s = memory(); expect(writeCache(s, raw)).toBe(true);
    expect(fingerprint(readCache(s))).toBe(fingerprint(raw));
  });
  it('is ignored when missing, corrupt, the wrong shape, empty, or too old', () => {
    expect(readCache(memory())).toBeNull();
    expect(readCache(memory({ [CACHE_KEY]: '{not json' }))).toBeNull();
    expect(readCache(memory({ [CACHE_KEY]: JSON.stringify({ savedAt: Date.now(), raw: { cards: [] } }) }))).toBeNull();
    expect(readCache(memory({ [CACHE_KEY]: JSON.stringify({ savedAt: Date.now(), raw: { ...raw, cards: [] } }) }))).toBeNull();
    expect(readCache(memory({ [CACHE_KEY]: JSON.stringify({ savedAt: Date.now(), raw: { ...raw, mechanicRelationshipCount: null } }) }))).toBeNull();
    const old = memory(); writeCache(old, raw, Date.now() - MAX_AGE_MS - 1000); expect(readCache(old)).toBeNull();
    expect(readCache({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
  it('tells a change from no change', () => { expect(fingerprint(raw)).toBe(fingerprint(rawFromCsv())); expect(fingerprint(changed())).not.toBe(fingerprint(raw)); });
  it('a full or blocked storage is not an error', () => {
    expect(writeCache({ setItem: () => { throw new Error('QuotaExceededError'); } }, raw)).toBe(false);
  });
});

describe('the store', () => {
  it('first visit: loads with a loading state, then saves the copy', async () => {
    const storage = memory(), fetchRaw = vi.fn(async () => raw), store = createCatalogStore({ client: {}, storage, fetchRaw });
    expect(store.getState().status).toBe('loading');
    store.load(); expect(store.getState().status).toBe('loading'); await flush();
    expect(store.getState().status).toBe('ready'); expect(store.getState().catalog.cards).toHaveLength(331);
    expect(fetchRaw).toHaveBeenCalledTimes(1); expect(readCache(storage)).not.toBeNull();
  });
  it('next visit: ready immediately from the saved copy, refreshed quietly, and untouched when nothing changed', async () => {
    const storage = memory(); writeCache(storage, raw);
    const seen = []; const store = createCatalogStore({ client: {}, storage, fetchRaw: async () => rawFromCsv() });
    store.subscribe(() => seen.push(store.getState().catalog));
    store.load();
    expect(store.getState().status).toBe('ready');           // synchronously, no loading screen
    const first = store.getState().catalog; await flush();
    expect(store.getState().catalog).toBe(first); expect(seen).toHaveLength(1);   // the identical refresh did not swap or re-render anything
  });
  it('switches to the fresh catalog (and saves it) when the refresh differs', async () => {
    const storage = memory(); writeCache(storage, raw);
    const store = createCatalogStore({ client: {}, storage, fetchRaw: async () => changed() });
    store.load(); const first = store.getState().catalog; await flush();
    expect(store.getState().catalog).not.toBe(first); expect(store.getState().catalog.cards.some(c => c.name.endsWith('(renamed)'))).toBe(true);
    expect(fingerprint(readCache(storage))).toBe(fingerprint(changed()));
  });
  it('keeps showing the saved copy if the background refresh fails', async () => {
    const storage = memory(); writeCache(storage, raw);
    const store = createCatalogStore({ client: {}, storage, fetchRaw: async () => { throw new Error('offline'); } });
    store.load(); await flush();
    expect(store.getState().status).toBe('ready'); expect(store.getState().catalog.cards).toHaveLength(331);
  });
  it('without a saved copy, a failed fetch is an error, and Retry tries again', async () => {
    let fail = true; const fetchRaw = vi.fn(async () => { if (fail) throw Object.assign(new Error('offline'), { status: 0 }); return raw; });
    const store = createCatalogStore({ client: {}, storage: memory(), fetchRaw });
    store.load(); await flush(); expect(store.getState().status).toBe('error');
    fail = false; const p = store.retry(); expect(store.getState().status).toBe('loading'); await p;
    expect(store.getState().status).toBe('ready');
  });
  it('works with no storage at all, and loads only once however many components ask', async () => {
    const fetchRaw = vi.fn(async () => raw), store = createCatalogStore({ client: {}, storage: null, fetchRaw });
    store.load(); store.load(); store.load(); await flush();
    expect(fetchRaw).toHaveBeenCalledTimes(1); expect(store.getState().status).toBe('ready');
  });
  it('lets listeners unsubscribe', async () => {
    const store = createCatalogStore({ client: {}, storage: null, fetchRaw: async () => raw }); const fn = vi.fn(); const off = store.subscribe(fn); off();
    store.load(); await flush(); expect(fn).not.toHaveBeenCalled();
  });
});
