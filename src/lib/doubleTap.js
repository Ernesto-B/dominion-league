/* Stop a double-tap from zooming the page without ever swallowing a real tap.
   `touch-action: manipulation` (style.css) already turns double-tap zoom off in current browsers; this is only a fallback for the odd one that ignores it. The old version cancelled the default of
   ANY tap within 350 ms of the last one, anywhere, which also cancels the click: a fast second tap on a different button was dropped. Now it only acts when the second tap lands on the SAME spot,
   quickly, and not on something you press (a button, link, field, summary, label or anything with a button role): those always get their click. */
export const DOUBLE_TAP_MS = 250, DOUBLE_TAP_PX = 24;
const PRESSABLE = 'a,button,input,textarea,select,summary,label,[role=button],[role=tab],[role=link],[onclick]';

export function isDoubleTapToBlock(prev, next, target) {
  if (!prev || !next) return false;
  if (next.t - prev.t > DOUBLE_TAP_MS) return false;
  if (Math.hypot(next.x - prev.x, next.y - prev.y) > DOUBLE_TAP_PX) return false;
  return !(target && target.closest && target.closest(PRESSABLE));
}

export function installDoubleTapGuard(doc = document) {
  let prev = null;
  doc.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || e.touches.length !== 0) return;
    const next = { t: Date.now(), x: t.clientX, y: t.clientY };
    if (e.cancelable && isDoubleTapToBlock(prev, next, e.target)) e.preventDefault();
    prev = next;
  }, { passive: false });
}
