import { useEffect, useState } from 'react';

const SHOW_AFTER = 600;   // px scrolled before the button appears

// Floating "back to top" button, on every page but Admin. `lift` raises it clear of a sticky bar at the bottom (Game night's Back / Next).
export default function ScrollTopButton({ lift = false }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const up = () => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  };
  return (
    <button type="button" className={'totop' + (show ? ' on' : '') + (lift ? ' lift' : '')} onClick={up}
      aria-label="Back to top" title="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show}>↑</button>
  );
}
