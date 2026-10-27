import { useCatalog } from '../CatalogContext.jsx';
import { cardHref, dominionHref } from '../links.js';
import { presetCardFilters } from '../filterStore.js';
import { useState } from 'react';
import { formatCost, pileOf, pileMembers, sharedMechanicCards, pageSlice, PAGE_SIZES } from '../model.js';
import CostIcons from '../components/Cost.jsx';
import { humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, TypePills, Section, Stat, CardText, rowLink } from '../components/bits.jsx';

export default function CardDetail({ id }) {
  const { catalog } = useCatalog();
  const card = catalog.cardsById.get(id);
  if (!card) return (
    <>
      <h1>Card not found</h1>
      <EmptyState>There’s no Kingdom card with that id in the collection.</EmptyState>
      <p><a href={dominionHref('cards')}>← Back to Kingdom cards</a></p>
    </>
  );
  const pile = pileOf(catalog, card);
  const related = sharedMechanicCards(catalog, card, { limit: Infinity });

  return (
    <>
      <p style={{ margin: '0 0 12px' }}><a href={dominionHref('cards')}>← All Kingdom cards</a></p>
      <div className="head">
        <div>
          <h1>{card.name}</h1>
          <p className="lede dn-line">
            <ExpansionBadge name={card.expansion} />
            <span className="dn-sep" aria-hidden="true">·</span><span>{card.edition === 'Original (only edition)' ? 'Only edition' : card.edition}</span>
            {card.addedInEdition === true && <><span className="dn-sep" aria-hidden="true">·</span><span>New in Second Edition</span></>}
            {card.previousName && <><span className="dn-sep" aria-hidden="true">·</span><span>Formerly called <b>{card.previousName}</b></span></>}
          </p>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Card facts">
        <Stat value={<CostIcons coins={card.coins} debt={card.debt} overpay={card.overpay} size={40} />} label={card.overpay ? 'cost (can be overpaid)' : 'cost'} title={`Printed cost: ${card.costRaw} (${formatCost(card)})`} />
        <Stat value={card.copies} label="physical copies" />
        <Stat value={pile ? pile.id : card.pileId} label={pile && pile.names > 1 ? 'shared supply pile' : 'supply pile'} />
        <Stat value={<span className="dn-types-lg"><TypePills types={card.types} /></span>} label={`printed types (${new Set(card.types).size})`} />
      </div>

      <Section title="Card text" id="cd-text">
        <div className="builder"><CardText text={card.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>
      </Section>

      <Section title="Supply pile" id="cd-pile">
        <div className="builder">
          {pile && pile.names > 1 ? (
            <>
              <p style={{ marginTop: 0 }}>Part of the <b>{pile.id}</b> pile — {pile.names} card names sharing {pile.copies} physical cards.</p>
              <ul className="dn-plain-list">{pileMembers(catalog, pile).map(c => (
                <li key={c.id}>{c.id === card.id ? <b>{c.name} <span className="meta">(this card)</span></b> : <a href={cardHref(c.id)}>{c.name}</a>} <span className="meta">· {c.copies} {c.copies === 1 ? 'copy' : 'copies'}</span></li>
              ))}</ul>
            </>
          ) : (
            <p style={{ margin: 0 }}>Has its own supply pile of <b>{pile ? pile.copies : card.copies}</b> physical cards.</p>
          )}
        </div>
      </Section>

      <Section title="Recorded mechanics" id="cd-mech">
        <div className="builder">
          {card.mechanics.length ? (
            <ul className="dn-mech-detail">{card.mechanics.map(m => {
              const def = catalog.taxonomy.get(m.id);
              return (
                <li key={m.id}>
                  <a href={dominionHref('cards')} onClick={() => presetCardFilters({ mechanics: [m.id] })} title="See every card recorded with this mechanic"><b>{humanize(m.id)}</b></a>
                  {def && <span className="meta dn-def">{def.definition}</span>}
                </li>
              );
            })}</ul>
          ) : (
            <p style={{ margin: 0 }}>No mechanics are recorded for this card yet — that does <b>not</b> mean it has none.</p>
          )}
        </div>
      </Section>

      {related.length > 0 && <RelatedCards key={card.id} card={card} related={related} />}
    </>
  );
}

/* Every card recorded with a mechanic in common, best match first, paged so a card with hundreds of matches
   stays readable. Keyed by card, so moving to another card starts again on page 1. */
function RelatedCards({ card, related }) {
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const pg = pageSlice(related, page, size);
  return (
    <Section title="Cards recorded with the same mechanics" id="cd-related">
      <div className="tablewrap">
        <table className="plain dn-table">
          <caption className="dn-sr">Cards that share recorded mechanics with {card.name}</caption>
          <thead><tr><th className="l" scope="col">Card</th><th className="l dn-hide-sm" scope="col">Types</th><th className="l" scope="col">Recorded in common</th></tr></thead>
          <tbody>{pg.items.map(r => (
            <tr key={r.card.id} {...rowLink(cardHref(r.card.id))}>
              <td className="l name"><a href={cardHref(r.card.id)}>{r.card.name}</a><br /><small className="meta"><ExpansionBadge name={r.card.expansion} size={14} /></small></td>
              <td className="l dn-hide-sm"><TypePills types={r.card.types} /></td>
              <td className="l">{r.shared.map(humanize).join(', ')} <span className="meta">({r.shared.length})</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="dn-pager">
        <span className="meta" aria-live="polite">Showing {pg.from}–{pg.to} of {pg.total} cards</span>
        <label className="f">Per page <select value={size === Infinity ? 'all' : size} onChange={e => { setSize(e.target.value === 'all' ? Infinity : Number(e.target.value)); setPage(1); }}>{PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}<option value="all">All</option></select></label>
        {pg.pages > 1 && (
          <span className="dn-pager-nav">
            <button type="button" className="ghost" onClick={() => setPage(pg.page - 1)} disabled={pg.page <= 1}>← Previous</button>
            <span className="meta">Page {pg.page} of {pg.pages}</span>
            <button type="button" className="ghost" onClick={() => setPage(pg.page + 1)} disabled={pg.page >= pg.pages}>Next →</button>
          </span>
        )}
      </div>
    </Section>
  );
}
