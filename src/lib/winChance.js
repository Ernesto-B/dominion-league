/* Each seated player's chance of finishing first, from their Elo alone: the usual Elo odds taken across the whole table, a player's weight is 10^(Elo / 400) and their chance is that share of the
   total. Equal ratings give an even split; 400 points of rating is ten times the weight. A rough guide for balancing a table, not a promise: the site's own ratings move by points, not by this formula. */
export function winChances(elos) {
  const w = elos.map(e => Math.pow(10, (Number(e) || 0) / 400)), total = w.reduce((a, b) => a + b, 0);
  return total ? w.map(x => x / total) : elos.map(() => 0);
}
