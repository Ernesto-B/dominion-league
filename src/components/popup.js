import { useSyncExternalStore } from 'react';

/* One shared hover popup, like the old popLayer: a single node attached to <body>. It has to live
   outside <main>: a .popwrap nested inside .stats sits under an ancestor that gets backdrop-filter
   in dark mode, which makes it a containing block for position:fixed descendants — combined with
   .stats's overflow:hidden, an in-place popup would be clipped into invisibility. */
let state = { visible: false, content: null, x: 0, y: 0, centered: false };
const listeners = new Set();
const set = next => { state = { ...state, ...next }; listeners.forEach(l => l()); };

// NOTE: `content` is rendered by <PopLayer>, which sits outside PageContext. Build it from props only.
export const popup = {
  show: (content, e) => set({ visible: true, content, x: e.clientX, y: e.clientY, centered: false }),
  move: e => state.visible && !state.centered && set({ x: e.clientX, y: e.clientY }),
  // keyboard focus has no pointer, so the popup goes in the middle of the screen
  showCentered: content => set({ visible: true, content, centered: true }),
  hide: () => state.visible && set({ visible: false }),
};
export const usePopup = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
