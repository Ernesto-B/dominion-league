import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';

// Just a player's current tier icon (nothing if they don't have one).
export default function NameIcon({ name, size }) {
  const { D } = usePage();
  const tier = D.byName && D.byName[name] && D.byName[name].tier;
  return tier ? <TierIcon id={tier.icon} size={size || 18} alt={tier.name + ' tier'} /> : null;
}
