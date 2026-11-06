import { useState } from 'react';
import { relatedOf } from '../extras.js';
import { artifactHref } from '../links.js';
import CardFace from './CardFace.jsx';
import { useCardImages } from '../cardImages.js';
import { openPeek } from './CardPeek.jsx';
import { ExpansionBadge, Section } from './bits.jsx';

// a picture for the wall (no caption: the card's name is on it); click it for the large picture (an Artifact's dialog links to its page). A card with no picture yet shows its name instead.
function Face({ r, catalog }) {
  const { get } = useCardImages();
  if (!get(r.id)) return <span className="dn-wall-text">{r.name}</span>;
  return <CardFace id={r.id} name={r.name} onOpen={() => openPeek(catalog, { kind: 'extra', id: r.id, name: r.name, href: r.kind === 'artifact' ? artifactHref(r.id) : null })} />;
}

// the cards as a wall of pictures, packed like the game report's kingdom tab (one card on its own is just a bigger picture)
const Wall = ({ items, catalog }) => <ul className={'dn-wall' + (items.length === 1 ? ' one' : '')}>{items.map(r => <li key={r.id}><Face r={r} catalog={catalog} /></li>)}</ul>;

// a pile of different cards (Loot, Ruins, Rewards): closed it is one calm line with a little fan of its cards; opened it lays them all out. Pictures load only once it is open.
export function Pile({ r, catalog }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="dn-pile" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>
        <span className="dn-pile-fan" aria-hidden="true">{r.cards.slice(0, 4).map(c => <CardFace key={c.id} id={c.id} name="" size="thumb" />)}</span>
        <span className="dn-pile-name"><b>{r.name}</b><span className="meta"><ExpansionBadge name={r.expansion} size={14} iconOnly />{r.cards.length} {r.cards.length === 1 ? 'card' : 'different cards'}</span></span>
      </summary>
      {open && <div className="dn-pile-grid"><Wall catalog={catalog} items={r.cards.map(c => ({ kind: 'extra', id: c.id, name: c.name }))} /></div>}
    </details>
  );
}

/* The cards an item's text hands out (Paddock's Horses, Swashbuckler's Treasure Chest, Sack of Loot's Loot): just the pictures: single cards as a wall, piles as one line you can open (and then a wall too). */
export default function GivenCards({ catalog, item, id = 'cd-gives' }) {
  const related = relatedOf(catalog, item);
  if (!related.length) return null;
  const singles = related.filter(r => r.kind !== 'pile'), piles = related.filter(r => r.kind === 'pile');
  return (
    <Section title="Cards it brings into play" id={id}>
      {singles.length > 0 && <Wall catalog={catalog} items={singles} />}
      {piles.map(r => <Pile key={r.id} r={r} catalog={catalog} />)}
    </Section>
  );
}
