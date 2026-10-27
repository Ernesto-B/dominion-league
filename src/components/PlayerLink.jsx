import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';

// Every page is rendered within one group's context (D is already scoped to gid), so a link to
// a player always stays in that same group.
export default function PlayerLink({ name }) {
  const { D, gid, hashFor } = usePage();
  const tier = D.byName && D.byName[name] && D.byName[name].tier;
  return (
    <a className="pl" href={hashFor('players', gid, encodeURIComponent(name))}>
      {tier && <TierIcon id={tier.icon} size={20} alt={tier.name + ' tier'} />}<span>{name}</span>
    </a>
  );
}
