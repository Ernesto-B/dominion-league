/* A ref callback for a scrolling list: it keeps `data-more="true"` on the element while there is more below the visible part, so the CSS can fade the last visible row
   as a hint that the list scrolls. Nothing to clean up by hand: React calls it with null on unmount, which removes the listener. */
export function scrollFade(el) {
  if (!el) return;
  const update = () => { el.dataset.more = String(el.scrollHeight - el.clientHeight - el.scrollTop > 2); };
  update();
  el.addEventListener('scroll', update, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
  if (ro) ro.observe(el);
  el._scrollFadeOff = () => { el.removeEventListener('scroll', update); if (ro) ro.disconnect(); };
}
// React 19 calls a ref callback's returned function on unmount; React 18 calls the callback again with null
export const scrollFadeRef = el => { if (el) { scrollFade(el); return () => { if (el._scrollFadeOff) el._scrollFadeOff(); }; } return undefined; };
