import { useEffect, useState } from 'react';
import { usePage } from '../PageContext.js';
import { f0, short } from '../lib/format.js';
import { uxOn } from '../ux.js';

// ux experiment "lists": below 720px the chart is drawn at phone width (no wide scrolling picture) and its end-of-line labels become tappable name chips
const PHONE = '(max-width:720px)';
function useNarrow() {
  const [narrow, setNarrow] = useState(() => uxOn('lists') && typeof matchMedia !== 'undefined' && matchMedia(PHONE).matches);
  useEffect(() => {
    if (!uxOn('lists')) return undefined;
    const m = matchMedia(PHONE), on = () => setNarrow(m.matches);
    m.addEventListener('change', on); on();
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

/* Elo after each game night, one line per player.
   hot       — the player emphasised by default (the Players page passes the one being viewed); also
               drawn last so their line sits on top.
   highlight — a name set by hovering/focusing a ladder row or a label; wins over `hot` when set.
   onHover   — called with a name when a label is hovered/focused. */
export default function RatingChart({ names, hot = null, highlight = null, onHover }) {
  const { D } = usePage();
  const narrow = useNarrow();
  const [pick, setPick] = useState(null);   // the name tapped in the chips
  const nights = D.nights;
  if (nights.length < 1) return <p className="empty">The rating history appears after the first night is logged.</p>;
  const start = D.E.start;
  const series = names.map(n => ({ name: n, pts: [start].concat(nights.map(x => x.snapshot[n] ?? start)) }));
  const W = narrow ? 400 : 880, H = narrow ? 300 : 330, L = narrow ? 38 : 46, R = narrow ? 22 : 112, T = 12, B = 28;
  let lo = Infinity, hi = -Infinity;
  series.forEach(s => s.pts.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
  lo = Math.min(lo, start - 20); hi = Math.max(hi, start + 20);
  const step = (hi - lo) > 200 ? 50 : (hi - lo) > 80 ? 25 : 10;
  lo = Math.floor((lo - 5) / step) * step; hi = Math.ceil((hi + 5) / step) * step;
  const N = nights.length;
  const x = i => L + (N === 0 ? 0 : i / N) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  if (!series.length) return <p className="empty">No one in this group has a rated game yet.</p>;

  const grid = [];
  for (let v = lo; v <= hi; v += step) {
    grid.push(<line key={'g' + v} className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />);
    grid.push(<text key={'t' + v} x={L - 8} y={y(v) + 4} textAnchor="end">{v}</text>);
  }
  const ticks = Math.min(N, narrow ? 3 : 6), dates = [];
  for (let t = 1; t <= ticks; t++) {
    const i = Math.round(t / ticks * N);
    // the newest date sits at the right edge of the plot: end-align it there so it can't run off the picture (the middle ones centre)
    dates.push(<text key={'d' + t} x={x(i)} y={H - 8} textAnchor={t === ticks && narrow ? 'end' : 'middle'}>{short(nights[i - 1].date)}</text>);
  }
  // Labels sit at their line's final value, nudged down so they never overlap.
  const sorted = series.slice().sort((a, b) => a.pts[N] - b.pts[N]);
  const ly = {}; let last = -Infinity;
  for (let i = sorted.length - 1; i >= 0; i--) { const ty = Math.max(y(sorted[i].pts[N]), last + 13); ly[sorted[i].name] = ty; last = ty; }
  const lit = narrow ? (pick ?? highlight ?? hot) : (highlight ?? hot);
  const choose = name => { const next = pick === name ? null : name; setPick(next); onHover && onHover(next); };
  const on = s => s.name === lit ? ' on' : '';

  return (
    <div className={'chart' + (narrow && lit ? ' has-lit' : '')}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Elo rating after each game night, one line per player">
        {grid}
        <line className="base" x1={L} x2={W - R} y1={y(start)} y2={y(start)} />
        {dates}
        {series.slice().sort((a, b) => (a.name === hot) - (b.name === hot)).map(s => (
          <path key={s.name} className={'ln' + on(s)} data-p={s.name} d={s.pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('')} />
        ))}
        {!narrow && series.map(s => (
          <text key={s.name} className={'lab' + on(s)} data-p={s.name} x={W - R + 8} y={ly[s.name] + 4}
            onMouseEnter={() => onHover && onHover(s.name)} onFocus={() => onHover && onHover(s.name)}>{s.name} {f0(s.pts[N])}</text>
        ))}
      </svg>
      {narrow && (
        <ul className="chart-keys" aria-label="Players — tap one to light up its line">
          {sorted.slice().reverse().map(s => (
            <li key={s.name}><button type="button" aria-pressed={lit === s.name} className={lit === s.name ? 'on' : ''} onClick={() => choose(s.name)}>{s.name} <b>{f0(s.pts[N])}</b></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
