import { useCatalog } from '../CatalogContext.jsx';
import { cardHref, dominionHref } from '../links.js';
import { presetCardFilters } from '../filterStore.js';
import { formatCost, pileOf, pileMembers, sharedMechanicCards } from '../model.js';
import CostIcons from '../components/Cost.jsx';
import { MECHANICS_NOTE, humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, TypePills, Section, Stat, statusLabel } from '../components/bits.jsx';

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
  const related = sharedMechanicCards(catalog, card);

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
          <p style={{ margin: '10px 0 0' }}><TypePills types={card.types} /></p>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Card facts">
        <Stat value={<CostIcons coins={card.coins} debt={card.debt} overpay={card.overpay} size={40} />} label={card.overpay ? 'cost (can be overpaid)' : 'cost'} title={`Printed cost: ${card.costRaw} (${formatCost(card)})`} />
        <Stat value={card.copies} label="physical copies" />
        <Stat value={pile ? pile.id : card.pileId} label={pile && pile.names > 1 ? 'shared supply pile' : 'supply pile'} />
        <Stat value={card.types.length} label={card.types.length === 1 ? 'printed type' : 'printed types'} />
      </div>

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
                  {m.reviewStatus && <span className="pill" title={m.reviewStatus}>{statusLabel(m.reviewStatus)}</span>}
                  {def && <span className="meta dn-def">{def.definition}</span>}
                </li>
              );
            })}</ul>
          ) : (
            <p style={{ margin: 0 }}>No mechanics are recorded for this card yet — that does <b>not</b> mean it has none.</p>
          )}
          <p className="note" style={{ marginBottom: 0 }}>{MECHANICS_NOTE}</p>
        </div>
      </Section>

      {related.length > 0 && (
        <Section title="Cards recorded with the same mechanics" id="cd-related">
          <div className="tablewrap">
            <table className="plain dn-table">
              <caption className="dn-sr">Cards that share recorded mechanics with {card.name}</caption>
              <thead><tr><th className="l" scope="col">Card</th><th className="l dn-hide-sm" scope="col">Types</th><th className="l" scope="col">Recorded in common</th></tr></thead>
              <tbody>{related.map(r => (
                <tr key={r.card.id}>
                  <td className="l name"><a href={cardHref(r.card.id)}>{r.card.name}</a><br /><small className="meta"><ExpansionBadge name={r.card.expansion} size={14} /></small></td>
                  <td className="l dn-hide-sm"><TypePills types={r.card.types} /></td>
                  <td className="l">{r.shared.map(humanize).join(', ')} <span className="meta">({r.shared.length})</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="note">Based only on tags that are recorded for both cards — a recorded overlap, not a statement about how the cards play.</p>
        </Section>
      )}

      <p className="note">Card text and artwork aren’t part of this collection data, so they aren’t shown here.</p>
    </>
  );
}
