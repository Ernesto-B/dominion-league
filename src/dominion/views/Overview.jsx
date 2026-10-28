import { useMemo } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { useListScroll } from '../useUrlFilters.js';
import { writeQuery } from '../urlState.js';
import { chartFromQuery, chartToQuery } from '../sunburst.js';
import { cardsFilterHref, landscapesFilterHref } from '../links.js';
import { PLURAL, humanize } from '../constants.js';
import BarChart from '../components/BarChart.jsx';
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
        <div>
          <Section title="Card names by expansion" id="ov-exp">
            <div className="builder">
              <BarChart label="Kingdom card names per expansion"
                items={s.byExpansion.map(e => ({ key: e.name, label: e.label, value: e.names, icon: e.icon && <SetIcon name={e.icon} size={18} />, href: cardsFilterHref({ expansions: [e.name] }) }))} />
            </div>
          </Section>
        </div>
        <div>
          <Section title="Printed card types" id="ov-types">
            <div className="builder">
              <BarChart label="Kingdom card names per printed type"
                items={s.byType.map(t => ({ key: t.key, label: t.key, value: t.count, href: cardsFilterHref({ types: [t.key] }) }))} />
            </div>
          </Section>
        </div>
      </div>

      <div className="grid2">
        <Section title="Physical cards by expansion" id="st-copies">
          <div className="builder">
            <BarChart label="Physical Kingdom cards per expansion"
              items={s.byExpansion.map(e => ({ key: e.name, label: e.label, value: e.copies, icon: e.icon && <SetIcon name={e.icon} size={18} /> }))} />
          </div>
        </Section>
        <Section title="Supply piles" id="st-piles">
          <div className="builder">
            <p className="meta" style={{ marginTop: 0 }}>Piles by how many card names they hold</p>
            <BarChart label="Supply piles by number of card names" items={s.pileSizes.map(p => ({ key: 'n' + p.key, label: p.key === 1 ? 'One name' : `${p.key} names`, value: p.count }))} />
            <p className="meta">Piles by physical cards in the pile</p>
            <BarChart label="Supply piles by number of physical cards" items={s.pileCopies.map(p => ({ key: 'c' + p.key, label: `${p.key} ${p.key === 1 ? 'card' : 'cards'}`, value: p.count }))} />
            <p className="note" style={{ marginBottom: 0 }}>Out of {s.piles} piles. A pile with several names is a split or mixed pile (Knights, Castles, and the split piles).</p>
          </div>
        </Section>
      </div>

      <Section title="Card types by expansion" id="st-matrix">
        <TypeMatrix matrix={s.typeMatrix} names={s.names} cards={catalog.cards} chart={chart} onChart={setChart} />
      </Section>

      <div className="grid2">
        <Section title="Most common type combinations" id="st-combos">
          <div className="tablewrap"><table className="plain dn-table">
            <caption className="dn-sr">The most common combinations of printed types on a single card</caption>
            <thead><tr><th className="l" scope="col">Printed together</th><th scope="col">Card names</th><th scope="col">Share of {s.names}</th></tr></thead>
            <tbody>{s.combos.slice(0, 10).map(c => {
              // a row counts cards whose printed types are EXACTLY this combination, so the link filters the same way
              const href = cardsFilterHref({ types: c.key.split(' + '), typeMode: 'exact' });
              return <tr key={c.key} {...rowLink(href)}><td className="l"><a href={href} title={`Show the ${c.count} cards that are exactly ${c.key}`}>{c.key}</a></td><td>{c.count}</td><td>{pct(c.count, s.names)}</td></tr>;
            })}</tbody>
          </table></div>
          <p className="note">{s.multiType} of {s.names} card names have more than one printed type.</p>
        </Section>
        <Section title="Landscapes" id="st-land">
          <div className="builder">
            <p className="meta" style={{ marginTop: 0 }}>By type</p>
            <BarChart label="Landscape designs per type" items={s.landscapeByType.map(t => ({ key: t.key, label: PLURAL[t.key] || t.key, value: t.count, href: landscapesFilterHref({ types: [t.key] }) }))} />
            <p className="meta">By expansion</p>
            <BarChart label="Landscape designs per expansion" items={s.landscapeByExpansion.map(x => { const e = s.byExpansion.find(b => b.name === x.key); return { key: x.key, label: e ? e.label : x.key, value: x.count, icon: e?.icon && <SetIcon name={e.icon} size={18} /> }; })} />
            <p className="note" style={{ marginBottom: 0 }}>{s.landscapes} landscape designs, one card each. Not Kingdom cards.</p>
          </div>
        </Section>
      </div>

      <div className="grid2">
        <Section title="Coin cost" id="st-cost">
          <div className="builder">
            <BarChart label="Kingdom card names per coin cost" labelWidth="34px" items={[
              ...s.coinCosts.map(c => ({ key: 'c' + c.key, label: <CostIcons coins={c.key} size={24} />, value: c.count, href: cardsFilterHref({ costs: [c.key] }) })),
              { key: 'debt-only', label: <span className="dn-cost" role="img" aria-label="Debt only: cards that cost only Debt" title="Cards that cost only Debt"><PlainDebtIcon size={24} /></span>, value: s.debtOnly.length },
            ]} />
            <p className="note" style={{ marginBottom: 0 }}>
              Out of {s.names} card names. {s.debtOnly.length} cards cost only Debt ({s.debtOnly.map(c => c.name).join(', ')}) and have no coin cost, so they get their own bar rather than counting as $0.
              {' '}{s.debtCards.length - s.debtOnly.length} more costs coins <i>and</i> Debt ({s.debtCards.filter(c => c.coins > 0).map(c => c.name).join(', ')}) and is counted at its coin cost.
              {' '}{s.overpayCards.length} can be overpaid ({s.overpayCards.map(c => c.name).join(', ')}) and are counted at their base cost.
            </p>
          </div>
        </Section>

        <Section title="Recorded mechanics" id="st-mech">
          <div className="builder">
            <p className="meta" style={{ marginTop: 0 }}>
              {m.relationships.toLocaleString()} recorded mechanic tags across {m.distinct} of the {m.taxonomySize} defined mechanics; {m.cardsWithTag} of {s.names} card names have at least one tag.
              Bars show card names recorded with each mechanic (denominator: {s.names} names), top {Math.min(TOP, m.frequency.length)} of {m.frequency.length}.
            </p>
            <BarChart label="Card names recorded with each mechanic, most common first" items={shown.map(mechItem)} />
            {rest.length > 0 && (
              <details className="dn-more"><summary>Show the other {rest.length} recorded mechanics</summary>
                <BarChart label="Remaining recorded mechanics" items={rest.map(mechItem)} max={shown[0].count} />
              </details>
            )}
          </div>
        </Section>
      </div>

      <Section title="Data checks" id="st-checks">
        <ul className="dn-checks">
          <li className={s.checks.copiesAgree ? 'ok' : 'bad'}>{s.checks.copiesAgree ? '✓' : '✗'} Physical cards add up the same way over cards and over piles ({s.copies.toLocaleString()} / {s.copiesFromCards.toLocaleString()}).</li>
          <li className={s.checks.pileNamesAgree ? 'ok' : 'bad'}>{s.checks.pileNamesAgree ? '✓' : '✗'} Every pile lists as many card names as it says it holds.</li>
          <li className={s.checks.relationshipsAgree ? 'ok' : 'bad'}>{s.checks.relationshipsAgree ? '✓' : '✗'} The {m.relationships.toLocaleString()} mechanic tags on the cards match the {(m.expectedRelationships ?? m.relationships).toLocaleString()} rows in the database.</li>
        </ul>
      </Section>
    </>
  );
}
