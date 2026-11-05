/* Seating for a big game night, pure: who has already shared a table, and how to split a crowd across two tables. Dominion seats at most MAX_PLAYERS at one table. */
export const MAX_PLAYERS = 6;
export const MAX_SEATS = MAX_PLAYERS * 2;   // two tables

const pairKey = (a, b) => (a < b ? a + '\u0000' + b : b + '\u0000' + a);

// every pair of players who have sat at a table together (any game with two or more players, friendly ones included)
export function metPairs(games) {
  const met = new Set();
  for (const g of games) {
    if (!g.names || g.names.length < 2) continue;
    for (let i = 0; i < g.names.length; i++) for (let j = i + 1; j < g.names.length; j++) met.add(pairKey(g.names[i], g.names[j]));
  }
  return met;
}
export const haveMet = (met, a, b) => met.has(pairKey(a, b));

// the pairs among `names` who have never shared a table
export function firstTimers(names, met) {
  const out = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (!haveMet(met, names[i], names[j])) out.push([names[i], names[j]]);
  return out;
}

/* Split 7 to 12 players over two tables (each at most MAX_PLAYERS), as evenly in size as possible. Fair first: the two tables' average Elo as close as can be. After that, a small push
   towards putting people who have never met at the same table (worth `mixWeight` Elo of average for each such pair), so a crowd is a chance to meet. Deterministic: the same people
   always give the same split. Returns { a, b, avgA, avgB, firstTimes } (each table sorted by Elo, highest first), or null when it cannot be done. */
export function suggestSplit(players, met, { mixWeight = 3 } = {}) {
  const list = players.slice().sort((x, y) => y.elo - x.elo || x.name.localeCompare(y.name));
  const n = list.length;
  if (n <= MAX_PLAYERS || n > MAX_SEATS) return null;
  const sizeA = Math.ceil(n / 2);   // table A takes the extra seat of an odd crowd
  let best = null;
  const pick = [];
  const unmetWithin = idx => {
    let c = 0;
    for (let i = 0; i < idx.length; i++) for (let j = i + 1; j < idx.length; j++) if (!haveMet(met, list[idx[i]].name, list[idx[j]].name)) c++;
    return c;
  };
  const walk = (from) => {
    if (pick.length === sizeA) {
      const inA = new Set(pick), A = pick.slice(), B = list.map((_, i) => i).filter(i => !inA.has(i));
      const avg = idx => idx.reduce((t, i) => t + list[i].elo, 0) / idx.length;
      const aA = avg(A), aB = avg(B), within = unmetWithin(A) + unmetWithin(B);
      const score = Math.abs(aA - aB) - mixWeight * within / n;   // per player, so the weight means the same for 7 players and for 12
      if (!best || score < best.score - 1e-9) best = { score, A, B, aA, aB, within };
      return;
    }
    for (let i = from; i < n; i++) { pick.push(i); walk(i + 1); pick.pop(); }
  };
  walk(0);
  const name = idx => idx.map(i => list[i].name);
  return { a: name(best.A), b: name(best.B), avgA: best.aA, avgB: best.aB, firstTimes: best.within };
}
