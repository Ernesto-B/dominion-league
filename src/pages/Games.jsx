
import { Suspense, lazy, useLayoutEffect, useState } from 'react';
import { usePage } from '../PageContext.js';
import { SET_NAMES } from '../lib/sets.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import FilterFold from '../components/FilterFold.jsx';
import GamesTable from '../components/GamesTable.jsx';
import { takeKingdomDraft } from '../dominion/kingdomDraft.js';
import { uxOn } from '../ux.js';

// the Add/Edit dialog (with the kingdom picker and its catalog code) is only needed once someone opens it
const GameModal = lazy(() => import('../components/GameModal.jsx'));

// Filters live at module level so they survive navigating away and back, as they always have.
let saved = { season: 'all', type: 'all', player: 'all', set: 'all' };

export default function Games() {
  const { D, me, enabledSets, arg, gid, hashFor } = usePage();
  const [gf, setGf] = useState(saved);
  // null, or { editId, draft? } (editId null = a new game). Arriving from the Randomizer's "Use this kingdom" opens a new game already filled in.
  const [modal, setModal] = useState(() => { const d = me && me.is_admin ? takeKingdomDraft() : null; return d ? { editId: null, draft: d } : null; });
  // Changing a filter resets the sort and collapses expanded rows, as the old full re-render did
  // (the table is re-keyed on the filters below).
  const set = k => e => { saved = { ...gf, [k]: e.target.value }; setGf(saved); };
  const canEdit = !!(me && me.is_admin);

  const matches = (g, f) => (f.season === 'all' || String(g.season) === f.season) && (f.type === 'all' || g.type === f.type)
    && (f.player === 'all' || g.places[f.player] != null) && (f.set === 'all' || g.sets.includes(f.set));
  // #/games/<group>/<id> — a link to one game. Arriving on it clears any filters that would hide it
  // (only on arrival, so changing a filter afterwards still works); the table then opens, tints and
  // scrolls to the row. An id that isn't in this group is ignored.
  const target = /^\d+$/.test(arg || '') ? D.games.find(g => g.line === +arg) : null;
  useLayoutEffect(() => {
    if (target && !matches(target, saved)) { saved = { season: 'all', type: 'all', player: 'all', set: 'all' }; setGf(saved); }
  }, [arg]);   // eslint-disable-line react-hooks/exhaustive-deps

  const list = D.games.filter(g => matches(g, gf)).slice().reverse();

  const selects = (
    <>
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
    </>
  );

  return (
    <>
      <div className="head">
        <div><h1>Games</h1><p className="lede">Every table we've logged, newest first. Winners in bold.</p></div>
        {canEdit && uxOn('flow')
          ? <a className="btn gamenight" href={hashFor('night', gid)}><img src="icons/nav/add-a-game.png" alt="" />Game night</a>
          : canEdit && <button id="gAddBtn" className="iconbtn" type="button" onClick={() => setModal({ editId: null })}><img src="icons/nav/add-a-game.png" alt="Add a game" /></button>}
      </div>
      <GroupSwitcher route="games" />
      <Banner />
      {uxOn('redesign') ? (
        <>
          <FilterFold active={['season', 'type', 'player', 'set'].filter(k => gf[k] !== 'all').length}>
            <div className="controls" style={{ marginTop: 8 }}>{selects}</div>
          </FilterFold>
          <p className="meta" role="status">{list.length} table{list.length === 1 ? '' : 's'}</p>
        </>
      ) : (
        <div className="controls">{selects}
          <span className="meta">{list.length} table{list.length === 1 ? '' : 's'}</span></div>
      )}
      {modal && <Suspense fallback={null}><GameModal key={String(modal.editId)} editId={modal.editId} draft={modal.draft} onClose={() => setModal(null)} /></Suspense>}
      {list.length ? <GamesTable key={`${gf.season}|${gf.type}|${gf.player}|${gf.set}|${target ? target.line : ''}`} games={list} highlight={target ? target.line : undefined} onEdit={canEdit ? id => setModal({ editId: id }) : undefined} /> : <p className="empty">Nothing matches those filters.</p>}
    </>
  );
}
