import { usePage } from '../PageContext.js';
import { usePins } from '../usePins.js';
import { MAX_PINS, pinnedBadges } from '../lib/achievements.js';
import { badgesFor } from '../lib/xp.js';
import { tabQuery } from '../lib/profileTabs.js';

/* A "+" chip beside the pinned badges on the viewer's own page, like one more title waiting to be filled: it opens the Badges tab already showing only the earned badges,
   where a Pin pill sits on each. Nothing on anyone else's page, and nothing once all three places are used (the Overview's "Edit pins" still changes them). */
export default function PinAdd({ p }) {
  const { D, gid, hashFor, catalog } = usePage();
  const { mine, ids } = usePins(p.name);
  if (!mine) return null;
  // count the pins that actually show (an id saved for a badge that is no longer earned, or no longer exists, takes no place)
  const shown = pinnedBadges(ids, p.rated ? badgesFor(D, p, catalog) : []).length;
  if (shown >= MAX_PINS) return null;
  return <a className="pin-add" href={hashFor('players', gid, encodeURIComponent(p.name)) + tabQuery('badges', { show: 'owned' })} aria-label="Pin a badge beside your name" title="Pin a badge">+</a>;
}
