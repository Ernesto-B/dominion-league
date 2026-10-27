import { Fragment, useState } from 'react';
import { usePage } from '../PageContext.js';
import { openGameModal } from '../legacy/pages.js';
import { SET_NAMES, setIconPath } from '../lib/sets.js';
import GroupSwitcher from '../components/GroupSwitcher.jsx';
import Banner from '../components/Banner.jsx';
import GameFinish, { finishText } from '../components/GameFinish.jsx';
import GameDetail from '../components/GameDetail.jsx';
import SetIcon from '../components/SetIcon.jsx';
import TypePill from '../components/TypePill.jsx';
import LandscapePills from '../components/LandscapePills.jsx';
import SortableTable from '../components/SortableTable.jsx';

// Filters live at module level so they survive navigating away and back, as they always have.
let saved = { season: 'all', type: 'all', player: 'all', set: 'all' };

export default function Games() {
  const page = usePage();
  const { D, me, enabledSets } = page;
  const [gf, setGf] = useState(saved);
  const [open, setOpen] = useState(() => new Set());
  // Changing a filter resets the sort and collapses expanded rows, as the old full re-render did
  // (the table is re-keyed on the filters below).
  const set = k => e => { saved = { ...gf, [k]: e.target.value }; setGf(saved); setOpen(new Set()); };
  const canEdit = !!(me && me.is_admin);

  const list = D.games.filter(g =>
    (gf.season === 'all' || String(g.season) === gf.season) && (gf.type === 'all' || g.type === gf.type)
    && (gf.player === 'all' || g.places[gf.player] != null) && (gf.set === 'all' || g.sets.includes(gf.set))).slice().reverse();

  const toggle = line => setOpen(o => { const n = new Set(o); n.has(line) ? n.delete(line) : n.add(line); return n; });
  const head = [{ label: '' }, { label: 'Date', cls: 'l' }, { label: '' }, { label: 'Finish', cls: 'l' }, { label: 'Sets', cls: 'l' },
    { label: 'VP' }, { label: 'Landscapes', cls: 'l' }, { label: 'Notes', cls: 'l' }, ...(canEdit ? [{ label: '' }] : [])];
  const rows = list.map(g => {
    const isOpen = open.has(g.line);
    return {
      key: g.line, data: g.line, className: 'grow' + (isOpen ? ' open' : ''), onClick: () => toggle(g.line), open: isOpen,
      detail: <GameDetail game={g} />,
      cells: [
        { node: '▸', className: 'chev' },
        g.date,
        { node: <TypePill type={g.type} />, text: g.type === 'Playoff' || g.type === 'Friendly' ? g.type : '' },
        { node: <GameFinish game={g} />, text: finishText(g), className: 'wrap' },
        { node: g.sets.map((s, i) => <Fragment key={s}>{i > 0 && ' '}{setIconPath(s) ? <SetIcon name={s} size={22} /> : s}</Fragment>), text: g.sets.map(s => setIconPath(s) ? '' : s).join(' '), className: 'wrap' },
        g.vp ?? '',
        { node: <LandscapePills game={g} />, text: (g.landscapes || []).join(' '), className: 'wrap' },
        { node: g.notes, text: g.notes, className: 'wrap' },
        ...(canEdit ? [{ node: <a href="#" data-edit={g.line} onClick={e => { e.preventDefault(); e.stopPropagation(); openGameModal(page, g.line); }}>Edit</a>, text: '' }] : []),
      ],
    };
  });

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
      {list.length ? <SortableTable key={`${gf.season}|${gf.type}|${gf.player}|${gf.set}`} head={head} rows={rows} /> : <p className="empty">Nothing matches those filters.</p>}
    </>
  );
}
