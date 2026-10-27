import { f0, f2, pc, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import SortableTable from './SortableTable.jsx';

const HEAD = [
  { label: 'Rank' }, { label: 'Player', cls: 'l' }, { label: 'Games' }, { label: 'Wins' }, { label: 'Win %' }, { label: 'Avg points' },
  { label: 'Season score' }, { label: 'Qualified' }, { label: 'Seed' }, { label: 'Elo change' }, { label: 'Nights' }, { label: 'Attendance' },
];

// Season standings (from D.seasonStandings()); green rows are playoff seeds.
export default function SeasonTable({ standings }) {
  const rows = standings.rows.map(r => ({
    key: r.name,
    className: r.seed ? 'seed' : '',
    cells: [
      r.rank,
      { node: <PlayerLink name={r.name} />, text: r.name, className: 'name' },
      r.games, r.wins, pc(r.winPct), f2(r.avgPts),
      { node: <b>{f0(r.score * 1000)}</b>, text: f0(r.score * 1000) },
      r.qualified
        ? { node: <span className="pill ok">Yes</span>, text: 'Yes' }
        : { node: <span className="pill warn">{r.need} more</span>, text: `${r.need} more` },
      r.seed || '',
      { node: sgn(r.eloChange), text: sgn(r.eloChange), className: r.eloChange > 0.5 ? 'up-t' : r.eloChange < -0.5 ? 'down-t' : '' },
      r.nights, pc(r.attendance),
    ],
  }));
  return <SortableTable head={HEAD} rows={rows} />;
}
