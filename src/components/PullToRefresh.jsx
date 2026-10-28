import { useEffect, useRef, useState } from 'react';

/* Pull down from the very top of a page on a touch screen to reload the league. The browser's own pull-to-refresh is switched off in CSS
   (overscroll-behavior), because it would reload the whole app; this one only refetches the data (boot()). Does nothing on a mouse, while
   a dialog is open, or when the gesture starts anywhere but the top. */
const READY = 48, MAX = 90;   // px the page has followed (the finger has gone about 1.7x as far)

export default function PullToRefresh({ onRefresh }) {
  const [pull, setPull] = useState(0);        // px the finger has dragged, damped
  const [busy, setBusy] = useState(false);
  const start = useRef(null), live = useRef(0), busyRef = useRef(false);

  useEffect(() => {
    if (typeof matchMedia === 'undefined' || !matchMedia('(pointer:coarse)').matches) return undefined;
    const blocked = el => !!el.closest('.modal-overlay, .moresheet-back, input, select, textarea, .chart, .night-steps');
    const down = e => {
      if (busyRef.current || window.scrollY > 0 || blocked(e.target)) { start.current = null; return; }
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
    };
    const move = e => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y, dx = Math.abs(e.touches[0].clientX - start.current.x);
      if (dy <= 0 || dx > dy || window.scrollY > 0) { if (live.current) { live.current = 0; setPull(0); } return; }
      live.current = Math.min(MAX, dy * 0.6);   // resistance: the page follows slower than the finger
      setPull(live.current);
    };
    const up = async () => {
      const reached = live.current >= READY;
      start.current = null; live.current = 0;
      if (!reached) { setPull(0); return; }
      busyRef.current = true; setBusy(true); setPull(READY);
      try { await Promise.all([onRefresh(), new Promise(r => setTimeout(r, 600))]); }   // 600ms so a fast refetch still reads as "it did something"
      finally { busyRef.current = false; setBusy(false); setPull(0); }
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => { window.removeEventListener('touchstart', down); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); window.removeEventListener('touchcancel', up); };
  }, [onRefresh]);

  if (!pull && !busy) return null;
  const ready = pull >= READY;
  return (
    <div className={'ptr' + (busy ? ' busy' : '') + (ready ? ' ready' : '')} style={{ transform: `translate(-50%, ${pull - 44}px)` }} role="status" aria-live="polite">
      <i aria-hidden="true" style={busy ? undefined : { transform: `rotate(${Math.min(pull, MAX) * 3}deg)` }}></i>
      <span className="visually-hidden">{busy ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
    </div>
  );
}
