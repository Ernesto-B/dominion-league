import { startLabel } from './gameTime.js';
import { badgesFor, xpOf } from './xp.js';

/* Two players side by side, from the same data their own pages use. It is built as a rivalry, not a scoreboard: what they have played TOGETHER comes first, the numbers are shown without a
   winner or a gap, and badges are shown as what they share. Pure (no DOM), so it is tested on its own.
   Returns { together, rows, sets, badges }:
     together  { games, aheadA, aheadB, ties, recent: [{ line, date, placeA, placeB, n, time }] (every one, newest first; the page shows three at a time) }   the rated games both sat in (Friendly games never count, as everywhere)
     rows      [{ key, label, a, b }]   display strings, one row per stat, nothing is ranked
     sets      { a: [[expansion, games]…], b: […] }   each one's most played expansions
     badges    { shared: [badge], onlyA: [badge], onlyB: [badge] }   earned ones only, by badge */
const pct = v => (v == null ? '—' : `${Math.round(v * 100)}%`);
const one1 = v => (v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1));

export function compare(D, a, b, catalog = null) {
  const pa = D.players.find(p => p.name === a), pb = D.players.find(p => p.name === b);
  if (!pa || !pb || a === b) return null;
  const both = D.games.filter(g => g.n >= 2 && g.type !== 'Friendly' && g.places[a] != null && g.places[b] != null);
  const together = { games: both.length, aheadA: both.filter(g => g.places[a] < g.places[b]).length, aheadB: both.filter(g => g.places[b] < g.places[a]).length, ties: both.filter(g => g.places[a] === g.places[b]).length,
    recent: both.slice().reverse().map(g => ({ line: g.line, date: g.date, placeA: g.places[a], placeB: g.places[b], n: g.n, time: startLabel(g) })) };
  // the pair's record in each expansion they have met in (two games or more, the busiest four), and their closest game by VP
  const setRec = {};
  both.forEach(g => (g.sets || []).forEach(nm => {
    const e = setRec[nm] || (setRec[nm] = { set: nm, games: 0, aheadA: 0, aheadB: 0 });
    e.games++; if (g.places[a] < g.places[b]) e.aheadA++; else if (g.places[b] < g.places[a]) e.aheadB++;
  }));
  together.bySet = Object.values(setRec).filter(e => e.games >= 2).sort((x, y) => y.games - x.games || x.set.localeCompare(y.set)).slice(0, 4);
  together.closest = null;
  both.forEach(g => {
    const va = g.playerVP && g.playerVP[a], vb = g.playerVP && g.playerVP[b];
    if (va == null || vb == null) return;
    const gap = Math.abs(va - vb);
    if (!together.closest || gap < together.closest.gap) together.closest = { line: g.line, date: g.date, gap, vpA: va, vpB: vb };
  });
  const avgPlace = p => (p.results.length ? p.results.reduce((t, r) => t + r.place, 0) / p.results.length : null);
  const avgVP = who => { const v = D.games.filter(g => g.n >= 2 && g.type !== 'Friendly' && g.places[who] != null && g.playerVP && g.playerVP[who] != null).map(g => g.playerVP[who]); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null; };
  const apa = avgPlace(pa), apb = avgPlace(pb), vpa = avgVP(a), vpb = avgVP(b);
  const xa = xpOf(D, a, catalog), xb = xpOf(D, b, catalog), ba = catalog ? badgesFor(D, pa, catalog) : [], bb = catalog ? badgesFor(D, pb, catalog) : [];
  const ea = new Map(ba.filter(x => x.earned).map(x => [x.id, x])), eb = new Map(bb.filter(x => x.earned).map(x => [x.id, x]));
    const rows = [
    { key: 'elo', icon: 'icons/stats/elo.png', label: 'Elo', a: pa.rated ? Math.round(pa.elo) : '—', b: pb.rated ? Math.round(pb.elo) : '—', na: pa.rated ? pa.elo : null, nb: pb.rated ? pb.elo : null, lo: D.E.start - 300 },
    { key: 'peak', icon: 'icons/stats/peak-elo.png', label: 'Peak Elo', a: pa.rated ? Math.round(pa.peak) : '—', b: pb.rated ? Math.round(pb.peak) : '—', na: pa.rated ? pa.peak : null, nb: pb.rated ? pb.peak : null, lo: D.E.start - 300 },
    { key: 'tier', label: 'Tier', a: pa.tier ? pa.tier.name : '—', b: pb.tier ? pb.tier.name : '—' },
    { key: 'level', label: 'Level', a: xa ? xa.level : '—', b: xb ? xb.level : '—', na: xa ? xa.level : null, nb: xb ? xb.level : null },
    { key: 'games', icon: 'icons/stats/rated-games.png', label: 'Rated games', a: pa.rated, b: pb.rated, na: pa.rated, nb: pb.rated },
    { key: 'wins', icon: 'icons/stats/wins.png', label: 'Wins', a: pa.wins, b: pb.wins, na: pa.wins, nb: pb.wins },
    { key: 'winpct', icon: 'icons/stats/wins.png', label: 'Win rate', a: pct(pa.winPct), b: pct(pb.winPct), na: pa.winPct, nb: pb.winPct, hi: 1 },
    { key: 'tophalf', icon: 'icons/stats/top-half-finishes.png', label: 'Top-half finishes', a: pct(pa.topHalf), b: pct(pb.topHalf), na: pa.topHalf, nb: pb.topHalf, hi: 1 },
    { key: 'avgplace', label: 'Average finish', a: one1(apa), b: one1(apb) },
    { key: 'avgvp', label: 'Average VP', a: vpa == null ? '—' : Math.round(vpa), b: vpb == null ? '—' : Math.round(vpb), na: vpa, nb: vpb },
    { key: 'streak', icon: 'icons/stats/win-streak.png', label: 'Best win streak', a: pa.bestStreak, b: pb.bestStreak, na: pa.bestStreak, nb: pb.bestStreak },
    { key: 'titles', icon: 'icons/champion.png', label: 'Season titles', a: pa.titles || 0, b: pb.titles || 0, na: pa.titles || 0, nb: pb.titles || 0 },
    { key: 'lasts', icon: 'icons/stats/last-place-finishes.png', label: 'Last places', a: pa.lasts, b: pb.lasts, na: pa.lasts, nb: pb.lasts },
    { key: 'dry', icon: 'icons/stats/longest-without-win.png', label: 'Longest dry spell', a: pa.bestDry, b: pb.bestDry, na: pa.bestDry, nb: pb.bestDry },
    { key: 'badges', label: 'Badges earned', a: catalog ? ea.size : '—', b: catalog ? eb.size : '—', na: catalog ? ea.size : null, nb: catalog ? eb.size : null },
  ];
  const sets = who => { const m = {}; D.games.forEach(g => { if (g.places[who] != null) g.sets.forEach(s => { m[s] = (m[s] || 0) + 1; }); }); return Object.entries(m).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3); };
  const badges = { shared: [], onlyA: [], onlyB: [] };
  ea.forEach((x, id) => (eb.has(id) ? badges.shared : badges.onlyA).push(x));
  eb.forEach((x, id) => { if (!ea.has(id)) badges.onlyB.push(x); });
  return { a: pa, b: pb, together, rows, sets: { a: sets(a), b: sets(b) }, badges };
}
