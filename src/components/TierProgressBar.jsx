import { usePage } from '../PageContext.js';
import HoverPopup from './HoverPopup.jsx';
import TierIcon from './TierIcon.jsx';
import { tierProgress } from '../lib/tierProgress.js';
import { tierRange } from './TierLegend.jsx';

const TierAnchor = ({ tier }) => (
  <div className="tieranchor">{tier && <TierIcon id={tier.icon} size={28} alt={tier.name} />}<span>{tier ? tier.name : 'Top tier'}</span></div>
);

// Progress from the player's tier to the next; hovering lists every tier's Elo range.
export default function TierProgressBar({ p }) {
  const { D } = usePage();
  if (!p.tier) return null;
  const rows = D.tiers.map((t, i) => (
    <div className="tierpoprow" key={t.name}><TierIcon id={t.icon} size={22} alt={t.name} /><b>{t.name}</b><span>{tierRange(D.tiers, i)}</span></div>
  ));
  let fill, label, to;
  if (!p.nextTier) { fill = <i style={{ width: '100%', background: 'var(--brass)' }}></i>; label = 'Top tier reached'; to = null; }
  else {
    const pct = tierProgress(p.elo, p.tier, p.nextTier.tier) * 100;
    fill = <i style={{ width: pct + '%' }}></i>; label = `${Math.round(pct)}% of the way to ${p.nextTier.tier.name}`; to = p.nextTier.tier;
  }
  return (
    <HoverPopup content={rows} className="tierbarwrap">
      <div className="tierbar"><TierAnchor tier={p.tier} /><div className="progress" role="img" aria-label={label}>{fill}</div><TierAnchor tier={to} /></div>
    </HoverPopup>
  );
}
