
import { Suspense, lazy, useLayoutEffect, useState } from 'react';
import { usePage } from '../PageContext.js';
import { SET_NAMES } from '../lib/sets.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import FilterFold from '../components/FilterFold.jsx';
import GamesTable from '../components/GamesTable.jsx';
import SetSelect from '../components/SetSelect.jsx';
import { takeKingdomDraft } from '../dominion/kingdomDraft.js';

// the Add/Edit dialog (with the kingdom picker and its catalog code) is only needed once someone opens it
const GameModal = lazy(() => import('../components/GameModal.jsx'));
// the report on one game (a link to #/games/<group>/<id>): deeper than anything the list can show, so it loads on its own
const GameReport = lazy(() => import('../components/GameReport.jsx'));

const readView = () => { try { return localStorage.getItem('dl.gamesview') === 'table' ? 'table' : 'cards'; } catch { return 'cards'; } };

// Filters live at module level so they survive navigating away and back, as they always have.
let saved = { season: 'all', type: 'all', player: 'all', set: 'all' };

export default function Games() {
  const { D, me, enabledSets, arg, gid, hashFor } = usePage();
  const [gf, setGf] = useState(saved);
  const [view, setViewState] = useState(readView);   // 'cards' | 'table' on a wide screen (ux 'redesign'); a phone always gets cards
  const setView = v => { setViewState(v); try { localStorage.setItem('dl.gamesview', v); } catch { /* not remembered */ } };
  // null, or { editId, draft? } (editId null = a new game). Arriving from the Randomizer's "Use this kingdom" opens a new game already filled in.
  const [modal, setModal] = useState(() => { const d = me && me.is_admin ? takeKingdomDraft() : null; return d ? { editId: null, draft: d } : null; });
  // Changing a filter resets the sort and collapses expanded rows, as the old full re-render did
  // (the table is re-keyed on the filters below).
  const set = k => e => { saved = { ...gf, [k]: e.target.value }; setGf(saved); };
  const canEdit = !!(me && me.is_admin);

  const matches = (g, f) => (f.season === 'all' || String(g.season) === f.season) && (f.type === 'all' || g.type === f.type)
    && (f.player === 'all' || g.places[f.player] != null) && (f.set === 'all' || g.sets.includes(f.set));
  // #/games/<group>/<id> — a link to one game opens that game's report (components/GameReport.jsx), the deepest view there is. An id that isn't in this group
  // is ignored and the list shows as usual.
  const target = /^\d+$/.test(arg || '') ? D.games.find(g => g.line === +arg) : null;
  // #/games/<group>?game=<id> — the list with that game opened, tinted and scrolled to (Records and badge dates link here). Arriving clears any filters that would hide it.
  const hlId = (/^\?game=(\d+)$/.exec(arg || '') || [])[1];
  const hl = hlId ? D.games.find(g => g.line === +hlId) : null;
  useLayoutEffect(() => {
    if (hl && !matches(hl, saved)) { saved = { season: 'all', type: 'all', player: 'all', set: 'all' }; setGf(saved); }
  }, [arg]);   // eslint-disable-line react-hooks/exhaustive-deps

  const list = D.games.filter(g => matches(g, gf)).slice().reverse();
  if (target) return <><GroupSwitcher route="games" /><Suspense fallback={<p className="loading">Loading the game…</p>}><GameReport key={target.line} game={target} /></Suspense></>;

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
      <span className="f">Set <SetSelect id="gfset" value={gf.set} sets={SET_NAMES.filter(n => enabledSets.has(n) || D.records.sets[n])} onChange={v => { saved = { ...gf, set: v }; setGf(saved); }} /></span>
    </>
  );

  return (
    <>
      <div className="head">
        <div><h1>Games</h1><p className="lede">Every table we've logged, newest first. Winners in bold.</p></div>
        {canEdit && <a className="btn gamenight" href={hashFor('night', gid)}><img src="icons/nav/add-a-game.png" alt="" />Game night</a>}
      </div>
      <GroupSwitcher route="games" />
      <Banner />
      <FilterFold active={['season', 'type', 'player', 'set'].filter(k => gf[k] !== 'all').length}>
        <div className="controls" style={{ marginTop: 8 }}>{selects}</div>
      </FilterFold>
      <div className="gview-bar">
        <p className="meta" role="status">{list.length} table{list.length === 1 ? '' : 's'}</p>
        <div className="gview-switch" role="group" aria-label="Show games as">
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Cards</button>
          <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
        </div>
      </div>
      {modal && <Suspense fallback={null}><GameModal key={String(modal.editId)} editId={modal.editId} draft={modal.draft} onClose={() => setModal(null)} /></Suspense>}
      {list.length ? <GamesTable key={`${gf.season}|${gf.type}|${gf.player}|${gf.set}|${hl ? hl.line : ''}`} games={list} highlight={hl ? hl.line : undefined} mark={gf.player !== 'all' ? gf.player : null} view={view} onEdit={canEdit ? id => setModal({ editId: id }) : undefined} /> : <p className="empty">Nothing matches those filters.</p>}
    </>
  );
}
