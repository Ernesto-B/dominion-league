import { DEFAULT_OPTIONS, optionsToParams } from '../dominion/randomizer.js';

/* "Roll a kingdom to chase this badge": for a badge a kingdom can help with, the Randomizer options that aim at it. Only badges the randomizer's rules can actually steer are listed (a count of
   expansions, or "every card is from a different one", cannot be forced, so those have none). Pure; the Next up tiles turn it into a link to the Randomizer. */
const LAND = { 'changing-tides': 'Trait', 'architect-of-victory': 'Project', 'the-wayfinder': 'Way', 'master-strategist': 'Landmark', 'turning-point': 'Event' };
const CHASE = {
  'war-zone': { minAttacks: 5 }, 'trial-by-fire': { minAttacks: 3 },
  'peaceful-realm': { maxAttacks: 0 }, 'the-pacifist': { maxAttacks: 0 },
  'gold-rush': { themes: ['treasure'] },
  'gilded-hall': { costSpread: 'high' },
  'the-great-divide': { costSpread: 'barbell' },
  'cheap-tricks': { maxCost: 4 }, 'fire-sale': { maxCost: 3 },
  'shifting-realities': { landscapes: 2 }, 'fortune-favors': { landscapes: 3 }, 'master-of-fate': { landscapes: 3 },
  'landscape-connoisseur': { landscapes: 2, favor: true }, 'beyond-the-horizon': { landscapes: 2, favor: true },
  'collector': { favor: true }, 'grand-archivist': { favor: true }, 'master-of-all-realms': { favor: true },
};
// `badge` is the full badge: an expansion step ("play with more than half of X's cards") carries the expansion it is for, and a roll of just that expansion, leaning to cards not seen yet, aims at it
export function chaseOptions(id, badge) {
  if (badge && badge.expansion) return { expansions: [badge.expansion], favor: true };
  if (LAND[id]) return { landscapes: 1, landscapeTypes: [LAND[id]] };
  return CHASE[id] || null;
}
// the Randomizer address that rolls with those options (null when the randomizer cannot steer that badge)
export function chaseHref(id, badge) {
  const o = chaseOptions(id, badge);
  if (!o) return null;
  const q = optionsToParams({ ...DEFAULT_OPTIONS, ...o }).toString();
  return '#/dominion/randomizer' + (q ? '?' + q : '');
}
