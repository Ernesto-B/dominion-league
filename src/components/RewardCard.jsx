import { TIERS } from '../lib/achievements.js';
import { XP } from '../lib/xp.js';

const LABEL = Object.fromEntries(TIERS.map(t => [t.id, t.label]));
const kicker = b => (b.secret ? 'Secret badge found' : `Badge unlocked · ${LABEL[b.tier] || 'Common'}`);

/* A thing just won, shown as a small reward card: a badge (tier-coloured, the harder ones glint once as they land) or a level. `who` names the
   player when several are listed together. `i` staggers a group so they arrive one after another. */
export function BadgeReward({ b, who, i = 0 }) {
  return (
    <li className={'reward td-' + (b.tier || 'common')} style={{ '--i': i }}>
      <span className="reward-kicker">{who ? `${who} · ` : ''}{kicker(b)}</span>
      <b>{b.name}</b>
      <small>{b.hint}</small>
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
