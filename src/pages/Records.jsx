import { usePage } from '../PageContext.js';
import * as Eng from '../lib/engine.js';
import { f0, f1, f2, pc, sgn } from '../lib/format.js';
import { LANDSCAPES } from '../lib/sets.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import PlayerLink from '../components/PlayerLink.jsx';
import SetIcon from '../components/SetIcon.jsx';
import TierIcon from '../components/TierIcon.jsx';
import SortableTable from '../components/SortableTable.jsx';

const winnerOf = g => g.names.filter(n => g.places[n] === 1).join(' & ');
const L = 'l';

export default function Records() {
  const { D, gid, hashFor } = usePage();
  const R = D.records, O = R.overview, min = D.S.minGamesForRecords;

  const rec = (label, x, fmt, iconSrc) => ({
    key: label,
    cells: [
      { node: <>{iconSrc && <><img className="staticon sm" src={iconSrc} alt="" /> </>}{label}</>, text: label },
      { node: x ? <PlayerLink name={x.name} /> : '—', text: x ? x.name : '—', className: 'name' },
      { node: <b>{x ? fmt(x.value) : ''}</b>, text: x ? fmt(x.value) : '' },
    ],
  });
  const playerRecords = [
    rec('Current Elo leader', R.leader, f0, 'icons/stats/elo.png'),
    rec('Highest Elo ever', R.peak, f0, 'icons/stats/peak-elo.png'),
    rec('Most rated games', R.mostGames, f0, 'icons/stats/rated-games.png'),
    rec('Most wins', R.mostWins, f0, 'icons/stats/wins.png'),
    rec(`Best win % (min ${min} games)`, R.bestWinPct, pc),
    rec(`Best average points (min ${min} games)`, R.bestAvgPts, f2, 'icons/stats/average-points.png'),
    rec('Longest win streak', R.bestStreak, f0, 'icons/stats/win-streak.png'),
    rec('Most season titles', R.mostTitles?.value > 0 ? R.mostTitles : null, f0, 'icons/champion.png'),
  ];

  // [label, who, when (a link to that game), value]
  const when = (date, line) => line == null ? date : <a className="gamelink" href={hashFor('games', gid, line)} title="Open this game in the Games page">{date}</a>;
  const single = [];
  if (R.gain) single.push(['Biggest Elo gain in one game', <PlayerLink name={R.gain.name} />, when(R.gain.date, R.gain.line), sgn(R.gain.value)]);
  if (R.loss) single.push(['Biggest Elo drop in one game', <PlayerLink name={R.loss.name} />, when(R.loss.date, R.loss.line), sgn(R.loss.value)]);
  if (R.topVP) single.push(['Highest winning score', winnerOf(R.topVP.game), when(R.topVP.game.date, R.topVP.game.line), R.topVP.value + ' VP']);
  if (R.mostLandscapes) single.push(['Most landscape types in one game', winnerOf(R.mostLandscapes.game) + ' won', when(R.mostLandscapes.game.date, R.mostLandscapes.game.line), R.mostLandscapes.value + ' of ' + LANDSCAPES.length]);

  const setRows = Object.entries(R.sets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <>
      <div className="head">
        <div><h1>Records</h1><p className="lede">Everything the league has produced so far.</p></div>
      </div>
      <GroupSwitcher route="records" />
      <Banner />
      <div className="stats">
        <div className="stat"><b>{O.tables}</b><span>tables logged</span></div>
        <div className="stat"><b>{O.nights}</b><span>game nights</span></div>
        <div className="stat"><b>{O.playersRated}</b><span>rated players</span></div>
        <div className="stat"><b>{O.avgTable ? f1(O.avgTable) : '—'}</b><span>players per table</span></div>
        <div className="stat"><b>{O.avgVP ? f1(O.avgVP) : '—'}</b><span>avg winning VP</span></div>
      </div>
      <div className="grid2">
        <div>
          <h2>Player records</h2>
          <SortableTable head={[{ label: 'Record', cls: L }, { label: 'Holder', cls: L }, { label: 'Value' }]} rows={playerRecords} />
        </div>
        <div>
          <h2>Table sizes</h2>
          <SortableTable head={[{ label: 'Players at the table', cls: L }, { label: 'Tables' }]}
            rows={Object.entries(R.tableSizes).map(([k, v]) => ({ key: k, cells: [k, v] }))} empty="None yet" />
        </div>
      </div>

      {single.length > 0 && <>
        <h2>Single-game records</h2>
        <div className="tablewrap"><table className="plain">
          <thead><tr><th className="l">Record</th><th className="l">Who</th><th className="l">When</th><th>Value</th></tr></thead>
          <tbody>{single.map(([label, who, when, val]) => (
            <tr key={label}><td className="l">{label}</td><td className="l">{who}</td><td className="l">{when}</td><td><b>{val}</b></td></tr>
          ))}</tbody>
        </table></div>
      </>}

      {O.tables && R.mostLandscapes && <Landscapes R={R} min={min} />}

      <h2>Sets in play</h2>
      {R.setsLogged ? <>
        <SortableTable head={[{ label: 'Set', cls: L }, { label: 'Games' }, { label: 'Share' }, { label: 'Avg winning VP' }]}
          rows={setRows.map(([k, v]) => {
            const st = R.setStats[k];
            const vp = st && st.avgVP != null ? f1(st.avgVP) : '—';
            return { key: k, cells: [{ node: <><SetIcon name={k} size={20} /> {k}</>, text: k }, v, pc(v / R.setsLogged), vp] };
          })} />
        <p className="note">A game tagged with more than one set counts fully toward each one — the kingdom was mixed, not split.</p>
      </> : <p className="empty">Fill the sets field when adding a game (separate sets with semicolons).</p>}

      <h2>Season champions</h2>
      <SortableTable head={[{ label: 'Season', cls: L }, { label: 'Champion', cls: L }, { label: 'Dates', cls: L }]}
        rows={D.seasons.map(s => ({
          key: s.number,
          cells: [
            { node: <a href={hashFor('season', gid, s.number)}>{s.name}</a>, text: s.name },
            {
              node: s.champion
                ? <><TierIcon id="champion" size={20} alt="Champion" /> {D.byName[s.champion] ? <PlayerLink name={s.champion} /> : s.champion}</>
                : <span className="meta">not decided</span>,
              text: s.champion || 'not decided',
            },
            s.ok ? Eng.fmtDay(s.start) + ' to ' + Eng.fmtDay(s.end) : '',
          ],
        }))} />
    </>
  );
}

function Landscapes({ R, min }) {
  const LS = R.landscapeSplit, dist = R.landscapeTypesDist;
  const side = (label, x) => (
    <div className="stat"><b>{x.games}</b><span>{label}{x.avgVP != null ? ` · avg winning VP ${f1(x.avgVP)}` : ''}{x.avgTable ? ` · ${f1(x.avgTable)} players` : ''}</span></div>
  );
  return (
    <>
      <h2>Landscapes in play</h2>
      <SortableTable
        head={[{ label: 'Type', cls: L }, { label: 'Games' }, { label: 'Share of tables' }, { label: 'Avg winning VP' }, { label: `Best win % (min ${min} games)`, cls: L }]}
        rows={LANDSCAPES.map(l => {
          const st = R.landscapeStats[l], b = R.bestByLandscape[l];
          const games = st ? st.games : 0;
          return {
            key: l,
            cells: [
              l, games, pc(games / R.landscapeTables), st && st.avgVP != null ? f1(st.avgVP) : '—',
              { node: b ? <><PlayerLink name={b.name} /> <b>{pc(b.value)}</b> <span className="meta">({b.games} games)</span></> : '—', text: b ? b.name : '—' },
            ],
          };
        })} />
      <div className="stats">{side('games with landscapes', LS.with)}{side('games without', LS.without)}</div>
      <div className="stats">{[0, 1, 2, 3, 4, 5].filter(k => dist[k]).map(k => (
        <div className="stat" key={k}><b>{dist[k]}</b><span>game{dist[k] === 1 ? '' : 's'} with {k} landscape type{k === 1 ? '' : 's'}</span></div>
      ))}</div>
      <p className="note">Games logged before landscape tracking count as "without". A game with more than one type counts fully toward each.</p>
    </>
  );
}
