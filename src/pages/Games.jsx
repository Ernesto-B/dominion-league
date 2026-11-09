
import { Suspense, lazy, useLayoutEffect, useState } from 'react';
import { usePage } from '../PageContext.js';
import { SET_NAMES } from '../lib/sets.js';
import Banner from '../components/Banner.jsx';
import FacetBar from '../dominion/components/FacetBar.jsx';
import { Chip } from '../dominion/components/bits.jsx';
import NameIcon from '../components/NameIcon.jsx';
import { scrollFadeRef } from '../lib/scrollFade.js';
import SetIcon from '../components/SetIcon.jsx';
import GamesTable from '../components/GamesTable.jsx';
import KingdomWall from '../components/KingdomWall.jsx';
import PendingGames from '../components/PendingGames.jsx';
import { useWide } from '../useMedia.js';
import { nightGroup } from '../lib/groups.js';

// the Add/Edit dialog (with the kingdom picker and its catalog code) is only needed once someone opens it
const GameModal = lazy(() => import('../components/GameModal.jsx'));
// the report on one game (a link to #/games/<group>/<id>): deeper than anything the list can show, so it loads on its own
const GameReport = lazy(() => import('../components/GameReport.jsx'));

const readView = () => { try { const v = localStorage.getItem('dl.gamesview'); return v === 'table' || v === 'kingdoms' ? v : 'cards'; } catch { return 'cards'; } };

// Filters live at module level so they survive navigating away and back, as they always have.
let saved = { season: 'all', player: 'all', set: 'all' };

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

  const matches = (g, f) => (f.season === 'all' || String(g.season) === f.season)
    && (f.player === 'all' || g.places[f.player] != null) && (f.set === 'all' || g.sets.includes(f.set));
  // #/games/<group>/<id> — a link to one game opens that game's report (components/GameReport.jsx), the deepest view there is. An id that isn't in this group
  // is ignored and the list shows as usual.
  const argId = (arg || '').split('?')[0];   // `?tab=kingdom` after the id is the report's open tab (GameReport.jsx)
  const target = /^\d+$/.test(argId) ? D.games.find(g => g.line === +argId) : null;
  // #/games/<group>?game=<id> — the list with that game opened, tinted and scrolled to (Records and badge dates link here). Arriving clears any filters that would hide it.
  const hlId = (/^\?game=(\d+)$/.exec(arg || '') || [])[1];
  const hl = hlId ? D.games.find(g => g.line === +hlId) : null;
  useLayoutEffect(() => {
    if (hl && !matches(hl, saved)) { saved = { season: 'all', player: 'all', set: 'all' }; setGf(saved); }
  }, [arg]);   // eslint-disable-line react-hooks/exhaustive-deps

  const list = D.games.filter(g => matches(g, gf)).slice().reverse();
  if (target) return <><Suspense fallback={<p className="loading">Loading the game…</p>}><GameReport key={target.line} game={target} /></Suspense></>;

  // the same row of facet buttons as the Collection's tables: each shows what is chosen, and its choices open right under the row (a pick closes it)
  const pick = (k, v) => { saved = { ...gf, [k]: v }; setGf(saved); };
  const one = (k, all, items) => <div className="dn-chips" role="group">{[['all', all], ...items].map(([v, text]) => <Chip key={v} pressed={gf[k] === v} onClick={() => pick(k, v)}>{text}</Chip>)}</div>;
  const names = D.players.map(p => p.name).sort((a, b) => a.localeCompare(b));
  const sets = SET_NAMES.filter(n => enabledSets.has(n) || D.records.sets[n]);
  const facets = [
    { id: 'season', label: 'Season', single: true, value: gf.season === 'all' ? null : (D.seasons.find(s => String(s.number) === gf.season) || {}).name, children: one('season', 'All seasons', D.seasons.map(s => [String(s.number), s.name])) },
    { id: 'player', label: 'Player', menu: true, value: gf.player === 'all' ? null : gf.player, children: (
      // the player list looks like the Player page's picker: each name with their tier icon, scrolling when long
      <nav className="pp-menu" ref={scrollFadeRef} aria-label="Choose a player">
        {['all', ...names].map(n => <button type="button" key={n} className="pp-opt" aria-pressed={gf.player === n} onClick={() => pick('player', n)}>{n === 'all' ? <span className="pp-all" aria-hidden="true" /> : <NameIcon name={n} size={18} />}{n === 'all' ? 'All' : n}</button>)}
      </nav>
    ) },
    ...(sets.length ? [{ id: 'set', label: 'Set', single: true, value: gf.set === 'all' ? null : gf.set, children: (
      <div className="dn-chips" role="group">{['all', ...sets].map(v => <Chip key={v} pressed={gf.set === v} onClick={() => pick('set', v)}>{v === 'all' ? 'All sets' : <span className="dn-exp"><SetIcon name={v} size={18} /><span className="dn-exp-label">{v}</span></span>}</Chip>)}</div>
    ) }] : []),
  ];

  return (
    <>
      <div className="head">
        <div><h1>Games</h1><p className="lede">Every table we've logged, newest first. Winners in bold.</p></div>
        {me && <a className="btn gamenight" href={hashFor('night', ngid)}><img src="icons/nav/add-a-game.png" alt="" />Game night</a>}
      </div>
      <Banner />
      <PendingGames />
      <FacetBar facets={facets} />
      <div className="gview-bar">
        <p className="meta" role="status">{shownView === 'kingdoms' ? `${list.filter(g => g.kingdom && g.kingdom.length && g.n >= 2).length} kingdom${list.filter(g => g.kingdom && g.kingdom.length && g.n >= 2).length === 1 ? '' : 's'} logged in ` : ''}{list.length} table{list.length === 1 ? '' : 's'}</p>
        <div className="gview-switch" role="group" aria-label="Show games as">
          <button type="button" aria-pressed={shownView === 'cards'} onClick={() => setView('cards')}>Cards</button>
          <button type="button" className="only-wide" aria-pressed={shownView === 'table'} onClick={() => setView('table')}>Table</button>
          <button type="button" aria-pressed={shownView === 'kingdoms'} onClick={() => setView('kingdoms')}>Kingdoms</button>
        </div>
      </div>
      {modal && <Suspense fallback={null}><GameModal key={String(modal.editId)} editId={modal.editId} onClose={() => setModal(null)} /></Suspense>}
      {list.length && shownView === 'kingdoms' ? <KingdomWall key={`${gf.season}|${gf.player}|${gf.set}`} games={list} /> : list.length ? <GamesTable paged key={`${gf.season}|${gf.player}|${gf.set}|${hl ? hl.line : ''}`} stateKey={`${gf.season}|${gf.player}|${gf.set}|${hl ? hl.line : ''}`} games={list} highlight={hl ? hl.line : undefined} mark={gf.player !== 'all' ? gf.player : null} view={shownView === 'table' ? 'table' : 'cards'} onEdit={canEdit ? id => setModal({ editId: id }) : undefined} /> : <p className="empty">Nothing matches those filters.</p>}
    </>
  );
}
