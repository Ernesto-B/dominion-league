import { useEffect } from 'react';

/* While the page is being scrolled, <html> carries `is-scrolling` (and loses it 160 ms after the last scroll event). style.css uses it to hold the site's LOOPING
   decorative animations (the pinned badges' shine, the streak flame) still for that moment: scrolling then only has to move the page, not also redraw them on every
   frame, which is what keeps it smooth on a weaker graphics chip. One passive listener, no state, nothing re-renders. */
export function useScrollCalm() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;
    const onScroll = () => {
      if (!root.classList.contains('is-scrolling')) root.classList.add('is-scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove('is-scrolling'), 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); root.classList.remove('is-scrolling'); };
  }, []);
}
