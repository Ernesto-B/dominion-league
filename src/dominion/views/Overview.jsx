import { useMemo } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { useListScroll } from '../useUrlFilters.js';
import { writeQuery } from '../urlState.js';
import { chartFromQuery, chartToQuery } from '../sunburst.js';
import { cardsFilterHref, landscapesFilterHref } from '../links.js';
import { PLURAL, humanize } from '../constants.js';
import { Bars, Columns, Donut, HeatChips, Lollipop, Segments, Waffle } from '../components/charts.jsx';
import { Section, Stat, rowLink } from '../components/bits.jsx';
import CostIcons, { PlainDebtIcon } from '../components/Cost.jsx';
import TypeMatrix from '../components/TypeMatrix.jsx';
import SetIcon from '../../components/SetIcon.jsx';

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const TOP = 20;

export default function Overview({ query = '' }) {
  const { catalog, summary: s } = useCatalog();
  useListScroll();   // back from a card opened out of the chart returns you to the same place
  const chart = useMemo(() => chartFromQuery(query), [query]);
  const setChart = patch => writeQuery(chartToQuery({ ...chart, ...patch }));
  const m = s.mechanics;
  const shown = m.frequency.slice(0, TOP), rest = m.frequency.slice(TOP);
  const mechItem = x => ({ key: x.id, label: humanize(x.id), value: x.count, href: cardsFilterHref({ mechanics: [x.id] }) });

  return (
    <>
      <div className="head">
        <div>
          <h1>Collection</h1>
        </div>
      </div>

      <div className="stats" role="group" aria-label="Collection totals">
        <Stat value={s.names} label="Kingdom card names" title="Distinct Kingdom card names" />
        <Stat value={s.piles} label="Kingdom supply piles" title="Piles in the Kingdom supply; a split pile holds two names" />
        <Stat value={s.copies} label="Physical Kingdom cards" title="Every copy in the boxes, counted across all piles" />
        <Stat value={s.expansions} label="Owned expansions" />
        <Stat value={s.landscapes} label="Landscape designs" title="Events, Landmarks, Projects, Ways and Traits — not Kingdom cards" />
        <Stat value={s.artifacts} label="Artifacts" title="Renaissance Artifacts — not Kingdom cards, not landscapes" />
      </div>
      <details className="help">
        <summary>Why the numbers differ</summary>
        <div className="note">
        <p><b>{s.names.toLocaleString()}</b> card names sit in <b>{s.piles.toLocaleString()}</b> supply piles, because {s.multiNamePiles.length} piles hold more than one name
          ({s.multiNamePiles.map(p => `${p.id}: ${p.names}`).join('; ')}) — {s.extraNames} extra names in all.</p>
        <p>The <b>{s.copies.toLocaleString()}</b> physical cards count every copy in those piles.</p>
        <p>The <b>{s.landscapes}</b> landscapes and <b>{s.artifacts}</b> Artifacts are separate components and are <em>not</em> included in the card or pile counts.</p>
        <p>Basic supply cards and anything else outside Kingdom cards, landscapes and Artifacts are not recorded in this catalog, so they are not counted anywhere.</p>
        </div>
      </details>

      <div className="grid2">
        <Section title="Piles by expansion" id="ov-exp">
            <div className="builder">
              <Donut label="Supply piles per expansion" center="piles"
                items={s.byExpansion.map(e => ({ key: e.name, label: e.label, value: e.piles, icon: e.icon && <SetIcon name={e.icon} size={18} />, href: cardsFilterHref({ expansions: [e.name] }) }))} />
            </div>
        </Section>
        <Section title="Printed card types" id="ov-types">
            <div className="builder">
              <Bars label="Kingdom card names per printed type"
                items={s.byType.map(t => ({ key: t.key, label: t.key, value: t.count, href: cardsFilterHref({ types: [t.key] }) }))} />
            </div>
        </Section>
      </div>

      <div className="grid2">
        <Section title="Physical cards by expansion" id="st-copies">
          <div className="builder">
            <Lollipop label="Physical Kingdom cards per expansion"
              items={s.byExpansion.map(e => ({ key: e.name, label: e.label, value: e.copies, icon: e.icon && <SetIcon name={e.icon} size={18} />, href: cardsFilterHref({ expansions: [e.name] }) }))} />
          </div>
        </Section>
        <Section title="Card Cost" id="st-cost">
          <div className="builder">
            <Columns label="Kingdom card names per coin cost" items={[
              ...s.coinCosts.map(c => ({ key: 'c' + c.key, label: <CostIcons coins={c.key} size={24} />, value: c.count, href: cardsFilterHref({ costs: [c.key] }), title: `${c.count} cards cost ${c.key} coins — show them` })),
              { key: 'debt-only', label: <span className="dn-cost" role="img" aria-label="Debt only: cards that cost only Debt" title="Cards that cost only Debt"><PlainDebtIcon size={24} /></span>, value: s.debtOnly.length, href: cardsFilterHref({ debt: 'has' }), title: `${s.debtOnly.length} cards cost only Debt (${s.debtCards.length} cost Debt in all) — show the cards that cost Debt` },
            ]} />
            <p className="note" style={{ marginBottom: 0 }}>
              Out of {s.names} card names. {s.debtOnly.length} cards cost only Debt ({s.debtOnly.map(c => c.name).join(', ')}) and have no coin cost, so they get their own bar rather than counting as $0.
              {' '}{s.debtCards.length - s.debtOnly.length} more costs coins <i>and</i> Debt ({s.debtCards.filter(c => c.coins > 0).map(c => c.name).join(', ')}) and is counted at its coin cost.
              {' '}{s.overpayCards.length} can be overpaid ({s.overpayCards.map(c => c.name).join(', ')}) and are counted at their base cost.
            </p>
          </div>
        </Section>
      </div>

      <Section title="Card types by expansion" id="st-matrix">
        <TypeMatrix matrix={s.typeMatrix} piles={s.piles} cards={catalog.cards} chart={chart} onChart={setChart} />
      </Section>

      <div className="grid2">
        <Section title="Recorded mechanics" id="st-mech">
          <div className="builder">
            <p className="meta" style={{ marginTop: 0 }}>
              {m.relationships.toLocaleString()} recorded mechanic tags across {m.distinct} of the {m.taxonomySize} defined mechanics; {m.cardsWithTag} of {s.names} card names have at least one tag.
              Bars show card names recorded with each mechanic (denominator: {s.names} names), top {Math.min(TOP, m.frequency.length)} of {m.frequency.length}.
            </p>
            <HeatChips label="Card names recorded with each mechanic, most common first" items={shown.map(mechItem)} />
            {rest.length > 0 && (
              <details className="dn-more"><summary>Show the other {rest.length} recorded mechanics</summary>
                <HeatChips label="Remaining recorded mechanics" items={rest.map(mechItem)} max={shown[0].count} />
              </details>
            )}
          </div>
        </Section>
        <Section title="Landscapes" id="st-land">
          <div className="builder">
            <p className="meta" style={{ marginTop: 0 }}>By type</p>
            <Waffle label="Landscape designs per type" unit="landscapes" items={s.landscapeByType.map(t => ({ key: t.key, label: PLURAL[t.key] || t.key, value: t.count, href: landscapesFilterHref({ types: [t.key] }) }))} />
            <p className="meta">By expansion</p>
            <Segments label="Landscape designs per expansion" unit="landscapes" items={s.landscapeByExpansion.map(x => { const e = s.byExpansion.find(b => b.name === x.key); return { key: x.key, label: e ? e.label : x.key, value: x.count, icon: e?.icon && <SetIcon name={e.icon} size={18} />, href: landscapesFilterHref({ expansions: [x.key] }) }; })} />
          </div>
          <p className="note">{s.landscapes} landscape designs, one card each. Not Kingdom cards.</p>
        </Section>
      </div>
    </>
  );
}
