/* The cards (or landscapes) you left by pressing Random, most recent last, kept for this browser session: Shift+R on a card page goes back along it, one step per press, so a random card you
   liked a moment ago is one key away. `kind` keeps Kingdom cards and landscapes apart. */
const KEY = kind => `dl.randtrail.${kind}`;
const LIMIT = 50;
const read = kind => { try { const a = JSON.parse(sessionStorage.getItem(KEY(kind)) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const write = (kind, a) => { try { sessionStorage.setItem(KEY(kind), JSON.stringify(a.slice(-LIMIT))); } catch { /* not kept */ } };

// remember `id` as the page left by Random
export function pushTrail(kind, id) { const a = read(kind); if (a[a.length - 1] !== id) a.push(id); write(kind, a); }
// the last one before this page (skipping the page you are on), removed from the trail so the next press goes one further back; null when there is none
export function popTrail(kind, currentId) {
  const a = read(kind);
  while (a.length) { const id = a.pop(); if (id !== currentId) { write(kind, a); return id; } }
  write(kind, a);
  return null;
}
export const hasTrail = (kind, currentId) => read(kind).some(id => id !== currentId);
