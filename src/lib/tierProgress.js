/* How far along the way to the next tier a rating is, 0 to 1. The lowest tier has no floor of its own, so its bar starts a fixed
   distance below the first threshold (250 Elo, 875 with Knight at 1125): a player who has lost a few games still sees a little progress. */
export const LOWEST_TIER_SPAN = 250;

export function tierProgress(elo, tier, nextTier) {
  const upper = nextTier.min;
  const lower = tier.min == null || tier.min === -Infinity ? upper - LOWEST_TIER_SPAN : tier.min;
  return Math.max(0, Math.min(1, (elo - lower) / (upper - lower)));
}
