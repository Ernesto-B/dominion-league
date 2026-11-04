import { useCatalog } from '../CatalogContext.jsx';
import { MAX_COMPARE, cardsFilterHref, compareHref, compareIdsFromQuery, cardHref, dominionHref } from '../links.js';
import { humanize } from '../constants.js';
import CostIcons from '../components/Cost.jsx';
import { startPicking } from '../compareBasket.js';
import CardFace from '../components/CardFace.jsx';
import { useCardImages } from '../cardImages.js';
import { ExpansionBadge, TypePills, CardText } from '../components/bits.jsx';

/* Up to four Kingdom cards side by side, as pictures (or as text where a card has no picture yet). The cards live in the address (#/dominion/compare?cards=a,b), so Back, a bookmark
   and a shared link all work, and nothing here needs state. Each card's recorded mechanics are marked by how many of the cards share them: on every card, on some, or only on that one.
   Mechanic tags are positive-only (a missing tag is NOT a "no"), so the wording says "recorded" and never claims a card lacks a mechanic. */
export default function CardCompare({ query = '' }) {
  const { catalog } = useCatalog();
  const { get: picture } = useCardImages();
  const cards = compareIdsFromQuery(query).map(id => catalog.cardsById.get(id)).filter(Boolean);
  const ids = cards.map(c => c.id);
  const count = new Map();   // mechanic id -> how many of these cards carry it
  cards.forEach(c => c.mechanicIds.forEach(m => count.set(m, (count.get(m) || 0) + 1)));
  const shareOf = m => (cards.length < 2 ? 'solo' : count.get(m) === cards.length ? 'all' : count.get(m) > 1 ? 'some' : 'only');
  const common = cards.length >= 2 ? [...count].filter(([, n]) => n === cards.length).map(([m]) => m) : [];

  return (
    <>
      <div className="head"><div><h1>Compare cards</h1><p className="lede">Read up to {MAX_COMPARE} Kingdom cards side by side.</p></div>
        <a className="dn-cmp-back" href={dominionHref('cards')}>← All Kingdom cards</a></div>

      {cards.length >= 2 && (
        <div className="dn-cmp-sum" role="group" aria-label="Recorded mechanics all these cards share">
          <b>Recorded in common</b>
          {common.length
            ? <span className="dn-cmp-tags">{common.map(m => <a key={m} className="dn-mtag all" href={cardsFilterHref({ mechanics: [m] })}>{humanize(m)}</a>)}</span>
            : <span className="meta">No recorded mechanic is on all {cards.length} cards.</span>}
          <small className="meta dn-cmp-key"><i className="dn-mtag all" /> on every card <i className="dn-mtag some" /> on some <i className="dn-mtag only" /> only on one</small>
        </div>
      )}

      {/* always four places: the cards chosen, then dashed empty slots that open the Kingdom cards list in pick mode, with these cards already picked */}
      {(
        <div className="dn-cmp-grid">
          {cards.map(c => (
            <article className="dn-cmp-col" key={c.id} aria-label={c.name}>
              <header>
                <h2><a href={cardHref(c.id)}>{c.name}</a></h2>
                <a className="dn-cmp-x" href={compareHref(ids.filter(i => i !== c.id))} aria-label={`Remove ${c.name} from the comparison`} title="Remove">✕</a>
              </header>
              {picture(c.id)
                ? <CardFace id={c.id} name={c.name} className="big" />   // the picture carries the cost, types and text, so nothing repeats it
                : <>
                    <div className="dn-cmp-facts">
                      <ExpansionBadge name={c.expansion} size={18} />
                      <CostIcons coins={c.coins} debt={c.debt} overpay={c.overpay} size={26} />
                      <TypePills types={c.types} />
                    </div>
                    <CardText text={c.text} hasAnyText={catalog.meta.textRecordCount > 0} />
                  </>}
              <h3 className="dn-cmp-h">Recorded mechanics</h3>
              {c.mechanicIds.length
                ? <span className="dn-cmp-tags">{c.mechanicIds.map(m => <a key={m} className={'dn-mtag ' + shareOf(m)} href={cardsFilterHref({ mechanics: [m] })} title={catalog.taxonomy.get(m)?.definition}>{humanize(m)}</a>)}</span>
                : <p className="meta" style={{ margin: 0 }}>None recorded yet. That doesn’t mean it has none.</p>}
            </article>
          ))}
          {Array.from({ length: MAX_COMPARE - cards.length }, (_, k) => (
            <button type="button" key={'slot' + k} className="dn-cmp-slot" onClick={() => { startPicking(ids); window.location.hash = dominionHref('cards'); }}>
              <span aria-hidden="true">+</span>Add a card
            </button>
          ))}
        </div>
      )}
    </>
  );
}
