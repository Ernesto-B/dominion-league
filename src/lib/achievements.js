/* Badges a player has earned, worked out from nothing but their own results (p.results from the engine) and the group's games. Pure.
   Every badge is a plain fact about the games, shown with the game that earned it; nothing here expires, resets or can be lost, so
   it never nags. `earned` is the game where it was first true (so the badge links to it), or null while it is still out of reach. */
const sole = (g, place) => place === 1 && Object.values(g.places).filter(x => x === 1).length === 1;
const soleLast = (g, place) => place === g.n && Object.values(g.places).filter(x => x === g.n).length === 1;

const firstIndex = (results, ok) => { for (let i = 0; i < results.length; i++) if (ok(results[i], i)) return i; return -1; };

export const BADGES = [
  { id: 'first-win', name: 'First blood', hint: 'Win a game outright.' },
  { id: 'hat-trick', name: 'Hat trick', hint: 'Win three games in a row.' },
  { id: 'redemption', name: 'Redemption', hint: 'Win the game right after finishing last.' },
  { id: 'giant-slayer', name: 'Giant slayer', hint: 'Win at a table with someone rated 100+ Elo above you.' },
  { id: 'big-swing', name: 'Big swing', hint: 'Gain 50 or more Elo in a single game.' },
  { id: 'clean-sweep', name: 'Clean sweep', hint: 'Win every game of a night (two or more games).' },
  { id: 'know-your-enemy', name: 'Know your enemy', hint: 'Play at least one game against every other player.' },
  { id: 'regular', name: 'Regular', hint: 'Play 10 rated games.' },
  { id: 'veteran', name: 'Veteran', hint: 'Play 25 rated games.' },
];

/* `p` is a player from the engine (results, titles, peak); `tiers` D.tiers; `everyone` the other rated players' names. */
export function achievements(p, tiers = [], everyone = []) {
  const rs = p.results || [];
  const at = i => (i >= 0 && rs[i] ? { date: rs[i].game.date, line: rs[i].game.line } : null);
  const out = new Map();

  out.set('first-win', at(firstIndex(rs, r => sole(r.game, r.place))));
  let run = 0, hat = -1;
  rs.forEach((r, i) => { run = sole(r.game, r.place) ? run + 1 : 0; if (run === 3 && hat < 0) hat = i; });
  out.set('hat-trick', at(hat));
  out.set('redemption', at(firstIndex(rs, (r, i) => i > 0 && sole(r.game, r.place) && soleLast(rs[i - 1].game, rs[i - 1].place))));
  out.set('giant-slayer', at(firstIndex(rs, r => sole(r.game, r.place) && Object.entries(r.game.elo || {}).some(([n, e]) => n !== p.name && e && e.before - r.before >= 100))));
  out.set('big-swing', at(firstIndex(rs, r => r.after - r.before >= 50)));

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
  out.set('regular', at(rs.length >= 10 ? 9 : -1));
  out.set('veteran', at(rs.length >= 25 ? 24 : -1));

  const list = BADGES.map(b => ({ ...b, earned: out.get(b.id) || null }));
  // reaching each tier above the first; the date is the game that took the player over the line
  (tiers || []).forEach((t, k) => {
    if (!k || t.min == null) return;
    list.push({ id: 'tier-' + t.id, name: `Reached ${t.name}`, hint: `Get to ${t.min} Elo.`, tier: t, earned: at(firstIndex(rs, r => Math.round(r.after) >= t.min)) });
  });
  if (p.titles > 0) list.push({ id: 'champion', name: p.titles > 1 ? `Season champion ×${p.titles}` : 'Season champion', hint: 'Win a season.', earned: { date: null, line: null } });
  return list;
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
