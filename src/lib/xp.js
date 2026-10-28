import { achievements } from './achievements.js';

/* Experience points: how much a player has played, as opposed to how well (that is Elo). Pure, worked out from the games on every load like
   Elo, so retuning a number below rewrites history and nothing is stored. XP only ever goes up and every game counts, friendly ones too.
   It reads the engine's output (D.games, D.seasons, D.E) and never changes it.

   Per game a player earns, from the table they sat at:
     finish     LAST for last place, then PER_PLACE more for each place up (a shared place counts as the better one)
     win        for finishing first (a shared first counts)
     half       a smaller prize for the top half of a 4-, 5- or 6-player table (2nd; 2nd and 3rd at six)
     streak     winning again right after a win doubles the finish + win XP, to at most STREAK_CAP in all
     improve    finishing clearly higher (as a fraction of the table) than your own average over your last IMPROVE_WINDOW games
     attendance a few XP more for each game night in a row you came to (paid once a night, on your first game of it)
     surprise   doing better than Elo predicted: SURPRISE x (the share of opponents you beat - the share Elo said you would)
     vp         your VP, one XP each, plus VP_SHARE x your VP / the winner's VP
     landscapes a flat prize for a kingdom that used landscapes
     new cards  NEW_CARD for each kingdom card and NEW_LANDSCAPE for each landscape this player has never sat at a table with
     badges     BADGE for each badge unlocked in the game (plus a badge's own `bonus`)
   and SEASON for winning a season, paid on that player's last game of it. Nothing is capped except the streak. */
export const XP = {
  last: 25, perPlace: 8, win: 15, half: 8, halfMin: 4, halfMax: 6,
  streakMult: 2, streakCap: 100,
  improve: [[0.5, 20], [0.25, 10]],        // [rise over your own recent average, in the finishing fraction, XP], best first
  improveWindow: 5,
  attendStep: 3, attendCap: Infinity,      // XP per night in a row beyond the first
  surprise: 40, vpShare: 10, vpRaw: 1,
  landscapes: 10, newCard: 3, newLandscape: 4,
  badge: 30, season: 100,
};
export const LEVEL_STEPS = [5, 10, 15];   // the Level track's badges

// total XP to reach a level: 50 x L x (L - 1) → level 2 at 100, 5 at 1,000, 10 at 4,500
export const xpForLevel = L => 50 * L * (L - 1);
export function levelAt(xp) {
  let L = Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * Math.max(0, xp))) / 2));
  while (xpForLevel(L + 1) <= xp) L++;
  while (L > 1 && xpForLevel(L) > xp) L--;
  return L;
}

const PART_LABEL = {
  finish: 'Finishing place', win: 'Winning', half: 'Top half', streak: 'Win streak', improve: 'Improvement', attendance: 'Showing up', surprise: 'Beating the odds', vp: 'Victory points',
  landscapes: 'Landscapes in play', cards: 'New kingdom cards', badges: 'Badges', season: 'Season title',
};
// the order the parts are always listed in, so each sits in the same place from one player to the next
export const PART_ORDER = ['finish', 'win', 'half', 'streak', 'improve', 'surprise', 'vp', 'attendance', 'landscapes', 'cards', 'badges', 'season'];
export const partLabel = k => PART_LABEL[k] || k;

/* One game's XP for a player. `st` is what the player carried in: { prevWon, recent (their last finishing fractions), seen: Set }; `rating(name)` the Elo going in. */
function gameParts(g, a, st, rating, scale) {
  const n = g.n, place = g.places[a], pts = g.pts[a];
  const parts = {};
  parts.finish = XP.last + XP.perPlace * (n - place);
  if (place === 1) parts.win = XP.win;
  if (n >= XP.halfMin && n <= XP.halfMax && place >= 2 && place <= Math.floor(n / 2)) parts.half = XP.half;
  if (place === 1 && st.prevWon) {
    const base = parts.finish + (parts.win || 0), boosted = Math.min(base * XP.streakMult, XP.streakCap);
    if (boosted > base) parts.streak = boosted - base;
  }
  if (st.recent.length) { const rise = pts - st.recent.reduce((x, y) => x + y, 0) / st.recent.length, hit = XP.improve.find(([r]) => rise >= r); if (hit) parts.improve = hit[1]; }
  const others = g.names.filter(x => x !== a);
  if (others.length) {
    const exp = others.reduce((s, b) => s + 1 / (1 + Math.pow(10, (rating(b) - rating(a)) / scale)), 0) / others.length;
    const extra = Math.round(XP.surprise * (pts - exp));
    if (extra > 0) parts.surprise = extra;
  }
  const vp = g.playerVP && g.playerVP[a];
  if (vp != null && !Number.isNaN(vp)) {
    const top = Math.max(g.vp || 0, ...Object.values(g.playerVP || {}));
    const v = Math.max(0, Math.round(vp)) * XP.vpRaw + (top > 0 ? Math.round(XP.vpShare * Math.max(0, vp) / top) : 0);
    if (v > 0) parts.vp = v;
  }
  const kd = g.kingdom || [];
  if (g.landscapes.length || kd.some(k => k.kind === 'landscape')) parts.landscapes = XP.landscapes;
  let fresh = 0;
  for (const k of new Map(kd.filter(k => k.kind === 'card' || k.kind === 'landscape').map(k => [k.kind + k.id, k])).values()) {
    if (!st.seen.has(k.kind + k.id)) fresh += k.kind === 'card' ? XP.newCard : XP.newLandscape;
  }
  if (fresh) parts.cards = fresh;
  return parts;
}

/* Everyone's XP: Map name → { total, level, base, next, perGame: [{ line, date, xp, parts }], totals: { part: xp }, steps, last }.
   `badges` is a Map name → the player's badge list from achievements() (without the Level track, which pays out here). */
export function computeXp(D, badges = new Map()) {
  const scale = D.E.scale, out = new Map(), st = new Map(), rate = new Map();
  const state = n => st.get(n) || st.set(n, { prevWon: false, recent: [], night: -1, run: 0, seen: new Set(), total: 0, perGame: [], totals: {}, steps: LEVEL_STEPS.map(level => ({ level, earned: null })) }).get(n);

  // badge XP lands on the game that earned it; a badge with no game (the season title) lands with the title
  const badgeXp = new Map();   // name → Map(line → xp)
  for (const [name, list] of badges) {
    const m = new Map();
    for (const b of list) if (b.earned && b.earned.line != null) m.set(b.earned.line, (m.get(b.earned.line) || 0) + XP.badge + (b.bonus || 0));
    badgeXp.set(name, m);
  }
  // a season title: paid on the champion's last game on or before the season's end
  const title = new Map();   // name → Map(line → { season, badge })
  for (const s of D.seasons || []) {
    if (!s.champion) continue;
    const key = [...badges.keys(), ...D.players.map(p => p.name)].find(n => n.toLowerCase() === s.champion.toLowerCase());
    if (!key) continue;
    let at = null;
    for (const g of D.games) if (g.n >= 2 && g.places[key] != null && (s.end == null || g.day <= s.end)) at = g;
    if (!at) continue;
    const m = title.get(key) || title.set(key, new Map()).get(key);
    m.set(at.line, (m.get(at.line) || 0) + 1);
  }

  const nights = new Map([...new Set(D.games.filter(g => g.n >= 2).map(g => g.day))].sort((x, y) => x - y).map((d, i) => [d, i]));
  for (const g of D.games) {
    if (g.n < 2) { continue; }
    const rating = nm => rate.get(nm) ?? D.E.start;
    const before = new Map(g.names.map(nm => [nm, g.elo && g.elo[nm] ? g.elo[nm].before : rating(nm)]));
    const r0 = nm => before.get(nm) ?? rating(nm);
    for (const a of g.names) {
      const s = state(a);
      const parts = gameParts(g, a, s, r0, scale);
      // game nights in a row: paid once a night, on this player's first game of it
      const night = nights.get(g.day);
      if (night !== s.night) {
        s.run = s.night === night - 1 ? s.run + 1 : 1; s.night = night;
        const extra = Math.min(s.run - 1, XP.attendCap) * XP.attendStep;
        if (extra > 0) parts.attendance = extra;
      }
      let badgeN = (badgeXp.get(a) && badgeXp.get(a).get(g.line)) || 0;
      const seasons = title.get(a) && title.get(a).get(g.line);
      if (seasons) { parts.season = XP.season * seasons; badgeN += XP.badge * seasons; }   // the champion badge
      let xp = Object.values(parts).reduce((x, y) => x + y, 0) + badgeN;
      // level badges pay out too: a level reached in this game, and any a payout then reaches
      for (let again = true; again;) {
        again = false;
        const lvl = levelAt(s.total + xp);
        for (const step of s.steps) if (!step.earned && lvl >= step.level) { step.earned = { date: g.date, line: g.line }; badgeN += XP.badge; xp += XP.badge; again = true; }
      }
      if (badgeN) parts.badges = badgeN;
      s.total += xp;
      s.perGame.push({ line: g.line, date: g.date, xp, parts });
      for (const [k, v] of Object.entries(parts)) s.totals[k] = (s.totals[k] || 0) + v;
      s.prevWon = g.places[a] === 1; s.recent.push(g.pts[a]); if (s.recent.length > XP.improveWindow) s.recent.shift();
      for (const k of g.kingdom || []) if (k.kind === 'card' || k.kind === 'landscape') s.seen.add(k.kind + k.id);
    }
    if (g.elo) for (const nm of g.names) if (g.elo[nm]) rate.set(nm, g.elo[nm].after);
  }

  for (const p of D.players) {
    const s = state(p.name), level = levelAt(s.total), lo = xpForLevel(level), hi = xpForLevel(level + 1);
    out.set(p.name, {
      total: s.total, level, into: s.total - lo, span: hi - lo, need: hi - s.total, pct: (s.total - lo) / (hi - lo),
      perGame: s.perGame, last: s.perGame[s.perGame.length - 1] || null, totals: s.totals, steps: s.steps,
    });
  }
  return out;
}

// computed once per loaded league (D is rebuilt on every reload), shared by the ladder, the me card and the Player page
const cache = new WeakMap();
export function leagueXp(D) {
  let m = cache.get(D);
  if (!m) {
    const everyone = D.ranked.map(x => x.name);
    m = computeXp(D, new Map(D.players.map(p => [p.name, achievements(p, D.tiers, everyone)])));
    cache.set(D, m);
  }
  return m;
}
export const xpOf = (D, name) => leagueXp(D).get(name) || null;

/* What one game paid each player (no breakdown): [{ name, place, xp, level, levelUp }] in finishing order, from leagueXp(D). levelUp is the level reached,
   when this game took the player over a line. Empty when the game isn't in the XP map (fewer than two players). */
export function gameXp(xpMap, game) {
  if (!game || !xpMap) return [];
  return game.names.slice().sort((a, b) => game.places[a] - game.places[b]).map(name => {
    const x = xpMap.get(name), at = x ? x.perGame.findIndex(e => e.line === game.line) : -1;
    if (at < 0) return null;
    const xp = x.perGame[at].xp, after = x.perGame.slice(0, at + 1).reduce((t, e) => t + e.xp, 0);
    const level = levelAt(after);
    return { name, place: game.places[name], xp, level, levelUp: level > levelAt(after - xp) ? level : null };
  }).filter(Boolean);
}
