// Extra Hall of Fame awards for a finished season, read from seasonStandings() output.
// Pure: no DOM, no engine changes. Regular tables only (friendlies never count toward a season).

// longest run of consecutive Regular wins inside the season, per player (games arrive in play order)
export function seasonAwards(st) {
  if (!st || !st.games) return { streak: null, mostWins: null, bigGain: null };
  const reg = st.games.filter(g => g.type === 'Regular' && g.n >= 2);
  const run = {}, best = {};
  reg.forEach(g => g.names.forEach(n => {
    if (g.places[n] === 1) { run[n] = (run[n] || 0) + 1; if (run[n] > (best[n] || 0)) best[n] = run[n]; } else run[n] = 0;
  }));
  let streak = null;
  Object.entries(best).forEach(([name, value]) => { if (value >= 2 && (!streak || value > streak.value)) streak = { name, value }; });

  let mostWins = null;
  (st.rows || []).forEach(r => { if (r.wins > 0 && (!mostWins || r.wins > mostWins.value)) mostWins = { name: r.name, value: r.wins }; });

  let bigGain = null;
  st.games.forEach(g => {
    if (!g.elo || g.n < 2) return;
    g.names.forEach(n => {
      const e = g.elo[n]; if (!e) return;
      const d = e.after - e.before;
      if (d > 0 && (!bigGain || d > bigGain.value)) bigGain = { name: n, value: d, line: g.line, date: g.date };
    });
  });
  return { streak, mostWins, bigGain };
}
