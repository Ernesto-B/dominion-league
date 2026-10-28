/* A steadier rating system, for PREVIEW beside the real one. Nothing here changes the real ladder: it reads the same games the engine
   already parsed (D.games: names, places, n, type) and works out what the ratings would have been.

   What differs from the engine's Elo, and why (your rules: finishing in the top half matters most, then winning; one bad night
   shouldn't wipe out a good one; the trend should be upward without ratings becoming meaningless):
     - a much smaller K once a player is established, so a game moves you tens of points, not a hundred;
     - the result of a finish isn't "how many players you beat" but a points-per-finish table that pays for the top half first and the
       win second (see finishScores) — an even table of four pays about +42 / +18 / −18 / −30, where the real ladder pays +100 / +33 / −33 / −100;
     - the table pays out `target` of the points on average (0.50 = a closed, zero-sum ladder; a little more = a slow, deliberate rise),
       the same at every table size, so the drift is a dial you set, not an accident.
   What is kept: you still gain more for beating stronger players (the expected-score part is the engine's), so a loss to a weaker
   player still costs you, and your RANK stays relative — somebody passing you is still somebody passing you. */

export const DEFAULT_STEADY = Object.freeze({
  k: 80, provisionalK: 160, provisionalGames: 10, start: 1000, scale: 400,
  linear: 0.45,     // how much plain finishing position counts
  topHalf: 0.30,    // the bonus for finishing in the top half (floor(n / 2) places)
  win: 0.15,        // the extra bonus for winning
  target: 0.54,     // the average share of the points a table pays out
});

// the engine's own rule for what counts towards a rating (src/lib/engine.js `rated`); a test keeps the two in step
export const isRatedGame = g => g.n >= 2 && g.type !== 'Friendly';

const expectedVs = (a, b, scale) => 1 / (1 + Math.pow(10, (b - a) / scale));
const raw = (pos, n, w) => w.linear * (n - pos) / (n - 1) + w.topHalf * (pos <= Math.floor(n / 2) ? 1 : 0) + w.win * (pos === 1 ? 1 : 0);

/* The points-per-finish for everyone at one table. `places` is each player's place (1 = first; tied players share a number).
   A tied group shares the average of the positions it covers, and the whole table is shifted so it pays `target` on average. */
export function finishScores(places, params = {}) {
  const w = { ...DEFAULT_STEADY, ...params }, n = places.length;
  const byPos = Array.from({ length: n }, (_, i) => raw(i + 1, n, w));
  const mean = byPos.reduce((a, b) => a + b, 0) / n, shift = w.target - mean;
  return places.map(pl => {
    const tied = places.filter(x => x === pl).length;                 // positions pl .. pl + tied - 1
    let s = 0; for (let i = 0; i < tied; i++) s += byPos[pl - 1 + i];
    return s / tied + shift;
  });
}

/* What each finishing place pays at an EVEN table (everyone on the same rating, everyone established). */
export const steadyPayout = (n, params = {}) => { const w = { ...DEFAULT_STEADY, ...params }; return finishScores(Array.from({ length: n }, (_, i) => i + 1), w).map(s => w.k * (s - 0.5)); };
export const classicPayout = (n, k = 200) => Array.from({ length: n }, (_, i) => (k / (n - 1)) * ((n - 1 - i) - (n - 1) / 2));

/* Replays `games` (oldest first, as D.games is) under the steady system. `players` are the group's names.
   Returns { ratings, rated, records, ranked } — `records` is one entry per player per rated game, for ladderStats(). */
export function computeSteady(games, players, params = {}) {
  const w = { ...DEFAULT_STEADY, ...params };
  const cur = Object.fromEntries(players.map(n => [n, w.start])), rated = Object.fromEntries(players.map(n => [n, 0]));
  const records = [];
  games.forEach((g, gi) => {
    if (!isRatedGame(g)) return;
    const names = g.names, n = names.length, scores = finishScores(names.map(a => g.places[a]), w), next = {};
    names.forEach((a, i) => {
      if (!(a in cur)) { cur[a] = w.start; rated[a] = 0; }
      let sumE = 0; names.forEach(b => { if (b !== a) sumE += expectedVs(cur[a], cur[b] ?? w.start, w.scale); });
      const k = rated[a] < w.provisionalGames ? w.provisionalK : w.k;
      next[a] = k * (scores[i] - sumE / (n - 1));
    });
    names.forEach(a => { records.push({ name: a, delta: next[a], win: g.places[a] === 1, game: gi }); cur[a] += next[a]; rated[a]++; });
  });
  return { ratings: cur, rated, records, ranked: rankPlayers(cur, rated) };
}

// best first; the rank is shared by players within 0.1 of each other, like the engine's
export function rankPlayers(ratings, rated) {
  const list = Object.keys(ratings).filter(n => rated[n] > 0).map(name => ({ name, rating: ratings[name] }));
  list.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  return list.map(p => ({ ...p, rank: 1 + list.filter(q => Math.round(q.rating * 10) > Math.round(p.rating * 10)).length }));
}

/* How a system feels, from its per-player-per-game changes ({ name, delta, win, game }, oldest first):
     swing          the typical size of one game's move (average |change|)
     erasesWin      of the games a player LOST ground, the share where the loss was at least as big as that player's last win gain —
                    i.e. how often one bad night undoes the last good one */
export function ladderStats(records) {
  if (!records.length) return { swing: 0, erasesWin: 0, games: 0 };
  let abs = 0, losses = 0, erased = 0; const lastWin = {};
  for (const r of records) {
    abs += Math.abs(r.delta);
    if (r.win && r.delta > 0) lastWin[r.name] = r.delta;
    else if (r.delta < 0 && lastWin[r.name] != null) { losses++; if (-r.delta >= lastWin[r.name]) erased++; }
  }
  return { swing: abs / records.length, erasesWin: losses ? erased / losses : 0, games: records.length };
}

// the engine's own results (g.elo[name] = { before, after }) as the same records, so the two systems are measured identically
export function classicRecords(games) {
  const out = [];
  games.forEach((g, gi) => { if (!isRatedGame(g) || !g.elo) return; g.names.forEach(a => { if (g.elo[a]) out.push({ name: a, delta: g.elo[a].after - g.elo[a].before, win: g.places[a] === 1, game: gi }); }); });
  return out;
}
