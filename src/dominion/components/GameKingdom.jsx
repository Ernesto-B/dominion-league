import { useState } from 'react';
import { useCatalogLoad } from '../CatalogContext.jsx';
import { displayName, resolveKingdom } from '../kingdom.js';
import { useCardImages } from '../cardImages.js';
import { KingdomChip } from './KingdomChips.jsx';
import CardFace from './CardFace.jsx';
import { openPeek } from './CardPeek.jsx';

const VIEW_KEY = 'dl.kingdomview';
const loadView = () => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'pictures'; } catch { return 'pictures'; } };
const cost = r => (r.missing ? 99 : r.obj.coins ?? 0);

/* The pictures view: the cards as small thumbnails by cost then name (a card without a picture is a text chip in the grid), a Plunder Trait as a tag on the card it sits on,
   other landscapes as thumbnails beneath. Tap one to enlarge it. */
function Pictures({ resolved, catalog }) {
  const { get } = useCardImages();
  const cards = resolved.filter(r => r.kind === 'card').sort((a, b) => cost(a) - cost(b) || (a.missing ? 1 : b.missing ? -1 : displayName(a.obj).localeCompare(displayName(b.obj))));
  const here = new Set(cards.map(r => r.id));
  const traitsOn = new Map(), lands = [];
  resolved.filter(r => r.kind === 'landscape').forEach(r => {
    if (r.on && here.has(r.on)) traitsOn.set(r.on, [...(traitsOn.get(r.on) || []), r]);
    else lands.push(r);
  });
  const peek = r => () => openPeek(catalog, r.kind === 'card'
    ? { kind: 'card', s: { key: r.obj.pileKey, name: displayName(r.obj), expansion: r.obj.expansion, cards: [r.obj] } }
    : { kind: 'landscape', l: { landscape: r.obj } });
  const one = (r, extra) => (r.missing || !get(r.obj.id)
    ? <KingdomChip key={r.id} r={r} plain catalog={catalog} compact />
    : <CardFace key={r.id} id={r.obj.id} name={displayName(r.obj)} size="small" onOpen={peek(r)} className={extra} />);
  return (
    <>
      <div className="dn-kgrid">{cards.map(r => (
        <div key={r.id} className="dn-kcell">
          {one(r, 'gal-card')}
          {(traitsOn.get(r.id) || []).map(t => <span key={t.id} className="dn-ktag" title={`${displayName(t.obj)} on ${displayName(r.obj)}`}>{displayName(t.obj)}</span>)}
        </div>
      ))}</div>
      {lands.length > 0 && <div className="dn-kgrid dn-klands">{lands.map(r => <div key={r.id} className="dn-kcell">{one(r, 'gal-card')}</div>)}</div>}
    </>
  );
}

// A game's kingdom, as it appears under an expanded game on the Games page. Loads the catalog (cached for the whole visit)
// the first time one is opened, since the game itself only stores catalog ids. Cards and landscapes are listed A to Z (the pile's name for a
// split pile; an id the catalog no longer knows goes last).
export default function GameKingdom({ items }) {
  const cat = useCatalogLoad();
  const [view, setView] = useState(loadView);
  const { any } = useCardImages();
  const pick = v => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* not remembered */ } };
  if (!items.length) return null;
  let body;
  if (cat.status === 'ready') {
    const resolved = resolveKingdom(cat.catalog, items);
    const name = r => (r.missing ? '\uffff' : displayName(r.obj));
    const az = (a, b) => name(a).localeCompare(name(b));
    const cards = resolved.filter(r => r.kind === 'card').sort(az), lands = resolved.filter(r => r.kind === 'landscape').sort(az);
    body = view === 'pictures' && any ? <Pictures resolved={resolved} catalog={cat.catalog} /> : (
      <>
        {cards.length > 0 && <div className="dn-kchips">{cards.map(r => <KingdomChip key={r.id} r={r} />)}</div>}
        {lands.length > 0 && <div className="dn-kchips">{lands.map(r => <KingdomChip key={r.id} r={r} />)}</div>}
      </>
    );
  } else if (cat.status === 'error') {
    body = <p className="meta" style={{ margin: 0 }}>{items.length} {items.length === 1 ? 'card was' : 'cards were'} logged for this game, but the card list couldn’t be loaded. <button type="button" className="ghost" onClick={cat.retry}>Try again</button></p>;
  } else body = <p className="meta" style={{ margin: 0 }}>Loading the kingdom…</p>;
  return <div className="dn-kingdom" onClick={e => e.stopPropagation()}><p className="meta dn-kingdom-h">Kingdom{any && cat.status === 'ready' && <button type="button" className="linkish dn-kview" onClick={() => pick(view === 'pictures' ? 'list' : 'pictures')}>{view === 'pictures' ? 'Show as list' : 'Show pictures'}</button>}</p>{body}</div>;
}
