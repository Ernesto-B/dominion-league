import { useSyncExternalStore } from 'react';
import { navigated } from './dominion/scrollMemory.js';

const pathOf = hash => hash.split('?')[0];

function subscribe(cb) {
  let last = location.hash;
  const onChange = () => {
    cb();
    const prev = last; last = location.hash;
    navigated(prev, last, window.scrollY);   // still the old page's position: nothing has scrolled yet
    // only a different page scrolls to the top; a change of the query alone (a filter click) is the same page
    if (pathOf(last) !== pathOf(prev)) window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);
