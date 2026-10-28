/* "Since you last looked": what changed on the ladder between the visitor's last look and now. Pure apart from the storage it is
   handed, so it is tested. Everything it says is a plain fact about the games (who moved, who is on a streak, how far from a tier);
   there are no nudges or countdowns, and it stays quiet until there is something new.

   A snapshot is { line, at, ranks: {name: rank}, tiers: {name: tierId}, elo: {name: elo} }, where `line` is the newest game id seen. */
const key = gid => `dl.seen.${gid ?? 'all'}`;

export const snapshotOf = (ranked, games, now = Date.now()) => ({
  line: games.reduce((m, g) => Math.max(m, g.line ?? 0), 0), at: now,
  ranks: Object.fromEntries(ranked.map(p => [p.name, p.rank])),
  tiers: Object.fromEntries(ranked.map(p => [p.name, p.tier.id])),
  elo: Object.fromEntries(ranked.map(p => [p.name, Math.round(p.elo)])),
});

export function loadSeen(storage, gid) {
  try { const v = JSON.parse(storage.getItem(key(gid))); return v && typeof v.line === 'number' ? v : null; } catch { return null; }
}
export function saveSeen(storage, gid, snap) { try { storage.setItem(key(gid), JSON.stringify(snap)); } catch { /* not remembered */ } }

/* The things worth saying, newest-first and at most `max`. `prev` is the stored snapshot, `ranked` is D.ranked, `games` is D.games,
   `me` the viewer's player name (or null). Returns { games, nights, lines } or null when nothing is new. */
export function sinceLastVisit(prev, ranked, games, me = null, max = 4) {
  if (!prev) return null;
  const fresh = games.filter(g => (g.line ?? 0) > prev.line && g.n >= 2);
  if (!fresh.length) return null;
  const nights = new Set(fresh.map(g => g.day)).size, lines = [];
  const byName = new Map(ranked.map(p => [p.name, p]));
  const mine = me && byName.get(me);
  const moved = name => { const p = byName.get(name); return p && prev.ranks[name] != null ? prev.ranks[name] - p.rank : 0; };

  if (mine) {
    const d = moved(me);
    if (prev.ranks[me] == null) lines.push({ kind: 'me', text: `You’re on the ladder now, in ${mine.rank}${suffix(mine.rank)} place.` });
    else if (d > 0) lines.push({ kind: 'me', text: `You moved up ${d} place${d === 1 ? '' : 's'}, to ${mine.rank}${suffix(mine.rank)}.` });
    else if (d < 0) lines.push({ kind: 'me', text: `You slipped ${-d} place${d === -1 ? '' : 's'}, to ${mine.rank}${suffix(mine.rank)}.` });
    else lines.push({ kind: 'me', text: `You held ${mine.rank}${suffix(mine.rank)} place.` });
    if (prev.tiers[me] && prev.tiers[me] !== mine.tier.id) lines.push({ kind: 'tier', text: `You’re now a ${mine.tier.name}.` });
    else if (mine.nextTier && mine.nextTier.need <= 60) lines.push({ kind: 'next', text: `${mine.nextTier.need} Elo from ${mine.nextTier.tier.name}.` });
  }
  // the biggest mover who isn't the viewer, then anyone on a streak of 3+ wins
  const movers = ranked.filter(p => p.name !== me).map(p => ({ p, d: moved(p.name) })).filter(x => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  if (movers[0]) lines.push({ kind: 'other', text: `${movers[0].p.name} ${movers[0].d > 0 ? 'climbed' : 'dropped'} ${Math.abs(movers[0].d)} to ${movers[0].p.rank}${suffix(movers[0].p.rank)}.` });
  const hot = ranked.filter(p => p.streak >= 3).sort((a, b) => b.streak - a.streak)[0];
  if (hot) lines.push({ kind: 'streak', text: `${hot.name === me ? 'You are' : hot.name + ' is'} on a ${hot.streak}-win streak.` });
  return { games: fresh.length, nights, lines: lines.slice(0, max) };
}

function suffix(n) { const v = n % 100; return ['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'; }
