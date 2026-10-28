import { useState } from 'react';

/* The Overview's small charts. Plain SVG / HTML / CSS, no library; every number is real text (screen readers read it)
   and every item may carry an `href` (its label becomes a link to the matching filtered list). Each chart answers a different question,
   so the page doesn't read as one chart repeated:
     Donut       how a whole splits between a few parts (share)
     Bars        a plain ranking, label, bar, number
     Lollipop    a ranking where the exact value matters
     Segments    one whole split into a handful of parts, in a single bar
     Waffle      "one square per thing" — how many there are, and of what kind
     Columns     an ordered scale (costs), tallest to shortest
     HeatChips   a long list of tags, shaded by how common each is
   An item is { key, label, value, href?, icon?, color? }. */
const fmt = n => n.toLocaleString();
const share = (v, total) => (v > 0 && v / total < 0.005 ? '<1%' : `${Math.round((v / total) * 100)}%`);
const sum = items => items.reduce((a, i) => a + i.value, 0);
const catColor = (i, n) => `hsl(${Math.round((i * 360) / Math.max(1, n) + 18)} 52% 58%)`;
const colored = items => items.map((it, i) => ({ ...it, color: it.color || catColor(i, items.length) }));
const Name = ({ i }) => <>{i.icon}{i.href ? <a href={i.href} onClick={i.onClick}>{i.label}</a> : i.label}</>;
const typeColor = key => `rgb(var(--t-${String(key).toLowerCase()}, var(--sb-neutral)))`;

/* ---- Donut: slices of a ring with a legend beside it. Pointing at a slice or a legend row lights that one up and names it in the middle;
   the share (a percentage) is on the tooltip and in the spoken text, the legend itself shows the count. */
export function Donut({ items, label, center }) {
  const data = colored(items), total = Math.max(1, sum(data)), R = 70, C = 2 * Math.PI * R;
  const [hot, setHot] = useState(null);
  const lit = data.find(i => i.key === hot) || null;
  let acc = 0;
  return (
    <div className="dn-donut" role="group" aria-label={label}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <g transform="rotate(-90 100 100)">
          {data.map(i => {
            const len = (i.value / total) * C, on = hot === i.key;
            const el = <circle key={i.key} cx="100" cy="100" r={R} fill="none" stroke={i.color} strokeWidth={on ? 36 : 30} opacity={hot && !on ? 0.35 : 1} style={{ transition: 'opacity .15s, stroke-width .15s' }}
              strokeDasharray={`${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}`} strokeDashoffset={-acc} onMouseEnter={() => setHot(i.key)} onMouseLeave={() => setHot(null)}><title>{`${i.label}: ${fmt(i.value)} (${share(i.value, total)})`}</title></circle>;
            acc += len; return el;
          })}
        </g>
        <text x="100" y="98" textAnchor="middle" className="dn-donut-n">{fmt(lit ? lit.value : sum(data))}</text>
        <text x="100" y="118" textAnchor="middle" className="dn-donut-c">{lit ? lit.label : center}</text>
      </svg>
      <ol className="dn-legend dn-legend-2" style={{ '--rows': Math.ceil(data.length / 2) }}>
        {data.map(i => (
          <li key={i.key} className={hot === i.key ? 'on' : undefined} title={`${i.label}: ${fmt(i.value)} (${share(i.value, total)})`} onMouseEnter={() => setHot(i.key)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(i.key)} onBlur={() => setHot(null)}>
            <i style={{ background: i.color }} aria-hidden="true" /><span className="dn-legend-name"><Name i={i} /></span><span className="dn-legend-n">{fmt(i.value)}</span>
            <span className="dn-sr">{share(i.value, total)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---- Bars: label, proportional bar, number. The plain ranking; all bars share one scale (`max`, default the largest value) */
export function Bars({ items, label, max, format = fmt }) {
  const top = max ?? Math.max(1, ...items.map(i => i.value));
  return (
    <ol className="dn-bars" aria-label={label}>
      {items.map(i => (
        <li key={i.key ?? i.label}>
          <span className="dn-bar-label"><Name i={i} /></span>
          <span className="dn-bar-track" aria-hidden="true"><span style={{ width: `${Math.max(i.value ? 2 : 0, (i.value / top) * 100)}%` }} /></span>
          <span className="dn-bar-value">{format(i.value)}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---- Lollipop: a thin stem and a dot at the value; good for a ranking where the number matters more than the bulk */
export function Lollipop({ items, label, max, format = fmt }) {
  const top = max ?? Math.max(1, ...items.map(i => i.value));
  return (
    <ol className="dn-lol" aria-label={label}>
      {items.map(i => (
        <li key={i.key ?? i.label}>
          <span className="dn-bar-label"><Name i={i} /></span>
          <span className="dn-lol-track" aria-hidden="true"><span className="dn-lol-stem" style={{ width: `${(i.value / top) * 100}%` }}><i /></span></span>
          <span className="dn-bar-value">{format(i.value)}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---- Segments: one bar split into parts, with the parts listed under it */
export function Segments({ items, label }) {
  const data = colored(items), total = Math.max(1, sum(data));
  return (
    <div className="dn-seg" role="group" aria-label={label}>
      <div className="dn-seg-bar" aria-hidden="true">{data.map(i => <span key={i.key} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} title={`${i.label}: ${fmt(i.value)}`} />)}</div>
      <ol className="dn-legend">
        {data.map(i => <li key={i.key}><i style={{ background: i.color }} aria-hidden="true" /><span className="dn-legend-name"><Name i={i} /></span><span className="dn-legend-n">{fmt(i.value)}</span><span className="dn-legend-p">{share(i.value, total)}</span></li>)}
      </ol>
    </div>
  );
}

/* ---- Waffle: one square for every thing counted, grouped and coloured by kind */
export function Waffle({ items, label }) {
  const data = items.map(i => ({ ...i, color: i.color || typeColor(i.key) })), total = sum(data);
  return (
    <div className="dn-waffle-wrap" role="group" aria-label={label}>
      <div className="dn-waffle" aria-hidden="true">{data.flatMap(i => Array.from({ length: i.value }, (_, k) => <span key={`${i.key}${k}`} style={{ background: i.color }} title={i.label} />))}</div>
      <ol className="dn-legend">
        {data.map(i => <li key={i.key}><i style={{ background: i.color }} aria-hidden="true" /><span className="dn-legend-name"><Name i={i} /></span><span className="dn-legend-n">{fmt(i.value)}</span><span className="dn-legend-p">{share(i.value, Math.max(1, total))}</span></li>)}
      </ol>
    </div>
  );
}

/* ---- Columns: upright bars along an ordered scale (the label sits under each, the value on top) */
export function Columns({ items, label }) {
  const top = Math.max(1, ...items.map(i => i.value));
  return (
    <ol className="dn-cols" aria-label={label}>
      {items.map(i => (
        <li key={i.key ?? i.label}>
          <b className="dn-col-n">{fmt(i.value)}</b>
          {i.href
            ? <a className="dn-col-track dn-col-link" href={i.href} title={i.title} aria-label={i.title || `${i.value}`}><span style={{ height: `${Math.max(i.value ? 3 : 0, (i.value / top) * 100)}%` }} /></a>
            : <span className="dn-col-track" aria-hidden="true"><span style={{ height: `${Math.max(i.value ? 3 : 0, (i.value / top) * 100)}%` }} /></span>}
          <span className="dn-col-label"><Name i={i} /></span>
        </li>
      ))}
    </ol>
  );
}

/* ---- HeatChips: a long list as chips, shaded by how common each is */
export function HeatChips({ items, label, max }) {
  const top = max ?? Math.max(1, ...items.map(i => i.value));
  return (
    <ol className="dn-heat" aria-label={label}>
      {items.map(i => (
        <li key={i.key ?? i.label} style={{ background: `color-mix(in srgb, var(--felt) ${Math.round(10 + (i.value / top) * 55)}%, transparent)` }}>
          <span className="dn-heat-name"><Name i={i} /></span><b>{fmt(i.value)}</b>
        </li>
      ))}
    </ol>
  );
}
