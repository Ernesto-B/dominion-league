import SetIcon from '../../components/SetIcon.jsx';
import { expansionMeta, humanize } from '../constants.js';

export function ExpansionBadge({ name, size = 18 }) {
  const m = expansionMeta(name);
  return <span className="dn-exp">{m.icon && <SetIcon name={m.icon} size={size} />}{m.label}</span>;
}

export const TypePills = ({ types }) => <span className="dn-types">{types.map(t => <span className="pill" key={t}>{t}</span>)}</span>;

// a toggle button for a filter value (aria-pressed so assistive tech announces on/off)
export function Chip({ pressed, onClick, children, count, label }) {
  return (
    <button type="button" className="dn-chip" aria-pressed={pressed} onClick={onClick} aria-label={label} title={label}>
      {children}{count != null && <span className="n">{count}</span>}
    </button>
  );
}

export const Section = ({ title, children, id }) => (
  <section aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>
);

export const Stat = ({ value, label, title }) => <div className="stat" title={title}><b>{typeof value === 'number' ? value.toLocaleString() : value}</b><span>{label}</span></div>;

// "official_rulebook_positive_nonexhaustive_batch30" -> "Official rulebook positive nonexhaustive batch30"
export const statusLabel = s => humanize(s);

export function ExternalLink({ href, children }) {
  if (!href || !/^https?:\/\//i.test(href)) return null;   // dataset URLs only; never render anything that isn't plain http(s)
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
