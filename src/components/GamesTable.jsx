import { Fragment, useEffect, useRef, useState } from 'react';
import { useOpenGames } from '../lib/entryState.js';
import { setIconPath } from '../lib/sets.js';
import GameFinish, { finishText } from './GameFinish.jsx';
import GameDetail from './GameDetail.jsx';
import SetIcon from './SetIcon.jsx';
import TypePill from './TypePill.jsx';
import LandscapePills from './LandscapePills.jsx';
import SortableTable from './SortableTable.jsx';
import GameCards from './GameCards.jsx';
import { useWide } from '../useMedia.js';
import { usePage } from '../PageContext.js';
import { usePager } from '../dominion/components/Pager.jsx';

const PAGE_SIZES = [6, 12, 24], DEFAULT_SIZE = 12;   // games per page: 12 at first, then 6, 24 or all

// Sortable list of games, each row expandable into its per-player breakdown. `onEdit(line)` adds the
// admin Edit column. Re-key it (e.g. on filter changes) to reset the sort and collapse every row.
// `paged` adds the Games page's pager. `highlight` (a game id) opens that row, tints it and scrolls it into view — used by links to a game.
export default function GamesTable({ games, onEdit, highlight, view = 'cards', mark, stateKey = '', paged = false }) {   // `stateKey`: what the expanded rows belong to (a filter choice, a season): another value starts closed   // a wide screen shows cards unless the Games page's switch says table
  const [open, toggle] = useOpenGames('games|' + stateKey + (mark === undefined ? '' : '|' + mark), () => new Set(highlight != null ? [highlight] : []));   // kept for Back (lib/entryState.js)
  const wrap = useRef(null);
  const wide = useWide();
  // a link to one game opens on the page that game is on
  const at = highlight != null ? games.findIndex(g => g.line === highlight) : -1;
  const { pg, pager } = usePager(games, 'games', PAGE_SIZES, { size: DEFAULT_SIZE, page: at >= 0 ? Math.floor(at / DEFAULT_SIZE) + 1 : 1 });
  const shown = paged ? pg.items : games;   // `paged`: the Games page (6, 12, 24 or all); the other lists show everything
  const { me } = usePage();
  const marked = mark === undefined ? (me ? me.name : null) : mark;   // whose name is highlighted: the signed-in player unless the page says otherwise (null = nobody)
  const showTable = wide && view === 'table', showCards = !showTable;   // render only the layout in use: a phone never needs the wide table's thousands of cells
  useEffect(() => {
    if (highlight == null || !wrap.current) return;
    const row = [...wrap.current.querySelectorAll(`[data-g="${highlight}"]`)].find(e => e.offsetParent !== null);   // the table row or, on a phone with the card list, the card
    if (row) row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [highlight]);
  // on a phone only the date and the finish order stay as columns; sets, VP, landscapes and notes live in the expanded row
  const head = [{ label: '' }, { label: 'Date', cls: 'l' }, { label: '' }, { label: 'Finish', cls: 'l' }, { label: 'Sets', cls: 'l dn-hide-sm' },
    { label: 'VP', cls: 'dn-hide-sm' }, { label: 'Landscapes', cls: 'l dn-hide-sm' }, { label: 'Notes', cls: 'l dn-hide-sm' }, ...(onEdit ? [{ label: '', cls: 'dn-hide-sm' }] : [])];
  const rows = !showTable ? [] : shown.map(g => {
    const isOpen = open.has(g.line);
    return {
      key: g.line, data: g.line, className: 'grow' + (isOpen ? ' open' : '') + (g.line === highlight ? ' hl' : ''), onClick: () => toggle(g.line), open: isOpen,
      detail: <GameDetail game={g} onEdit={onEdit} />,
      cells: [
        { node: '▸', className: 'chev' },
        g.date,
        { node: <TypePill type={g.type} />, text: g.type === 'Playoff' || g.type === 'Friendly' ? g.type : '' },
        { node: <GameFinish game={g} me={marked} />, text: finishText(g), className: 'wrap' },
        { node: g.sets.map((s, i) => <Fragment key={s}>{i > 0 && ' '}{setIconPath(s) ? <SetIcon name={s} size={22} /> : s}</Fragment>), text: g.sets.map(s => setIconPath(s) ? '' : s).join(' '), className: 'wrap dn-hide-sm' },
        g.vp ?? '',
        { node: <LandscapePills game={g} />, text: (g.landscapes || []).join(' '), className: 'wrap dn-hide-sm' },
        { node: g.notes, text: g.notes, className: 'wrap dn-hide-sm' },
        ...(onEdit ? [{ node: <a href="#" data-edit={g.line} onClick={e => { e.preventDefault(); e.stopPropagation(); onEdit(g.line); }}>Edit</a>, text: '', className: 'dn-hide-sm' }] : []),
      ],
    };
  });
  // the cards are the phone layout; a wide screen shows them too (view 'cards') or keeps the sortable table (view 'table')
  return <><div ref={wrap} className={'gview-' + view}>{showTable && <div className="gtable"><SortableTable head={head} rows={rows} /></div>}{showCards && <GameCards games={shown} open={open} toggle={toggle} onEdit={onEdit} showDate highlight={highlight} me={marked || undefined} />}</div>{paged && games.length > 0 && pager}</>;
}
