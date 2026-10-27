/* Where the Collection's catalog lives while the site is open, and how it gets there fast.

   The catalog is the same for everyone and changes only when the SQL seed is re-run, so a visit shows the copy saved in the
   browser from last time AT ONCE and refreshes it quietly in the background (stale-while-revalidate): if the fresh copy is
   identical nothing happens, if it differs the page switches to it. A first visit (or a wiped cache) loads from the server
   as before, with the same loading and error screens.

   The saved copy is the RAW rows, already verified complete when they were fetched (see api.js fetchAllRows); the catalog
   is rebuilt from them on every visit, which takes under a millisecond. Storage being blocked, full or corrupt is never an
   error — the site just behaves as if there were no cache. Pure of React so every path is tested in Node. */
import { fetchRawCatalog } from './api.js';
import { buildCatalog } from './model.js';

export const CACHE_KEY = 'dl.catalog.v1';   // bump when the shape of the raw rows changes, so an old copy is never misread
export const MAX_AGE_MS = 14 * 24 * 3600 * 1000;
const TABLES = ['cards', 'piles', 'landscapes', 'artifacts', 'artifactMechanics', 'taxonomy', 'cardText'];

const defaultStorage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

// a cheap fingerprint (djb2) of the raw rows: enough to tell "same data" from "changed"
export function fingerprint(raw) {
  const s = JSON.stringify(raw); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h >>> 0}`;
}

const looksRight = raw => raw && typeof raw === 'object' && TABLES.every(t => Array.isArray(raw[t])) && raw.cards.length > 0 && Number.isFinite(raw.mechanicRelationshipCount);

export function readCache(storage, now = Date.now()) {
  try {
    const parsed = JSON.parse(storage.getItem(CACHE_KEY));
    if (!parsed || !looksRight(parsed.raw) || !(now - parsed.savedAt < MAX_AGE_MS)) return null;
    return parsed.raw;
  } catch { return null; }
}
export function writeCache(storage, raw, now = Date.now()) {
  try { storage.setItem(CACHE_KEY, JSON.stringify({ savedAt: now, raw })); return true; } catch { return false; }   // quota or blocked: fine
}

export function createCatalogStore({ client, storage = defaultStorage(), now = Date.now, fetchRaw = fetchRawCatalog } = {}) {
  let state = { status: 'loading', catalog: null, error: null };
  let started = false, fp = null;
  const listeners = new Set();
  const set = next => { state = next; listeners.forEach(l => l()); };

  async function fetchFresh({ background }) {
    try {
      const raw = await fetchRaw(client);
      const next = fingerprint(raw);
      if (next !== fp) { fp = next; set({ status: 'ready', catalog: buildCatalog(raw), error: null }); }
      if (storage) writeCache(storage, raw, now());   // also refreshes the saved-at time, so a copy that keeps being confirmed never expires
    } catch (error) {
      if (background) { console.warn('Dominion catalog refresh failed (showing the saved copy):', error); return; }
      console.error('Dominion catalog failed to load:', error);
      set({ status: 'error', catalog: null, error });
    }
  }

  return {
    getState: () => state,
    subscribe: l => { listeners.add(l); return () => listeners.delete(l); },
    // starts loading once, however many components ask
    load() {
      if (started) return; started = true;
      const raw = storage ? readCache(storage, now()) : null;
      if (raw) { fp = fingerprint(raw); set({ status: 'ready', catalog: buildCatalog(raw), error: null }); fetchFresh({ background: true }); }
      else fetchFresh({ background: false });
    },
    retry() { started = true; set({ status: 'loading', catalog: null, error: null }); return fetchFresh({ background: false }); },
    clear() { if (storage) { try { storage.removeItem(CACHE_KEY); } catch { /* ignore */ } } },
  };
}

const stores = new Map();   // one store per Supabase client, for the life of the page
export function storeFor(client) { if (!stores.has(client)) stores.set(client, createCatalogStore({ client })); return stores.get(client); }
export const resetCatalogStores = () => stores.clear();
