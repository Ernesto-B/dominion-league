import { useCatalogLoad } from '../CatalogContext.jsx';
import { displayName, resolveKingdom } from '../kingdom.js';
import { KingdomChip } from './KingdomChips.jsx';

// A game's kingdom, as it appears under an expanded game on the Games page. Loads the catalog (cached for the whole visit)
// the first time one is opened, since the game itself only stores catalog ids. Cards and landscapes are listed A to Z (the pile's name for a
// split pile; an id the catalog no longer knows goes last).
export default function GameKingdom({ items }) {
  const cat = useCatalogLoad();
  if (!items.length) return null;
  let body;
  if (cat.status === 'ready') {
    const resolved = resolveKingdom(cat.catalog, items);
    const name = r => (r.missing ? '\uffff' : displayName(r.obj));
    const az = (a, b) => name(a).localeCompare(name(b));
    const cards = resolved.filter(r => r.kind === 'card').sort(az), lands = resolved.filter(r => r.kind === 'landscape').sort(az);
    body = (
      <>
        {cards.length > 0 && <div className="dn-kchips">{cards.map(r => <KingdomChip key={r.id} r={r} />)}</div>}
        {lands.length > 0 && <div className="dn-kchips">{lands.map(r => <KingdomChip key={r.id} r={r} />)}</div>}
      </>
    );
  } else if (cat.status === 'error') {
    body = <p className="meta" style={{ margin: 0 }}>{items.length} {items.length === 1 ? 'card was' : 'cards were'} logged for this game, but the card list couldn’t be loaded. <button type="button" className="ghost" onClick={cat.retry}>Try again</button></p>;
  } else body = <p className="meta" style={{ margin: 0 }}>Loading the kingdom…</p>;
  return <div className="dn-kingdom" onClick={e => e.stopPropagation()}><p className="meta dn-kingdom-h">Kingdom</p>{body}</div>;
}
