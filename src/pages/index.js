import Rankings from './Rankings.jsx';
import Season from './Season.jsx';
import Players from './Players.jsx';
import H2H from './H2H.jsx';
import Records from './Records.jsx';
import Games from './Games.jsx';

// Routes already ported to React; every other route (just Admin now) still goes through LegacyPage.
export const PAGES = { home: Rankings, season: Season, players: Players, h2h: H2H, records: Records, games: Games };
