import { useRef } from 'react';

/* A <details> that opens and closes smoothly: its body slides open (height and a fade) instead of snapping. It is still a real <details> (keyboard, screen readers and find-in-page work as usual);
   only the click on its summary is taken over, to run a short Web Animations animation, and a visitor who asked for less motion gets the plain toggle. */
const MS = 180;
export default function Fold({ summary, children, className = '' }) {
  const box = useRef(null), body = useRef(null), anim = useRef(null);
  const toggle = e => {
    const d = box.current, b = body.current;
    if (!d || !b || typeof b.animate !== 'function' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;   // the browser's own toggle
    e.preventDefault();
    if (anim.current) anim.current.cancel();
    const opening = !d.open;
    if (opening) d.open = true;
    const full = b.scrollHeight + 'px';
    b.style.overflow = 'hidden';
    const a = b.animate(opening ? [{ height: '0px', opacity: 0 }, { height: full, opacity: 1 }] : [{ height: full, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: MS, easing: 'ease-out' });
    anim.current = a;
    a.onfinish = () => { b.style.overflow = ''; if (!opening) d.open = false; anim.current = null; };
    a.oncancel = () => { b.style.overflow = ''; };
  };
  return (
    <details ref={box} className={'dn-mech dn-rz-details ' + className}>
      <summary onClick={toggle}>{summary}</summary>
      <div ref={body}>{children}</div>
    </details>
  );
}
