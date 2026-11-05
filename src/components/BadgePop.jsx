import { TIERS } from '../lib/achievements.js';
import { short } from '../lib/format.js';

const LABEL = { ...Object.fromEntries(TIERS.map(t => [t.id, t.label])), secret: 'Secret' };

// The hover popup for a badge: its name, its rarity in the rarity's own colour, the requirement, and when it was earned.
// Popup content is drawn outside PageContext (see PopLayer), so everything it needs comes in as props.
export default function BadgePop({ badge: b, hint, progress = null }) {   // `progress`: a line like "3 of 5" for a badge still being worked on
  return (
    <div className="popdesc badgepop">
      <b>{b.name}</b>
      {LABEL[b.tier] && <span className="poprare" style={{ color: `var(--td-${b.tier})` }}>{LABEL[b.tier]}</span>}
      <span>{hint}</span>
      {b.earned && b.earned.date ? <small>Earned {short(b.earned.date)}</small> : null}
      {!b.earned && progress ? <small>{progress}</small> : null}
    </div>
  );
}
