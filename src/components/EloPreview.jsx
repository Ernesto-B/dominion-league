import { usePage } from '../PageContext.js';
import { f0, pc, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';

// "Before you play": who has the most at stake at this table (expected score and the Elo swing either way)
export default function EloPreview({ picked }) {
  const { D } = usePage();
  const pv = D.preview(picked);
  if (!pv.length) return null;
  return (
    <>
      <h3>Before you play</h3>
      <div className="tablewrap"><table className="plain">
        <thead><tr><th className="l">Player</th><th>Elo</th><th>Expected score</th><th>Elo if 1st</th><th>Elo if last</th></tr></thead>
        <tbody>{pv.map(x => (
          <tr key={x.name}><td className="name"><PlayerLink name={x.name} /></td><td>{f0(x.elo)}</td><td>{pc(x.expected)}</td><td className="up-t">{sgn(x.ifWin)}</td><td className="down-t">{sgn(x.ifLast)}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="note">Expected score is the share of the available points a player would average at this table; 50% means an even table. Use it to see who has the most at stake, or to balance seating.</p>
    </>
  );
}
