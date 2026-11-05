
import { Suspense, lazy, useLayoutEffect, useState } from 'react';
import { usePage } from '../PageContext.js';
import { SET_NAMES } from '../lib/sets.js';
import Banner from '../components/Banner.jsx';
import FilterFold from '../components/FilterFold.jsx';
import GamesTable from '../components/GamesTable.jsx';
import SetSelect from '../components/SetSelect.jsx';
import KingdomWall from '../components/KingdomWall.jsx';
import { useWide } from '../useMedia.js';
import { nightGroup } from '../lib/groups.js';

// the Add/Edit dialog (with the kingdom picker and its catalog code) is only needed once someone opens it
const GameModal = lazy(() => import('../components/GameModal.jsx'));
// the report on one game (a link to #/games/<group>/<id>): deeper than anything the list can show, so it loads on its own
const GameReport = lazy(() => import('../components/GameReport.jsx'));

const readView = () => { try { const v = localStorage.getItem('dl.gamesview'); return v === 'table' || v === 'kingdoms' ? v : 'cards'; } catch { return 'cards'; } };

// Filters live at module level so they survive navigating away and back, as they always have.
let saved = { season: 'all', type: 'all', player: 'all', set: 'all' };

export default function Games() {
  const { D, me, enabledSets, arg, gid, hashFor, allGroups } = usePage();
  const ngid = nightGroup(allGroups, gid);   // the group Game night will open in
  const hlGame = () => /^\?game=\d+$/.test(arg || '');
  const [gf, setGf] = useState(saved);
  const [view, setViewState] = useState(readView);   // 'cards' | 'table' | 'kingdoms'; a phone has no table, so it shows cards instead
  const wide = useWide();
  const shownView = (view === 'table' && !wide) || (view === 'kingdoms' && hlGame()) ? 'cards' : view;   // a link to one game (?game=) shows the list it is highlighted in
  const setView = v => { setViewState(v); try { localStorage.setItem('dl.gamesview', v); } catch { /* not remembered */ } };
  // null, or { editId } (editId null = a new game)
  const [modal, setModal] = useState(null);
  // Changing a filter resets the sort and collapses expanded rows, as the old full re-render did
  // (the table is re-keyed on the filters below).
  const set = k => e => { saved = { ...gf, [k]: e.target.value }; setGf(saved); };
  const canEdit = !!(me && me.is_admin);

  const matches = (g, f) => (f.season === 'all' || String(g.season) === f.season) && (f.type === 'all' || g.type === f.type)
    && (f.player === 'all' || g.places[f.player] != null) && (f.set === 'all' || g.sets.includes(f.set));
  // #/games/<group>/<id> — a link to one game opens that game's report (components/GameReport.jsx), the deepest view there is. An id that isn't in this group
  // is ignored and the list shows as usual.
  const argId = (arg || '').split('?')[0];   // `?tab=kingdom` after the id is the report's open tab (GameReport.jsx)
  const target = /^\d+$/.test(argId) ? D.games.find(g => g.line === +argId) : null;
  // #/games/<group>?game=<id> — the list with that game opened, tinted and scrolled to (Records and badge dates link here). Arriving clears any filters that would hide it.
  const hlId = (/^\?game=(\d+)$/.exec(arg || '') || [])[1];
  const hl = hlId ? D.games.find(g => g.line === +hlId) : null;
  useLayoutEffect(() => {
    if (hl && !matches(hl, saved)) { saved = { season: 'all', type: 'all', player: 'all', set: 'all' }; setGf(saved); }
  }, [arg]);   // eslint-disable-line react-hooks/exhaustive-deps

  const list = D.games.filter(g => matches(g, gf)).slice().reverse();
  if (target) return <><Suspense fallback={<p className="loading">Loading the game…</p>}><GameReport key={target.line} game={target} /></Suspense></>;

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
          {D.players.map(p => p.name).sort((a, b) => a.localeCompare(b)).map(n => <option key={n}>{n}</option>)}
        </select></label>
      <span className="f">Set <SetSelect id="gfset" value={gf.set} sets={SET_NAMES.filter(n => enabledSets.has(n) || D.records.sets[n])} onChange={v => { saved = { ...gf, set: v }; setGf(saved); }} /></span>
    </>
  );

  return (
    <>
      <div className="head">
        <div><h1>Games</h1><p className="lede">Every table we've logged, newest first. Winners in bold.</p></div>
        {canEdit && <a className="btn gamenight" href={hashFor('night', ngid)}><img src="icons/nav/add-a-game.png" alt="" />Game night</a>}
      </div>
      <Banner />
      <FilterFold active={['season', 'type', 'player', 'set'].filter(k => gf[k] !== 'all').length}>
        <div className="controls" style={{ marginTop: 8 }}>{selects}</div>
      </FilterFold>
      <div className="gview-bar">
        <p className="meta" role="status">{shownView === 'kingdoms' ? `${list.filter(g => g.kingdom && g.kingdom.length && g.n >= 2).length} kingdom${list.filter(g => g.kingdom && g.kingdom.length && g.n >= 2).length === 1 ? '' : 's'} logged in ` : ''}{list.length} table{list.length === 1 ? '' : 's'}</p>
        <div className="gview-switch" role="group" aria-label="Show games as">
          <button type="button" aria-pressed={shownView === 'cards'} onClick={() => setView('cards')}>Cards</button>
          <button type="button" className="only-wide" aria-pressed={shownView === 'table'} onClick={() => setView('table')}>Table</button>
          <button type="button" aria-pressed={shownView === 'kingdoms'} onClick={() => setView('kingdoms')}>Kingdoms</button>
        </div>
      </div>
      {modal && <Suspense fallback={null}><GameModal key={String(modal.editId)} editId={modal.editId} onClose={() => setModal(null)} /></Suspense>}
      {list.length && shownView === 'kingdoms' ? <KingdomWall key={`${gf.season}|${gf.type}|${gf.player}|${gf.set}`} games={list} /> : list.length ? <GamesTable paged key={`${gf.season}|${gf.type}|${gf.player}|${gf.set}|${hl ? hl.line : ''}`} stateKey={`${gf.season}|${gf.type}|${gf.player}|${gf.set}|${hl ? hl.line : ''}`} games={list} highlight={hl ? hl.line : undefined} mark={gf.player !== 'all' ? gf.player : null} view={shownView === 'table' ? 'table' : 'cards'} onEdit={canEdit ? id => setModal({ editId: id }) : undefined} /> : <p className="empty">Nothing matches those filters.</p>}
    </>
  );
}
