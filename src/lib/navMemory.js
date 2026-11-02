/* "Back goes back to where you were". Every page you leave remembers how far down you had scrolled, and coming BACK to it (the browser's Back button, a swipe) puts you there again;
   a link you click always starts at the top. Nothing is added to the page: it is the browser's own history, with two small additions:
     - each history entry is tagged (history.state.dlNav) the first time it is seen, so a hash change that arrives already tagged is a revisit (Back / Forward) and one that is not is new;
     - the scroll position of the entry being left is kept in sessionStorage under its tag.
   A page that fills in late (the report's kingdom, Game night's cards, pictures) is given a couple of seconds to grow tall enough; the retries stop at once if the person scrolls or touches. */
const KEY = 'dl.scrollpos';
const LIMIT = 60;

const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = m => {
  const keys = Object.keys(m); if (keys.length > LIMIT) keys.slice(0, keys.length - LIMIT).forEach(k => delete m[k]);
  try { sessionStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage full or private mode: the position is just not kept */ }
};
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let currentId = null;
export const tagEntry = () => {
  const s = history.state;
  if (s && s.dlNav) return { id: s.dlNav, revisit: true };
  const id = newId();
  try { history.replaceState({ ...(s || {}), dlNav: id }, ''); } catch { /* no tag: this entry is treated as new */ }
  return { id, revisit: false };
};

// Scrolls to y, waiting for the page to be tall enough; gives up after about 3 s or at the first sign the person is scrolling themselves.
export function scrollBackTo(y, { tick = 80, tries = 38 } = {}) {
  if (!(y > 0)) { window.scrollTo(0, 0); return () => {}; }
  let n = 0, timer = 0, stopped = false;
  const stop = () => { stopped = true; clearTimeout(timer); ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(e => window.removeEventListener(e, stop)); };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(e => window.addEventListener(e, stop, { passive: true }));
  const step = () => {
    if (stopped) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(y, Math.max(0, max)));
    if ((max >= y - 2 && n > 1) || ++n > tries) { stop(); return; }
    timer = setTimeout(step, tick);
  };
  step();
  return stop;
}

let cancel = () => {};
// Called by useHash on every hash change. Returns what to do with the scroll: { restore: y } for a revisit that had a position, 'top' for a new page, or null (same page).
export function onNavigate({ pathChanged }) {
  const m = read();
  if (currentId) m[currentId] = window.scrollY;   // still the page being left: nothing has scrolled yet
  cancel();
  const { id, revisit } = tagEntry();
  currentId = id; write(m);
  if (!pathChanged) return null;
  return revisit ? { restore: m[id] || 0 } : 'top';
}
export const restore = y => { cancel = scrollBackTo(y); };

export function startNavMemory() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';   // the browser's own attempt runs before a page has any height; this one waits for it
  currentId = tagEntry().id;
  window.addEventListener('pagehide', () => { const m = read(); if (currentId) m[currentId] = window.scrollY; write(m); });
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (nav && nav.type === 'reload') { const y = read()[currentId]; if (y > 0) restore(y); }   // a reload keeps your place too
}

/* "Stay where you are": a control that swaps one detail page for another (Random / Previous / Next on a card page) calls keepScrollOnce() just before it changes the address, and the next
   page change leaves the scroll position alone instead of jumping to the top. It only lasts a moment, so a later, unrelated link still starts at the top. */
let keepUntil = 0;
export const keepScrollOnce = () => { keepUntil = Date.now() + 1500; };
export const takeKeepScroll = () => { const on = Date.now() < keepUntil; keepUntil = 0; return on; };
