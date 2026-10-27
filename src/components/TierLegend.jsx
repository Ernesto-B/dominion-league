import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';

export const tierRange = (tiers, i) => {
  const t = tiers[i], hi = tiers[i + 1] ? tiers[i + 1].min - 1 : null;
  return t.min === -Infinity ? `under ${tiers[i + 1].min}` : hi == null ? `${t.min}+` : `${t.min}–${hi}`;
};

export default function TierLegend() {
  const { D } = usePage();
  return (
    <div className="tiers" role="list" aria-label="Rank tiers">
      {D.tiers.map((t, i) => (
        <div className="tierkey" role="listitem" key={t.name}>
          <TierIcon id={t.icon} size={40} alt="" /><b>{t.name}</b><span>{tierRange(D.tiers, i)}</span>
        </div>
      ))}
      <div className="tierkey" role="listitem"><TierIcon id="champion" size={40} alt="" /><b>Champion</b><span>won a season</span></div>
    </div>
  );
}
