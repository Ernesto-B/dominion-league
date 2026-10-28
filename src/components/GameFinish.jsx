import { Fragment } from 'react';
import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';

export const ordered = g => g.names.slice().sort((a, b) => g.places[a] - g.places[b]);
const sep = (g, names, i) => i ? (g.places[names[i]] === g.places[names[i - 1]] ? ' = ' : ' > ') : '';

// Plain-text twin of <GameFinish>, used as the sort key.
export const finishText = g => { const names = ordered(g); return names.map((n, i) => sep(g, names, i) + n).join(''); };

// `me` marks one player's name (the Players page).
// "Ann > Bob = Cy": each name with the tier icon it had right after this game; winners in bold.
export default function GameFinish({ game: g, me = null }) {
  const { D } = usePage();
  const names = ordered(g);
  return names.map((n, i) => {
    const t = D.tierFor(g.snapshot[n]);
    return (
      <Fragment key={n}>
        {sep(g, names, i)}
        {t && <TierIcon id={t.icon} size={16} alt={t.name + ' tier'} />}
        {n === me ? <span className="me-name">{i === 0 || g.places[n] === 1 ? <b>{n}</b> : n}</span> : i === 0 || g.places[n] === 1 ? <b>{n}</b> : n}
      </Fragment>
    );
  });
}
