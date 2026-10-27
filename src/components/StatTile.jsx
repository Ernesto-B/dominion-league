import { setIconPath, SET_NAMES } from '../lib/sets.js';
import HoverPopup from './HoverPopup.jsx';
import SetIcon from './SetIcon.jsx';

export const PopText = ({ text, extra }) => <div className="popdesc">{text}{extra ? <b>{extra}</b> : null}</div>;

// A .stat tile with an optional leading category icon and an optional hover explanation. Icons are
// unconditional even when the stat is 0 — a tile that hides its icon at zero looks broken.
export default function StatTile({ icon, big, label, iconClass, popup }) {
  return (
    <HoverPopup content={popup}>
      <div className={'stat' + (icon ? ' has-icon' : '')}>
        {icon && <img className={'staticon' + (iconClass ? ' ' + iconClass : '')} src={icon} alt="" />}
        <div className="stat-body"><b>{big}</b><span>{label}</span></div>
      </div>
    </HoverPopup>
  );
}

// Just the set's icon and a caption — no count (a raw table count isn't a meaningful stat).
export function SetStatTile({ setName, label, popup }) {
  if (!setName) return null;
  const src = setIconPath(setName);
  return (
    <HoverPopup content={popup}>
      <div className="stat seticon-stat">{src && <img className="seticon" src={src} alt={setName} />}<span>{label}: {setName}</span></div>
    </HoverPopup>
  );
}

// Every currently-owned set (not just ones this player used), so the popup shows what's missing as
// much as what's played. A set unticked in Admin > Sets drops out, as it does from the Add Game picker.
// Popup content is rendered by <PopLayer> outside the page's PageContext, so everything it needs
// arrives as props — it must not call usePage().
export function SetBreakdown({ setCounts, enabledSets }) {
  return SET_NAMES.filter(nm => enabledSets.has(nm)).sort((a, b) => (setCounts[b] || 0) - (setCounts[a] || 0) || a.localeCompare(b)).map(nm => {
    const n = setCounts[nm] || 0;
    return <div className="poprow" key={nm}><SetIcon name={nm} size={20} /><b>{nm}</b><span>{`${n} game${n === 1 ? '' : 's'}`}</span></div>;
  });
}
