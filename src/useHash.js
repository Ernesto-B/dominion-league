import { useSyncExternalStore } from 'react';
import { navigated } from './dominion/scrollMemory.js';
import { onNavigate, restore, startNavMemory } from './lib/navMemory.js';

let started = false;

const pathOf = hash => hash.split('?')[0];

function subscribe(cb) {
  if (!started) { started = true; startNavMemory(); }
  let last = location.hash;
  const onChange = () => {
    cb();
    const prev = last; last = location.hash;
    navigated(prev, last, window.scrollY);   // still the old page's position: nothing has scrolled yet
    // a different page starts at the top, unless this is a Back / Forward to a page you had scrolled (lib/navMemory.js puts you back there);
    // a change of the query alone (a filter click) is the same page
    const go = onNavigate({ pathChanged: pathOf(last) !== pathOf(prev) });
    if (go === 'top') window.scrollTo(0, 0);
    else if (go && go.restore != null) restore(go.restore);
  };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);
