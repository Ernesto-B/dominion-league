import { useEffect, useRef } from 'react';

/* Keyboard shortcuts, for a computer. Two kinds:
     - site-wide ones (components/Shortcuts.jsx): `g` then a letter goes to a page, `/` searches, `?` lists them all;
     - page ones, registered by whatever page is showing through <PageShortcuts bindings=[{ key, label, run }]/> and gone when it leaves (a card page's arrows, a game report's tabs).
   A page's binding wins over the site-wide one with the same key. Nothing fires while typing in a field, with Ctrl / Cmd / Alt held, over an open dialog, or on a phone (no pointer to hover with). */
const registered = [];   // each entry: () => bindings; the last one registered is the most specific

export function registerShortcuts(get) { registered.push(get); return () => { const i = registered.indexOf(get); if (i >= 0) registered.splice(i, 1); }; }
// every active page binding, the most recently registered first, one per key
export function activeBindings() {
  const seen = new Set(), out = [];
  for (let i = registered.length - 1; i >= 0; i--) for (const b of registered[i]() || []) { const k = idOf(b); if (!seen.has(k)) { seen.add(k); out.push(b); } }
  return out;
}
// a binding is a key, and `shift: true` for Shift + that letter (R and Shift+R are different bindings)
export const idOf = b => (b.shift ? 'shift+' : '') + normKey(b.key);
// does this key press fire the binding? Shift only counts for letters (a `?` is typed with Shift, and that is not a Shift binding)
export const matches = (b, e) => normKey(b.key) === normKey(e.key) && !!b.shift === (!!e.shiftKey && /^[a-zA-Z]$/.test(e.key));
export function usePageShortcuts(bindings) {
  const ref = useRef(bindings); ref.current = bindings;
  useEffect(() => registerShortcuts(() => ref.current), []);
}

export const normKey = k => (k.length === 1 ? k.toLowerCase() : k);
// true when the key press is for a field (or something editable), where letters are text
export function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
}
// a dialog is open (the enlarged card, the Add / Edit game dialog, the help): page shortcuts stand aside
export const dialogOpen = (doc = document) => !!doc.querySelector('.dn-peek, .modal-overlay, [role=dialog][aria-modal=true]');
export const canUseKeys = () => typeof matchMedia === 'undefined' || matchMedia('(hover: hover) and (pointer: fine)').matches;

// `g` then one of these goes to the page: the label is for the help list
export const GO = [
  ['h', 'Rankings', 'home'], ['s', 'Season', 'season'], ['p', 'Players', 'players'], ['g', 'Games', 'games'], ['r', 'Records', 'records'],
  ['c', 'Collection', 'dominion'], ['n', 'Game night (admin)', 'night'], ['a', 'Admin', 'admin'],
];
export const GO_WINDOW = 1200;   // ms after `g` to press the letter
