/* What the "starts with you" home card says about the signed-in player. Pure, so it is tested directly.
   `ranked` is D.ranked (best first); `start` the Elo everyone begins on. Returns null when the player isn't on the ladder yet. */
/* `win` (optional) is what a win at an even table of four pays, so the next-tier line can say how many wins away it is. */
import { tierProgress } from './tierProgress.js';

export function meSummary(ranked, name, start = 1000, win = 0) {
  const i = ranked.findIndex(p => p.name === name);
  if (i < 0) return null;
  const p = ranked[i], above = ranked[i - 1] || null, below = ranked[i + 1] || null;
  const last = p.results.length ? p.results[p.results.length - 1] : null;
  let gap = null;   // the nearest thing to say about the ladder: how far behind the next player up, or how far clear of the one below
  if (above) gap = { kind: 'behind', who: above.name, rank: above.rank, elo: Math.max(0, Math.round(above.elo - p.elo)) };
  else if (below) gap = { kind: 'clear', who: below.name, rank: below.rank, elo: Math.max(0, Math.round(p.elo - below.elo)) };
  let next = null;   // the next tier up: how many Elo away, how far along the way, and about how many wins that is
  if (p.nextTier) {
    next = { tier: p.nextTier.tier, need: p.nextTier.need, pct: tierProgress(p.elo, p.tier, p.nextTier.tier), wins: win > 0 ? Math.max(1, Math.ceil(p.nextTier.need / win)) : null };
  }
  return {
    next,
    rank: p.rank, of: ranked.length, elo: Math.round(p.elo), fromStart: Math.round(p.elo - start), tier: p.tier, tierHeld: !!p.tierHeld, provisional: p.status === 'Provisional',
    streak: p.streak, titles: p.titles || 0, gap,
    last: last ? { place: last.place, of: last.game.n, date: last.game.date, delta: Math.round(last.after - last.before) } : null,
    form: p.results.slice(-5).map(r => ({ tone: r.pts >= 0.67 ? 'w' : r.pts <= 0.33 ? 'l' : 'm', place: r.place, of: r.game.n, date: r.game.date })),
  };
}
