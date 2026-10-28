import { useEffect, useRef, useState } from 'react';

/* A number that counts up (or down) to its value when it appears, easing out so the last few ticks land softly. With reduced motion, or
   no requestAnimationFrame (tests, server rendering), it simply shows the value. `from` is where it starts (default: 0 for counts, so
   pass the old value to count between two ratings). */
export default function CountUp({ value, from = 0, ms = 900, format = v => Math.round(v) }) {
  const calm = typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [shown, setShown] = useState(calm ? value : from);
  const first = useRef(true);
  useEffect(() => {
    if (calm) { setShown(value); return undefined; }
    const start = first.current ? from : shown;   // later changes glide from wherever the number is now
    first.current = false;
    if (start === value) { setShown(value); return undefined; }
    let raf, t0;
    const tick = t => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / ms), eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <>{format(shown)}</>;
}
