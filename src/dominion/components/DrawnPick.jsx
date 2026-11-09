import { useEffect, useRef } from 'react';
import CardFace from './CardFace.jsx';
import CostIcons from './Cost.jsx';
import { ExpansionBadge, LandscapePill, TypePills } from './bits.jsx';
import { displayName } from '../kingdom.js';
import { finishKingdomPick } from '../kingdomPick.js';

/* What "Random card / Random landscape" drew while a card is being CHOSEN for a kingdom: shown right in the list, with the picture when there is one,
   so the viewer decides (use it, or draw another) instead of being sent back with a card they never saw. The draw is `item`; `onAgain` draws again. */
export default function DrawnPick({ item, kind, replacing, onAgain, times = null, who = '' }) {   // times: how often it was played (null: no kingdoms logged yet), for `who` or the whole group; never played earns the "New" corner, as in a game report
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.scrollIntoView) ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [item.id]);
  const card = kind === 'card', name = card ? displayName(item) : item.name;
  return (
    <section className="dn-drawn" ref={ref} aria-label={`The ${kind} drawn at random`} aria-live="polite">
      <div className="dn-drawn-face" title={times === 0 ? `Never played ${who ? `by ${who}` : 'in the group'}` : undefined}><CardFace id={item.id} name={name} size="big" />{times === 0 && <span className="gr-newtag left">New</span>}</div>
      <div className="dn-drawn-body">
        <p className="meta dn-drawn-k">Drawn at random</p>
        <h2 className="dn-drawn-n">{name}</h2>
        <p className="dn-drawn-m"><ExpansionBadge name={item.expansion} size={18} /> {card ? <TypePills types={item.types} /> : <LandscapePill type={item.type} />} {(card || item.coins != null) && <CostIcons coins={item.coins} debt={item.debt} overpay={item.overpay} size={24} />}</p>
        <div className="dn-drawn-btns">
          <button type="button" onClick={() => finishKingdomPick(item.id)}><span className="dn-drawn-lbl">{replacing ? `Use ${name}` : `Add ${name}`}</span></button>
          <button type="button" className="ghost" onClick={onAgain}>Draw another</button>
        </div>
      </div>
    </section>
  );
}
