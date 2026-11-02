import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cardImage, useCardImages, warmPictures } from '../cardImages.js';
import CardFace from './CardFace.jsx';

/* The card beside the pointer: rest the mouse on a card's chip (anywhere on the site) and, after a moment, its picture appears next to the cursor; move off and it goes.
   Only for a mouse (a phone has no hover, and keeps its own tap and ⌄), only for a card that has a picture, and never in the way: it sits beside the pointer, flips to the other
   side near an edge, ignores the mouse itself (pointer-events: none) and is hidden by a scroll, a click or Escape. Like the enlarge dialog its state lives in ONE layer for the
   whole app (<HoverLayer /> in App.jsx), so a chip hovering never redraws the page under it.
   `hoverHandlers(id)` is what a chip or table row spreads onto its element (`id` may also be a function that returns the id when the pointer arrives). */
const DELAY = 150;   // long enough that sweeping the mouse across a row of chips does not flash a picture at each one
let timer = 0, current = null, last = { x: 0, y: 0 };
const listeners = new Set();
const publish = v => { current = v; listeners.forEach(f => f(v)); };
const canHover = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

const hide = () => { clearTimeout(timer); timer = 0; if (current) publish(null); };
const start = (which, e) => {
  const id = typeof which === 'function' ? which() : which;   // a row can name its picture lazily (a pile's picture is only known once the manifest has loaded)
  if (!id || !canHover() || !cardImage(id)) return;
  last = { x: e.clientX, y: e.clientY };
  warmPictures([id], 'big');   // the download starts the moment the mouse arrives, so it is usually done by the time the delay is over
  clearTimeout(timer);
  timer = setTimeout(() => publish({ id, ...last }), DELAY);
};
const move = e => { last = { x: e.clientX, y: e.clientY }; if (current) publish({ ...current, ...last }); };

export const hoverHandlers = id => ({ onMouseEnter: e => start(id, e), onMouseMove: move, onMouseLeave: hide, onMouseDown: hide });

// where the picture goes: beside the pointer, on whichever side has room, kept inside the window
export function placeBeside({ x, y }, w, h, vw, vh, gap = 22) {
  const left = x + gap + w <= vw - 8 ? x + gap : Math.max(8, x - gap - w);
  const top = Math.min(Math.max(8, y - h / 2), Math.max(8, vh - h - 8));
  return { left, top };
}

export default function HoverLayer() {
  useCardImages();   // this layer is always mounted, so the list of pictures is loaded for every page, even one that draws no picture itself (a chip, a table row)
  const [shown, setShown] = useState(current);
  useEffect(() => {
    listeners.add(setShown); setShown(current);
    const onKey = e => { if (e.key === 'Escape') hide(); };
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    window.addEventListener('hashchange', hide);
    document.addEventListener('keydown', onKey);
    return () => { listeners.delete(setShown); window.removeEventListener('scroll', hide, true); window.removeEventListener('hashchange', hide); document.removeEventListener('keydown', onKey); };
  }, []);
  const img = shown && cardImage(shown.id);
  if (!img) return null;
  const wide = img.width > img.height, w = wide ? 340 : 260, h = Math.round(w * img.height / img.width);
  const at = placeBeside(shown, w, h, window.innerWidth, window.innerHeight);
  return createPortal(
    <div className="dn-hoverpic" style={{ left: at.left, top: at.top, width: w }} aria-hidden="true">
      <CardFace id={shown.id} name="" size="big" />
    </div>,
    document.body,
  );
}
