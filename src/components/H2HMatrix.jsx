import { pc } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import NameIcon from './NameIcon.jsx';

/* The head-to-head grid: each cell is how often the ROW player finished ahead of the COLUMN player. `hh` is D.h2h(season).
   `focus` (a player name) tints that player's row and column header, so on a player's own page it reads as "me against everyone". */
export default function H2HMatrix({ hh, focus = null }) {
  return (
    <div className="tablewrap"><table className="matrix">
      <thead><tr><th>Row vs column</th>{hh.players.map(n => <th key={n} className={n === focus ? 'me' : undefined}><NameIcon name={n} size={26} /><br />{n}</th>)}</tr></thead>
      <tbody>{hh.players.map(a => (
        <tr key={a} className={a === focus ? 'me' : undefined}>
          <td><PlayerLink name={a} /></td>
          {hh.players.map(b => {
            if (a === b) return <td key={b} className="self">–</td>;
            const w = hh.ahead[a][b], l = hh.ahead[b][a], t = w + l;
            if (!t) return <td key={b}></td>;
            const r = w / t, col = r >= 0.5 ? 'var(--felt)' : 'var(--brick)', a8 = Math.round(Math.abs(r - 0.5) * 2 * 55);
            return (
              <td key={b} style={{ background: `color-mix(in srgb, ${col} ${a8}%, transparent)` }} title={`${a} finished ahead of ${b} ${w} of ${t} times`}>
                <b>{pc(r)}</b><br /><span className="meta">{w}–{l}</span>
              </td>
            );
          })}
        </tr>
      ))}</tbody>
    </table></div>
  );
}
