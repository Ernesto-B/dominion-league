import { cardHref, landscapeHref } from '../links.js';
import { displayName, primaryType } from '../kingdom.js';
import CostIcons from './Cost.jsx';

/* One card or landscape of a kingdom as a chip: the card's cost icon and name (edged in the colour of its main printed
   type), or a landscape's name (edged in its landscape colour). A link to its Collection page, unless `onRemove` is given
   (the Add Game dialog), where it is plain text with a remove button. `r` is a resolveKingdom() entry. */
export function KingdomChip({ r, onRemove, plain = false }) {
  if (r.missing) return <span className="dn-kchip dn-kchip-missing" title="No longer in the collection">{r.id}</span>;
  const { obj } = r;
  const tone = r.kind === 'card' ? primaryType(obj) : obj.type;
  const cls = 'dn-kchip' + (tone ? ' t-' + tone.toLowerCase() : '');
  const inner = (
    <>
      {r.kind === 'card' && <CostIcons coins={obj.coins} debt={obj.debt} overpay={obj.overpay} size={20} />}
      <span className="dn-kchip-name">{displayName(obj)}</span>
      {r.onObj && <span className="meta dn-kchip-on">on {displayName(r.onObj)}</span>}
    </>
  );
  if (plain) return <span className={cls}>{inner}</span>;   // text only: for places where a tap must not leave the page (the Game night flow)
  if (onRemove) return (
    <span className={cls}>{inner}<button type="button" className="dn-kchip-x" aria-label={`Remove ${displayName(obj)}`} title={`Remove ${displayName(obj)}`} onClick={onRemove}>×</button></span>
  );
  return <a className={cls} href={r.kind === 'card' ? cardHref(obj.id) : landscapeHref(obj.id)} title={r.kind === 'card' ? displayName(obj) : `${obj.type}: ${obj.name}`}>{inner}</a>;
}
