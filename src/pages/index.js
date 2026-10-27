import Rankings from './Rankings.jsx';
import Season from './Season.jsx';
import H2H from './H2H.jsx';
import Records from './Records.jsx';
import Games from './Games.jsx';

// Routes already ported to React; every other route still goes through LegacyPage.
export const PAGES = { home: Rankings, season: Season, h2h: H2H, records: Records, games: Games };
