import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePopup } from './popup.js';

// Mounted once by App. Positions itself next to the pointer, flipping to the other side of the
// cursor when it would run off the viewport.
export default function PopLayer() {
  const s = usePopup();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !s.visible) return;
    if (s.centered) { el.style.transform = 'translate(-50%,-50%)'; el.style.left = '50%'; el.style.top = '50%'; return; }
    el.style.transform = 'none';
    // A fixed box with auto width is sized by the room to its right, i.e. by where it currently is.
    // The old code placed on mouseenter and again on the mousemove right behind it, so the second
    // pass measured at the first pass's position. React batches those two events into one render,
    // so place twice here to reproduce that (and make the result independent of the stale position).
    for (let pass = 0; pass < 2; pass++) {
      const pad = 16;
      let x = s.x + pad, y = s.y + pad;
      const pw = el.offsetWidth, ph = el.offsetHeight;
      if (x + pw > window.innerWidth - 8) x = s.x - pw - pad;
      if (y + ph > window.innerHeight - 8) y = s.y - ph - pad;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
  });
  return createPortal(<div className="popbox" ref={ref} style={{ display: s.visible ? 'block' : 'none' }}>{s.content}</div>, document.body);
}
