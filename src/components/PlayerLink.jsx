import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';

// Every page is rendered within one group's context (D is already scoped to gid), so a link to
// a player always stays in that same group.
// `at` (an Elo) shows the tier the player had right after a specific game instead of right now,
// so a rank-up is visible as an icon change between two games in their history.
export default function PlayerLink({ name, at }) {
  const { D, gid, hashFor } = usePage();
  const tier = at != null ? D.tierFor(at) : D.byName && D.byName[name] && D.byName[name].tier;
  return (
    <a className="pl" href={hashFor('players', gid, encodeURIComponent(name))}>
      {tier && <TierIcon id={tier.icon} size={20} alt={tier.name + ' tier'} />}<span>{name}</span>
    </a>
  );
}
