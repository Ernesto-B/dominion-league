import { useCatalog } from '../CatalogContext.jsx';
import { displayName } from '../kingdom.js';
import { humanize } from '../constants.js';
import { hoverHandlers } from './CardHover.jsx';
import CostIcons from './Cost.jsx';
import { ExpansionBadge, LandscapePill, TypePills } from './bits.jsx';
import { cancelKingdomPick, returnFromPick } from '../kingdomPick.js';

/* The banner over a list while a card or landscape is being chosen FOR A KINGDOM (not browsed): what is happening and a way out that changes nothing. When one is being replaced it is
   drawn as a row of the very same table (same cells, same column widths while choosing: `dn-aligned`), so each row below can be read against it. `plays` is the Kingdom cards list's
   played counts (or null), which decides whether that table has a Played column to line up with. */
export default function KingdomPickBar({ target, plays = null }) {
  const { catalog } = useCatalog();
  const card = target.kind === 'card';
  const what = card ? 'card' : 'landscape';
  const obj = target.labelId && (card ? catalog.cardsById.get(target.labelId) : catalog.landscapesById.get(target.labelId));
  return (
    <div className="dn-kpbar" role="region" aria-label={`Choosing a ${what} for your kingdom`}>
      <div className="dn-kpbar-top">
        <b className="dn-kpbar-t">{target.label ? `Choose a ${what} to replace` : `Choose a ${what} to add to your kingdom`}</b>
        <button type="button" className="ghost" onClick={() => { cancelKingdomPick(); returnFromPick(target); }}>Cancel</button>
      </div>
      {target.label && (obj ? (
        <table className="plain dn-table dn-browse dn-aligned dn-kpbar-table" aria-label={`The ${what} being replaced`}>
          <tbody><tr {...hoverHandlers(obj.id)}>
            <td className="l"><ExpansionBadge name={obj.expansion} size={18} /></td>
            <td className="l name">{card ? displayName(obj) : obj.name}</td>
            <td className="l">{card ? <TypePills types={obj.types} /> : <LandscapePill type={obj.type} />}</td>
            <td className="dn-cost-cell">{card || obj.coins != null ? <CostIcons coins={obj.coins} debt={obj.debt} overpay={obj.overpay} size={26} /> : <span className="dn-nocost" role="img" aria-label="No cost" />}</td>
            <td className="l dn-hide-sm">{card ? obj.sharedPile || '—' : obj.trigger ? humanize(obj.trigger) : '—'}</td>
            {card && plays && <td className="dn-hide-sm">{plays.get(obj.pileKey)?.games || '—'}</td>}
          </tr></tbody>
        </table>
      ) : <p className="dn-kpbar-top meta">{target.label}</p>)}
    </div>
  );
}
