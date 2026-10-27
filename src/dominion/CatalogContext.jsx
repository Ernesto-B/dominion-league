import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { sb } from '../lib/supabase.js';
import { storeFor } from './catalogStore.js';
import { summarize } from './stats.js';
import { LoadingState, ErrorState } from './components/States.jsx';

/* The catalog (cards, piles, landscapes, ...) is small and read-only, so it is loaded once per page load, verified
   complete, and shared by every Dominion view — moving between Overview, Cards and a card page never refetches.
   Views read it from context, which also lets tests supply a catalog directly. */
const CatalogContext = createContext(null);
export const useCatalog = () => { const v = useContext(CatalogContext); if (!v) throw new Error('useCatalog must be used inside <CatalogProvider>'); return v; };

export function CatalogProvider({ catalog, children }) {
  const value = useMemo(() => ({ catalog, summary: summarize(catalog) }), [catalog]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/* The catalog comes from catalogStore.js: shown from the browser's saved copy at once when there is one, refreshed in the
   background; fetched with a loading screen the first time. Every component that asks shares the one store. */
export function useCatalogLoad(client = sb) {
  const store = storeFor(client);
  store.load();   // idempotent; called while rendering (not in an effect) so a saved copy is on screen in the very first paint
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { ...state, retry: store.retry };
}

// Fetches the catalog, then renders children with it available through useCatalog().
export function DominionData({ children, client }) {
  const s = useCatalogLoad(client);
  if (s.status === 'loading') return <LoadingState />;
  if (s.status === 'error') return <ErrorState error={s.error} onRetry={s.retry} />;
  return <CatalogProvider catalog={s.catalog}>{children}</CatalogProvider>;
}
