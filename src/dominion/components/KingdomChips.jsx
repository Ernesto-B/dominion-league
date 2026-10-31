import { cardHref, landscapeHref } from '../links.js';
import { displayName, primaryType, shelfOrder } from '../kingdom.js';
import { expansionMeta } from '../constants.js';
import CostIcons from './Cost.jsx';
import { ExpansionBadge } from './bits.jsx';

/* One card or landscape of a kingdom as a chip: the card's cost icon and name (edged in the colour of its main printed
   type), or a landscape's name (edged in its landscape colour). A link to its Collection page, unless `onRemove` is given
   (the Add Game dialog), where it is plain text with a remove button (and, on a phone, a ⌄ that opens the card's text when `onPeek` is given). `expansion` puts the expansion's icon first, for a table finding the card in its boxes. `dim` greys it out (a filter that does not pick it). `r` is a resolveKingdom() entry. */
export function KingdomChip({ r, onRemove, onPeek, plain = false, expansion = false, dim = false }) {
  if (r.missing) return <span className="dn-kchip dn-kchip-missing" title="No longer in the collection">{r.id}</span>;
  const { obj } = r;
  const tone = r.kind === 'card' ? primaryType(obj) : obj.type;
  const cls = 'dn-kchip' + (tone ? ' t-' + tone.toLowerCase() : '') + (dim ? ' dim' : '');
  const inner = (
    <>
      {expansion && obj.expansion && <ExpansionBadge name={obj.expansion} size={18} iconOnly />}
      {(r.kind === 'card' || obj.coins != null) && <CostIcons coins={obj.coins} debt={obj.debt} overpay={obj.overpay} size={20} />}
      <span className="dn-kchip-name">{displayName(obj)}</span>
      {r.onObj && <span className="meta dn-kchip-on">on {displayName(r.onObj)}</span>}
    </>
  );
  if (plain) return <span className={cls}>{inner}</span>;   // text only: for places where a tap must not leave the page (the Game night flow)
  if (onRemove) return (
    <span className={cls}>{inner}{onPeek && <button type="button" className="dn-kchip-more" aria-label={`Show the text of ${displayName(obj)}`} onClick={onPeek}>⌄</button>}<button type="button" className="dn-kchip-x" aria-label={`Remove ${displayName(obj)}`} title={`Remove ${displayName(obj)}`} onClick={onRemove}>×</button></span>
  );
  return <a className={cls} href={r.kind === 'card' ? cardHref(obj.id) : landscapeHref(obj.id)} title={r.kind === 'card' ? displayName(obj) : `${obj.type}: ${obj.name}`}>{inner}</a>;
}

/* A kingdom laid out like the boxes it came from: one row per expansion (its icon and name), the expansion's cards A to Z beside it, the expansions in the
   collection's order. `entries` is [{ r, node }]: `r` is the resolveKingdom() entry that decides where it goes, `node` what is drawn for it. Entries
   the catalog no longer knows come last, ungrouped. */
export function ShelfGroups({ entries }) {
  const found = entries.filter(e => !e.r.missing).sort((a, b) => shelfOrder(a.r, b.r)), lost = entries.filter(e => e.r.missing);
  const rows = [];
  found.forEach(e => { const last = rows[rows.length - 1]; if (last && last.exp === e.r.obj.expansion) last.list.push(e); else rows.push({ exp: e.r.obj.expansion, list: [e] }); });
  return (
    <div className="dn-shelf">
      {rows.map(row => (
        <div key={row.exp} className="dn-shelf-row">
          <span className="dn-shelf-h"><ExpansionBadge name={row.exp} size={22} iconOnly /><span>{expansionMeta(row.exp).label}</span></span>
          <div className="dn-kchips">{row.list.map(e => e.node)}</div>
        </div>
      ))}
      {lost.length > 0 && <div className="dn-shelf-row"><span className="dn-shelf-h"><span>Not in the collection</span></span><div className="dn-kchips">{lost.map(e => e.node)}</div></div>}
    </div>
  );
}
