import { useSyncExternalStore } from 'react';

function subscribe(cb) {
  const onChange = () => { cb(); window.scrollTo(0, 0); };
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);
