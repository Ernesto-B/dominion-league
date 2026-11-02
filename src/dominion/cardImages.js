import { useEffect, useState } from 'react';

/* Card pictures: WHERE they come from lives in this one file. Everything else asks `cardImage(id)` and hands the result to <CardFace>.
   Two homes, tried in this order (the reverse in `npm run dev`, so a developer's own copy wins):
     - the PRIVATE Supabase bucket `card-images` (supabase/dominion/03_card_images_bucket.sql): only signed-in league members can read it. A private file cannot be a plain
       <img src>, so each picture is downloaded with the member's session, kept in the browser's Cache Storage under a stable key (its path + the picture's hash from the
       manifest) and shown from there. After the first view a picture costs no network at all, and a changed picture (a new hash) is fetched once.
     - a folder next to the site (public/cards, built by `npm run cards:build`, never committed): what the developer's own machine uses.
   The manifest ({ v: 2, items: { id: { w, h, bw?, bh?, k } } }) says which cards have a picture and how big. It is kept on the device and refreshed in the background (at most
   every few hours), so opening a page never waits for it. A site with no pictures simply has none, and every screen falls back to the text it always had.
   Three sizes per card: thumbnail (lists), small (grids), big (the enlarge view, only when the source had the detail). Nothing is downloaded until it is near the screen. */
const BUCKET = 'card-images';
const CACHE = 'dl-cards-v1';
const MANIFEST_KEY = 'dl.cards.manifest';
const REFRESH_MS = 6 * 60 * 60 * 1000;
const MAX_PARALLEL = 6;

let manifest = null, loading = null, failed = false, mode = 'local';   // mode: where the manifest was found, 'bucket' or 'local'
const listeners = new Set();
const announce = () => listeners.forEach(f => f());

const parse = text => { try { const m = JSON.parse(text); return m && m.items ? m : null; } catch { return null; } };

async function fromBucket() {
  try {
    const { sb } = await import('../lib/supabase.js');
    const { data, error } = await sb.storage.from(BUCKET).download('manifest.json');
    return !error && data ? parse(await data.text()) : null;
  } catch { return null; }
}
async function fromLocal(fetcher) {
  try { const r = await fetcher('cards/manifest.json'); return r.ok ? parse(await r.text()) : null; } catch { return null; }
}
// `npm run dev` looks in the local folder first (a developer's own copy wins, then the bucket). A production build uses ONLY the bucket: a build made on a machine that has public/cards would otherwise
// fall back to those files in the moment before sign-in (the bucket refuses a signed-out visitor) and never ask the bucket again.
const order = () => (import.meta.env && import.meta.env.DEV ? [['local', fromLocal], ['bucket', fromBucket]] : [['bucket', fromBucket]]);

export function loadManifest(fetcher = (...a) => fetch(...a)) {
  if (loading && !failed) return loading;   // a load that found nothing (not signed in yet, offline) is tried again the next time it is asked for
  failed = false;
  const saved = (() => { try { const s = JSON.parse(localStorage.getItem(MANIFEST_KEY) || 'null'); return s && s.m && s.m.items ? s : null; } catch { return null; } })();
  if (saved) { manifest = saved.m; mode = saved.mode || 'local'; }   // shown at once; refreshed below when it is old
  const fresh = !!saved && saved.mode === order()[0][0] && Date.now() - saved.at < REFRESH_MS;   // a list saved from another source than this build prefers is out of date at once
  const fetchIt = async () => {
    for (const [name, get] of order()) {
      const m = await get(fetcher);
      if (m) { manifest = m; mode = name; try { localStorage.setItem(MANIFEST_KEY, JSON.stringify({ m, mode: name, at: Date.now() })); } catch { /* storage full: not kept */ } return; }
    }
    if (!saved) { manifest = { v: 2, items: {} }; failed = true; }   // none anywhere: no pictures for now
  };
  loading = (fresh ? Promise.resolve() : fetchIt()).then(() => { announce(); return manifest; });
  return loading;
}

// ---- finding a picture ----
const sizeOf = (e, kind) => (kind === 'big' && e.bw ? { w: e.bw, h: e.bh } : kind === 'thumb' ? (e.w > e.h ? { w: 160, h: Math.round(160 * e.h / e.w) } : { w: 96, h: Math.round(96 * e.h / e.w) }) : { w: e.w, h: e.h });
const pathFor = (id, kind) => `${id.replace(/:/g, '/')}${kind === 'big' ? '@big' : kind === 'thumb' ? '@t' : ''}.webp`;
const pic = (id, e, kind) => { const s = sizeOf(e, kind); return { path: pathFor(id, kind), key: `${pathFor(id, kind)}?k=${e.k}`, width: s.w, height: s.h }; };

// { width, height (the small version), small, big, thumb } for a catalog id (a Kingdom card, a landscape, an Artifact or a pile), or null when there is no picture for it.
// Each of small / big / thumb is { path, key, width, height } for pictureSrc(); `big` is null when the source had no more detail than the small one.
export function cardImage(id) {
  const e = manifest && manifest.items[id];
  return e ? { width: e.w, height: e.h, small: pic(id, e, 'small'), big: e.bw ? pic(id, e, 'big') : null, thumb: pic(id, e, 'thumb') } : null;
}
export const anyCardImages = () => !!manifest && Object.keys(manifest.items).length > 0;
export const cardImageMode = () => mode;

// ---- showing a picture ----
const urls = new Map();   // key -> Promise<object URL>, so one picture is only ever fetched once per page load
let running = 0; const waiting = [];
const slot = () => new Promise(res => { const go = () => { running++; res(); }; running < MAX_PARALLEL ? go() : waiting.push(go); });
const release = () => { running--; const next = waiting.shift(); if (next) next(); };
const openCache = async () => { try { return typeof caches !== 'undefined' ? await caches.open(CACHE) : null; } catch { return null; } };
const cacheKey = key => `https://cards.invalid/${key}`;

// A page-load-stable source for an <img>: the local folder's own URL, or an object URL made from the saved (or just downloaded) picture. Resolves to null when it cannot be had.
export const localSrc = p => `cards/${p.path}?k=${p.key.split('?k=')[1]}`;   // the developer's own folder: a plain URL, known at once
export function pictureSrc(p) {
  if (mode === 'local') return Promise.resolve(localSrc(p));
  if (urls.has(p.key)) return urls.get(p.key);
  const job = (async () => {
    await slot();
    try {
      const cache = await openCache();
      const hit = cache && await cache.match(cacheKey(p.key));
      let blob = hit ? await hit.blob() : null;
      if (!blob) {
        const { sb } = await import('../lib/supabase.js');
        const { data, error } = await sb.storage.from(BUCKET).download(p.path);
        if (error || !data) return null;
        blob = data;
        if (cache) { try { await cache.put(cacheKey(p.key), new Response(blob, { headers: { 'content-type': 'image/webp' } })); } catch { /* quota: shown, not kept */ } }
      }
      return URL.createObjectURL(blob);
    } catch { return null; } finally { release(); }
  })();
  urls.set(p.key, job);
  job.then(u => { if (!u) urls.delete(p.key); });   // a failure is tried again next time, never remembered
  return job;
}

// Forget every saved picture and the manifest (signing out: the pictures belong to signed-in members)
export async function clearCardCache() {
  urls.forEach(p => p.then(u => u && URL.revokeObjectURL(u)));
  urls.clear(); manifest = null; loading = null; failed = false;
  try { localStorage.removeItem(MANIFEST_KEY); } catch { /* nothing to clear */ }
  try { if (typeof caches !== 'undefined') await caches.delete(CACHE); } catch { /* nothing to clear */ }
}

// for tests
export const _setManifest = (m, m2 = 'local') => { manifest = m; mode = m2; loading = m ? Promise.resolve(m) : null; failed = false; urls.clear(); };

// Re-renders the caller once the manifest has loaded (instantly when it already has).
export function useCardImages() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick(n => n + 1);
    listeners.add(f);
    if (!manifest || !loading) loadManifest();
    return () => { listeners.delete(f); };
  }, []);
  return { get: cardImage, any: anyCardImages(), ready: !!manifest };
}

// "Card faces" or "List": how a rolled kingdom is drawn when there are pictures. Remembered on this device (default: faces).
const PREF = 'dl.cardview';
export function useCardView() {
  const [view, set] = useState(() => { try { return localStorage.getItem(PREF) === 'list' ? 'list' : 'faces'; } catch { return 'faces'; } });
  const setView = v => { set(v); try { localStorage.setItem(PREF, v); } catch { /* private mode: it just is not remembered */ } };
  return [view, setView];
}

// A supply pile that holds several names (Knights, Castles, the split piles) can have a picture of its own: the pile card. Its id is `<expansion id>:pile:<pile name, slugged>`
// (dark-ages:pile:knights), the same one scripts/dominion/build-card-images.mjs writes. Without a pile picture the slot shows its first card that has one.
export const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const pileImageId = slot => (slot.cards.length > 1 ? `${slot.cards[0].id.split(':')[0]}:pile:${slugOf(String(slot.key).split('::')[1] || slot.name)}` : null);
// the id of the picture that stands for a slot of a roll or draft, or null when none of it has one
export function slotFaceId(slot) {
  const pile = pileImageId(slot);
  if (pile && cardImage(pile)) return pile;
  const c = slot.cards.find(x => cardImage(x.id));
  return c ? c.id : null;
}
