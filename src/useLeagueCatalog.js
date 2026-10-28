import { useEffect, useSyncExternalStore } from 'react';
import { sb } from './lib/supabase.js';
import { storeFor } from './dominion/catalogStore.js';

/* The Collection's catalog for the league pages (badges and XP read what each game's kingdom was made of). It is only asked for once the first
   screen has settled, so it never competes with it; the store shows the browser's saved copy at once on later visits and shares one fetch with the
   Collection itself. null until it is in (or if it can't be loaded): everything that needs it simply earns nothing yet. */
export function useLeagueCatalog() {
  const store = storeFor(sb);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  useEffect(() => {
    const run = () => store.load();
    if (typeof requestIdleCallback === 'function') { const id = requestIdleCallback(run, { timeout: 4000 }); return () => cancelIdleCallback(id); }
    const id = setTimeout(run, 1500); return () => clearTimeout(id);
  }, [store]);
  return state.status === 'ready' ? state.catalog : null;
}
