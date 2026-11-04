/* The cards being picked for a comparison while the viewer browses the Kingdom cards list: a tiny shared store (the list, its tray and the compare page all read it),
   kept in sessionStorage so a reload or a trip to a card's page doesn't lose the picks. `picking` is whether the list is in pick mode. The comparison itself lives in its address, not here. */
import { useSyncExternalStore } from 'react';
import { MAX_COMPARE } from './links.js';

const KEY = 'dl.compare';
const listeners = new Set();
const load = () => {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (v && Array.isArray(v.ids)) return { picking: !!v.picking, ids: v.ids.filter(x => typeof x === 'string').slice(0, MAX_COMPARE) }; } catch { /* unreadable: start empty */ }
  return { picking: false, ids: [] };
};
let state = load();
const set = next => {
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: the picks just won't survive a reload */ }
  listeners.forEach(l => l());
};

// pure: add the id, or take it off if it is there; a fifth card is refused (the list comes back unchanged)
export const toggled = (ids, id) => (ids.includes(id) ? ids.filter(x => x !== id) : ids.length >= MAX_COMPARE ? ids : [...ids, id]);

export const startPicking = (ids = []) => set({ picking: true, ids: ids.slice(0, MAX_COMPARE) });
export const stopPicking = () => set({ picking: false, ids: [] });
export const togglePick = id => set({ ...state, ids: toggled(state.ids, id) });
export const removePick = id => set({ ...state, ids: state.ids.filter(x => x !== id) });
export const useCompareBasket = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
