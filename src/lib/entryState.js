/* A little page state that comes back with Back / Forward and not otherwise: which game cards are expanded, for instance. It is kept per HISTORY ENTRY (the tag lib/navMemory.js puts on each one),
   in sessionStorage, so pressing Back from a card's page finds the game cards open as you left them, while reaching the same page by a fresh link starts closed, as before. */
const KEY = 'dl.entrystate';
const LIMIT = 60;
import { useEffect, useState } from 'react';

const entryId = () => { try { return (history.state && history.state.dlNav) || null; } catch { return null; } };
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export function loadEntryState(name, id = entryId()) {
  if (!id) return undefined;
  const e = read()[id];
  return e ? e[name] : undefined;
}
export function saveEntryState(name, value, id = entryId()) {
  if (!id) return;
  const m = read();
  m[id] = { ...(m[id] || {}), [name]: value };
  const keys = Object.keys(m); if (keys.length > LIMIT) keys.slice(0, keys.length - LIMIT).forEach(k => delete m[k]);
  try { sessionStorage.setItem(KEY, JSON.stringify(m)); } catch { /* full or private mode: just not kept */ }
}

// The set of expanded game ids for one list on a page: `useOpenGames('last-night')` -> [open (a Set), toggle(id), setOpen]
export function useOpenGames(name, initial = () => new Set()) {
  const [open, setOpen] = useState(() => { const saved = loadEntryState(name); return Array.isArray(saved) ? new Set(saved) : initial(); });
  useEffect(() => { saveEntryState(name, [...open]); }, [open, name]);
  const toggle = line => setOpen(o => { const n = new Set(o); n.has(line) ? n.delete(line) : n.add(line); return n; });
  return [open, toggle, setOpen];
}
