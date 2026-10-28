import { Fragment, useEffect, useRef, useState } from 'react';
import { setIconPath } from '../lib/sets.js';
import GameFinish, { finishText } from './GameFinish.jsx';
import GameDetail from './GameDetail.jsx';
import SetIcon from './SetIcon.jsx';
import TypePill from './TypePill.jsx';
import LandscapePills from './LandscapePills.jsx';
import SortableTable from './SortableTable.jsx';
import GameCards from './GameCards.jsx';

// Sortable list of games, each row expandable into its per-player breakdown. `onEdit(line)` adds the
// admin Edit column. Re-key it (e.g. on filter changes) to reset the sort and collapse every row.
// `highlight` (a game id) opens that row, tints it and scrolls it into view — used by links to a game.
export default function GamesTable({ games, onEdit, highlight, view = 'cards', link = false }) {   // a wide screen shows cards unless the Games page's switch says table
  const [open, setOpen] = useState(() => new Set(highlight != null ? [highlight] : []));
  const wrap = useRef(null);
  useEffect(() => {
    if (highlight == null || !wrap.current) return;
    const row = [...wrap.current.querySelectorAll(`[data-g="${highlight}"]`)].find(e => e.offsetParent !== null);   // the table row or, on a phone with the card list, the card
    if (row) row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [highlight]);
  const toggle = line => setOpen(o => { const n = new Set(o); n.has(line) ? n.delete(line) : n.add(line); return n; });
  // on a phone only the date and the finish order stay as columns; sets, VP, landscapes and notes live in the expanded row
  const head = [{ label: '' }, { label: 'Date', cls: 'l' }, { label: '' }, { label: 'Finish', cls: 'l' }, { label: 'Sets', cls: 'l dn-hide-sm' },
    { label: 'VP', cls: 'dn-hide-sm' }, { label: 'Landscapes', cls: 'l dn-hide-sm' }, { label: 'Notes', cls: 'l dn-hide-sm' }, ...(onEdit ? [{ label: '', cls: 'dn-hide-sm' }] : [])];
  const rows = games.map(g => {
    const isOpen = open.has(g.line);
    return {
      key: g.line, data: g.line, className: 'grow' + (isOpen ? ' open' : '') + (g.line === highlight ? ' hl' : ''), onClick: () => toggle(g.line), open: isOpen,
      detail: <GameDetail game={g} onEdit={onEdit} />,
      cells: [
        { node: '▸', className: 'chev' },
        g.date,
        { node: <TypePill type={g.type} />, text: g.type === 'Playoff' || g.type === 'Friendly' ? g.type : '' },
        { node: <GameFinish game={g} />, text: finishText(g), className: 'wrap' },
        { node: g.sets.map((s, i) => <Fragment key={s}>{i > 0 && ' '}{setIconPath(s) ? <SetIcon name={s} size={22} /> : s}</Fragment>), text: g.sets.map(s => setIconPath(s) ? '' : s).join(' '), className: 'wrap dn-hide-sm' },
        g.vp ?? '',
        { node: <LandscapePills game={g} />, text: (g.landscapes || []).join(' '), className: 'wrap dn-hide-sm' },
        { node: g.notes, text: g.notes, className: 'wrap dn-hide-sm' },
        ...(onEdit ? [{ node: <a href="#" data-edit={g.line} onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(g.line); }}>Edit</a>, text: '', className: 'dn-hide-sm' }] : []),
      ],
    };
  });
  // the cards are the phone layout; a wide screen shows them too (view 'cards') or keeps the sortable table (view 'table')
  return <div ref={wrap} className={'gview-' + view}><div className="gtable"><SortableTable head={head} rows={rows} /></div><GameCards games={games} open={open} toggle={toggle} onEdit={onEdit} showDate highlight={highlight} link={link} /></div>;
}
