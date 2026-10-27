
import { useState } from 'react';
import { usePage } from '../PageContext.js';
import { openGameModal } from '../legacy/pages.js';
import { SET_NAMES } from '../lib/sets.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import GamesTable from '../components/GamesTable.jsx';

// Filters live at module level so they survive navigating away and back, as they always have.
let saved = { season: 'all', type: 'all', player: 'all', set: 'all' };

export default function Games() {
  const page = usePage();
  const { D, me, enabledSets } = page;
  const [gf, setGf] = useState(saved);
  // Changing a filter resets the sort and collapses expanded rows, as the old full re-render did
  // (the table is re-keyed on the filters below).
  const set = k => e => { saved = { ...gf, [k]: e.target.value }; setGf(saved); };
  const canEdit = !!(me && me.is_admin);

  const list = D.games.filter(g =>
    (gf.season === 'all' || String(g.season) === gf.season) && (gf.type === 'all' || g.type === gf.type)
    && (gf.player === 'all' || g.places[gf.player] != null) && (gf.set === 'all' || g.sets.includes(gf.set))).slice().reverse();

  return (
    <>
      <div className="head">
        <div><h1>Games</h1><p className="lede">Every table we've logged, newest first. Winners in bold.</p></div>
        {canEdit && <button id="gAddBtn" className="iconbtn" type="button" onClick={() => openGameModal(page, null)}><img src="icons/nav/add-a-game.png" alt="Add a game" /></button>}
      </div>
      <GroupSwitcher route="games" />
      <Banner />
      <div className="controls">
        <label className="f">Season <select id="gfs" value={gf.season} onChange={set('season')}>
          <option value="all">All seasons</option>
          {D.seasons.map(s => <option key={s.number} value={s.number}>{s.name}</option>)}
        </select></label>
        <label className="f">Type <select id="gft" value={gf.type} onChange={set('type')}>
          {['all', 'Regular', 'Playoff', 'Friendly'].map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
        </select></label>
        <label className="f">Player <select id="gfp" value={gf.player} onChange={set('player')}>
          <option value="all">Everyone</option>
          {D.players.map(p => <option key={p.name}>{p.name}</option>)}
        </select></label>
        <label className="f">Set <select id="gfset" value={gf.set} onChange={set('set')}>
          <option value="all">All sets</option>
          {SET_NAMES.filter(n => enabledSets.has(n) || D.records.sets[n]).map(n => <option key={n}>{n}</option>)}
        </select></label>
        <span className="meta">{list.length} table{list.length === 1 ? '' : 's'}</span>
      </div>
      {list.length ? <GamesTable key={`${gf.season}|${gf.type}|${gf.player}|${gf.set}`} games={list} onEdit={canEdit ? id => openGameModal(page, id) : undefined} /> : <p className="empty">Nothing matches those filters.</p>}
    </>
  );
}
