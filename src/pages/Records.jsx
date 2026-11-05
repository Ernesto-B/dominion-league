import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import * as Eng from '../lib/engine.js';
import { f0, f1, f2, pc, sgn } from '../lib/format.js';
import { LANDSCAPES } from '../lib/sets.js';
import Banner from '../components/Banner.jsx';
import PlayerLink from '../components/PlayerLink.jsx';
import SetIcon from '../components/SetIcon.jsx';
import TierIcon from '../components/TierIcon.jsx';
import { badgesFor } from '../lib/xp.js';
import { badgeRecords } from '../lib/achievements.js';
import SortableTable from '../components/SortableTable.jsx';

const L = 'l';

export default function Records() {
  const { D, gid, hashFor, catalog, me, arg } = usePage();
  // ?season=N narrows every record to that season's games (the default is all time)
  const asked = +((/[?&]season=(\d+)/.exec(arg || '') || [])[1] || 0);
  const scope = D.seasons.find(s => s.number === asked && s.ok) || null;
  const R = scope ? D.seasonRecords(scope.number) : D.records, O = R.overview, min = D.S.minGamesForRecords;

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
    ...(scope ? [] : [rec('Most season titles', R.mostTitles?.value > 0 ? R.mostTitles : null, f0, 'icons/champion.png')]),
  ];

  // badge records, from every rated player's badges (kingdom badges count once the catalog has loaded)
  const BR = useMemo(() => badgeRecords(D.players.filter(p => p.rated).map(p => ({ name: p.name, list: badgesFor(D, p, catalog) }))), [D, catalog]);
  const who = names => names.map((n, i) => <span key={n}>{i > 0 && ', '}<PlayerLink name={n} /></span>);
  // how many of the records above are yours: a small boast at the top of the page
  const mine = me && [R.leader, R.peak, R.mostGames, R.mostWins, R.bestWinPct, R.bestAvgPts, R.bestStreak, R.mostTitles && R.mostTitles.value > 0 ? R.mostTitles : null].filter(x => x && x.name === me.name).length
    + [BR.most, BR.hard].filter(x => x && x.names.includes(me.name)).length;
  const brow = (label, x, value) => ({
    key: label,
    cells: [label, { node: x ? who(x.names) : '—', text: x ? x.names.join(', ') : '—', className: 'name' }, { node: <b>{x ? value(x) : ''}</b>, text: x ? String(value(x)) : '' }],
  });
  const badgeRows = [
    brow('Most badges earned', BR.most, x => x.value),
    brow('Most epic and legendary badges', BR.hard, x => x.value),
  ];

  // [label, who, when (a link to that game), value]
  const when = (date, line) => line == null ? date : <a className="gamelink" href={hashFor('games', gid) + '?game=' + line} title="Open this game in the Games page">{date}</a>;
  // a player's name with the tier they held right after that game, so the icon is the rank at the time the record was set
  const link = (g, n) => <PlayerLink name={n} tier={g && D.tierAt(g, n)} />;
  const folks = (g, list, tail, sep = ' & ') => <>{list.map((n, i) => <span key={n}>{i > 0 && sep}{link(g, n)}</span>)}{tail}</>;
  const winnerOf = g => folks(g, g.names.filter(n => g.places[n] === 1));
  const gameOf = line => D.games.find(g => g.line === line);
  const single = [];
  if (R.gain) single.push(['Biggest Elo gain in one game', link(gameOf(R.gain.line), R.gain.name), when(R.gain.date, R.gain.line), sgn(R.gain.value)]);
  if (R.loss) single.push(['Biggest Elo drop in one game', link(gameOf(R.loss.line), R.loss.name), when(R.loss.date, R.loss.line), sgn(R.loss.value)]);
  if (R.topVP) single.push(['Highest winning score', winnerOf(R.topVP.game), when(R.topVP.game.date, R.topVP.game.line), R.topVP.value + ' VP']);
  if (R.mostLandscapes) single.push(['Most landscape types in one game', folks(R.mostLandscapes.game, R.mostLandscapes.game.names.filter(n => R.mostLandscapes.game.places[n] === 1)), when(R.mostLandscapes.game.date, R.mostLandscapes.game.line), R.mostLandscapes.value + ' of ' + LANDSCAPES.length]);

  // more single-game records, worked out here from the games (a game needs every VP entered to have a margin)
  const rated = D.games.filter(g => g.n >= 2 && g.type !== 'Friendly' && (!scope || g.season === scope.number));
  const vps = g => g.names.map(n => ({ n, v: g.playerVP && g.playerVP[n] !== '' && g.playerVP[n] != null ? Number(g.playerVP[n]) : NaN }));
  const best = (list, score, high = true) => list.reduce((a, g) => { const s = score(g); return s == null ? a : !a || (high ? s > a.s : s < a.s) ? { g, s } : a; }, null);
  const margin = g => { const v = vps(g); if (v.length < 2 || v.some(x => !Number.isFinite(x.v))) return null; const t = v.map(x => x.v).sort((x, y) => y - x); return t[0] - t[1]; };
  const total = g => { const v = vps(g); return v.length && v.every(x => Number.isFinite(x.v)) ? v.reduce((t, x) => t + x.v, 0) : null; };
  const loser = g => { const v = vps(g).filter(x => Number.isFinite(x.v) && g.places[x.n] > 1); return v.length ? Math.max(...v.map(x => x.v)) : null; };
  const lowWin = g => { const v = vps(g).filter(x => Number.isFinite(x.v) && g.places[x.n] === 1); return v.length ? Math.max(...v.map(x => x.v)) : null; };
  const add = (label, hit, val, who) => { if (hit) single.push([label, who ? who(hit.g) : winnerOf(hit.g), when(hit.g.date, hit.g.line), val(hit.s)]); };
  add('Biggest winning margin', best(rated, margin), s => s + ' VP');
  add('Closest game', best(rated.filter(g => margin(g) != null && margin(g) > 0), margin, false), s => s + ' VP');
  add('Highest score in a loss', best(rated, loser), s => s + ' VP', g => folks(g, g.names.filter(n => g.places[n] > 1 && Number(g.playerVP[n]) === loser(g))));
  add('Lowest winning score', best(rated, lowWin, false), s => s + ' VP');

  // records that belong to a table, not to one player: the "Table" column lists everyone who sat there
  const extremes = [];
  const addTable = (label, hit, val) => { if (hit) extremes.push([label, folks(hit.g, hit.g.names, null, ', '), when(hit.g.date, hit.g.line), val(hit.s)]); };
  addTable('Most total VP at one table', best(rated, total), s => s + ' VP');
  const timed = rated.filter(g => g.minutes > 0), longest = best(timed, g => g.minutes), shortest = best(timed, g => g.minutes, false);
  addTable('Longest game', longest, s => s + ' min');
  if (shortest && longest && shortest.g !== longest.g) addTable('Shortest game', shortest, s => s + ' min');   // one timed game is both, so say it once

  const setRows = Object.entries(R.sets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <>
      <div className="head">
        <div><h1>Records</h1><p className="lede">{scope ? `Only the games of ${scope.name}.` : 'Everything the league has produced so far.'}</p></div>
        {D.seasons.some(s => s.ok) && (
          <div className="pills" aria-label="Which games the records count">
            <a href={hashFor('records', gid)} aria-current={!scope ? 'true' : undefined}>All time</a>
            {D.seasons.filter(s => s.ok).map(s => <a key={s.number} href={hashFor('records', gid) + '?season=' + s.number} aria-current={scope && scope.number === s.number ? 'true' : undefined}>{s.name}</a>)}
          </div>
        )}
      </div>
      <Banner />
      <div className="stats">
        <div className="stat"><b>{O.tables}</b><span>tables logged</span></div>
        <div className="stat"><b>{O.nights}</b><span>game nights</span></div>
        <div className="stat"><b>{O.playersRated}</b><span>rated players</span></div>
        <div className="stat"><b>{O.avgTable ? f1(O.avgTable) : '—'}</b><span>players per table</span></div>
        <div className="stat"><b>{O.avgVP ? f1(O.avgVP) : '—'}</b><span>avg winning VP</span></div>
      </div>
      {!scope && mine > 0 && <p className="holds"><b>You hold {mine} record{mine === 1 ? '' : 's'}</b> <span className="meta">on this page</span></p>}
      <div className="grid2">
        <div>
          <h2>Player records</h2>
          <SortableTable stack head={[{ label: 'Record', cls: L }, { label: 'Holder', cls: L }, { label: 'Value' }]} rows={playerRecords} />
        </div>
        <div>
          <h2>Table sizes</h2>
          <SortableTable head={[{ label: 'Players at the table', cls: L }, { label: 'Matches' }]}
            rows={Object.entries(R.tableSizes).map(([k, v]) => ({ key: k, cells: [k, v] }))} empty="None yet" />
          {!scope && <>
            <h2>Badges</h2>
            <SortableTable stack head={[{ label: 'Record', cls: L }, { label: 'Holder', cls: L }, { label: 'Value' }]} rows={badgeRows} />
          </>}
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
      {extremes.length > 0 && <>
        <h2>Game extremes</h2>
        <div className="tablewrap"><table className="plain">
          <thead><tr><th className="l">Record</th><th className="l">Table</th><th className="l">When</th><th>Value</th></tr></thead>
          <tbody>{extremes.map(([label, who, when, val]) => (
            <tr key={label}><td className="l">{label}</td><td className="l">{who}</td><td className="l">{when}</td><td><b>{val}</b></td></tr>
          ))}</tbody>
        </table></div>
      </>}


      <h2>Sets in play</h2>
      {R.setsLogged ? <>
        <SortableTable stack head={[{ label: 'Set', cls: L }, { label: 'Games' }, { label: 'Share' }, { label: 'Avg winning VP' }]}
          rows={setRows.map(([k, v]) => {
            const st = R.setStats[k];
            const vp = st && st.avgVP != null ? f1(st.avgVP) : '—';
            return { key: k, cells: [{ node: <><SetIcon name={k} size={20} /> {k}</>, text: k }, v, pc(v / R.setsLogged), vp] };
          })} />
        <p className="note">A game tagged with more than one set counts fully toward each one — the kingdom was mixed, not split.</p>
      </> : <p className="empty">Fill the sets field when adding a game (separate sets with semicolons).</p>}

      {O.tables && R.mostLandscapes && <Landscapes R={R} min={min} />}

      <h2>Season champions</h2>
      <SortableTable stack head={[{ label: 'Season', cls: L }, { label: 'Champion', cls: L }, { label: 'Dates', cls: L }]}
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
