import { XP, badgesFor, leagueXp, levelAt } from './xp.js';
import { REQUIRE_RULES } from '../dominion/randomizer.js';
import { ord } from './format.js';

/* The deep report behind one game (the Games page's game view). Pure: worked out from the league's games (D.games, already scoped to one group),
   the XP map (lib/xp.js) and, when it is in, the Collection's catalog; nothing here is stored or changes any rating.

   gameReport(D, g, { catalog }) -> {
     when       { date, season, nightNo, nightOf, startedAt, endedAt, savedAt }      the game in its night (ISO strings; any of the three may be null)
     time       { minutes, avgAll, avgSize, rankFastest, of, perMinute } | null        null when no length was saved
     kingdom    { cards, landscapes, avgCost, costBuckets, attacks, ..., vs } | null   null without a catalog or a logged kingdom
     players    [{ name, place, vp, ..., xp, badges, newCards, compare[], fit[] }]     in finishing order
     highlights [{ tone, title, text }]                                               the (at most five) things worth knowing, best first
   }
   "vs usual" always means: this game against the same player's OTHER games in the group. */

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round1 = x => Math.round(x * 10) / 10;
const inOrder = g => g.names.slice().sort((a, b) => g.places[a] - g.places[b] || a.localeCompare(b));

/* Everyone's games in order, once per loaded league: Map name -> [{ g, place, pts, vp, delta, minutes }] (games of two or more players). */
const histCache = new WeakMap();
function histories(D) {
  const hit = histCache.get(D); if (hit) return hit;
  const out = new Map();
  for (const g of D.games) {
    if (g.n < 2) continue;
    for (const name of g.names) {
      const e = g.elo && g.elo[name];
      const vp = g.playerVP && g.playerVP[name] != null && !Number.isNaN(+g.playerVP[name]) ? +g.playerVP[name] : null;
      (out.get(name) || out.set(name, []).get(name)).push({ g, place: g.places[name], pts: g.pts[name], vp, delta: e ? e.after - e.before : null, minutes: g.minutes > 0 ? +g.minutes : null });
    }
  }
  histCache.set(D, out);
  return out;
}

// the kingdom of a game as the catalog knows it, with the numbers a report wants (worked out once per game and catalog: the comparisons ask for every game's)
const ksCache = new WeakMap();
export function kingdomStats(g, catalog) {
  if (!catalog || !(g.kingdom || []).length) return null;
  const hit = ksCache.get(g); if (hit && hit.catalog === catalog) return hit.v;
  const v = kingdomStatsOf(g, catalog);
  ksCache.set(g, { catalog, v });
  return v;
}
function kingdomStatsOf(g, catalog) {
  const cards = (g.kingdom || []).filter(k => k.kind === 'card').map(k => catalog.cardsById.get(k.id)).filter(Boolean);
  const lands = [...new Map((g.kingdom || []).filter(k => k.kind === 'landscape').map(k => catalog.landscapesById.get(k.id)).filter(Boolean).map(l => [l.id, l])).values()];
  if (!cards.length && !lands.length) return null;
  const coin = cards.filter(c => c.debt === 0);   // a Debt card's price is not in coins: it is left out of the average, and shown as a count
  const bucket = c => Math.min(6, Math.max(2, c.coins)) - 2;   // $2 or less, $3, $4, $5, $6 or more
  const buckets = [0, 0, 0, 0, 0]; coin.forEach(c => { buckets[bucket(c)]++; });
  const count = t => cards.filter(c => c.types.includes(t)).length;
  const exps = new Map(); cards.forEach(c => exps.set(c.expansion, (exps.get(c.expansion) || 0) + 1));
  return {
    cards, landscapes: lands, avgCost: coin.length ? mean(coin.map(c => c.coins)) : null, costBuckets: buckets, debtCards: cards.length - coin.length,
    attacks: count('Attack'), reactions: count('Reaction'), treasures: count('Treasure'), victories: count('Victory'), durations: count('Duration'),
    expansions: [...exps].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    landscapeTypes: [...new Set(lands.map(l => l.type))],
    // what the cards are: their printed types (a card with two types counts under both), and the tools they offer by the recorded mechanics (positive-only: a card
    // can do more than its tags say, so only what IS recorded is listed)
    types: [...new Set(cards.flatMap(c => c.types))].map(name => ({ name, n: count(name) })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    tools: Object.entries(REQUIRE_RULES).filter(([, r]) => r.tags).map(([key, r]) => ({ key, label: r.chip, n: cards.filter(c => (c.mechanicIds || []).some(t => r.tags.includes(t))).length })).filter(t => t.n > 0),
  };
}

const baseCache = new WeakMap();
// what the group's games usually look like, once per league and catalog: lengths (by table size), kingdom prices, attacks, landscapes
function baselines(D, catalog) {
  const hit = baseCache.get(D); if (hit && hit.catalog === (catalog || null)) return hit.v;
  const timed = D.games.filter(g => g.n >= 2 && g.minutes > 0);
  const bySize = new Map(); timed.forEach(g => (bySize.get(g.n) || bySize.set(g.n, []).get(g.n)).push(+g.minutes));
  const ks = catalog ? D.games.filter(g => g.n >= 2).map(g => kingdomStats(g, catalog)).filter(k => k && k.cards.length >= 5) : [];
  const v = {
    minutes: timed.map(g => +g.minutes), avgMinutes: mean(timed.map(g => +g.minutes)), minutesBySize: new Map([...bySize].map(([n, a]) => [n, mean(a)])), nBySize: new Map([...bySize].map(([n, a]) => [n, a.length])),
    costs: ks.map(k => k.avgCost).filter(x => x != null), avgCost: mean(ks.map(k => k.avgCost).filter(x => x != null)), avgAttacks: mean(ks.map(k => k.attacks)),
    landscapeShare: ks.length ? ks.filter(k => k.landscapes.length).length / ks.length : null, kingdoms: ks.length,
    swings: D.games.filter(g => g.n >= 2 && g.elo).map(g => Math.max(...g.names.map(n => (g.elo[n] ? Math.abs(g.elo[n].after - g.elo[n].before) : 0)))).sort((a, b) => b - a),
  };
  baseCache.set(D, { catalog: catalog || null, v });
  return v;
}

// who is in the ladder, in order, going into (before) and coming out of (after) a game: by the Elo snapshots, among players who had sat at a rated table by then
function ranksAround(D, g) {
  const prev = g.idx > 0 ? D.games[g.idx - 1] : null;
  const appeared = new Set();
  for (const x of D.games) { if (x.idx > g.idx) break; if (x.n >= 2 && x.type !== 'Friendly') x.names.forEach(n => appeared.add(n)); }
  const rank = (snap, who) => { if (!snap) return null; const list = [...who].filter(n => snap[n] != null).sort((a, b) => snap[b] - snap[a] || a.localeCompare(b)); return new Map(list.map((n, i) => [n, i + 1])); };
  const beforeWho = new Set(appeared); g.names.forEach(n => { if (!(prev && prev.snapshot && prev.snapshot[n] != null)) beforeWho.delete(n); });
  return { before: rank(prev && prev.snapshot, beforeWho), after: rank(g.snapshot, appeared) };
}

// a player's Elo going into a game: the game's own record of it when it was rated, else the last rating they came out of an earlier game with (what XP uses for a
// friendly), else the starting rating
function ratingBefore(D, g, name) {
  if (g.elo && g.elo[name]) return g.elo[name].before;
  for (let i = g.idx - 1; i >= 0; i--) { const e = D.games[i].elo && D.games[i].elo[name]; if (e) return e.after; }
  return D.E.start;
}
// each player's chance of beating a random opponent at this table, going in, by Elo alone (what XP calls "the odds")
const expectedShare = (D, g, n, scale) => {
  const me = ratingBefore(D, g, n), others = g.names.filter(x => x !== n).map(o => ratingBefore(D, g, o));
  return others.length ? mean(others.map(o => 1 / (1 + Math.pow(10, (o - me) / scale)))) : null;
};

const fmtId = k => k.kind + k.id;

/* HOW each part of a player's XP for one game was worked out, with the real numbers, in the same terms as the rules in lib/xp.js (which this mirrors: if a rule there
   changes, change it here; a test checks that every explained part adds up to what was paid). Returns { part: [{ text, amount?, item? }] }: a line with an `amount` is a
   step that adds to the part, a line with `item` is a name listed under the step above it. */
function explainXp(D, g, name, parts, h, { badges, newCards, newLandscapes, table }) {
  const out = {}, n = g.n, place = g.places[name], pts = g.pts[name], pct = x => Math.round(x * 100) + '%', s = x => (x === 1 ? '' : 's');
  const mineIdx = h.findIndex(e => e.g.line === g.line), before = h.slice(0, mineIdx);
  if (parts.finish) out.finish = [{ text: `Last place pays ${XP.last} XP`, amount: XP.last }].concat(n - place > 0 ? [{ text: `${n - place} place${s(n - place)} above last, ${XP.perPlace} XP each (you finished ${ord(place)} of ${n})`, amount: XP.perPlace * (n - place) }] : []);
  if (parts.win) out.win = [{ text: 'Finishing first pays a flat prize', amount: XP.win }];
  if (parts.half) out.half = [{ text: `A top-half finish at a table of ${n} pays a smaller prize`, amount: XP.half }];
  if (parts.streak) {
    const base = (parts.finish || 0) + (parts.win || 0), boosted = Math.min(base * XP.streakMult, XP.streakCap);
    out.streak = [{ text: `You also won your previous game, so finish + win XP doubles: ${base} → ${base * XP.streakMult}` }, ...(base * XP.streakMult > XP.streakCap ? [{ text: `…up to ${XP.streakCap} XP in all` }] : []), { text: 'The extra, on top of the finish and win prizes', amount: boosted - base }];
  }
  if (parts.improve) {
    const recent = before.slice(-XP.improveWindow).map(e => e.pts), avg = recent.reduce((x, y) => x + y, 0) / recent.length;
    out.improve = [{ text: `Your finish over your last ${recent.length} game${s(recent.length)}: beating ${pct(avg)} of the table on average` }, { text: `This game: beating ${pct(pts)}, a rise of ${pct(pts - avg)}` }, { text: `A rise of ${XP.improve.map(([r, x]) => `${pct(r)} pays ${x}`).reverse().join(', ')}`, amount: parts.improve }];
  }
  if (parts.attendance) {
    // game nights in a row: the nights this group played, consecutive ones this player came to (paid once a night)
    const days = [...new Set(D.games.filter(x => x.n >= 2).map(x => x.day))].sort((a, b) => a - b), mine = new Set(h.filter(e => e.g.idx <= g.idx).map(e => e.g.day));
    let k = days.indexOf(g.day), run = 1; while (k - run >= 0 && mine.has(days[k - run])) run++;
    out.attendance = [{ text: `Game night ${run} in a row for you` }, { text: `${run - 1} night${s(run - 1)} beyond the first, ${XP.attendStep} XP each, paid on your first game of the night`, amount: parts.attendance }];
  }
  if (parts.surprise && table) out.surprise = [{ text: `Elo expected you to beat ${pct(table)} of the table` }, { text: `You beat ${pct(pts)}` }, { text: `${XP.surprise} XP × (${pct(pts)} − ${pct(table)})`, amount: parts.surprise }];
  if (parts.vp) {
    const vp = (g.playerVP && +g.playerVP[name]) || 0, top = Math.max(g.vp || 0, ...Object.values(g.playerVP || {}).map(Number)), raw = Math.max(0, Math.round(vp)) * XP.vpRaw;
    out.vp = [{ text: `${vp} VP, ${XP.vpRaw} XP each`, amount: raw }].concat(top > 0 ? [{ text: `Your VP as a share of the winner's (${vp} of ${top}) × ${XP.vpShare}`, amount: parts.vp - raw }] : []);
  }
  if (parts.landscapes) out.landscapes = [{ text: 'A kingdom with landscapes in it pays a flat prize', amount: XP.landscapes }];
  if (parts.cards) {
    out.cards = [];
    if (newCards.length) out.cards.push({ text: `${newCards.length} card${s(newCards.length)} you had never played with × ${XP.newCard}`, amount: newCards.length * XP.newCard }, ...newCards.map(c => ({ item: c.name })));
    if (newLandscapes.length) out.cards.push({ text: `${newLandscapes.length} landscape${s(newLandscapes.length)} you had never played with × ${XP.newLandscape}`, amount: newLandscapes.length * XP.newLandscape }, ...newLandscapes.map(l => ({ item: l.name })));
  }
  if (parts.badges) {
    const rows = badges.filter(b => !b.secret || b.earned).map(b => ({ text: `${b.secret ? 'A hidden legend' : b.name}`, amount: XP.badge + (b.bonus || 0), tier: b.tier || 'common' }));
    const sum = rows.reduce((t, r) => t + r.amount, 0);
    out.badges = [...rows, ...(sum !== parts.badges ? [{ text: 'Other badge prizes', amount: parts.badges - sum }] : [])];
  }
  if (parts.season) out.season = [{ text: 'Winning the season title', amount: parts.season }];
  return out;
}

// What the tier did this game, for the report: stayed, rose, dropped, or is being held under the line (demotion grace).
function tierMove(e, E) {
  const a = e.tierBefore, b = e.tierAfter;
  if (!a || !b) return null;
  const left = Math.max(0, Math.floor(+E.demotionGrace || 0)) - (e.below || 0);
  if (b.min > a.min) return { kind: 'up', tier: b.name };
  if (b.min < a.min) return { kind: 'down', tier: b.name, from: a.name };
  if (e.held) return { kind: 'held', tier: b.name, left: Math.max(0, left) };
  return null;
}

export function gameReport(D, g, { catalog = null } = {}) {
  const xpMap = leagueXp(D, catalog), hist = histories(D), base = baselines(D, catalog), scale = D.E.scale;
  const order = inOrder(g), idxOf = new Map(D.games.map(x => [x.line, x.idx]));
  const k = kingdomStats(g, catalog);
  const ranks = ranksAround(D, g);

  // ---- the game in its night and season
  const sameDay = D.games.filter(x => x.day === g.day && x.n >= 2);
  const when = { date: g.date, season: g.season, nightNo: sameDay.findIndex(x => x.line === g.line) + 1, nightOf: sameDay.length, startedAt: g.startedAt || null, endedAt: g.endedAt || null, savedAt: g.savedAt || null };

  // ---- time
  let time = null;
  if (g.minutes > 0) {
    const m = +g.minutes, size = base.minutesBySize.get(g.n) ?? null;
    time = {
      minutes: m, avgAll: base.avgMinutes, avgSize: size, sizeSample: base.nBySize.get(g.n) || 0, of: base.minutes.length, rankFastest: base.minutes.filter(x => x < m).length + 1,
      perMinute: (() => { const top = Math.max(...Object.values(g.playerVP || { x: 0 }).map(Number).filter(x => !Number.isNaN(x)), 0); return top > 0 ? round1(top / m) : null; })(),
    };
  }

  // ---- the kingdom against the group's usual
  let kingdom = null;
  if (k) {
    const costRank = base.costs.length && k.avgCost != null ? base.costs.filter(x => x < k.avgCost).length / base.costs.length : null;
    // how often the group has played these cards before this game (a split pile counts once, by its pile)
    const before = new Map();
    for (const x of D.games) { if (x.idx >= g.idx) break; const kx = x.n >= 2 ? kingdomStats(x, catalog) : null; if (kx) new Set(kx.cards.map(c => c.pileKey)).forEach(key => before.set(key, (before.get(key) || 0) + 1)); }
    const played = k.cards.map(c => ({ card: c, before: before.get(c.pileKey) || 0 }));
    const veteran = played.slice().sort((a, b) => b.before - a.before || a.card.name.localeCompare(b.card.name))[0];
    kingdom = {
      ...k, vs: { avgCost: base.avgCost, costPercentile: costRank, avgAttacks: base.avgAttacks, landscapeShare: base.landscapeShare, sample: base.kingdoms },
      history: { firstInGroup: played.filter(x => x.before === 0).map(x => x.card), mostPlayed: veteran && veteran.before > 0 ? veteran : null, gamesBefore: D.games.filter(x => x.idx < g.idx && x.n >= 2 && kingdomStats(x, catalog)).length },
    };
  }

  // ---- the players
  const players = order.map(name => {
    const h = hist.get(name) || [], others = h.filter(e => e.g.line !== g.line);
    const mine = h.find(e => e.g.line === g.line);
    const elo = g.elo && g.elo[name], score = g.score && g.score[name];
    const xpEntry = xpMap.get(name) && xpMap.get(name).perGame.find(e => e.line === g.line);
    const xpTotalAfter = xpMap.get(name) ? xpMap.get(name).perGame.filter(e => idxOf.get(e.line) <= g.idx).reduce((s, e) => s + e.xp, 0) : 0;
    const lvAfter = levelAt(xpTotalAfter), lvBefore = levelAt(xpTotalAfter - (xpEntry ? xpEntry.xp : 0));
    const player = D.players.find(p => p.name === name);
    const badges = player ? badgesFor(D, player, catalog).filter(b => b.earned && b.earned.line === g.line) : [];

    // cards and landscapes this player had never sat at a table with (the same test XP pays NEW_CARD / NEW_LANDSCAPE for)
    const seen = new Set();
    for (const x of D.games) { if (x.idx >= g.idx) break; if (x.n >= 2 && x.places[name] != null) (x.kingdom || []).forEach(it => seen.add(fmtId(it))); }
    const fresh = [...new Map((g.kingdom || []).filter(it => !seen.has(fmtId(it))).map(it => [fmtId(it), it])).values()];
    const newCards = catalog ? fresh.filter(it => it.kind === 'card').map(it => catalog.cardsById.get(it.id)).filter(Boolean) : [];
    const newLandscapes = catalog ? fresh.filter(it => it.kind === 'landscape').map(it => catalog.landscapesById.get(it.id)).filter(Boolean) : [];

    // against the player's own usual
    const compare = [];
    const add = (id, label, value, usual, unit, higherIsBetter = true) => {
      if (value == null || usual == null) return;
      const delta = value - usual;
      compare.push({ id, label, value, usual, delta, unit, good: Math.abs(delta) < 1e-9 ? null : higherIsBetter ? delta > 0 : delta < 0 });
    };
    const vps = others.filter(e => e.vp != null).map(e => e.vp);
    if (vps.length >= 2) add('vp', 'Victory points', mine && mine.vp, mean(vps), 'VP');
    if (others.length >= 2) add('finish', 'Finish', mine && Math.round(mine.pts * 100), Math.round(mean(others.map(e => e.pts)) * 100), '%');
    const deltas = others.filter(e => e.delta != null).map(e => e.delta);
    if (deltas.length >= 2 && elo) add('elo', 'Elo change', elo.after - elo.before, mean(deltas), 'Elo');
    const xps = xpMap.get(name) ? xpMap.get(name).perGame.filter(e => e.line !== g.line).map(e => e.xp) : [];
    if (xps.length >= 2 && xpEntry) add('xp', 'XP', xpEntry.xp, mean(xps), 'XP');
    const pace = e => (e.vp != null && e.minutes ? e.vp / e.minutes : null), paces = others.map(pace).filter(x => x != null);
    if (paces.length >= 2 && mine && pace(mine) != null) add('pace', 'VP per minute', round1(pace(mine)), mean(paces), 'VP/min');

    // how this player does with what this game had: each expansion in the kingdom, and kingdoms with attacks / landscapes / pricey cards, against their usual finish
    const fit = [];
    const overall = others.length ? mean(others.map(e => e.pts)) : null;
    const ksOf = e => (catalog ? kingdomStats(e.g, catalog) : null);
    if (k && overall != null) {
      const withK = others.map(e => ({ e, k: ksOf(e) })).filter(x => x.k);
      const test = (label, here, ok) => {
        if (!here) return;
        const s = withK.filter(x => ok(x.k)); if (s.length < 3) return;
        const avg = mean(s.map(x => x.e.pts)); fit.push({ label, games: s.length, avg, overall, delta: avg - overall });
      };
      k.expansions.forEach(ex => test(ex.name, true, kk => kk.expansions.some(x => x.name === ex.name)));
      test('Kingdoms with 3+ Attacks', k.attacks >= 3, kk => kk.attacks >= 3);
      test('Kingdoms with landscapes', k.landscapes.length > 0, kk => kk.landscapes.length > 0);
      if (base.avgCost != null && k.avgCost != null) test('Pricier-than-usual kingdoms', k.avgCost > base.avgCost, kk => kk.avgCost != null && kk.avgCost > base.avgCost);
      fit.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }

    const others2 = g.names.filter(x => x !== name), eloOf = nm => (g.elo && g.elo[nm] ? g.elo[nm].before : null);
    const oppAvg = others2.every(nm => eloOf(nm) != null) ? mean(others2.map(eloOf)) : null;
    const exp = expectedShare(D, g, name, scale);
    return {
      name, place: g.places[name], won: g.places[name] === 1, vp: mine ? mine.vp : null, pts: g.pts[name],
      vpShare: (() => { const top = Math.max(...Object.values(g.playerVP || {}).map(Number).filter(x => !Number.isNaN(x)), 0); return mine && mine.vp != null && top > 0 ? mine.vp / top : null; })(),
      elo: elo ? { before: elo.before, after: elo.after, delta: elo.after - elo.before, saving: elo.saving || 0, grace: tierMove(elo, D.E) } : null,
      score: score ? { before: score.before, after: score.after, delta: score.after - score.before } : null,
      rank: ranks.after ? { before: ranks.before ? ranks.before.get(name) ?? null : null, after: ranks.after.get(name) ?? null } : null,
      table: oppAvg != null && elo ? { oppAvg, own: elo.before, diff: oppAvg - elo.before, expected: exp, actual: g.pts[name] } : null,
      xp: xpEntry ? { total: xpEntry.xp, parts: xpEntry.parts, levelBefore: lvBefore, levelAfter: lvAfter, levelUp: lvAfter > lvBefore ? lvAfter : null, explain: explainXp(D, g, name, xpEntry.parts, h, { badges, newCards, newLandscapes, table: expectedShare(D, g, name, scale) }) } : null,
      badges, newCards, newLandscapes, compare, fit, games: h.length,
    };
  });

  // ---- what is worth saying about it: each line has a weight, and the heaviest few are kept
  const highlights = [];
  const say = (weight, tone, title, text) => highlights.push({ weight, tone, title, text });
  const top = players[0], runner = players[1], winners = players.filter(p => p.won);
  const eloBefore = p => (p.elo ? p.elo.before : null);
  if (winners.length === 1 && g.n >= 3 && players.every(p => eloBefore(p) != null) && players.slice(1).every(p => eloBefore(p) > eloBefore(top))) say(100, 'gold', 'Upset', `${top.name} was the lowest-rated player at the table and won.`);
  else if (winners.length === 1 && players.slice(1).some(p => eloBefore(p) != null && eloBefore(top) != null && eloBefore(p) - eloBefore(top) >= 100)) say(95, 'gold', 'Giant killed', `${top.name} beat someone rated ${Math.round(Math.max(...players.slice(1).map(p => eloBefore(p))) - eloBefore(top))} Elo higher.`);
  if (winners.length > 1) say(70, 'blue', 'Shared victory', `${winners.map(p => p.name).join(' and ')} tied for first.`);
  if (top && runner && top.vp != null && runner.vp != null && winners.length === 1) {
    const gap = top.vp - runner.vp;
    if (gap <= 2) say(85, 'blue', 'Photo finish', `${top.name} won by ${gap} VP.`);
    else if (gap >= 30) say(80, 'gold', 'Landslide', `${top.name} won by ${gap} VP.`);
  }
  const swing = Math.max(0, ...players.map(p => (p.elo ? Math.abs(p.elo.delta) : 0)));
  const swingRank = base.swings.filter(x => x > swing + 1e-9).length + 1;
  if (swing > 0 && swingRank <= 3 && base.swings.length >= 5) say(90, 'gold', `Top-${swingRank} Elo swing`, `A ${Math.round(swing)}-point move, the ${swingRank === 1 ? 'biggest' : swingRank === 2 ? '2nd biggest' : '3rd biggest'} in this group.`);
  if (time && base.minutes.length >= 5) {
    if (time.rankFastest <= 3) say(75, 'green', time.rankFastest === 1 ? 'Fastest game yet' : `Top-${time.rankFastest} fastest`, `${time.minutes} minutes, out of ${time.of} timed games.`);
    else if (base.minutes.filter(x => x > time.minutes).length < 3) say(50, 'blue', 'A marathon', `${time.minutes} minutes, one of the longest in the group.`);
  }
  const bestVp = players.filter(p => p.vp != null && (hist.get(p.name) || []).filter(e => e.vp != null).length >= 4 && (hist.get(p.name) || []).filter(e => e.g.line !== g.line && e.vp != null).every(e => e.vp < p.vp));
  if (bestVp.length) say(65, 'green', 'Personal best', `${bestVp.map(p => `${p.name} (${p.vp} VP)`).join(', ')} ${bestVp.length === 1 ? 'scored' : 'scored'} the most they ever have.`);
  const ups = players.filter(p => p.xp && p.xp.levelUp);
  if (ups.length === 1) say(60, 'green', 'Level up', `${ups[0].name} reached level ${ups[0].xp.levelUp}.`);
  else if (ups.length > 1) say(60, 'green', `${ups.length} level-ups`, `${ups.map(p => `${p.name} (${p.xp.levelUp})`).join(', ')}.`);
  const badged = players.filter(p => p.badges.length), nBadges = badged.reduce((n, p) => n + p.badges.length, 0);
  if (nBadges) say(68, 'gold', nBadges === 1 ? 'Badge unlocked' : `${nBadges} badges unlocked`, badged.map(p => `${p.name}: ${p.badges.slice(0, 2).map(b => (b.secret ? 'a hidden legend' : b.name)).join(', ')}${p.badges.length > 2 ? ` +${p.badges.length - 2}` : ''}`).join('; ') + '.');
  const freshAll = new Set(players.flatMap(p => [...p.newCards.map(c => c.id), ...p.newLandscapes.map(l => l.id)]));
  if (catalog && freshAll.size >= 3) say(40, 'blue', 'Fresh cards', `${freshAll.size} cards or landscapes were new to someone at the table.`);
  highlights.sort((a, b) => b.weight - a.weight);

  return { line: g.line, type: g.type, n: g.n, sets: g.sets, notes: g.notes, when, time, kingdom, players, highlights: highlights.slice(0, 5).map(({ weight, ...h }) => h) };
}
