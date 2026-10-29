import { expansionMeta } from '../dominion/constants.js';

/* Badges a player has earned, worked out from nothing but their own results (p.results from the engine) and the group's games. Pure.
   Every badge is a plain fact about the games, shown with the game that earned it; nothing here expires, resets or can be lost, so
   it never nags. `earned` is the game where it was first true (so the badge links to it), or null while it is still out of reach. */
const sole = (g, place) => place === 1 && Object.values(g.places).filter(x => x === 1).length === 1;
const soleLast = (g, place) => place === g.n && Object.values(g.places).filter(x => x === g.n).length === 1;

const firstIndex = (results, ok) => { for (let i = 0; i < results.length; i++) if (ok(results[i], i)) return i; return -1; };

/* `group` files a badge under a heading on the Player page. A badge with a `track` is one step of a ladder (games played, ranks): the page draws a
   track as one box showing the current step and the next, with every step inside it. Ids never change, so "seen" lists keep working.
   `bonus` is the XP a badge pays on top of the standard badge XP (lib/xp.js). `target` is the number a step is reached at, when it is a count.
   `tier` is how hard it is, shown as a small coloured dot (TIERS). */
export const GROUPS = ['Winning', 'Comebacks and upsets', 'The table', 'The kingdom', 'Landscapes', 'Expansions', 'Milestones', 'Seasons', 'Secrets'];
export const TIERS = [
  { id: 'common', label: 'Common', hint: 'Simple progression milestones' },
  { id: 'uncommon', label: 'Uncommon', hint: 'Moderate challenges' },
  { id: 'rare', label: 'Rare', hint: 'Difficult accomplishments' },
  { id: 'epic', label: 'Epic', hint: 'Major challenges' },
  { id: 'legendary', label: 'Legendary', hint: 'Long-term goals' },
];
const wins = (n, name, tier, bonus) => ({ id: 'wins-' + n, group: 'Winning', track: 'wins', trackName: 'Victories', name, hint: `Win ${n} games.`, target: n, tier, bonus });
const lifetime = (n, name, tier, bonus) => ({ id: 'vp-' + n, group: 'Milestones', track: 'vp', trackName: 'Estate Ledger', name, hint: `Score ${n.toLocaleString()} VP over all your games.`, target: n, tier, bonus });
const typeWins = (id, name, type, article) => ({ id, group: 'Landscapes', name, hint: `Win 5 games featuring ${article} ${type}.`, target: 5, tier: 'uncommon', bonus: 40 });
export const BADGES = [
  // Winning
  { id: 'first-win', group: 'Winning', tier: 'common', name: 'First blood', hint: 'Win a game outright.' },
  wins(5, 'Skirmisher', 'common', 20), wins(10, 'Veteran of the Field', 'uncommon', 40), wins(20, 'Scourge', 'rare', 80), wins(50, 'Warmaster', 'epic', 200), wins(100, 'Immortal', 'legendary', 500),
  { id: 'hat-trick', group: 'Winning', track: 'streak', trackName: 'Winning Streak', tier: 'uncommon', name: 'Hat trick', hint: 'Win three rated games in a row.', target: 3 },
  { id: 'unstoppable', group: 'Winning', track: 'streak', trackName: 'Winning Streak', tier: 'rare', name: 'Unstoppable', hint: 'Win five rated games in a row.', target: 5, bonus: 60 },
  { id: 'clean-sweep', group: 'Winning', tier: 'uncommon', name: 'Clean sweep', hint: 'Win every game of a night (two or more games).' },
  { id: 'landslide', group: 'Winning', track: 'margin', trackName: 'Margin of Victory', tier: 'uncommon', name: 'Landslide', hint: 'Win a game by more than 20 VP over the runner-up.', target: 21, bonus: 30 },
  { id: 'overkill', group: 'Winning', track: 'margin', trackName: 'Margin of Victory', tier: 'rare', name: 'Overkill', hint: 'Win a game by 50 VP or more over the runner-up.', target: 50, bonus: 60 },
  { id: 'twice-the-crown', group: 'Winning', tier: 'rare', name: 'Twice the Crown', hint: 'Win with at least double the VP of every other player.', bonus: 40 },
  { id: 'total-domination', group: 'Winning', tier: 'legendary', name: 'Total Domination', hint: 'In a game of 3 or more, win with more VP than all your opponents combined.', bonus: 300 },
  { id: 'shadow', group: 'Winning', tier: 'uncommon', name: 'Shadow of the Throne', hint: 'Finish in the top half three games in a row.', bonus: 20 },
  // Comebacks and upsets
  { id: 'redemption', group: 'Comebacks and upsets', tier: 'common', name: 'Redemption', hint: 'Win the game right after finishing last.' },
  { id: 'giant-slayer', group: 'Comebacks and upsets', track: 'slayer', trackName: 'Challenger', tier: 'uncommon', name: 'Revolutionary', hint: 'Win at a table with someone rated 100+ Elo above you.' },
  { id: 'god-slayer', group: 'Comebacks and upsets', track: 'slayer', trackName: 'Challenger', tier: 'rare', name: 'Regicide', hint: 'Win at a table with someone rated 200+ Elo above you.', bonus: 50 },
  { id: 'phoenix', group: 'Comebacks and upsets', tier: 'epic', name: 'The Phoenix', hint: 'Win a rated game of 3 or more as the lowest-rated player at the table.', bonus: 75 },
  { id: 'big-swing', group: 'Comebacks and upsets', track: 'swing', trackName: 'Acclaim', tier: 'uncommon', name: 'The Rumored', hint: 'Gain 50 or more Elo in a single game.' },
  { id: 'bigfoot', group: 'Comebacks and upsets', track: 'swing', trackName: 'Acclaim', tier: 'rare', name: 'Ascendant', hint: 'Gain 100 or more Elo in a single game.', bonus: 40 },
  { id: 'bounty-hunter', group: 'Comebacks and upsets', tier: 'uncommon', name: 'Bounty Hunter', hint: 'Finish ahead of a higher-rated player in 5 different rated games.', target: 5, bonus: 40 },
  { id: 'kingslayer', group: 'Comebacks and upsets', tier: 'epic', name: 'Kingslayer', hint: 'Finish ahead of the league’s highest-rated player, as they stood going into the game.', bonus: 100 },
  // The table
  { id: 'know-your-enemy', group: 'The table', tier: 'uncommon', name: 'Know Thy Enemy', hint: 'Play at least one game against every other player.' },
  { id: 'unbeaten-blade', group: 'The table', tier: 'rare', name: 'Unbeaten Blade', hint: 'Win three 1v1 games in a row.', bonus: 30 },
  { id: 'lone-wolf', group: 'The table', tier: 'uncommon', name: 'Lone Wolf', hint: 'Win 10 1v1 games.', target: 10, bonus: 40 },
  { id: 'royal-court', group: 'The table', tier: 'uncommon', name: 'Royal Court', hint: 'Win 10 games with 4 or more players.', target: 10, bonus: 40 },
  { id: 'king-of-the-hill', group: 'The table', tier: 'epic', name: 'King of the Hill', hint: 'Win two games in a row with 5 or more players in each.', bonus: 75 },
  { id: 'apex-predator', group: 'The table', tier: 'rare', name: 'Apex Predator', hint: 'Win a 6-player game.', bonus: 40 },
  { id: 'colossus', group: 'The table', tier: 'epic', name: 'Colossus', hint: 'In a 5 or 6-player game, outscore the bottom three players combined.', bonus: 100 },
  { id: 'the-final-boss', group: 'The table', tier: 'epic', name: 'The Final Boss', hint: 'Win a 6-player rated game while rated highest at the table.', bonus: 100 },
  { id: 'world-voyage', group: 'The table', tier: 'epic', name: 'World Voyage', hint: 'Win a game at every table size, from 2 to 6 players.', bonus: 200 },
  { id: 'the-grandmaster', group: 'The table', tier: 'legendary', name: 'The Grandmaster', hint: 'Win a rated game at every table size (2 to 6) against opponents whose average Elo is at least your own going in.', bonus: 500 },
  { id: 'the-unbreakable', group: 'The table', tier: 'legendary', name: 'The Unbreakable', hint: 'Play 20 rated games in a row without finishing last.', target: 20, bonus: 600 },
  // The kingdom
  { id: 'gilded-hall', group: 'The kingdom', tier: 'uncommon', name: 'Gilded Hall', hint: 'Win with a kingdom whose cards cost 4.8 coins or more on average.', bonus: 25 },
  { id: 'the-great-divide', group: 'The kingdom', tier: 'rare', name: 'The Great Divide', hint: 'Win with 3 or more cards costing 2 coins or less and 3 or more costing 6 or more.', bonus: 50 },
  { id: 'pure-blood', group: 'The kingdom', tier: 'uncommon', name: 'Pure Blood', hint: 'Play a game where all 10 kingdom cards are from the same expansion.', bonus: 15 },
  { id: 'a-world-divided', group: 'The kingdom', tier: 'rare', name: 'Crusader', hint: 'Win with a kingdom of exactly 2 expansions, 5 piles from each.', bonus: 60 },
  { id: 'ten-kingdoms', group: 'The kingdom', tier: 'epic', name: 'Ten Kingdoms, One Crown', hint: 'Win where every kingdom pile is from a different expansion.', bonus: 150 },
  { id: 'war-zone', group: 'The kingdom', track: 'warpath', trackName: 'Warpath', tier: 'uncommon', name: 'War Zone', hint: 'Play a game with 5 or more Attack cards in the kingdom.', bonus: 20 },
  { id: 'trial-by-fire', group: 'The kingdom', track: 'warpath', trackName: 'Warpath', tier: 'uncommon', name: 'Trial by Fire', hint: 'Win with 3 or more Attack cards in the kingdom.', bonus: 25 },
  { id: 'peaceful-realm', group: 'The kingdom', track: 'peace', trackName: 'Peace', tier: 'common', name: 'Peaceful Realm', hint: 'Play a game with no Attack card in the kingdom.', bonus: 10 },
  { id: 'the-pacifist', group: 'The kingdom', track: 'peace', trackName: 'Peace', tier: 'uncommon', name: 'The Pacifist', hint: 'Win a game with no Attack card in the kingdom.', bonus: 30 },
  { id: 'gold-rush', group: 'The kingdom', tier: 'common', name: 'Gold Rush', hint: 'Win a game with 3 or more Treasures in the kingdom.', bonus: 15 },
  { id: 'cheap-tricks', group: 'The kingdom', track: 'humble', trackName: 'Humble Means', tier: 'uncommon', name: 'Cheap Tricks', hint: 'Win when every kingdom card costs 4 coins or less.', bonus: 20 },
  { id: 'fire-sale', group: 'The kingdom', track: 'humble', trackName: 'Humble Means', tier: 'rare', name: 'Fire Sale', hint: 'Win when every kingdom card costs 3 coins or less.', bonus: 50 },
  // Landscapes
  typeWins('changing-tides', 'Changing Tides', 'Trait', 'a'), typeWins('architect-of-victory', 'Architect of Victory', 'Project', 'a'), typeWins('the-wayfinder', 'The Wayfinder', 'Way', 'a'),
  typeWins('master-strategist', 'Master Strategist', 'Landmark', 'a'), typeWins('turning-point', 'Turning Point', 'Event', 'an'),
  { id: 'shifting-realities', group: 'Landscapes', track: 'mix', trackName: 'Terraformer', tier: 'uncommon', name: 'Shifting Realities', hint: 'Win a game featuring at least two different landscape types.', target: 2, bonus: 30 },
  { id: 'fortune-favors', group: 'Landscapes', track: 'mix', trackName: 'Terraformer', tier: 'rare', name: 'Fortune Favors the Bold', hint: 'Win a game featuring at least three different landscape types.', target: 3, bonus: 60 },
  { id: 'master-of-fate', group: 'Landscapes', tier: 'epic', name: 'Master of Fate', hint: 'Win at least one game featuring each landscape type, over any number of games.', bonus: 150 },
  { id: 'landscape-connoisseur', group: 'Landscapes', track: 'lsee', trackName: 'Pioneer', tier: 'uncommon', name: 'Landfall', hint: 'See 25 different landscape cards in your games.', target: 25, bonus: 40 },
  { id: 'beyond-the-horizon', group: 'Landscapes', track: 'lsee', trackName: 'Pioneer', tier: 'rare', name: 'Beyond the Horizon', hint: 'See 50 different landscape cards in your games.', target: 50, bonus: 100 },
  // Milestones
  { id: 'regular', group: 'Milestones', track: 'games', trackName: 'Games played', tier: 'common', name: 'Regular', hint: 'Play 10 rated games.', target: 10 },
  { id: 'veteran', group: 'Milestones', track: 'games', trackName: 'Games played', tier: 'uncommon', name: 'Veteran', hint: 'Play 25 rated games.', target: 25 },
  { id: 'spoils-150', group: 'Milestones', track: 'spoils', trackName: 'Spoils', tier: 'uncommon', name: 'Full Coffers', hint: 'Earn more than 150 XP from a single game.', target: 151, bonus: 25 },
  { id: 'spoils-200', group: 'Milestones', track: 'spoils', trackName: 'Spoils', tier: 'rare', name: "Dragon's Hoard", hint: 'Earn more than 200 XP from a single game.', target: 201, bonus: 75 },
  lifetime(250, 'Landholder', 'common', 10), lifetime(500, 'Baron', 'common', 20), lifetime(750, 'Provincial Governor', 'uncommon', 35), lifetime(1000, 'Duke of Duchies', 'rare', 60), lifetime(1250, 'Lord of the Realm', 'epic', 100),
  { id: 'the-centurion', group: 'Milestones', tier: 'epic', name: 'The Centurion', hint: 'Finish a game with 100 VP or more.', bonus: 100 },
  { id: 'unfortunate-one', group: 'Milestones', tier: 'common', name: 'The Unfortunate One', hint: 'Finish a game with exactly 1 VP.', bonus: 10 },
  { id: 'into-the-abyss', group: 'Milestones', tier: 'uncommon', name: 'Into the Abyss', hint: 'Finish a game with negative VP.', bonus: 20 },
  { id: 'the-immortal', group: 'Milestones', tier: 'legendary', name: 'The Immortal', hint: 'Win 100 rated games and reach 1,500 Elo.', bonus: 1000 },
  // ---- SECRET badges: hidden until earned (see maskSecrets). `hint` is the real rule, shown only to the player who earned it; everyone else sees `quote`. ----
  { id: 'the-unholy-trinity', group: 'Secrets', secret: true, tier: 'secret', name: 'The Unholy Trinity', quote: 'Some kingdoms were never meant to exist.', hint: 'Win a match with more than 0 VP while every other player finishes with 0 or fewer VP.', bonus: 300 },
  { id: 'the-chosen-one', group: 'Secrets', secret: true, tier: 'secret', name: 'The Chosen One', quote: 'Destiny does not recognize rank.', hint: 'Win a 6-player match where all five opponents began at least 100 Elo above you.', bonus: 500 },
  { id: 'the-phantom-king', group: 'Secrets', secret: true, tier: 'secret', name: 'The Phantom King', quote: 'A crown claimed without a kingdom.', hint: 'Win a match with exactly 0 VP.', bonus: 250 },
  { id: 'the-forbidden-kingdom', group: 'Secrets', secret: true, tier: 'secret', name: 'The Forbidden Kingdom', hint: 'Win a match featuring at least 5 Attack Kingdom cards and 2 landscape cards.', bonus: 150 },
  { id: 'the-perfect-storm', group: 'Secrets', secret: true, tier: 'secret', name: 'The Perfect Storm', hint: 'Win a match featuring Seaside, Plunder and Menagerie cards, with at least 2 Kingdom cards from each expansion.', bonus: 200 },
  { id: 'the-council-of-shadows', group: 'Secrets', secret: true, tier: 'secret', name: 'The Council of Shadows', hint: 'Win a match with cards from Dark Ages, Intrigue and Empires, and at least one Landmark.', bonus: 200 },
];

/* A SECRET badge (`secret: true`, `group: 'Secrets'`, `tier: 'secret'`) is hidden until it is earned: achievements() hands back a masked "???" entry for it
   (no name, no rule, no progress), so no screen can leak it; once earned it is an ordinary badge that reveals itself with its own celebration. It has no
   difficulty dot and does not count toward Dominion Legend. To add one: an entry in BADGES like { id, group: 'Secrets', secret: true, tier: 'secret', name, hint, quote?, bonus }
   plus its rule (an `out.set(id, ...)` line, like any other badge). Once earned, its name shows on the player's profile to everyone, but the rule (`hint`) only to the
   player who earned it: everyone else gets `quote` (a line of flavour, optional) via viewHint(). `art` (a picture path) is optional too and is not set yet. */
const SECRET_HINT = 'A secret badge. Keep playing to find out what it asks.';
// the list with every secret that is not found yet replaced by its "???" entry (nothing of the real badge is kept, except what XP needs once it is earned)
// what to print as a badge's description: a secret's real rule only for the player who earned it (`mine`), its flavour line for everyone else
export const viewHint = (b, mine) => (b.secret && b.earned && !mine ? b.quote || 'A hidden legend.' : b.hint);
export const maskSecrets = list => list.map(b => (b.secret && !b.earned ? { id: b.id, group: b.group, secret: true, tier: 'secret', name: '???', hint: SECRET_HINT, earned: null } : b));

// the 50% and 100% steps of each expansion (by the catalog's expansion name): more than half of its supply piles, then all of them
const EXPANSION_NAMES = {
  'Dominion Base Game': ['Village Elder', 'Lord of Dominion'], Intrigue: ['Court Intriguer', 'Master of Whispers'], Seaside: ['Wanted Pirate', 'Seafaring Legend'],
  Prosperity: ['Merchant Prince', 'Grand Treasurer'], Hinterlands: ['Border Wanderer', 'Warden of the Marches'], 'Dark Ages': ['Grave Robber', 'Lord of Ruin'],
  'Cornucopia & Guilds': ['Guild Apprentice', 'Guildmaster'], Empires: ['Imperial Envoy', 'Imperator'], Renaissance: ['Patron of the Arts', 'Renaissance Man'],
  Menagerie: ['Horse Whisperer', 'Master of the Menagerie'], Plunder: ['Treasure Hunter', 'Dread Admiral'],
};
const LEVEL_NAMES = { 5: 'Apprentice', 10: 'Adept', 20: 'Sage', 50: 'Grandmaster', 100: 'Paragon', 200: 'Dominion Incarnate' };
const LEVEL_TIERS = { 5: 'common', 10: 'common', 20: 'uncommon', 50: 'rare', 100: 'epic', 200: 'legendary' };
const RANK_TIERS = ['common', 'uncommon', 'rare', 'epic'];   // Knight, Lord, Duke, Emperor (the tiers above the first)
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const vpOf = (g, n) => (g.playerVP && g.playerVP[n] != null && !Number.isNaN(+g.playerVP[n]) ? +g.playerVP[n] : null);
const allVp = g => g.names.every(n => vpOf(g, n) != null);
// the cards of a game's kingdom as the catalog knows them; `full` = at least 10 and every one found, so "every card costs..." can't be fooled by a half-logged kingdom
function cardsOf(g, catalog) {
  const cards = (g.kingdom || []).filter(k => k.kind === 'card').map(k => catalog.cardsById.get(k.id));
  return { cards: cards.filter(Boolean), full: cards.length >= 10 && cards.every(Boolean) };
}
const landscapesOf = (g, catalog) => [...new Map((g.kingdom || []).filter(k => k.kind === 'landscape').map(k => catalog.landscapesById.get(k.id)).filter(Boolean).map(l => [l.id, l])).values()];

/* Dominion Legend: every badge that is not legendary, earned. (The Renown track and the season title are added after this, since they come from XP and the
   league, so they are left out of the count.) Earned in the game that completed the set; null while anything is missing. */
export function legendFrom(list, games = []) {
  const need = list.filter(b => b.tier !== 'legendary' && !b.secret);
  if (!need.length || !need.every(b => b.earned)) return null;
  const idx = new Map(games.map(g => [g.line, g.idx ?? 0]));
  const last = need.map(b => b.earned.line).filter(l => l != null).reduce((m, l) => (m == null || (idx.get(l) ?? 0) > (idx.get(m) ?? 0) ? l : m), null);
  const g = last != null ? games.find(x => x.line === last) : null;
  return { date: g ? g.date : null, line: g ? g.line : null };
}

/* `p` is a player from the engine (results, titles, peak); `tiers` D.tiers; `everyone` the other rated players' names; `xp` the player's XP (lib/xp.js)
   for the Level track. `ctx` = { games: every game of the group (D.games), catalog: the Collection's catalog or null, baseXp: Map line -> XP before badge
   payouts }; without it only the badges that come from rated results can be earned. */
export function achievements(p, tiers = [], everyone = [], xp = null, ctx = {}) {
  const rs = p.results || [];
  const at = i => (i >= 0 && rs[i] ? { date: rs[i].game.date, line: rs[i].game.line } : null);
  const out = new Map(), vals = new Map();
  const me = p.name, all = ctx.games || [];

  out.set('first-win', at(firstIndex(rs, r => sole(r.game, r.place))));
  let run = 0, best = 0, hat = -1, unst = -1;
  rs.forEach((r, i) => { run = sole(r.game, r.place) ? run + 1 : 0; best = Math.max(best, run); if (run === 3 && hat < 0) hat = i; if (run === 5 && unst < 0) unst = i; });
  out.set('hat-trick', at(hat)); out.set('unstoppable', at(unst)); vals.set('hat-trick', best); vals.set('unstoppable', best);
  out.set('redemption', at(firstIndex(rs, (r, i) => i > 0 && sole(r.game, r.place) && soleLast(rs[i - 1].game, rs[i - 1].place))));
  const slayer = gap => at(firstIndex(rs, r => sole(r.game, r.place) && Object.entries(r.game.elo || {}).some(([n, e]) => n !== me && e && e.before - r.before >= gap)));
  out.set('giant-slayer', slayer(100)); out.set('god-slayer', slayer(200));
  out.set('big-swing', at(firstIndex(rs, r => r.after - r.before >= 50))); out.set('bigfoot', at(firstIndex(rs, r => r.after - r.before >= 100)));
  // the lowest-rated player at a table beats everyone else there (three or more players; six for The Chosen One)
  const lowest = (r, size) => { const e = Object.entries(r.game.elo || {}); return (size ? e.length === size : e.length >= 3) && r.place === 1 && e.every(([n, x]) => n === me || (x && x.before > r.before)); };
  out.set('phoenix', at(firstIndex(rs, r => lowest(r, 0))));
  // THE CHOSEN ONE (secret): a six-player win where all five opponents began at least 100 Elo above you
  out.set('the-chosen-one', at(firstIndex(rs, r => { const e = Object.entries(r.game.elo || {}); return e.length === 6 && r.place === 1 && e.every(([n, x]) => n === me || (x && x.before >= r.before + 100)); })));
  // rated games only, from here: who was rated above whom going in
  const eloOf = r => Object.entries(r.game.elo || {}).filter(([n, e]) => n !== me && e);
  out.set('the-final-boss', at(firstIndex(rs, r => r.game.n === 6 && r.place === 1 && eloOf(r).length === 5 && eloOf(r).every(([, e]) => e.before < r.before))));
  let bounty = 0; const bountyAt = [];
  rs.forEach((r, i) => { if (eloOf(r).some(([n, e]) => e.before > r.before && r.game.places[n] > r.place)) { bounty++; bountyAt.push(i); } });
  out.set('bounty-hunter', at(bounty >= 5 ? bountyAt[4] : -1)); vals.set('bounty-hunter', bounty);
  // the league's top-rated player going into a game (the previous game's ratings), beaten
  out.set('kingslayer', at(firstIndex(rs, r => {
    const g = r.game, prev = g.idx > 0 ? all[g.idx - 1] : null, snap = prev && prev.snapshot; if (!snap) return false;
    const top = Object.entries(snap).sort((a, b) => b[1] - a[1]); if (top.length < 2 || top[0][1] === top[1][1] || top[0][0] === me) return false;
    return g.places[top[0][0]] != null && g.places[top[0][0]] > r.place;
  })));
  // Immortal: 100 rated wins AND a 1,500 Elo peak; the later of the two moments
  let rw = 0, w100 = -1, p1500 = -1;
  rs.forEach((r, i) => { if (r.place === 1 && ++rw === 100) w100 = i; if (p1500 < 0 && r.after >= 1500) p1500 = i; });
  out.set('the-immortal', at(w100 >= 0 && p1500 >= 0 ? Math.max(w100, p1500) : -1));
  // 20 rated games in a row without finishing last (a shared last place is last)
  let safe = 0, unbreak = -1; rs.forEach((r, i) => { safe = r.place === r.game.n ? 0 : safe + 1; if (safe === 20 && unbreak < 0) unbreak = i; });
  out.set('the-unbreakable', at(unbreak));
  // a win at every table size against opponents rated at least as high on average
  const gm = new Set(); let gmAt = -1;
  rs.forEach((r, i) => { const o = eloOf(r); if (r.place === 1 && o.length && r.game.n >= 2 && r.game.n <= 6 && o.reduce((t, [, e]) => t + e.before, 0) / o.length >= r.before) gm.add(r.game.n); if (gmAt < 0 && gm.size === 5) gmAt = i; });
  out.set('the-grandmaster', at(gmAt));

  // a night won from start to finish: every rated game that day won outright, at least two of them
  const byDay = new Map();
  rs.forEach((r, i) => { const d = r.game.day; (byDay.get(d) || byDay.set(d, []).get(d)).push(i); });
  let sweep = -1;
  for (const idx of byDay.values()) if (idx.length >= 2 && idx.every(i => sole(rs[i].game, rs[i].place))) { sweep = sweep < 0 ? idx[idx.length - 1] : Math.min(sweep, idx[idx.length - 1]); }
  out.set('clean-sweep', at(sweep));

  const others = everyone.filter(n => n !== me), met = new Set();
  let allMet = -1;
  if (others.length) rs.forEach((r, i) => { if (allMet >= 0) return; Object.keys(r.game.places).forEach(n => met.add(n)); if (others.every(n => met.has(n))) allMet = i; });
  out.set('know-your-enemy', at(allMet));
  out.set('regular', at(rs.length >= 10 ? 9 : -1)); vals.set('regular', rs.length);
  out.set('veteran', at(rs.length >= 25 ? 24 : -1)); vals.set('veteran', rs.length);

  // everything below looks at every game the player sat at, friendly ones too (a win is a win), in order
  const G = all.filter(g => g.n >= 2 && g.places[me] != null);
  const gat = i => (i >= 0 && G[i] ? { date: G[i].date, line: G[i].line } : null);
  const won = G.map(g => g.places[me] === 1);
  const runEnd = (n, ok) => { let r = 0; for (let i = 0; i < G.length; i++) { r = ok(G[i], i) ? r + 1 : 0; if (r >= n) return i; } return -1; };
  const reach = (cum, t) => cum.findIndex(v => v >= t);
  const countAt = (ok, n) => { let c = 0, at1 = -1; G.forEach((g, i) => { if (ok(g, i) && ++c === n) at1 = i; }); return [at1, c]; };

  let w = 0; const cumWins = G.map((g, i) => (w += won[i] ? 1 : 0));
  for (const n of [5, 10, 20, 50, 100]) { out.set('wins-' + n, gat(reach(cumWins, n))); vals.set('wins-' + n, w); }
  let vpSum = 0; const cumVp = G.map(g => (vpSum += Math.max(0, vpOf(g, me) || 0)));
  for (const n of [250, 500, 750, 1000, 1250]) { out.set('vp-' + n, gat(reach(cumVp, n))); vals.set('vp-' + n, vpSum); }

  const rivalsVp = g => g.names.filter(n => n !== me).map(n => vpOf(g, n));
  const margin = (g, i) => (won[i] && allVp(g) ? vpOf(g, me) - Math.max(...rivalsVp(g)) : null);
  const margins = G.map(margin), bestMargin = margins.reduce((m, v) => (v != null && v > m ? v : m), 0);
  out.set('landslide', gat(margins.findIndex(m => m != null && m > 20))); out.set('overkill', gat(margins.findIndex(m => m != null && m >= 50)));
  vals.set('landslide', bestMargin); vals.set('overkill', bestMargin);
  out.set('twice-the-crown', gat(G.findIndex((g, i) => won[i] && allVp(g) && vpOf(g, me) > 0 && rivalsVp(g).every(v => v * 2 <= vpOf(g, me)))));
  out.set('total-domination', gat(G.findIndex((g, i) => won[i] && g.n >= 3 && allVp(g) && vpOf(g, me) > rivalsVp(g).reduce((t, v) => t + v, 0))));
  out.set('colossus', gat(G.findIndex(g => (g.n === 5 || g.n === 6) && allVp(g) && vpOf(g, me) > rivalsVp(g).sort((a, b) => a - b).slice(0, 3).reduce((x, y) => x + y, 0))));
  out.set('the-centurion', gat(G.findIndex(g => (vpOf(g, me) ?? -Infinity) >= 100)));
  out.set('unfortunate-one', gat(G.findIndex(g => vpOf(g, me) === 1)));
  out.set('into-the-abyss', gat(G.findIndex(g => (vpOf(g, me) ?? 0) < 0)));
  // SECRET badges that read the scores: a lone winner among players on 0 or less, and a win on exactly 0
  out.set('the-unholy-trinity', gat(G.findIndex((g, i) => won[i] && allVp(g) && vpOf(g, me) > 0 && rivalsVp(g).every(v => v <= 0))));
  out.set('the-phantom-king', gat(G.findIndex((g, i) => won[i] && vpOf(g, me) === 0)));
  out.set('shadow', gat(runEnd(3, g => g.pts[me] >= 0.5)));
  out.set('unbeaten-blade', gat((() => { const duels = G.map((g, i) => [g, i]).filter(([g]) => g.n === 2); let r = 0; for (const [, i] of duels) { r = won[i] ? r + 1 : 0; if (r >= 3) return i; } return -1; })()));
  const [wolfAt, wolf] = countAt((g, i) => g.n === 2 && won[i], 10); out.set('lone-wolf', gat(wolfAt)); vals.set('lone-wolf', wolf);
  const [courtAt, court] = countAt((g, i) => g.n >= 4 && won[i], 10); out.set('royal-court', gat(courtAt)); vals.set('royal-court', court);
  out.set('king-of-the-hill', gat(G.findIndex((g, i) => i > 0 && g.n >= 5 && G[i - 1].n >= 5 && won[i] && won[i - 1])));
  out.set('apex-predator', gat(G.findIndex((g, i) => g.n === 6 && won[i])));
  const sizes = new Set(); let voyage = -1;
  G.forEach((g, i) => { if (won[i] && g.n >= 2 && g.n <= 6) sizes.add(g.n); if (voyage < 0 && sizes.size === 5) voyage = i; });
  out.set('world-voyage', gat(voyage));

  // XP in one game, before any badge payout; the biggest so far is the progress
  const base = ctx.baseXp;
  if (base) {
    let bestXp = 0;
    G.forEach(g => { bestXp = Math.max(bestXp, base.get(g.line) || 0); });
    out.set('spoils-150', gat(G.findIndex(g => (base.get(g.line) || 0) > 150))); out.set('spoils-200', gat(G.findIndex(g => (base.get(g.line) || 0) > 200)));
    vals.set('spoils-150', bestXp); vals.set('spoils-200', bestXp);
  }

  const cat = ctx.catalog;
  const extra = [];   // badges built from the catalog (expansion tracks) and the levels, appended after the static ones
  // what the kingdoms were made of: needs the Collection's catalog
  if (cat) {
    const kc = G.map(g => cardsOf(g, cat)), ls = G.map(g => landscapesOf(g, cat));
    const exps = c => new Set(c.cards.map(x => x.expansion));
    const avg = c => c.cards.reduce((t, x) => t + x.coins, 0) / c.cards.length;
    const cheap = (c, max) => c.full && c.cards.every(x => x.debt === 0 && x.coins <= max);
    const attacks = c => c.cards.filter(x => x.types.includes('Attack')).length;
    const spread = kc.map(c => exps(c).size);
    const first = ok => gat(G.findIndex((g, i) => ok(g, i, kc[i], ls[i])));
    out.set('gilded-hall', first((g, i, c) => won[i] && c.full && avg(c) >= 4.8));
    out.set('the-great-divide', first((g, i, c) => won[i] && c.cards.filter(x => x.debt === 0 && x.coins <= 2).length >= 3 && c.cards.filter(x => x.debt === 0 && x.coins >= 6).length >= 3));
    out.set('pure-blood', first((g, i, c) => c.full && exps(c).size === 1));
    out.set('a-world-divided', first((g, i, c) => { if (!won[i] || !c.full || c.cards.length !== 10) return false; const n = {}; c.cards.forEach(x => { n[x.expansion] = (n[x.expansion] || 0) + 1; }); const v = Object.values(n); return v.length === 2 && v[0] === 5 && v[1] === 5; }));
    out.set('ten-kingdoms', first((g, i, c) => won[i] && c.full && exps(c).size === c.cards.length));
    out.set('trial-by-fire', first((g, i, c) => won[i] && attacks(c) >= 3));
    out.set('war-zone', first((g, i, c) => attacks(c) >= 5));
    out.set('peaceful-realm', first((g, i, c) => c.full && attacks(c) === 0)); out.set('the-pacifist', first((g, i, c) => won[i] && c.full && attacks(c) === 0));
    out.set('gold-rush', first((g, i, c) => won[i] && c.cards.filter(x => x.types.includes('Treasure')).length >= 3));
    out.set('cheap-tricks', first((g, i, c) => won[i] && cheap(c, 4))); out.set('fire-sale', first((g, i, c) => won[i] && cheap(c, 3)));

    // landscapes
    const types = i => new Set(ls[i].map(l => l.type));
    const typeWinCount = type => countAt((g, i) => won[i] && types(i).has(type), 5);
    for (const [id, type] of [['changing-tides', 'Trait'], ['architect-of-victory', 'Project'], ['the-wayfinder', 'Way'], ['master-strategist', 'Landmark'], ['turning-point', 'Event']]) { const [a, c] = typeWinCount(type); out.set(id, gat(a)); vals.set(id, c); }
    const bestMix = G.reduce((m, g, i) => (won[i] ? Math.max(m, types(i).size) : m), 0);
    out.set('shifting-realities', first((g, i) => won[i] && types(i).size >= 2)); out.set('fortune-favors', first((g, i) => won[i] && types(i).size >= 3));
    vals.set('shifting-realities', bestMix); vals.set('fortune-favors', bestMix);
    const wonTypes = new Set(), allTypes = cat.landscapeTypes || []; let fate = -1;
    G.forEach((g, i) => { if (won[i]) types(i).forEach(t => wonTypes.add(t)); if (fate < 0 && allTypes.length && allTypes.every(t => wonTypes.has(t))) fate = i; });
    out.set('master-of-fate', gat(fate));
    // SECRET badges that read the kingdom: wins with a lot of Attacks and landscapes, a Seaside / Plunder / Menagerie mix, and a Dark Ages / Intrigue / Empires mix with a Landmark
    const nOf = (c, exp) => c.cards.filter(x => x.expansion === exp).length;
    out.set('the-forbidden-kingdom', first((g, i, c) => won[i] && attacks(c) >= 5 && ls[i].length >= 2));
    out.set('the-perfect-storm', first((g, i, c) => won[i] && ['Seaside', 'Plunder', 'Menagerie'].every(e => nOf(c, e) >= 2)));
    out.set('the-council-of-shadows', first((g, i, c) => won[i] && ['Dark Ages', 'Intrigue', 'Empires'].every(e => nOf(c, e) >= 1) && types(i).has('Landmark')));
    const lSeen = new Set(), lCum = G.map((g, i) => { ls[i].forEach(l => lSeen.add(l.id)); return lSeen.size; });
    out.set('landscape-connoisseur', gat(reach(lCum, 25))); out.set('beyond-the-horizon', gat(reach(lCum, 50))); vals.set('landscape-connoisseur', lSeen.size); vals.set('beyond-the-horizon', lSeen.size);

    // expansions in one kingdom: played with (3, 5, 7) and won with (5, 8)
    out.set('first-expedition', gat(spread.findIndex(n => n >= 3))); out.set('world-traveler', gat(spread.findIndex(n => n >= 5))); out.set('melting-pot', gat(spread.findIndex(n => n >= 7)));
    const bestSpread = Math.max(0, ...spread), bestWonSpread = Math.max(0, ...spread.map((n, i) => (won[i] ? n : 0)));
    for (const id of ['first-expedition', 'world-traveler', 'melting-pot']) vals.set(id, bestSpread);
    out.set('cultural-exchange', gat(spread.findIndex((n, i) => won[i] && n >= 5))); out.set('united-kingdoms', gat(spread.findIndex((n, i) => won[i] && n >= 8)));
    vals.set('cultural-exchange', bestWonSpread); vals.set('united-kingdoms', bestWonSpread);
    const [terrAt, terrN] = countAt((g, i) => won[i] && spread[i] >= 5, 5); out.set('territorial-expansion', gat(terrAt)); vals.set('territorial-expansion', terrN);

    // cards (supply piles, a split pile once) ever seen, and wins per expansion
    const owned = cat.ownedExpansions.map(e => e.name), piles = new Set();
    const pileCum = G.map((g, i) => { kc[i].cards.forEach(c => piles.add(c.pileKey)); return piles.size; });
    out.set('collector', gat(reach(pileCum, 100))); out.set('grand-archivist', gat(reach(pileCum, 250))); out.set('master-of-all-realms', gat(cat.piles.length ? reach(pileCum, cat.piles.length) : -1));
    for (const id of ['collector', 'grand-archivist', 'master-of-all-realms']) vals.set(id, piles.size);
    const winsWith = new Map(owned.map(n => [n, 0])), firstWin = new Map(); let jack = -1, special = -1;
    G.forEach((g, i) => { if (!won[i]) return; exps(kc[i]).forEach(n => { if (!winsWith.has(n)) return; winsWith.set(n, winsWith.get(n) + 1); if (!firstWin.has(n)) firstWin.set(n, i); if (special < 0 && winsWith.get(n) >= 10) special = i; }); if (jack < 0 && owned.length && owned.every(n => firstWin.has(n))) jack = i; });
    out.set('jack-of-all-trades', gat(jack)); out.set('the-specialist', gat(special)); vals.set('the-specialist', Math.max(0, ...winsWith.values()));

    // every owned expansion is a track: more than half of its supply piles played, then all of them
    const perExp = new Map(owned.map(n => [n, new Set()])), seenSets = new Set(), sets5 = [], firstAt = new Map();
    const totals = new Map(owned.map(n => [n, cat.piles.filter(x => x.expansion === n).length]));
    G.forEach((g, i) => {
      for (const c of kc[i].cards) {
        if (!seenSets.has(c.expansion)) { seenSets.add(c.expansion); sets5.push(i); }
        const set = perExp.get(c.expansion); if (set) set.add(c.pileKey);
      }
      for (const n of owned) {
        const total = totals.get(n), size = perExp.get(n).size;
        if (size * 2 > total && !firstAt.has(n + ':half')) firstAt.set(n + ':half', i);
        if (size >= total && total && !firstAt.has(n + ':full')) firstAt.set(n + ':full', i);
      }
    });
    const cart = (id, name, hint, target, bonus, tier, k) => extra.push({ id, group: 'Expansions', track: 'sets', trackName: 'Cartographer', tier, name, hint, target, bonus, value: seenSets.size, earned: gat(k) });
    cart('sets-5', 'Journeyman', 'Play with cards from 5 expansions.', 5, 20, 'common', seenSets.size >= 5 ? sets5[4] : -1);
    cart('sets-all', 'Master Cartographer', `Play with cards from all ${owned.length} expansions.`, owned.length, 120, 'epic', seenSets.size >= owned.length ? sets5[owned.length - 1] : -1);
    for (const n of owned) {
      const names = EXPANSION_NAMES[n]; if (!names) continue;
      const total = totals.get(n), label = expansionMeta(n).label, size = perExp.get(n).size, set = expansionMeta(n).icon;
      const step = (id, name, hint, target, bonus, tier, k) => extra.push({ id: `exp-${slug(n)}-${id}`, group: 'Expansions', track: 'exp-' + slug(n), trackName: label, set, tier, name, hint, target, bonus, value: size, earned: gat(k) });
      step('half', names[0], `Play with more than half of ${label}'s cards.`, Math.floor(total / 2) + 1, 40, 'uncommon', firstAt.has(n + ':half') ? firstAt.get(n + ':half') : -1);
      step('full', names[1], `Play with every one of ${label}'s cards.`, total, 200, 'epic', firstAt.has(n + ':full') ? firstAt.get(n + ':full') : -1);
    }
  }

  const list = BADGES.map(b => ({ ...b, earned: out.get(b.id) || null, ...(vals.has(b.id) ? { value: vals.get(b.id) } : {}) }));
  // the catalog-built ones need their (static) names to be listed after the others in their sections: a track's steps stay together either way
  list.push(...extra);
  // Collection (cards seen): its steps carry the catalog total, so they are listed only when the catalog is in
  if (cat) {
    const total = cat.piles.length;
    const add = (id, name, hint, target, tier, bonus) => list.push({ id, group: 'Expansions', track: 'cards', trackName: 'Collection', tier, name, hint, target, bonus, value: vals.get(id), earned: out.get(id) || null });
    add('collector', 'Collector', 'See 100 different kingdom cards in your games.', 100, 'uncommon', 40);
    add('grand-archivist', 'Grand Archivist', 'See 250 different kingdom cards in your games.', 250, 'rare', 100);
    add('master-of-all-realms', 'Master of All Realms', `See every one of the ${total} kingdom cards across all ${cat.ownedExpansions.length} expansions.`, total, 'legendary', 500);
    const ex = (id, name, hint, target, tier, bonus, track, trackName) => list.push({ id, group: 'Expansions', track, trackName, tier, name, hint, target, bonus, value: vals.get(id), earned: out.get(id) || null });
    ex('first-expedition', 'First Expedition', 'Play a game with cards from 3 different expansions.', 3, 'common', 10, 'expeditions', 'Expeditions');
    ex('world-traveler', 'World Traveler', 'Play a game with cards from 5 different expansions.', 5, 'uncommon', 25, 'expeditions', 'Expeditions');
    ex('melting-pot', 'The Melting Pot', 'Play a game with cards from 7 different expansions.', 7, 'rare', 60, 'expeditions', 'Expeditions');
    ex('cultural-exchange', 'Cultural Exchange', 'Win a game with cards from 5 or more expansions.', 5, 'rare', 50, 'unity', 'Unity');
    ex('united-kingdoms', 'Royal Conqueror', 'Win a game with cards from 8 or more expansions.', 8, 'epic', 120, 'unity', 'Unity');
    list.push({ id: 'territorial-expansion', group: 'Expansions', tier: 'epic', name: 'Territorial Expansion', hint: 'Win 5 matches featuring 5 or more expansions in the kingdom.', target: 5, bonus: 100, value: vals.get('territorial-expansion'), earned: out.get('territorial-expansion') || null });
    list.push({ id: 'jack-of-all-trades', group: 'Expansions', tier: 'epic', name: 'Jack of All Trades', hint: 'Win at least one game with each expansion in the kingdom, over any number of games.', bonus: 150, earned: out.get('jack-of-all-trades') || null });
    list.push({ id: 'the-specialist', group: 'Expansions', tier: 'uncommon', name: 'The Specialist', hint: 'Win 10 games featuring the same expansion.', target: 10, bonus: 40, value: vals.get('the-specialist'), earned: out.get('the-specialist') || null });
  }

  // reaching each tier above the first; the date is the game that took the player over the line
  (tiers || []).forEach((t, k) => {
    if (!k || t.min == null) return;
    list.push({ id: 'tier-' + t.id, group: 'Milestones', track: 'rank', trackName: 'Rank', tier: RANK_TIERS[Math.min(k - 1, RANK_TIERS.length - 1)], name: `Reached ${t.name}`, hint: `Get to ${t.min} Elo.`, tierIcon: t, target: t.min, value: Math.round(p.peak || 0) || rs.reduce((m, r) => Math.max(m, Math.round(r.after)), 0), earned: at(firstIndex(rs, r => Math.round(r.after) >= t.min)) });
  });

  list.push({ id: 'dominion-legend', group: 'Milestones', tier: 'legendary', name: 'Dominion Legend', hint: 'Earn every other badge that is not legendary.', bonus: 2000, earned: legendFrom(list, all) });

  // the Renown track comes from XP (lib/xp.js), which itself needs the other badges, so it is only added when the caller passes the XP in
  if (xp) for (const st of xp.steps) list.push({ id: 'level-' + st.level, group: 'Milestones', track: 'level', trackName: 'Renown', tier: LEVEL_TIERS[st.level] || 'uncommon', name: LEVEL_NAMES[st.level] || `Level ${st.level}`, hint: `Reach level ${st.level}.`, target: st.level, bonus: st.bonus, value: xp.level, earned: st.earned });
  if (p.titles > 0) list.push({ id: 'champion', group: 'Seasons', tier: 'epic', name: p.titles > 1 ? `Season champion ×${p.titles}` : 'Season champion', hint: 'Win a season.', earned: { date: null, line: null } });
  // hide the secrets that are not found yet (after Dominion Legend and the level track have read the full list)
  return maskSecrets(list);
}

/* The list as the page draws it: sections in GROUPS order, each holding single badges and tracks (one entry per ladder, its steps inside).
   A track knows its `current` step (the highest earned) and `next` (the first not yet), with `value` / `target` for a progress bar. Inside a
   section entries run from common to legendary (a track by the tier it shows: its next step, or its last once finished); ties keep the order they are defined in. */
export function grouped(list) {
  const secs = new Map(GROUPS.map(g => [g, []]));
  for (const b of list) {
    const items = secs.get(b.group) || secs.set(b.group, []).get(b.group);
    if (!b.track) { items.push({ kind: 'badge', id: b.id, badge: b, got: b.earned ? 1 : 0, of: 1 }); continue; }
    let t = items.find(x => x.kind === 'track' && x.id === b.track);
    if (!t) items.push(t = { kind: 'track', id: b.track, name: b.trackName, steps: [] });
    t.steps.push(b);
  }
  return [...secs].filter(([, items]) => items.length).map(([group, items]) => {
    for (const t of items) if (t.kind === 'track') {
      t.got = t.steps.filter(x => x.earned).length; t.of = t.steps.length;
      t.current = [...t.steps].reverse().find(x => x.earned) || null;
      t.next = t.steps.find(x => !x.earned) || null;
    }
    const rank = x => { const b = x.kind === 'track' ? (x.next || x.steps[x.steps.length - 1]) : x.badge; const k = TIERS.findIndex(t => t.id === b.tier); return k < 0 ? TIERS.length : k; };
    const sorted = items.map((x, i) => [x, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
    return { group, got: items.reduce((n, x) => n + x.got, 0), of: items.reduce((n, x) => n + x.of, 0), items: sorted };
  });
}

/* League-wide badge records from each player's badge list ([{ name, list }]): who holds the most, the earned badge the fewest players hold (ties go to the
   harder tier), who holds the most epic and legendary ones, and the earned badge most players hold. Ties name every holder. */
export function badgeRecords(held) {
  const tierRank = id => TIERS.findIndex(t => t.id === id);
  const players = held.map(h => ({ name: h.name, got: h.list.filter(b => b.earned) }));
  const top = (score, min = 1) => {
    const best = Math.max(0, ...players.map(score));
    return best >= min ? { value: best, names: players.filter(x => score(x) === best).map(x => x.name) } : null;
  };
  const holders = new Map();
  for (const x of players) for (const b of x.got) { const e = holders.get(b.id) || { badge: b, names: [] }; e.names.push(x.name); holders.set(b.id, e); }
  const all = [...holders.values()];
  const pick = cmp => { const s = all.slice().sort(cmp)[0]; return s ? { badge: s.badge, names: s.names, count: s.names.length } : null; };
  return {
    most: top(x => x.got.length),
    hard: top(x => x.got.filter(b => tierRank(b.tier) >= 3).length),
    rarest: pick((a, b) => a.names.length - b.names.length || tierRank(b.badge.tier) - tierRank(a.badge.tier)),
    common: all.length ? pick((a, b) => b.names.length - a.names.length || tierRank(a.badge.tier) - tierRank(b.badge.tier)) : null,
    of: players.length,
  };
}

/* A player can pin a few earned badges to their profile (players.pinned_badges, in the order they chose). A single badge is pinned by its id; a
   badge in a track is pinned as the whole track ('track:<id>') and shows the furthest step earned, so the pin keeps up as they climb. Anything
   not earned any more or unknown to this site is skipped. */
export const MAX_PINS = 3;
export const pinKey = b => (b.track ? 'track:' + b.track : b.id);
export function pinnedBadges(ids, list) {
  const out = [];
  for (const id of ids || []) {
    const b = id.startsWith('track:') ? list.filter(x => x.track === id.slice(6) && x.earned).pop() : list.find(x => x.id === id && x.earned);
    if (b && !out.includes(b)) out.push(b);
  }
  return out.slice(0, MAX_PINS);
}

// badges earned that the viewer hasn't been told about. A first look (seen === null) records everything and announces nothing.
export const newBadges = (list, seen) => (seen ? list.filter(b => b.earned && !seen.includes(b.id)) : []);
export const earnedIds = list => list.filter(b => b.earned).map(b => b.id);

const key = gid => `dl.badges.${gid ?? 'all'}`;
export function loadBadgesSeen(storage, gid) { try { const v = JSON.parse(storage.getItem(key(gid))); return Array.isArray(v) ? v : null; } catch { return null; } }
export function saveBadgesSeen(storage, gid, ids) { try { storage.setItem(key(gid), JSON.stringify(ids)); } catch { /* not remembered */ } }

/* Who beats you most and whom you beat most, among opponents you have faced at least `min` times (head to head, from engine.h2h()). */
export function rivalries(hh, name, min = 3) {
  const ahead = hh.ahead[name];
  if (!ahead) return { nem: null, vic: null };
  const rivals = hh.players.filter(o => o !== name).map(o => ({ o, w: hh.ahead[name][o], l: hh.ahead[o][name] })).filter(x => x.w + x.l >= min);
  const nem = rivals.filter(x => x.l > x.w).sort((a, b) => b.l / (b.w + b.l) - a.l / (a.w + a.l) || b.l - a.l)[0] || null;
  const vic = rivals.filter(x => x.w > x.l).sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l) || b.w - a.w)[0] || null;
  return { nem, vic };
}
