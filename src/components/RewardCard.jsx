import { TIERS, viewHint } from '../lib/achievements.js';
import { XP } from '../lib/xp.js';

const LABEL = Object.fromEntries(TIERS.map(t => [t.id, t.label]));
// the rarity word wears its own tint (the same colours as the difficulty dots on the Player page), the rest of the line stays quiet
const kicker = b => (b.secret ? 'A hidden legend has been uncovered' : <>Badge unlocked · <em className="reward-rarity" style={{ color: `var(--td-${b.tier || 'common'})` }}>{LABEL[b.tier] || 'Common'}</em></>);

/* A thing just won, shown as a small reward card: a badge (tier-coloured, the harder ones glint once as they land; a secret one is a full-width banner that says a
   hidden legend was uncovered, and shows its rule only when `mine`) or a level. `who` names the
   player when several are listed together. `i` staggers a group so they arrive one after another. */
export function BadgeReward({ b, who, i = 0, mine = true }) {
  return (
    <li className={'reward td-' + (b.tier || 'common')} style={{ '--i': i }}>
      <span className="reward-kicker">{who ? `${who} · ` : ''}{kicker(b)}</span>
      <b>{b.name}</b>
      {b.secret && b.quote ? <small className="badge-quote">“{b.quote}”</small> : null}
      <small>{viewHint(b, mine)}</small>
      <span className="reward-xp">+{XP.badge + (b.bonus || 0)} XP</span>
    </li>
  );
}

export function LevelReward({ level, from, who, i = 0 }) {
  return (
    <li className="reward reward-lvl" style={{ '--i': i }}>
      <span className="reward-kicker">{who ? `${who} · ` : ''}Level up</span>
      <b>Level {level}</b>
      {from != null && from < level ? <small>up from level {from}</small> : null}
    </li>
  );
}
