import { f0, f2, pc, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import SortableTable from './SortableTable.jsx';

// on a phone (ux 'lists') the table keeps what decides a season and drops the rest (they are on the player's page)
const SECONDARY = new Set(['Win %', 'Avg points', 'Qualified', 'Elo change', 'Nights']);
const HEAD = [
  { label: 'Rank' }, { label: 'Player', cls: 'l' }, { label: 'Games' }, { label: 'Wins' }, { label: 'Win %' }, { label: 'Avg points' },
  { label: 'Season score', short: 'Score' }, { label: 'Qualified' }, { label: 'Seed' }, { label: 'Elo change' }, { label: 'Nights' },
];

// Season standings (from D.seasonStandings()); green rows are playoff seeds.
export default function SeasonTable({ standings }) {
  const hide = label => (SECONDARY.has(label) ? 'dn-hide-sm' : undefined);
  const rows = standings.rows.map(r => ({
    key: r.name,
    className: r.seed ? 'seed' : '',
    cells: [
      r.rank,
      { node: <PlayerLink name={r.name} />, text: r.name, className: 'name' },
      r.games, r.wins, { node: pc(r.winPct), text: pc(r.winPct), className: hide('Win %') }, { node: f2(r.avgPts), text: f2(r.avgPts), className: hide('Avg points') },
      { node: <b>{f0(r.score * 1000)}</b>, text: f0(r.score * 1000) },
      r.qualified
        ? { node: <span className="pill ok">Yes</span>, text: 'Yes', className: hide('Qualified') }
        : { node: <span className="pill warn">{r.need} more</span>, text: `${r.need} more`, className: hide('Qualified') },
      r.seed || '',
      { node: sgn(r.eloChange), text: sgn(r.eloChange), className: [r.eloChange > 0.5 ? 'up-t' : r.eloChange < -0.5 ? 'down-t' : '', hide('Elo change')].filter(Boolean).join(' ') || undefined },
      { node: r.nights, text: r.nights, className: hide('Nights') },
    ],
  }));
  // 'edge' marks the last column a phone still shows (Seed), so it can keep clear of the table's right edge
  const head = HEAD.map(h => (hide(h.label) ? { ...h, cls: [h.cls, 'dn-hide-sm'].filter(Boolean).join(' ') } : h.label === 'Seed' ? { ...h, cls: [h.cls, 'edge'].filter(Boolean).join(' ') } : h));
  return <div className="season-edge"><SortableTable head={head} rows={rows} /></div>;
}
