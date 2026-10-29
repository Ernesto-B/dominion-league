import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import { usePins } from '../usePins.js';
import HoverPopup from './HoverPopup.jsx';
import { badgeIcon } from './badgeIcon.jsx';
import { badgesFor } from '../lib/xp.js';
import { pinnedBadges, TIERS } from '../lib/achievements.js';
import { short } from '../lib/format.js';

const LABEL = { ...Object.fromEntries(TIERS.map(t => [t.id, t.label])), secret: 'Secret' };

/* The badges a player chose to show off, as chips beside their name (the tier colours the edge; epic and legendary glow). Hovering or focusing
   a chip says what it is and when it was earned. Nothing at all when they haven't pinned any. The popup is plain markup: it has no page context. */
export default function PinnedBadges({ p }) {
  const { D, catalog } = usePage();
  const { ids } = usePins(p.name);
  const list = useMemo(() => (ids.length && p.rated ? badgesFor(D, p, catalog) : []), [ids, p, D, catalog]);
  const pins = pinnedBadges(ids, list);
  if (!pins.length) return null;
  return (
    <div className="pinned" role="list" aria-label="Pinned badges">
      {pins.map(b => (
        <HoverPopup key={b.id} className="pin-wrap" content={
          <div className="popdesc"><b>{b.name}</b>{LABEL[b.tier] ? ` · ${LABEL[b.tier]}` : ''}<br />{b.hint}{b.earned && b.earned.date ? <><br />Earned {short(b.earned.date)}</> : null}</div>
        }>
          <span role="listitem" className={'pin-chip td-' + b.tier}><span className="pin-ico" aria-hidden="true">{badgeIcon(b, 18)}</span>{b.name}</span>
        </HoverPopup>
      ))}
    </div>
  );
}
