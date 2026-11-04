import { useCatalog } from '../CatalogContext.jsx';
import { cardHref, dominionHref, cardsFilterHref, compareHref } from '../links.js';
import { DEFAULT_CARD_FILTERS, browseCards, cardFiltersFromQuery, cardFiltersToQuery, neighbors, pickRandom } from '../filters.js';
import ItemNav, { ItemSteps } from '../components/ItemNav.jsx';
import { PageShortcuts } from '../../components/Shortcuts.jsx';
import { keepScrollOnce } from '../../lib/navMemory.js';
import { hasTrail, popTrail, pushTrail } from '../../lib/randomTrail.js';
import PlayHistory from '../components/PlayHistory.jsx';
import { useLeagueGames } from '../useLeagueGames.js';
import { useState } from 'react';
import { usePager } from '../components/Pager.jsx';
import { formatCost, pileOf, pileMembers, sharedMechanicCards } from '../model.js';
import CardFace from '../components/CardFace.jsx';
import { useCardImages } from '../cardImages.js';
import { hoverHandlers } from '../components/CardHover.jsx';
import CostIcons from '../components/Cost.jsx';
import { humanize } from '../constants.js';
import { EmptyState } from '../components/States.jsx';
import { ExpansionBadge, TypePills, Section, Stat, CardText, rowLink } from '../components/bits.jsx';

export default function CardDetail({ id, query = '' }) {
  const { catalog } = useCatalog();
  const lg = useLeagueGames();
  const { get: picture } = useCardImages();
  const card = catalog.cardsById.get(id);
  if (!card) return (
    <>
      <h1>Card not found</h1>
      <EmptyState>There’s no Kingdom card with that id in the collection.</EmptyState>
      <p><a href={dominionHref('cards', null, query)}>← Back to Kingdom cards</a></p>
    </>
  );
  const pile = pileOf(catalog, card);
  const pictured = !!picture(card.id);   // with the card itself on screen, its cost, types and text below would only repeat it: the facts row goes, the text folds away
  const related = sharedMechanicCards(catalog, card, { limit: Infinity });   // only cards recorded with two or more of the same mechanics; none, no table
  // Previous/Next/Random walk the list the viewer came from (its filters travel in the URL); a card that list doesn't
  // contain (a stale or hand-made link) falls back to every card, A–Z
  const filters = cardFiltersFromQuery(query);
  const ctx = { plays: lg?.stats?.piles };   // so Previous/Next follow the same order as a list sorted by times played
  let list = browseCards(catalog.cards, filters, ctx), qs = cardFiltersToQuery(filters);
  if (!list.some(c => c.id === card.id)) { list = browseCards(catalog.cards, DEFAULT_CARD_FILTERS, ctx); qs = ''; }
  const plays = lg?.stats ? lg.stats.piles.get(card.pileKey) : undefined;
  const nav = neighbors(list, card.id);
  const random = () => { const c = pickRandom(list, card.id); if (c) { pushTrail('card', card.id); window.location.hash = cardHref(c.id, qs); } };

  // the recorded mechanics, as a list (beside the card's picture when it has one, else in a section of its own below)
  const mechList = (
    <>
          {card.mechanics.length ? (
            <ul className="dn-mech-detail">{card.mechanics.map(m => {
              const def = catalog.taxonomy.get(m.id);
              return (
                <li key={m.id}>
                  <a href={cardsFilterHref({ mechanics: [m.id] })} title="See every card recorded with this mechanic"><b>{humanize(m.id)}</b></a>
                  {def && <span className="meta dn-def">{def.definition}</span>}
                </li>
              );
            })}</ul>
          ) : (
            <p style={{ margin: 0 }}>No mechanics are recorded for this card yet — that does <b>not</b> mean it has none.</p>
          )}
    </>
  );
  return (
    <>
      <PageShortcuts bindings={[
        ...(nav.prev ? [{ key: 'ArrowLeft', label: 'Previous card', run: () => { keepScrollOnce(); window.location.hash = cardHref(nav.prev.id, qs); } }] : []),
        ...(nav.next ? [{ key: 'ArrowRight', label: 'Next card', run: () => { keepScrollOnce(); window.location.hash = cardHref(nav.next.id, qs); } }] : []),
        { key: 'r', label: 'Random card', run: () => { keepScrollOnce(); random(); } },
        ...(hasTrail('card', card.id) ? [{ key: 'r', shift: true, label: 'Back to the last random card', run: () => { const id = popTrail('card', card.id); if (id) { keepScrollOnce(); window.location.hash = cardHref(id, qs); } } }] : []),
        { key: 'b', label: 'Back to the list', run: () => { window.location.hash = dominionHref('cards', null, qs); } },
      ]} />
      <ItemNav backHref={dominionHref('cards', null, qs)} backLabel="← All Kingdom cards" nav={nav} hrefFor={c => cardHref(c.id, qs)} onRandom={random} randomLabel="Random card" compareHref={compareHref([card.id])} />
      <div className="dn-hero">
      <div className="head">
        <div>
          <h1>{card.name}</h1>
          <p className="lede dn-line">
            <ExpansionBadge name={card.expansion} />
            {card.previousName && <><span className="dn-sep" aria-hidden="true">·</span><span>Formerly called <b>{card.previousName}</b></span></>}
          </p>
        </div>
      </div>
      <CardFace id={card.id} name={card.name} className="hero" />
      <ItemSteps below nav={nav} hrefFor={c => cardHref(c.id, qs)} onRandom={random} randomLabel="Random card" compareHref={compareHref([card.id])} />   {/* phone only: under the picture, where a thumb reaches */}

      {pictured && (
        <div className="dn-hero-side">
          <div><h2 className="dn-side-h">Recorded mechanics</h2>{mechList}</div>
          <details className="dn-textfold"><summary>Show card text</summary><CardText text={card.text} hasAnyText={catalog.meta.textRecordCount > 0} /></details>
        </div>
      )}
      {!pictured && <div className="stats" role="group" aria-label="Card facts">
        <Stat value={<CostIcons coins={card.coins} debt={card.debt} overpay={card.overpay} size={40} />} label={card.overpay ? 'cost (can be overpaid)' : 'cost'} title={`Printed cost: ${card.costRaw} (${formatCost(card)})`} />
        <Stat value={card.copies} label="physical copies" />
        <Stat value={pile ? pile.id : card.pileId} label={pile && pile.names > 1 ? 'shared supply pile' : 'supply pile'} />
        <Stat value={<span className="dn-types-lg"><TypePills types={card.types} /></span>} label={`printed types (${new Set(card.types).size})`} />
        {lg && lg.stats && <Stat value={plays ? plays.games : 0} label={plays && plays.games === 1 ? 'logged game' : 'logged games'} title="Logged games this card was in" />}
      </div>}
      </div>

      {!pictured && (
      <Section title="Card text" id="cd-text">
        <div className="builder"><CardText text={card.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>
      </Section>
      )}

      {lg && lg.stats && (
        <Section title="In our games" id="cd-plays">
          <div className="builder"><PlayHistory entry={plays} lg={lg} /></div>
        </Section>
      )}

      {/* a pile of one name (all 10 or 12 copies are this card) has nothing to say beyond "physical copies"; only a shared pile (Knights, Castles, the split piles) is worth a box */}
      {pile && pile.names > 1 && (
        <Section title="Supply pile" id="cd-pile">
          <div className="builder">
            <p style={{ marginTop: 0 }}>Part of the <b>{pile.id}</b> pile — {pile.names} card names sharing {pile.copies} physical cards.</p>
              <ul className="dn-plain-list">{pileMembers(catalog, pile).map(c => (
                <li key={c.id}>{c.id === card.id ? <b>{c.name} <span className="meta">(this card)</span></b> : <a href={cardHref(c.id)}>{c.name}</a>} <span className="meta">· {c.copies} {c.copies === 1 ? 'copy' : 'copies'}</span></li>
              ))}</ul>
          </div>
        </Section>
      )}

      {!pictured && (
      <Section title="Recorded mechanics" id="cd-mech">
        <div className="builder">
          {card.mechanics.length ? (
            <ul className="dn-mech-detail">{card.mechanics.map(m => {
              const def = catalog.taxonomy.get(m.id);
              return (
                <li key={m.id}>
                  <a href={cardsFilterHref({ mechanics: [m.id] })} title="See every card recorded with this mechanic"><b>{humanize(m.id)}</b></a>
                  {def && <span className="meta dn-def">{def.definition}</span>}
                </li>
              );
            })}</ul>
          ) : (
            <p style={{ margin: 0 }}>No mechanics are recorded for this card yet — that does <b>not</b> mean it has none.</p>
          )}
        </div>
      </Section>
      )}

      <RelatedCards key={card.id} card={card} related={related} />
    </>
  );
}

/* Every card recorded with two or more of the same mechanics, best match first, paged so a card with hundreds of matches
   stays readable. The table is always there: a card nothing else matches twice gets a line saying so, not a gap. Keyed by card, so moving to another card starts again on page 1. */
function RelatedCards({ card, related }) {
  const { pg, pager } = usePager(related);
  return (
    <Section title="Cards recorded with the same mechanics" id="cd-related">
      <div className="tablewrap">
        <table className="plain dn-table">
          <caption className="dn-sr">Cards that share recorded mechanics with {card.name}</caption>
          <thead><tr><th className="l" scope="col">Card</th><th className="l dn-hide-sm" scope="col">Types</th><th className="l" scope="col">Recorded in common</th></tr></thead>
          <tbody>{!pg.items.length && <tr className="dn-emptyrow"><td colSpan={3} className="l">No other card shares 2 or more recorded mechanics with {card.name}.</td></tr>}
          {pg.items.map(r => (
            <tr key={r.card.id} {...rowLink(cardHref(r.card.id))} {...hoverHandlers(r.card.id)}>
              <td className="l name"><a href={cardHref(r.card.id)}>{r.card.name}</a><br /><small className="meta"><ExpansionBadge name={r.card.expansion} size={14} /></small></td>
              <td className="l dn-hide-sm"><TypePills types={r.card.types} /></td>
              <td className="l">{r.shared.map(humanize).join(', ')} <span className="meta">({r.shared.length})</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {related.length > 0 && pager}
    </Section>
  );
}
