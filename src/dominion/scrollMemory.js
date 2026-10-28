/* "Back to your place": coming back from a card, landscape or Artifact page to the page it was opened from restores the scroll
   position. The place is a LIST (Kingdom cards, Landscapes) or the Overview (whose sunburst is far down the page). The position
   is captured at the moment the viewer leaves for a detail page — the hashchange handler runs before anything has scrolled,
   so window.scrollY is still the old page's. The memory is dropped as soon as the viewer goes anywhere that isn't that page or
   a detail page (reopening it from the menu starts at the top, as before), and it is only used when the page's URL — filters
   or chart state included — is exactly the one the position was recorded on. */
let mem = null;   // { key: the origin's hash, origin: its path, y }

const OVERVIEW = '#/dominion';
const pathOf = hash => hash.split('?')[0];
const isOrigin = hash => /^#\/dominion\/(cards|landscapes)$/.test(pathOf(hash)) || pathOf(hash) === OVERVIEW;
const isDetail = hash => /^#\/dominion\/(cards|landscapes|artifacts)\/[^/?]+$/.test(pathOf(hash));

// called on every hash change with the hash we came from, the one we are going to, and the current scroll position
export function navigated(prev, next, y) {
  if (isOrigin(prev) && isDetail(next)) { mem = { key: prev, origin: pathOf(prev), y }; return; }
  if (mem && !(pathOf(next) === mem.origin || isDetail(next))) mem = null;
}

export function restoreListScroll() {
  if (mem && mem.key === location.hash) window.scrollTo(0, mem.y);
}

export const forgetListScroll = () => { mem = null; };   // for tests
