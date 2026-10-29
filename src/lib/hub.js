import { TIERS } from './achievements.js';

/* Badges worth going after next, from a player's badge list: the ones already partly done come first (closest first), then the easiest not
   yet started. A stepped track offers only its next step. Pure; the list is what achievements() returns. */
export function nextUp(list, n = 3) {
  const tierRank = id => { const k = TIERS.findIndex(t => t.id === id); return k < 0 ? TIERS.length : k; };
  const firstOfTrack = new Set(), picks = [];
  for (const b of list) {
    if (b.earned || b.secret) continue;
    if (b.track) { if (firstOfTrack.has(b.track)) continue; firstOfTrack.add(b.track); }
    const pct = b.target && b.value != null ? Math.max(0, Math.min(1, b.value / b.target)) : null;
    picks.push({ id: b.id, name: b.name, hint: b.hint, tier: b.tier, track: b.trackName || null, value: b.value, target: b.target || null, pct, order: picks.length });
  }
  const started = picks.filter(x => x.pct != null && x.pct > 0 && x.pct < 1).sort((a, b) => b.pct - a.pct || tierRank(a.tier) - tierRank(b.tier) || a.order - b.order);
  const rest = picks.filter(x => !started.includes(x)).sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.order - b.order);
  return [...started, ...rest].slice(0, n);
}
