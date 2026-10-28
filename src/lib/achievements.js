import { expansionMeta } from '../dominion/constants.js';

/* Badges a player has earned, worked out from nothing but their own results (p.results from the engine) and the group's games. Pure.
   Every badge is a plain fact about the games, shown with the game that earned it; nothing here expires, resets or can be lost, so
   it never nags. `earned` is the game where it was first true (so the badge links to it), or null while it is still out of reach. */
const sole = (g, place) => place === 1 && Object.values(g.places).filter(x => x === 1).length === 1;
const soleLast = (g, place) => place === g.n && Object.values(g.places).filter(x => x === g.n).length === 1;

const firstIndex = (results, ok) => { for (let i = 0; i < results.length; i++) if (ok(results[i], i)) return i; return -1; };

/* `group` files a badge under a heading on the Player page. A badge with a `track` is one step of a ladder (games played, ranks): the page draws a
   track as one box showing the current step and the next, with every step inside it. Ids never change, so "seen" lists keep working.
   `bonus` is the XP a badge pays on top of the standard badge XP (lib/xp.js). `target` is the number a step is reached at, when it is a count. */
export const GROUPS = ['Winning', 'Comebacks and upsets', 'The table', 'The kingdom', 'Expansions', 'Milestones', 'Seasons'];
const wins = (n, name, bonus) => ({ id: 'wins-' + n, group: 'Winning', track: 'wins', trackName: 'Victories', name, hint: `Win ${n} games.`, target: n, bonus });
const lifetime = (n, name, bonus) => ({ id: 'vp-' + n, group: 'Milestones', track: 'vp', trackName: 'Estate Ledger', name, hint: `Score ${n.toLocaleString()} victory points over all your games.`, target: n, bonus });
export const BADGES = [
  { id: 'first-win', group: 'Winning', name: 'First blood', hint: 'Win a game outright.' },
  wins(5, 'Skirmisher', 20), wins(10, 'Veteran of the Field', 40), wins(20, 'Scourge', 80), wins(50, 'Warmaster', 200), wins(100, 'Immortal', 500),
  { id: 'hat-trick', group: 'Winning', name: 'Hat trick', hint: 'Win three games in a row.' },
  { id: 'clean-sweep', group: 'Winning', name: 'Clean sweep', hint: 'Win every game of a night (two or more games).' },
  { id: 'landslide', group: 'Winning', name: 'Landslide', hint: 'Win a game by more than 20 VP over the runner-up.', bonus: 30 },
  { id: 'twice-the-crown', group: 'Winning', name: 'Twice the Crown', hint: 'Win with at least double the VP of every other player.', bonus: 40 },
  { id: 'shadow', group: 'Winning', name: 'Shadow of the Throne', hint: 'Finish in the top half three games in a row.', bonus: 20 },
  { id: 'redemption', group: 'Comebacks and upsets', name: 'Redemption', hint: 'Win the game right after finishing last.' },
  { id: 'giant-slayer', group: 'Comebacks and upsets', track: 'slayer', trackName: 'Slayer', name: 'Giant slayer', hint: 'Win at a table with someone rated 100+ Elo above you.' },
  { id: 'god-slayer', group: 'Comebacks and upsets', track: 'slayer', trackName: 'Slayer', name: 'God Slayer', hint: 'Win at a table with someone rated 200+ Elo above you.', bonus: 50 },
  { id: 'phoenix', group: 'Comebacks and upsets', name: 'The Phoenix', hint: 'Win a rated game of 3 or more as the lowest-rated player at the table.', bonus: 75 },
  { id: 'big-swing', group: 'Comebacks and upsets', name: 'Big swing', hint: 'Gain 50 or more Elo in a single game.' },
  { id: 'know-your-enemy', group: 'The table', name: 'Know your enemy', hint: 'Play at least one game against every other player.' },
  { id: 'unbeaten-blade', group: 'The table', name: 'Unbeaten Blade', hint: 'Win three 1v1 games in a row.', bonus: 30 },
  { id: 'king-of-the-hill', group: 'The table', name: 'King of the Hill', hint: 'Win two games in a row with 5 or more players in each.', bonus: 75 },
  { id: 'apex-predator', group: 'The table', name: 'Apex Predator', hint: 'Win a 6-player game.', bonus: 40 },
  { id: 'colossus', group: 'The table', name: 'Colossus', hint: 'In a 5 or 6-player game, outscore the bottom three players combined.', bonus: 100 },
  { id: 'world-voyage', group: 'The table', name: 'World Voyage', hint: 'Win a game at every table size, from 2 to 6 players.', bonus: 200 },
  { id: 'gilded-hall', group: 'The kingdom', name: 'Gilded Hall', hint: 'Win with a kingdom whose cards cost 4.8 coins or more on average.', bonus: 25 },
  { id: 'pure-blood', group: 'The kingdom', name: 'Pure Blood', hint: 'Play a game where all 10 kingdom cards are from the same expansion.', bonus: 15 },
  { id: 'trial-by-fire', group: 'The kingdom', name: 'Trial by Fire', hint: 'Win with 3 or more Attack cards in the kingdom.', bonus: 25 },
  { id: 'peaceful-realm', group: 'The kingdom', name: 'Peaceful Realm', hint: 'Play a game with no Attack card in the kingdom.', bonus: 10 },
  { id: 'cheap-tricks', group: 'The kingdom', track: 'humble', trackName: 'Humble Means', name: 'Cheap Tricks', hint: 'Win when every kingdom card costs 4 coins or less.', bonus: 20 },
  { id: 'fire-sale', group: 'The kingdom', track: 'humble', trackName: 'Humble Means', name: 'Fire Sale', hint: 'Win when every kingdom card costs 3 coins or less.', bonus: 50 },
  { id: 'regular', group: 'Milestones', track: 'games', trackName: 'Games played', name: 'Regular', hint: 'Play 10 rated games.', target: 10 },
  { id: 'veteran', group: 'Milestones', track: 'games', trackName: 'Games played', name: 'Veteran', hint: 'Play 25 rated games.', target: 25 },
  { id: 'spoils-150', group: 'Milestones', track: 'spoils', trackName: 'Spoils', name: 'Full Coffers', hint: 'Earn more than 150 XP from a single game.', target: 151, bonus: 25 },
  { id: 'spoils-200', group: 'Milestones', track: 'spoils', trackName: 'Spoils', name: "Dragon's Hoard", hint: 'Earn more than 200 XP from a single game.', target: 201, bonus: 75 },
  lifetime(250, 'Landholder', 10), lifetime(500, 'Baron', 20), lifetime(750, 'Provincial Governor', 35), lifetime(1000, 'Duke of Duchies', 60), lifetime(1250, 'Lord of the Realm', 100),
];

// the 50% and 100% steps of each expansion (by the catalog's expansion name): more than half of its supply piles, then all of them
const EXPANSION_NAMES = {
  'Dominion Base Game': ['Village Elder', 'Lord of Dominion'], Intrigue: ['Court Intriguer', 'Master of Whispers'], Seaside: ['Wanted Pirate', 'Seafaring Legend'],
  Prosperity: ['Merchant Prince', 'Grand Treasurer'], Hinterlands: ['Border Wanderer', 'Warden of the Marches'], 'Dark Ages': ['Grave Robber', 'Lord of Ruin'],
  'Cornucopia & Guilds': ['Guild Apprentice', 'Guildmaster'], Empires: ['Imperial Envoy', 'Imperator'], Renaissance: ['Patron of the Arts', 'Renaissance Man'],
  Menagerie: ['Horse Whisperer', 'Master of the Menagerie'], Plunder: ['Treasure Hunter', 'Dread Admiral'],
};
const LEVEL_NAMES = { 5: 'Apprentice', 10: 'Adept', 20: 'Sage', 50: 'Grandmaster', 100: 'Paragon', 200: 'Dominion Incarnate' };
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const vpOf = (g, n) => (g.playerVP && g.playerVP[n] != null && !Number.isNaN(+g.playerVP[n]) ? +g.playerVP[n] : null);
const allVp = g => g.names.every(n => vpOf(g, n) != null);
// the cards of a game's kingdom as the catalog knows them; `full` = at least 10 and every one found, so "every card costs..." can't be fooled by a half-logged kingdom
function cardsOf(g, catalog) {
  const cards = (g.kingdom || []).filter(k => k.kind === 'card').map(k => catalog.cardsById.get(k.id));
  return { cards: cards.filter(Boolean), full: cards.length >= 10 && cards.every(Boolean) };
}

/* `p` is a player from the engine (results, titles, peak); `tiers` D.tiers; `everyone` the other rated players' names; `xp` the player's XP (lib/xp.js)
   for the Level track. `ctx` = { games: every game of the group (D.games), catalog: the Collection's catalog or null, baseXp: Map line -> XP before badge
   payouts }; without it only the badges that come from rated results can be earned. */
export function achievements(p, tiers = [], everyone = [], xp = null, ctx = {}) {
  const rs = p.results || [];
  const at = i => (i >= 0 && rs[i] ? { date: rs[i].game.date, line: rs[i].game.line } : null);
  const out = new Map(), vals = new Map();

  out.set('first-win', at(firstIndex(rs, r => sole(r.game, r.place))));
  let run = 0, hat = -1;
  rs.forEach((r, i) => { run = sole(r.game, r.place) ? run + 1 : 0; if (run === 3 && hat < 0) hat = i; });
  out.set('hat-trick', at(hat));
  out.set('redemption', at(firstIndex(rs, (r, i) => i > 0 && sole(r.game, r.place) && soleLast(rs[i - 1].game, rs[i - 1].place))));
  const slayer = gap => at(firstIndex(rs, r => sole(r.game, r.place) && Object.entries(r.game.elo || {}).some(([n, e]) => n !== p.name && e && e.before - r.before >= gap)));
  out.set('giant-slayer', slayer(100)); out.set('god-slayer', slayer(200));
  out.set('big-swing', at(firstIndex(rs, r => r.after - r.before >= 50)));
  // the lowest-rated player at a table of three or more beats everyone else there
  out.set('phoenix', at(firstIndex(rs, r => { const e = Object.entries(r.game.elo || {}); return e.length >= 3 && r.place === 1 && e.every(([n, x]) => n === p.name || (x && x.before > r.before)); })));

  // a night won from start to finish: every rated game that day won outright, at least two of them
  const byDay = new Map();
  rs.forEach((r, i) => { const d = r.game.day; (byDay.get(d) || byDay.set(d, []).get(d)).push(i); });
  let sweep = -1;
  for (const idx of byDay.values()) if (idx.length >= 2 && idx.every(i => sole(rs[i].game, rs[i].place))) { sweep = sweep < 0 ? idx[idx.length - 1] : Math.min(sweep, idx[idx.length - 1]); }
  out.set('clean-sweep', at(sweep));

  const others = everyone.filter(n => n !== p.name), met = new Set();
  let all = -1;
  if (others.length) rs.forEach((r, i) => { if (all >= 0) return; Object.keys(r.game.places).forEach(n => met.add(n)); if (others.every(n => met.has(n))) all = i; });
  out.set('know-your-enemy', at(all));
  out.set('regular', at(rs.length >= 10 ? 9 : -1)); vals.set('regular', rs.length);
  out.set('veteran', at(rs.length >= 25 ? 24 : -1)); vals.set('veteran', rs.length);

  // everything below looks at every game the player sat at, friendly ones too (a win is a win), in order
  const me = p.name, G = (ctx.games || []).filter(g => g.n >= 2 && g.places[me] != null);
  const gat = i => (i >= 0 && G[i] ? { date: G[i].date, line: G[i].line } : null);
  const won = G.map(g => g.places[me] === 1);
  const runEnd = (n, ok) => { let r = 0; for (let i = 0; i < G.length; i++) { r = ok(G[i], i) ? r + 1 : 0; if (r >= n) return i; } return -1; };
  const reach = (cum, t) => cum.findIndex(v => v >= t);

  let w = 0; const cumWins = G.map((g, i) => (w += won[i] ? 1 : 0));
  for (const n of [5, 10, 20, 50, 100]) { out.set('wins-' + n, gat(reach(cumWins, n))); vals.set('wins-' + n, w); }
  let vpSum = 0; const cumVp = G.map(g => (vpSum += Math.max(0, vpOf(g, me) || 0)));
  for (const n of [250, 500, 750, 1000, 1250]) { out.set('vp-' + n, gat(reach(cumVp, n))); vals.set('vp-' + n, vpSum); }

  const rivalsVp = g => g.names.filter(n => n !== me).map(n => vpOf(g, n));
  out.set('landslide', gat(G.findIndex((g, i) => won[i] && allVp(g) && vpOf(g, me) - Math.max(...rivalsVp(g)) > 20)));
  out.set('twice-the-crown', gat(G.findIndex((g, i) => won[i] && allVp(g) && vpOf(g, me) > 0 && rivalsVp(g).every(v => v * 2 <= vpOf(g, me)))));
  out.set('colossus', gat(G.findIndex(g => (g.n === 5 || g.n === 6) && allVp(g) && vpOf(g, me) > rivalsVp(g).sort((a, b) => a - b).slice(0, 3).reduce((x, y) => x + y, 0))));
  out.set('shadow', gat(runEnd(3, g => g.pts[me] >= 0.5)));
  out.set('unbeaten-blade', gat((() => { const duels = G.map((g, i) => [g, i]).filter(([g]) => g.n === 2); let r = 0; for (const [, i] of duels) { r = won[i] ? r + 1 : 0; if (r >= 3) return i; } return -1; })()));
  out.set('king-of-the-hill', gat(G.findIndex((g, i) => i > 0 && g.n >= 5 && G[i - 1].n >= 5 && won[i] && won[i - 1])));
  out.set('apex-predator', gat(G.findIndex((g, i) => g.n === 6 && won[i])));
  const sizes = new Set(); let voyage = -1;
  G.forEach((g, i) => { if (won[i] && g.n >= 2 && g.n <= 6) sizes.add(g.n); if (voyage < 0 && sizes.size === 5) voyage = i; });
  out.set('world-voyage', gat(voyage));

  // XP in one game, before any badge payout; the biggest so far is the progress
  const base = ctx.baseXp;
  if (base) {
    let best = 0;
    G.forEach(g => { best = Math.max(best, base.get(g.line) || 0); });
    out.set('spoils-150', gat(G.findIndex(g => (base.get(g.line) || 0) > 150))); out.set('spoils-200', gat(G.findIndex(g => (base.get(g.line) || 0) > 200)));
    vals.set('spoils-150', best); vals.set('spoils-200', best);
  }

  // what the kingdoms were made of: needs the Collection's catalog
  const cat = ctx.catalog;
  if (cat) {
    const kc = G.map(g => cardsOf(g, cat));
    const avg = c => c.cards.reduce((t, x) => t + x.coins, 0) / c.cards.length;
    const cheap = (c, max) => c.full && c.cards.every(x => x.debt === 0 && x.coins <= max);
    out.set('gilded-hall', gat(G.findIndex((g, i) => won[i] && kc[i].full && avg(kc[i]) >= 4.8)));
    out.set('pure-blood', gat(kc.findIndex(c => c.full && new Set(c.cards.map(x => x.expansion)).size === 1)));
    out.set('trial-by-fire', gat(G.findIndex((g, i) => won[i] && kc[i].cards.filter(x => x.types.includes('Attack')).length >= 3)));
    out.set('peaceful-realm', gat(kc.findIndex(c => c.full && !c.cards.some(x => x.types.includes('Attack')))));
    out.set('cheap-tricks', gat(G.findIndex((g, i) => won[i] && cheap(kc[i], 4))));
    out.set('fire-sale', gat(G.findIndex((g, i) => won[i] && cheap(kc[i], 3))));
  }

  const list = BADGES.map(b => ({ ...b, earned: out.get(b.id) || null, ...(vals.has(b.id) ? { value: vals.get(b.id) } : {}) }));

  // every owned expansion is a track: more than half of its supply piles played, then all of them (one pile per kingdom slot, a split pile once)
  if (cat) {
    const owned = cat.ownedExpansions.map(e => e.name), seenSets = new Set(), perExp = new Map(owned.map(n => [n, new Set()]));
    const sets5 = [], first = new Map();   // sets5: the game each new set was first played in
    G.forEach((g, i) => {
      for (const c of cardsOf(g, cat).cards) {
        if (!seenSets.has(c.expansion)) { seenSets.add(c.expansion); sets5.push(i); }
        const piles = perExp.get(c.expansion); if (piles) piles.add(c.pileKey);
      }
      for (const n of owned) {
        const total = cat.piles.filter(x => x.expansion === n).length, size = perExp.get(n).size;
        if (size * 2 > total && !first.has(n + ':half')) first.set(n + ':half', i);
        if (size >= total && total && !first.has(n + ':full')) first.set(n + ':full', i);
      }
    });
    const cart = (id, name, hint, target, bonus, k) => list.push({ id, group: 'Expansions', track: 'sets', trackName: 'Cartographer', name, hint, target, bonus, value: seenSets.size, earned: gat(k) });
    cart('sets-5', 'Journeyman', 'Play with cards from 5 expansions.', 5, 20, seenSets.size >= 5 ? sets5[4] : -1);
    cart('sets-all', 'Master Cartographer', `Play with cards from all ${owned.length} expansions.`, owned.length, 120, seenSets.size >= owned.length ? sets5[owned.length - 1] : -1);
    for (const n of owned) {
      const names = EXPANSION_NAMES[n]; if (!names) continue;
      const total = cat.piles.filter(x => x.expansion === n).length, label = expansionMeta(n).label, size = perExp.get(n).size, set = expansionMeta(n).icon;
      const step = (id, name, hint, target, bonus, k) => list.push({ id: `exp-${slug(n)}-${id}`, group: 'Expansions', track: 'exp-' + slug(n), trackName: label, set, name, hint, target, bonus, value: size, earned: gat(k) });
      step('half', names[0], `Play with more than half of ${label}'s cards.`, Math.floor(total / 2) + 1, 40, first.has(n + ':half') ? first.get(n + ':half') : -1);
      step('full', names[1], `Play with every one of ${label}'s cards.`, total, 200, first.has(n + ':full') ? first.get(n + ':full') : -1);
    }
  }

  // reaching each tier above the first; the date is the game that took the player over the line
  (tiers || []).forEach((t, k) => {
    if (!k || t.min == null) return;
    list.push({ id: 'tier-' + t.id, group: 'Milestones', track: 'rank', trackName: 'Rank', name: `Reached ${t.name}`, hint: `Get to ${t.min} Elo.`, tier: t, target: t.min, value: Math.round(p.peak || 0) || rs.reduce((m, r) => Math.max(m, Math.round(r.after)), 0), earned: at(firstIndex(rs, r => Math.round(r.after) >= t.min)) });
  });
  // the Renown track comes from XP (lib/xp.js), which itself needs the other badges, so it is only added when the caller passes the XP in
  if (xp) for (const st of xp.steps) list.push({ id: 'level-' + st.level, group: 'Milestones', track: 'level', trackName: 'Renown', name: LEVEL_NAMES[st.level] || `Level ${st.level}`, hint: `Reach level ${st.level}.`, target: st.level, bonus: st.bonus, value: xp.level, earned: st.earned });
  if (p.titles > 0) list.push({ id: 'champion', group: 'Seasons', name: p.titles > 1 ? `Season champion ×${p.titles}` : 'Season champion', hint: 'Win a season.', earned: { date: null, line: null } });
  return list;
}

/* The list as the page draws it: sections in GROUPS order, each holding single badges and tracks (one entry per ladder, its steps inside).
   A track knows its `current` step (the highest earned) and `next` (the first not yet), with `value` / `target` for a progress bar. Entries
   with something earned come first inside a section; otherwise the order is the order they are defined in. */
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
    const sorted = items.map((x, i) => [x, i]).sort((a, b) => (b[0].got > 0) - (a[0].got > 0) || a[1] - b[1]).map(x => x[0]);
    return { group, got: items.reduce((n, x) => n + x.got, 0), of: items.reduce((n, x) => n + x.of, 0), items: sorted };
  });
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
