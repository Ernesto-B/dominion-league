import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import { usePins } from '../usePins.js';
import { badgesFor } from '../lib/xp.js';
import { pinnedBadges, TIERS } from '../lib/achievements.js';

const LABEL = Object.fromEntries(TIERS.map(t => [t.id, t.label]));

/* The badges a player chose to show off: one quiet line under their name, nothing at all when they haven't pinned any. */
export default function PinnedBadges({ p }) {
  const { D, catalog } = usePage();
  const { ids } = usePins(p.name);
  const list = useMemo(() => (ids.length && p.rated ? badgesFor(D, p, catalog) : []), [ids, p, D, catalog]);
  const pins = pinnedBadges(ids, list);
  if (!pins.length) return null;
  return (
    <p className="pinned" aria-label="Pinned badges">
      {pins.map(b => <span key={b.id} className="pinned-b" title={`${LABEL[b.tier] || ''}: ${b.hint}`}><i className={'tier-dot td-' + b.tier}></i>{b.name}</span>)}
    </p>
  );
}
