import { useSyncExternalStore } from 'react';

// true while the viewport matches a media query; true on the server and in tests (no matchMedia), where the wide layout is the one worth rendering
export function useMedia(query, fallback = true) {
  return useSyncExternalStore(
    cb => { if (typeof matchMedia === 'undefined') return () => {}; const m = matchMedia(query); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => (typeof matchMedia === 'undefined' ? fallback : matchMedia(query).matches),
    () => fallback,
  );
}
export const useWide = () => useMedia('(min-width:721px)');
