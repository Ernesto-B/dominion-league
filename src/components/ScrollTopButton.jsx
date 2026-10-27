import { useEffect, useState } from 'react';

const SHOW_AFTER = 600;   // px scrolled before the button appears

// Floating "back to top" button. Mounted by the shell only on the long pages (Games, Collection).
export default function ScrollTopButton() {
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
    <button type="button" className={'totop' + (show ? ' on' : '')} onClick={up}
      aria-label="Back to top" title="Back to top" tabIndex={show ? 0 : -1} aria-hidden={!show}>↑</button>
  );
}
