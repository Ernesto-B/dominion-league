import { useState } from 'react';
import { usePage } from '../PageContext.js';
import CardFace from '../dominion/components/CardFace.jsx';
import PlayAgain from '../dominion/components/PlayAgain.jsx';
import { openPeek } from '../dominion/components/CardPeek.jsx';
import { useCardImages } from '../dominion/cardImages.js';
import { displayName } from '../dominion/kingdom.js';
import { winners } from '../dominion/playStats.js';

const PAGE = 12;

/* The Games page's "Kingdoms" view: the games in the list (so the Season, Type, Player and Set filters apply), newest first, each as a tile with its kingdom as small cards (two rows of five), its
   landscapes under them, who won, and two ways on: the game's report and, for an admin, "Play again". Tap a card to see it larger. Only games with a kingdom logged are shown; the pictures are the
   small thumbnails, loaded as a tile nears the screen. */
export default function KingdomWall({ games }) {
  const { catalog } = usePage();
  const [shown, setShown] = useState(PAGE);
  if (!catalog) return <p className="loading">Loading the cards…</p>;
  const withKingdom = games.filter(g => g.kingdom && g.kingdom.length && g.n >= 2);
  if (!withKingdom.length) return <p className="empty">None of these games has a kingdom logged. Games started from Game night record one.</p>;
  return (
    <>
      <ul className="gal">{withKingdom.slice(0, shown).map(g => <Tile key={g.line} g={g} catalog={catalog} />)}</ul>
      {withKingdom.length > shown && <p className="gal-more"><button type="button" className="ghost" onClick={() => setShown(n => n + PAGE)}>Show more ({withKingdom.length - shown} more)</button></p>}
    </>
  );
}

function Tile({ g, catalog }) {
  const { gid, hashFor } = usePage();
  const { get } = useCardImages();
  const cards = g.kingdom.filter(k => k.kind === 'card').map(k => catalog.cardsById.get(k.id)).filter(Boolean);
  const lands = g.kingdom.filter(k => k.kind === 'landscape').map(k => catalog.landscapesById.get(k.id)).filter(Boolean);
  const peek = (c, land) => () => openPeek(catalog, land ? { kind: 'landscape', l: { landscape: c } } : { kind: 'card', s: { key: c.pileKey, name: displayName(c), expansion: c.expansion, cards: [c] } });
  const one = (c, land) => (get(c.id)
    ? <CardFace key={c.id} id={c.id} name={displayName(c)} size="thumb" onOpen={peek(c, land)} className="gal-card" />
    : <button key={c.id} type="button" className="gal-noimg" onClick={peek(c, land)}>{displayName(c)}</button>);
  const report = hashFor('games', gid, g.line);
  return (
    <li className="gal-tile">
      <div className="gal-head">
        <a href={report} title="Open this game’s report"><b>{g.date}</b></a>
        <span className="meta">won by {winners(g).join(' & ')}</span>
      </div>
      <div className="gal-cards">{cards.map(c => one(c, false))}</div>
      {lands.length > 0 && <div className="gal-lands">{lands.map(l => one(l, true))}</div>}
      <div className="gal-foot">
        <a href={report}>Report →</a>
        <PlayAgain game={g} />
      </div>
    </li>
  );
}
