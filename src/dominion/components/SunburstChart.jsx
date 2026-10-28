import { useMemo, useState } from 'react';
import { arcLength, arcPath, centroid, layoutSunburst, shortName, sunburstData, typeVar, zoomData } from '../sunburst.js';
import { cardHref, cardsFilterHref } from '../links.js';
import { formatCost } from '../model.js';
import { setIconPath } from '../../lib/sets.js';

const SIZE = 560, C = SIZE / 2, R = { hole: 80, in0: 84, in1: 160, out0: 164, out1: 266 };
const PAD = 0.012;

/* The sunburst view of "Card types by expansion" (see sunburst.js), in two levels.

   Overview: two rings from the whole table, arcs coloured by printed type (the type-pill colours); the ring that isn't
   type-coloured is a quiet neutral. Click an inner arc — an expansion, or a printed type, depending on the inner ring chosen —
   to ZOOM into it: the chart is redrawn for just that one thing, down to the individual cards. Click the middle, the back
   button or press Esc to come back out.

   Hover or focus an arc to read it in the middle. In the overview, click (or tap) an outer arc to pin it, which puts a
   "show these cards" link under the chart. A CARD in the zoomed view is itself a link to that card's page.
   The table stays the exact, sortable view. */
export default function SunburstChart({ matrix, by, cards = [], zoom = null, onZoom = () => {} }) {
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  const [only, setOnly] = useState(null);         // a printed type the legend is isolating

  const data = useMemo(() => (zoom != null && cards.length ? zoomData(matrix, cards, by, zoom) : null) || sunburstData(matrix, by), [matrix, cards, by, zoom]);
  const groups = useMemo(() => layoutSunburst(data), [data]);
  const zoomed = !!data.zoom;
  const goZoom = k => onZoom(k);   // the zoom lives in the URL (see TypeMatrix); the chart is re-keyed on it, which also clears pin / hover / isolate
  const shown = hover ?? pinned;

  const find = key => { for (const g of groups) { if (g.key === key) return { group: g }; for (const k of g.children) if (k.key === key) return { group: g, leaf: k }; } return null; };
  const hit = shown && find(shown);
  const dim = x => only && x.type !== only;

  // what an arc says about itself: the figure and two lines for the middle, a sentence, and (when pinned) a link
  const describe = h => {
    if (!h) return null;
    const { group: g, leaf: k } = h;
    if (zoomed) {
      if (k) return { big: formatCost({ coins: k.coins, debt: k.debt }), l1: shortName(k.name, 18), l2: k.type, text: `${k.name} · ${k.expansion} · ${k.type} — click to open` };
      return { big: g.count, l1: by === 'expansion' ? g.type : g.label, l2: by === 'expansion' ? `of ${g.of} names` : g.type, text: `${g.label} · ${g.type}: ${g.count} of ${g.of} card names`, href: cardsFilterHref({ expansions: [g.expansion], types: [g.type] }), link: `Show these ${g.count} cards` };
    }
    if (by === 'expansion') return k
      ? { big: k.count, l1: k.label, l2: k.type, text: `${k.label} · ${k.type}: ${k.count} of ${k.of} card names`, href: cardsFilterHref({ expansions: [k.expansion], types: [k.type] }), link: `Show these ${k.count} cards` }
      : { big: g.count, l1: g.label, l2: 'card names', text: `${g.label}: ${g.count} card names. Click to zoom in`, href: cardsFilterHref({ expansions: [g.expansion] }), link: `Show ${g.label} cards` };
    return k
      ? { big: k.count, l1: k.type, l2: k.label, text: `${k.type} · ${k.label}: ${k.count} of ${k.of} card names`, href: cardsFilterHref({ expansions: [k.expansion], types: [k.type] }), link: `Show these ${k.count} cards` }
      : { big: g.count, l1: g.type, l2: 'card names', text: `${g.type}: ${g.count} card names. Click to zoom in`, href: cardsFilterHref({ types: [g.type] }), link: `Show all ${g.count} ${g.type} cards` };
  };
  const info = describe(hit);

  const keys = fn => e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  /* one segment. `typed`: coloured by its printed type, else the neutral of the ring that isn't. `tier` softens the outer
     ring (and alternates the inner one when a single type fills the whole chart), so neighbours stay distinct. */
  const arc = (x, r0, r1, label, { typed, tier, act, href }) => {
    const press = act ?? (() => setPinned(p => (p === x.key ? null : x.key)));
    const cls = 'dn-sb-arc' + (typed ? '' : ' dn-sb-neutral') + (tier ? ' ' + tier : '') + (shown === x.key ? ' on' : '') + (dim(x) ? ' dim' : '');
    const style = typed ? { fill: `rgb(var(${typeVar(x.type)}))` } : undefined;
    const hovers = { onMouseEnter: () => setHover(x.key), onMouseLeave: () => setHover(null), onFocus: () => setHover(x.key), onBlur: () => setHover(null) };
    // a card is a real link to its page (so it also opens in a new tab); everything else is a button
    if (href) return <a key={x.key} href={href} aria-label={label} {...hovers}><path d={arcPath(C, C, r0, r1, x.a0, x.a1, PAD)} className={cls} style={style} /></a>;
    return <path key={x.key} d={arcPath(C, C, r0, r1, x.a0, x.a1, PAD)} aria-label={label} className={cls} style={style}
      tabIndex={0} role="button" aria-pressed={act ? undefined : pinned === x.key} onClick={press} onKeyDown={keys(press)} {...hovers} />;
  };
  const radial = (a0, a1, r0, r1) => {
    const a = (a0 + a1) / 2, flip = a > Math.PI, rm = (r0 + r1) / 2;
    return `translate(${C},${C}) rotate(${(a * 180) / Math.PI - 90 + (flip ? 180 : 0)}) translate(${flip ? -rm : rm},0)`;
  };
  const icon = (key, name, x, y, size) => (name && setIconPath(name) ? <image key={key} href={setIconPath(name)} x={x - size / 2} y={y - size / 2} width={size} height={size} className="dn-sb-ico" pointerEvents="none" /> : null);

  const totalNames = matrix.rows.reduce((a, r) => a + r.names, 0);
  const typesHere = zoomed && by === 'expansion' ? data.groups.map(g => g.type) : zoomed ? [] : matrix.types;
  const back = () => goZoom(null);
  const what = by === 'expansion' ? 'expansions' : 'card types';

  // ---- the segments of both rings
  const innerTyped = zoomed || by === 'type', outerTyped = zoomed || by === 'expansion';
  const inner = groups.map((g, i) => arc(g, R.in0, R.in1, zoomed ? `${g.label}, ${g.type}: ${g.count} of ${g.of} card names` : `${g.label}: ${g.count} card names. Zoom in`,
    { typed: innerTyped, tier: zoomed && by === 'type' ? (i % 2 ? 'alt' : '') : '', act: zoomed ? undefined : () => goZoom(g.key) }));
  const outer = groups.flatMap(g => g.children.map(k => arc(k, R.out0, R.out1,
    zoomed ? `${k.name}, ${k.type}, ${k.expansion}` : `${k.label}, ${k.type}: ${k.count} of ${k.of} card names`, { typed: outerTyped, tier: zoomed ? 'leaf' : '', href: zoomed ? cardHref(k.id) : undefined })));

  // ---- their labels
  const innerLabels = groups.map(g => {
    const [x, y] = centroid(C, C, R.in0, R.in1, g.a0, g.a1), room = arcLength((R.in0 + R.in1) / 2, g.a0, g.a1);
    if (room < 30) return null;
    if (zoomed) {
      if (by === 'type') return icon(g.key, g.icon, x, y, 24);                                    // an expansion: its icon
      return <text key={g.key} x={x} y={y} className="dn-sb-lab" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{room > 62 ? g.type : g.count}</text>;
    }
    if (by === 'expansion') return icon(g.key, g.icon, x, y, 26);
    return <text key={g.key} x={x} y={y} className="dn-sb-lab" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{room > 62 ? g.label : g.count}</text>;
  });
  const outerLabels = groups.flatMap(g => g.children.map(k => {
    const room = arcLength((R.out0 + R.out1) / 2, k.a0, k.a1);
    if (zoomed) return room >= 12.5 ? <text key={k.key} transform={radial(k.a0, k.a1, R.out0, R.out1)} className="dn-sb-card" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{shortName(k.name)}</text> : null;
    const [x, y] = centroid(C, C, R.out0, R.out1, k.a0, k.a1);
    if (room < 17) return null;
    if (by === 'type' && room > 30 && k.icon && setIconPath(k.icon)) return icon(k.key, k.icon, x, y, 20);
    return <text key={k.key} x={x} y={y} className="dn-sb-num" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{k.count}</text>;
  }));

  const center = info ? { big: info.big, l1: info.l1, l2: info.l2 } : zoomed ? { big: data.big, l1: data.title, l2: '‹ back' } : { big: totalNames, l1: 'card names', l2: `click ${by === 'expansion' ? 'an expansion' : 'a type'}` };

  return (
    <div className="dn-sb" onKeyDown={e => { if (e.key === 'Escape' && zoomed) { e.preventDefault(); back(); } }}>
      {zoomed && (
        <div className="dn-sb-crumbs">
          <button type="button" className="ghost" onClick={back}>← All {what}</button>
          <span className="dn-sb-here">{by === 'expansion' ? 'Expansion' : 'Card type'}: <b>{data.title}</b></span>
        </div>
      )}
      {typesHere.length > 0 && (
        <div className="dn-sb-legend" role="group" aria-label="Isolate a printed type">
          {typesHere.map(t => (
            <button key={t} type="button" className={'dn-sb-key' + (only === t ? ' on' : '')} aria-pressed={only === t} onClick={() => setOnly(o => (o === t ? null : t))}>
              <i style={{ background: `rgb(var(${typeVar(t)}))` }} aria-hidden="true" />{t}
            </button>
          ))}
        </div>
      )}

      <svg className="dn-sb-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="group"
        aria-label={zoomed ? `Sunburst of ${data.title}: ${by === 'expansion' ? 'its card types, and the cards of each type' : 'the expansions that have it, and its cards'}.` : `Sunburst: ${by === 'expansion' ? 'card types within each expansion' : 'expansions within each card type'}. The table shows the same numbers.`}>
        {inner}{outer}
        {innerLabels}{outerLabels}
        <circle cx={C} cy={C} r={R.hole} className={'dn-sb-hole' + (zoomed ? ' back' : '')} onClick={zoomed ? back : undefined}
          {...(zoomed ? { role: 'button', tabIndex: 0, 'aria-label': `Zoom out to all ${what}`, onKeyDown: keys(back) } : {})} />
        <g className="dn-sb-center" textAnchor="middle" pointerEvents="none">
          <text x={C} y={C - 12} className={'dn-sb-big' + (String(center.big).length > 3 ? ' sm' : '')}>{center.big}</text>
          <text x={C} y={C + 12} className="dn-sb-sub">{center.l1}</text>
          <text x={C} y={C + 28} className="dn-sb-sub dn-sb-sub2">{center.l2}</text>
        </g>
      </svg>

      <p className="dn-sb-info" role="status" aria-live="polite">
        {pinned && info && !hover ? <>{info.text}. <a href={info.href}>{info.link} →</a></>
          : <span className="meta">{hover && info ? info.text : zoomed ? 'Hover an arc to read it. Click a card to open its page; click the middle or press Esc to zoom out.' : `Hover an arc to read it. Click ${by === 'expansion' ? 'an expansion' : 'a card type'} in the inner ring to zoom in.`}</span>}
      </p>
      <p className="note">
        {zoomed
          ? <>Outer ring: the cards themselves, cheapest first, clockwise from the top. A card with several printed types appears under each of its types, as in the table.</>
          : by === 'expansion'
            ? <>Inner ring: card names per expansion. Outer ring: how that expansion’s printed types split — a card with several types counts under each, so an expansion’s outer arcs are shares of its type counts, and the number on an arc is the real count.</>
            : <>Inner ring: printed types, sized by how many card names have the type. Outer ring: which expansions they come from. Knight and Castle aren’t shown (they only mark two piles).</>}
      </p>
    </div>
  );
}
