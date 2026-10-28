/* Switches for the UX experiments, so one build can be A (the current layout) and B (the new one) — and any mix:
     http://host/?ux=none         everything off: the current layout
     http://host/?ux=all          everything on (the default on this branch)
     http://host/?ux=nav,home     only these (nav, home, lists, flow, share, redesign)
   The choice is remembered in localStorage (so it survives the hash navigation that follows), and the footer switcher changes it.
   Each flag also becomes a class on <html> ("ux-nav", ...) for the CSS. Read once at startup: changing it reloads the page. */
export const UX_FLAGS = {
  nav: 'Bottom tab bar on phones',
  home: 'A home page that starts with you',
  lists: 'Denser lists and stacked tables on phones',
  flow: 'Guided Game night flow',
  share: 'Share a kingdom as an image',
  redesign: 'Cleaner front door: since-your-last-visit, tidier ladder, folded filters',
};
const KEY = 'dl.ux';
const ALL = Object.keys(UX_FLAGS);

// "none" | "all" | "nav,home" -> the list of flags that are on. Unknown names are ignored; nothing recognisable falls back to the default.
export function parseUx(value, fallback = ALL) {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  if (v === 'none' || v === 'off' || v === '0' || v === 'false') return [];
  if (v === 'all' || v === 'on' || v === '1' || v === 'true' || v === '') return ALL;
  const picked = v.split(',').map(s => s.trim()).filter(s => ALL.includes(s));
  return picked.length ? ALL.filter(f => picked.includes(f)) : fallback;
}
export const serializeUx = list => (list.length === 0 ? 'none' : list.length === ALL.length ? 'all' : list.join(','));

const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };
let current = null;

// resolves the flags from the URL (and remembers them), else from what was remembered, else the default
export function resolveUx(search = typeof location !== 'undefined' ? location.search : '', storage = store()) {
  const fromUrl = new URLSearchParams(search).get('ux');
  let list;
  if (fromUrl != null) { list = parseUx(fromUrl); try { storage && storage.setItem(KEY, serializeUx(list)); } catch { /* not remembered */ } }
  else { let saved = null; try { saved = storage && storage.getItem(KEY); } catch { /* ignore */ } list = parseUx(saved); }
  return list;
}
export const uxList = () => (current ||= resolveUx());
export const uxOn = name => uxList().includes(name);

// the footer switcher: remember a choice and reload without the ?ux= parameter so URLs stay clean
export function chooseUx(list) {
  try { store() && store().setItem(KEY, serializeUx(list)); } catch { /* ignore */ }
  const url = new URL(location.href); url.searchParams.delete('ux');
  // a ?ux= in the address would win over the choice just saved, so drop it; with none to drop, a plain reload applies the choice
  if (url.href !== location.href) location.replace(url.href); else location.reload();
}

// mark <html> so the stylesheet can key off the flags
export function applyUxClasses(root = typeof document !== 'undefined' ? document.documentElement : null) {
  if (!root) return;
  ALL.forEach(f => root.classList.toggle('ux-' + f, uxOn(f)));
}
export const resetUxForTests = () => { current = null; };
