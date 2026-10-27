import SetIcon from '../../components/SetIcon.jsx';
import { expansionMeta, humanize } from '../constants.js';
import { coinIconSrc } from './Cost.jsx';

export function ExpansionBadge({ name, size = 18 }) {
  const m = expansionMeta(name);
  return <span className="dn-exp">{m.icon && <SetIcon name={m.icon} size={size} />}{m.label}</span>;
}

// the class (pill t-action, ...) lets style.css tint the six main types; every other type keeps the plain pill
// a landscape's type as one pill, tinted like the printed-type pills (see t-event ... t-landmark in style.css)
export const LandscapePill = ({ type }) => <span className={`pill t-${type.toLowerCase()}`}>{type}</span>;

export const TypePills = ({ types }) => <span className="dn-types">{types.map(t => <span className={`pill t-${t.toLowerCase()}`} key={t}>{t}</span>)}</span>;

// a toggle button for a filter value (aria-pressed so assistive tech announces on/off)
export function Chip({ pressed, onClick, children, count, label, tone }) {
  return (
    <button type="button" className={tone ? `dn-chip t-${tone}` : 'dn-chip'} aria-pressed={pressed} onClick={onClick} aria-label={label} title={label}>
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

/* Printed card text. Paragraph breaks come from the data (blank lines), line breaks within a paragraph are kept
   by CSS (white-space:pre-line). The data writes symbols as words: "$5" becomes the owner's coin icon (0-10),
   a bare "$" the blank coin, "Debt" the blank Debt icon and "VP" the victory-point shield. Anything without
   artwork (a number beyond $10) stays as the plain text the data has. */
const SYMBOL = /(\$\d*|\bDebt\b|\bVP\b)/;
const symbolIcon = part => {
  const coin = /^\$(\d*)$/.exec(part);
  if (coin) { const src = coin[1] === '' ? 'icons/costs/coin.png' : coinIconSrc(Number(coin[1])); return src && { src, cls: 'dn-cardtext-coin' }; }
  if (part === 'Debt') return { src: 'icons/costs/debt.png', cls: 'dn-cardtext-coin' };
  if (part === 'VP') return { src: 'icons/costs/vp.png', cls: 'dn-cardtext-vp' };
  return null;
};
/* An inline image is a line-break opportunity of its own, so "+$" could wrap between the "+" and the icon.
   Each icon is therefore wrapped (nowrap) together with the glued-on token just before it ("+", "1", "40"). */
const withSymbols = para => {
  const parts = para.split(SYMBOL);
  return parts.map((part, i) => {
    const icon = symbolIcon(part);
    if (icon) {
      const glued = /\S+$/.exec(parts[i - 1] || '')?.[0] || '';
      return <span key={i} className="dn-nobr">{glued}<img className={icon.cls} src={icon.src} alt={part} /></span>;
    }
    const next = symbolIcon(parts[i + 1] || '');
    return next ? part.replace(/\S+$/, '') : part;
  });
};

export function CardText({ text, hasAnyText }) {
  if (!text) return (
    <p style={{ margin: 0 }}>{hasAnyText ? 'No card text is recorded for this card.' : 'Card text isn’t available yet — it hasn’t been loaded into the database.'}</p>
  );
  return <div className="dn-cardtext">{text.split(/\n{2,}/).map((para, i) => <p key={i}>{withSymbols(para)}</p>)}</div>;
}

/* Makes a whole table row a link to `href` (the name cell keeps its real <a>, which stays the keyboard/screen-reader
   target and still handles ctrl/cmd-click). A click anywhere else on the row follows it, unless the click was on
   another interactive element or finished a text selection. */
export const rowLink = href => ({
  className: 'dn-rowlink',
  onClick: e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.target.closest('a, button, input, select, textarea')) return;
    if (String(window.getSelection?.() || '')) return;
    window.location.hash = href;
  },
});
