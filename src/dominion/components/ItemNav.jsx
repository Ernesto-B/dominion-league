import { keepScrollOnce } from '../../lib/navMemory.js';

/* Previous / "n of N" / Next / Random for a card or landscape page. `nav` is neighbors() of the list the viewer came from.
   It is drawn twice on a detail page: in the strip at the top (a wide screen), and, on a phone, right under the card's picture, where a thumb reaches it
   (`below`; CSS shows one and hides the other). Each press keeps your scroll position (lib/navMemory.js keepScrollOnce). */
export function ItemSteps({ nav, hrefFor, onRandom, randomLabel, below = false, compareHref = null }) {
  const step = (item, label, rel) => (item
    ? <a href={hrefFor(item)} rel={rel} title={item.name} onClick={keepScrollOnce}>{label}</a>
    : <span className="meta dn-itemnav-off" aria-disabled="true">{label}</span>);
  return (
    <span className={'dn-itemnav-steps' + (below ? ' below' : '')}>
      <span className="dn-s-prev">{step(nav.prev, '← Previous', 'prev')}</span>
      <span className="meta dn-s-count">{nav.index + 1} of {nav.total}</span>
      <span className="dn-s-next">{step(nav.next, 'Next →', 'next')}</span>
      <button type="button" className="ghost dn-s-rand" onClick={() => { keepScrollOnce(); onRandom(); }}>{randomLabel}</button>
      {compareHref && <a className="dn-s-cmp" href={compareHref}>Compare</a>}
    </span>
  );
}

/* The strip at the top of a card/landscape page: back to the list (filters kept) and, on a wide screen, the steps. */
export default function ItemNav({ backHref, backLabel, ...steps }) {
  return (
    <div className="dn-itemnav">
      <a href={backHref}>{backLabel}</a>
      <ItemSteps {...steps} />
    </div>
  );
}
