/* The "steady" rating system the ladder uses when config.elo.model is 'steady' (src/lib/engine.js calls finishScores). The original
   pairwise Elo is still in the engine for model 'classic'.

   What it is for (the league's own rules: finishing in the top half matters most, then winning; one bad night shouldn't wipe out a good
   one; ratings shouldn't lurch around; the long-run trend is upward without anyone being safe):
     - a modest K once a player is established, so one game moves you tens of points, not a hundred;
     - the result of a finish isn't "how many players you beat" but a points-per-finish table that pays for the top half first and the
       win second (finishScores);
     - the exact middle of an odd table (3rd of 5, 2nd of 3) is an average result, so it earns half the top-half bonus and lands near zero
       instead of being punished like the bottom half;
     - the table pays out `target` of the points on average (0.50 = a closed, zero-sum ladder; a little more = a slow, deliberate rise),
       the same at every table size, so the drift is a dial you set.
   What is kept from Elo: you still gain more for beating stronger players (the expected-score part lives in the engine). */

export const DEFAULT_STEADY = Object.freeze({
  linear: 0.45,     // how much plain finishing position counts
  topHalf: 0.30,    // the bonus for finishing in the top half (the first floor(n / 2) places)
  middle: 0.5,      // the share of that bonus the exact middle of an odd table gets
  win: 0.15,        // the extra bonus for winning
  target: 0.52,     // the average share of the points a table pays out
});

const topCredit = (pos, n, w) => (pos <= Math.floor(n / 2) ? 1 : n % 2 === 1 && pos === (n + 1) / 2 ? w.middle : 0);
const raw = (pos, n, w) => w.linear * (n - pos) / (n - 1) + w.topHalf * topCredit(pos, n, w) + w.win * (pos === 1 ? 1 : 0);

/* The points-per-finish for everyone at one table, each between 0 and about 1 (the expected result of an average player is 0.5).
   `places` is each player's place (1 = first; tied players share a number). A tied group shares the average of the positions it
   covers, and the whole table is shifted so it pays `target` on average. Only the weights in `params` that exist are used. */
export function finishScores(places, params = {}) {
  const w = { ...DEFAULT_STEADY };
  Object.keys(DEFAULT_STEADY).forEach(k => { if (params[k] != null) w[k] = params[k]; });
  const n = places.length;
  const byPos = Array.from({ length: n }, (_, i) => raw(i + 1, n, w));
  const mean = byPos.reduce((a, b) => a + b, 0) / n, shift = w.target - mean;
  return places.map(pl => {
    const tied = places.filter(x => x === pl).length;                 // positions pl .. pl + tied - 1
    let s = 0; for (let i = 0; i < tied; i++) s += byPos[pl - 1 + i];
    return s / tied + shift;
  });
}

/* What each finishing place pays at an EVEN table (everyone on the same rating, everyone established), for the given K. */
export const steadyPayout = (n, params = {}) => finishScores(Array.from({ length: n }, (_, i) => i + 1), params).map(s => (params.k ?? 100) * (s - 0.5));
