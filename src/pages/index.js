import { lazy } from 'react';
import Rankings from './Rankings.jsx';
import Season from './Season.jsx';
import Players from './Players.jsx';
import Records from './Records.jsx';
import Games from './Games.jsx';

// The Collection and Admin are big and not everyone opens them, so they load on first visit (App renders pages inside <Suspense>).
const loadDominion = () => import('./Dominion.jsx');
const Dominion = lazy(loadDominion);
const Admin = lazy(() => import('./Admin.jsx'));
const Night = lazy(() => import('./Night.jsx'));   // ux experiment "flow": the guided way to log a game

// Routes already ported to React; every route is React now.
export const PAGES = { home: Rankings, season: Season, players: Players, records: Records, games: Games, night: Night, dominion: Dominion, admin: Admin };

/* Once the first screen is drawn and the browser is idle, fetch the Collection's code so opening it feels instant. Skipped when the
   visitor asked to save data or is on a slow connection, where an unrequested 20 KB download isn't free. */
export function prefetchCollection() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;
  const go = () => { loadDominion().catch(() => { /* it loads on demand anyway */ }); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 6000 }); else setTimeout(go, 3000);
}
