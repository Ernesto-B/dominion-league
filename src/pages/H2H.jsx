import { usePage } from '../PageContext.js';
import { pc } from '../lib/format.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import PlayerLink from '../components/PlayerLink.jsx';
import NameIcon from '../components/NameIcon.jsx';

export default function H2H() {
  const { D, gid, arg, hashFor } = usePage();
  const sel = arg === 'all' || !arg ? null : +arg;
  const hh = D.h2h(sel);

  const head = (
    <>
      <div className="head">
        <div><h1>Head to head</h1><p className="lede">Each cell shows how often the row player finished ahead of the column player.</p></div>
        <label className="f">Show <select id="h2hsel" value={sel == null ? 'all' : String(sel)} onChange={e => { location.hash = hashFor('h2h', gid, e.target.value); }}>
          <option value="all">All seasons</option>
          {D.seasons.map(s => <option key={s.number} value={s.number}>{s.name}</option>)}
        </select></label>
      </div>
      <GroupSwitcher route="h2h" />
      <Banner />
    </>
  );
  if (hh.players.length < 2) return <>{head}<p className="empty">Needs at least two players who shared a table.</p></>;

  let mostPlayed = null, closest = null;
  for (let i = 0; i < hh.players.length; i++) {
    for (let j = i + 1; j < hh.players.length; j++) {
      const a = hh.players[i], b = hh.players[j], w = hh.ahead[a][b], l = hh.ahead[b][a], t = w + l;
      if (!t) continue;
      if (!mostPlayed || t > mostPlayed.t) mostPlayed = { a, b, t };
      if (t >= 3) { const gap = Math.abs(w - l); if (!closest || gap < closest.gap || (gap === closest.gap && t > closest.t)) closest = { a, b, w, l, t, gap }; }
    }
  }

  return (
    <>
      {head}
      {(mostPlayed || closest) && (
        <div className="storyrow">
          {mostPlayed && <div className="story"><span className="slabel">Most played rivalry</span><PlayerLink name={mostPlayed.a} /> and <PlayerLink name={mostPlayed.b} /> have shared <b>{mostPlayed.t}</b> tables</div>}
          {closest && <div className="story"><span className="slabel">Closest rivalry</span><PlayerLink name={closest.a} /> and <PlayerLink name={closest.b} /> are split <b>{closest.w}–{closest.l}</b></div>}
        </div>
      )}
      <div className="tablewrap"><table className="matrix">
        <thead><tr><th>Row vs column</th>{hh.players.map(n => <th key={n}><NameIcon name={n} size={26} /><br />{n}</th>)}</tr></thead>
        <tbody>{hh.players.map(a => (
          <tr key={a}>
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
      <p className="note">Only rated games where both players sat at the same table. Ties are ignored. Small samples swing wildly, so give any cell under five games a pinch of salt.</p>
    </>
  );
}
