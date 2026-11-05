import { PROFILE_TABS, tabQuery } from '../lib/profileTabs.js';

/* Overview / Badges / History under a player's header. Plain links to the same page with another ?tab=, so the browser's Back button walks through the tabs. `base` is the player's address. */
export default function ProfileTabs({ tab, base, badgeCount = null }) {
  return (
    <nav className="gr-tabs pt-tabs" aria-label="Sections of this player's page">
      {PROFILE_TABS.map(([id, label]) => (
        <a key={id} href={base + tabQuery(id)} aria-current={tab === id ? 'page' : undefined}>
          {label}{id === 'badges' && badgeCount != null ? <span className="gr-count">{badgeCount}</span> : null}
        </a>
      ))}
    </nav>
  );
}
