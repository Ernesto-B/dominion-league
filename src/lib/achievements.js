/* Badges a player has earned, worked out from nothing but their own results (p.results from the engine) and the group's games. Pure.
   Every badge is a plain fact about the games, shown with the game that earned it; nothing here expires, resets or can be lost, so
   it never nags. `earned` is the game where it was first true (so the badge links to it), or null while it is still out of reach. */
const sole = (g, place) => place === 1 && Object.values(g.places).filter(x => x === 1).length === 1;
const soleLast = (g, place) => place === g.n && Object.values(g.places).filter(x => x === g.n).length === 1;

const firstIndex = (results, ok) => { for (let i = 0; i < results.length; i++) if (ok(results[i], i)) return i; return -1; };

/* `group` files a badge under a heading on the Player page. A badge with a `track` is one step of a ladder (games played, ranks): the page draws a
   track as one box showing the current step and the next, with every step inside it. Ids never change, so "seen" lists keep working. */
export const GROUPS = ['Winning', 'Comebacks and upsets', 'The table', 'Milestones', 'Seasons'];
export const BADGES = [
  { id: 'first-win', group: 'Winning', name: 'First blood', hint: 'Win a game outright.' },
  { id: 'hat-trick', group: 'Winning', name: 'Hat trick', hint: 'Win three games in a row.' },
  { id: 'clean-sweep', group: 'Winning', name: 'Clean sweep', hint: 'Win every game of a night (two or more games).' },
  { id: 'redemption', group: 'Comebacks and upsets', name: 'Redemption', hint: 'Win the game right after finishing last.' },
  { id: 'giant-slayer', group: 'Comebacks and upsets', name: 'Giant slayer', hint: 'Win at a table with someone rated 100+ Elo above you.' },
  { id: 'big-swing', group: 'Comebacks and upsets', name: 'Big swing', hint: 'Gain 50 or more Elo in a single game.' },
  { id: 'know-your-enemy', group: 'The table', name: 'Know your enemy', hint: 'Play at least one game against every other player.' },
  { id: 'regular', group: 'Milestones', track: 'games', trackName: 'Games played', name: 'Regular', hint: 'Play 10 rated games.', target: 10 },
  { id: 'veteran', group: 'Milestones', track: 'games', trackName: 'Games played', name: 'Veteran', hint: 'Play 25 rated games.', target: 25 },
];

/* `p` is a player from the engine (results, titles, peak); `tiers` D.tiers; `everyone` the other rated players' names. */
export function achievements(p, tiers = [], everyone = [], xp = null) {
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

  const list = BADGES.map(b => ({ ...b, earned: out.get(b.id) || null, ...(b.track === 'games' ? { value: rs.length } : {}) }));
  const peak = rs.reduce((m, r) => Math.max(m, Math.round(r.after)), 0);
  // reaching each tier above the first; the date is the game that took the player over the line
  (tiers || []).forEach((t, k) => {
    if (!k || t.min == null) return;
    list.push({ id: 'tier-' + t.id, group: 'Milestones', track: 'rank', trackName: 'Rank', name: `Reached ${t.name}`, hint: `Get to ${t.min} Elo.`, tier: t, target: t.min, value: peak, earned: at(firstIndex(rs, r => Math.round(r.after) >= t.min)) });
  });
  // the Level track comes from XP (lib/xp.js), which itself needs the other badges, so it is only added when the caller passes the XP in
  if (xp) for (const st of xp.steps) list.push({ id: 'level-' + st.level, group: 'Milestones', track: 'level', trackName: 'Level', name: `Level ${st.level}`, hint: `Earn enough XP to reach level ${st.level}.`, target: st.level, value: xp.level, earned: st.earned });
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
