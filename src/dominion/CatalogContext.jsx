import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sb } from '../lib/supabase.js';
import { loadCatalog } from './api.js';
import { summarize } from './stats.js';
import { LoadingState, ErrorState } from './components/States.jsx';

/* The catalog (cards, piles, landscapes, ...) is small and read-only, so it is fetched once per page load, verified
   complete, cached at module level, and shared by every Dominion view — moving between Overview, Cards and a card
   page never refetches. Views read it from context, which also lets tests supply a catalog directly. */
const CatalogContext = createContext(null);
export const useCatalog = () => { const v = useContext(CatalogContext); if (!v) throw new Error('useCatalog must be used inside <CatalogProvider>'); return v; };

export function CatalogProvider({ catalog, children }) {
  const value = useMemo(() => ({ catalog, summary: summarize(catalog) }), [catalog]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

let cached = null;                  // { promise, catalog? }
export const resetCatalogCache = () => { cached = null; };

export function useCatalogLoad(client = sb) {
  const [state, setState] = useState(() => (cached && cached.catalog ? { status: 'ready', catalog: cached.catalog } : { status: 'loading' }));
  const load = useCallback(() => {
    setState({ status: 'loading' });
    const entry = cached = { promise: loadCatalog(client) };
    entry.promise.then(
      catalog => { entry.catalog = catalog; if (cached === entry) setState({ status: 'ready', catalog }); },
      error => { if (cached === entry) cached = null; console.error('Dominion catalog failed to load:', error); setState({ status: 'error', error }); },
    );
  }, [client]);
  useEffect(() => {
    if (cached && cached.catalog) { setState({ status: 'ready', catalog: cached.catalog }); return; }
    if (cached && cached.promise) { cached.promise.then(c => setState({ status: 'ready', catalog: c }), e => setState({ status: 'error', error: e })); return; }
    load();
  }, [load]);
  return { ...state, retry: load };
}

// Fetches the catalog, then renders children with it available through useCatalog().
export function DominionData({ children, client }) {
  const s = useCatalogLoad(client);
  if (s.status === 'loading') return <LoadingState />;
  if (s.status === 'error') return <ErrorState error={s.error} onRetry={s.retry} />;
  return <CatalogProvider catalog={s.catalog}>{children}</CatalogProvider>;
}
