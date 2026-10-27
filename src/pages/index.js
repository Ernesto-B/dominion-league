import { lazy } from 'react';
import Rankings from './Rankings.jsx';
import Season from './Season.jsx';
import Players from './Players.jsx';
import H2H from './H2H.jsx';
import Records from './Records.jsx';
import Games from './Games.jsx';

// The Collection and Admin are big and not everyone opens them, so they load on first visit (App renders pages inside <Suspense>).
const Dominion = lazy(() => import('./Dominion.jsx'));
const Admin = lazy(() => import('./Admin.jsx'));

// Routes already ported to React; every route is React now.
export const PAGES = { home: Rankings, season: Season, players: Players, h2h: H2H, records: Records, games: Games, dominion: Dominion, admin: Admin };
