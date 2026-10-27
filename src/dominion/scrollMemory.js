/* "Back to your place": coming back from a card (or landscape) page to the list it was opened from restores the scroll
   position. The position is captured at the moment the viewer leaves the list for one of its detail pages — the
   hashchange handler runs before anything has scrolled, so window.scrollY is still the list's. The memory is dropped
   as soon as the viewer leaves the list/detail family (reopening the list from the menu starts at the top, as before),
   and it is only used when the list's URL — filters included — is the one the position was recorded on. */
let mem = null;   // { key: the list's hash, family: 'cards' | 'landscapes', y }

const pathOf = hash => hash.split('?')[0];
const familyOf = hash => (/^#\/dominion\/(cards|landscapes)(?:\/|$)/.exec(pathOf(hash)) || [])[1] || null;
const isList = hash => /^#\/dominion\/(cards|landscapes)$/.test(pathOf(hash));

// called on every hash change with the hash we came from, the one we are going to, and the current scroll position
export function navigated(prev, next, y) {
  if (isList(prev) && !isList(next) && familyOf(next) === familyOf(prev)) mem = { key: prev, family: familyOf(prev), y };
  else if (mem && familyOf(next) !== mem.family) mem = null;
}

export function restoreListScroll() {
  if (mem && mem.key === location.hash) window.scrollTo(0, mem.y);
}

export const forgetListScroll = () => { mem = null; };   // for tests
