/* "Choose a card for my kingdom": the Randomizer (or Game night's Random way) sends the viewer to the Kingdom cards or Landscapes list to pick one, then the pick comes back.
   It is a tiny shared store in sessionStorage, because the viewer leaves the page they started from:
     target   what is being chosen: { kind: 'card' | 'landscape', index (the slot to replace, or null to add), label (the name being replaced, or null), labelId (its id, to show the card), taken (ids already in the kingdom), returnHash, scrollY (how far down the page they started from was) }
     result   the choice made, waiting for the page that asked to take it: { kind, id, index }
     resume   true once the viewer has come back (picked or cancelled): the page that asked reopens in hand-editing, as they left it, until they press its button themselves
   The list shows its "choosing" screen while there is a target; picking sets the result, clears the target and goes back to `returnHash`; the panel takes the result when it appears again. */
import { useSyncExternalStore } from 'react';
import { scrollBackTo } from '../lib/navMemory.js';

const KEY = 'dl.kingdompick';
const listeners = new Set();
const load = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (v && typeof v === 'object') return { target: v.target || null, result: v.result || null, resume: !!v.resume }; } catch { /* unreadable: nothing pending */ } return { target: null, result: null, resume: false }; };
let state = load();
const set = next => {
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: the pick just won't survive a reload */ }
  listeners.forEach(l => l());
};

export const startKingdomPick = target => set({ target, result: null, resume: false });
export const cancelKingdomPick = () => set({ target: null, result: null, resume: true });
// back to the page that asked, scrolled to where the viewer was (arriving by a link would otherwise start at the top)
export function returnFromPick(t) {
  window.location.hash = t.returnHash;
  if (t.scrollY > 0) setTimeout(() => scrollBackTo(t.scrollY), 60);
}
// a pick made with a click or tap: the button pops and its row lights up for a moment so the choice is unmistakable, then the viewer goes back (at once for someone who asked for less motion)
export function choosePick(id, from) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const row = from && from.closest ? from.closest('tr') : null;
  if (row) row.classList.add('chosen');
  const btn = row && row.querySelector('.dn-addpill');
  if (btn) btn.classList.add('popped');
  if (reduce || !row) finishKingdomPick(id); else setTimeout(() => finishKingdomPick(id), 280);
}
export function finishKingdomPick(id) {
  const t = state.target; if (!t) return;
  set({ target: null, result: { kind: t.kind, id, index: t.index }, resume: true });
  returnFromPick(t);
}
// the waiting choice, once: whoever asked takes it when they are back on screen
export function takeKingdomPick() { const r = state.result; if (r) set({ ...state, target: null, result: null }); return r; }
// whether to open hand-editing again (looked at while the page starts, cleared once it is up, so a later visit starts normally)
export const peekResumeEditing = () => state.resume;
export const clearResumeEditing = () => { if (state.resume) set({ ...state, resume: false }); };
export const useKingdomPick = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state).target;
