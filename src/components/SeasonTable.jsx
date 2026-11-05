import { f0, pc, sgn } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';
import SortableTable from './SortableTable.jsx';
import RankMedal from './RankMedal.jsx';

// on a phone (ux 'lists') the table keeps what decides a season and drops the rest (they are on the player's page)
const SECONDARY = new Set(['Win %', 'Top half %', 'Qualified', 'Elo change', 'Nights']);
const HEAD = [
  { label: 'Rank' }, { label: 'Player', cls: 'l' }, { label: 'Games' }, { label: 'Wins' }, { label: 'Win %' }, { label: 'Top half %' },
  { label: 'Season score', short: 'Score' }, { label: 'Qualified' }, { label: 'Elo change' }, { label: 'Nights' },
];

// Season standings (from D.seasonStandings()); green rows are playoff seeds, the top three are tinted and wear a medal.
export default function SeasonTable({ standings }) {
  const hide = label => (SECONDARY.has(label) ? 'dn-hide-sm' : undefined);
  const rows = standings.rows.map(r => ({
    key: r.name,
    className: [r.seed ? 'seed' : '', r.rank <= 3 ? 'stand stand' + r.rank : ''].filter(Boolean).join(' '),   // the top three as things stand: tinted rows with a medal
    cells: [
      { node: <RankMedal rank={r.rank} />, text: r.rank },
      { node: <PlayerLink name={r.name} />, text: r.name, className: 'name' },
      r.games, r.wins, { node: pc(r.winPct), text: pc(r.winPct), className: hide('Win %') }, { node: pc(r.topHalf), text: pc(r.topHalf), className: hide('Top half %') },
      { node: <b>{f0(r.score * 1000)}</b>, text: f0(r.score * 1000), className: 'edge' },
      r.qualified
        ? { node: <span className="pill ok">Yes</span>, text: 'Yes', className: hide('Qualified') }
        : { node: <span className="pill warn">{r.need} more</span>, text: `${r.need} more`, className: hide('Qualified') },
      { node: sgn(r.eloChange), text: sgn(r.eloChange), className: [r.eloChange > 0.5 ? 'up-t' : r.eloChange < -0.5 ? 'down-t' : '', hide('Elo change')].filter(Boolean).join(' ') || undefined },
      { node: r.nights, text: r.nights, className: hide('Nights') },
    ],
  }));
  // 'edge' marks the last column a phone still shows (Season score), so it can keep clear of the table's right edge
  const head = HEAD.map(h => (hide(h.label) ? { ...h, cls: [h.cls, 'dn-hide-sm'].filter(Boolean).join(' ') } : h.label === 'Season score' ? { ...h, cls: [h.cls, 'edge'].filter(Boolean).join(' ') } : h));
  return <div className="season-edge"><SortableTable head={head} rows={rows} /></div>;
}
