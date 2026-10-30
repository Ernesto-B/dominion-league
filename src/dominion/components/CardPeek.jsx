import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cardHref, landscapeHref } from '../links.js';
import { CardText, ExpansionBadge, LandscapePill, TypePills } from './bits.jsx';
import CostIcons from './Cost.jsx';

/* One card's (or landscape's) text in a small dialog over the page, so it never changes the size of the cards around it: the phone can be
   passed round for everyone to read it (the ⌄ buttons that open it are a phone feature). Escape, a tap outside it or Close shuts it.
   `openPeek(catalog, peek)` opens it from anywhere; `peek` is { kind: 'card', s: { name, cards, expansion } } (a pile or a single card) or
   { kind: 'landscape', l: { landscape } }. Its state lives HERE, in one layer for the whole app (<PeekLayer /> in App.jsx), and not in the screen that has the
   ⌄ buttons: opening and closing it then redraws nothing but the dialog, never a grid of cards, so a tap right after closing is never kept waiting. */
let current = null;
const listeners = new Set();
const publish = v => { current = v; listeners.forEach(f => f(v)); };
export const openPeek = (catalog, peek) => publish({ catalog, peek });
const closePeek = () => publish(null);

export default function PeekLayer() {
  const [shown, setShown] = useState(current);
  useEffect(() => {
    listeners.add(setShown); setShown(current);
    window.addEventListener('hashchange', closePeek);   // following its "Card page" link, or any move to another page, shuts it
    return () => { listeners.delete(setShown); window.removeEventListener('hashchange', closePeek); };
  }, []);
  return shown ? <Peek catalog={shown.catalog} peek={shown.peek} onClose={closePeek} /> : null;
}

function Peek({ catalog, peek, onClose }) {
  const closeBtn = useRef(null);
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    closeBtn.current?.focus({ preventScroll: true });   // for a keyboard; never scrolls the page behind
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const has = catalog.meta.textRecordCount > 0;
  const body = peek.kind === 'card'
    ? { title: peek.s.name, cards: peek.s.cards, head: <><div className="dn-rz-cost"><CostIcons coins={peek.s.cards[0].coins} debt={peek.s.cards[0].debt} overpay={peek.s.cards[0].overpay} size={30} /></div><TypePills types={[...new Set(peek.s.cards.flatMap(c => c.types))]} /><ExpansionBadge name={peek.s.expansion} size={14} /></> }
    : { title: peek.l.landscape.name, cards: [peek.l.landscape], head: <><LandscapePill type={peek.l.landscape.type} /><ExpansionBadge name={peek.l.landscape.expansion} size={14} /></> };
  // in a portal on <body>: inside the page's frosted panels a fixed overlay would only cover the panel, and a tap outside it would miss
  return createPortal(
    <div className="dn-peek" role="presentation" onClick={onClose}>
      <div className="dn-peek-box" role="dialog" aria-modal="true" aria-label={`${body.title}, card text`} onClick={e => e.stopPropagation()}>
        <h3>{body.title}</h3>
        <div className="dn-peek-head">{body.head}</div>
        {body.cards.map(c => <div key={c.id} className="dn-rz-text">{body.cards.length > 1 && <p className="meta dn-rz-textname">{c.name}</p>}<CardText text={c.text} hasAnyText={has} /></div>)}
        <p className="meta" style={{ margin: '10px 0 0' }}><a href={peek.kind === 'card' ? cardHref(peek.s.cards[0].id) : landscapeHref(peek.l.landscape.id)}>{peek.kind === 'card' ? 'Card page' : 'Landscape page'}</a></p>
        <button type="button" ref={closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}
