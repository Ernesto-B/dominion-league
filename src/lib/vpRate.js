// Victory points per minute for one player: their VP over the minutes of the games that were timed (Game night's clock, or a game's saved minutes).
// A game with no clock, or without that player's VP, says nothing about pace and is left out. The rate is total VP / total minutes (a long game
// weighs what it lasted, not the same as a short one). `bySet` repeats it for the games that used each expansion; a game counts under every expansion it had.
export function vpPerMin(D, name) {
  const total = { vp: 0, min: 0, games: 0 }, by = {};
  D.games.forEach(g => {
    if (g.places[name] == null || !(g.minutes > 0)) return;
    const vp = g.playerVP && g.playerVP[name] != null && g.playerVP[name] !== '' ? Number(g.playerVP[name]) : NaN;
    if (!Number.isFinite(vp)) return;
    total.vp += vp; total.min += g.minutes; total.games++;
    (g.sets || []).forEach(s => { const e = by[s] || (by[s] = { vp: 0, min: 0, games: 0 }); e.vp += vp; e.min += g.minutes; e.games++; });
  });
  const rate = e => (e.min > 0 ? e.vp / e.min : null);
  return { rate: rate(total), games: total.games, bySet: Object.fromEntries(Object.entries(by).map(([s, e]) => [s, { rate: rate(e), games: e.games }])) };
}
