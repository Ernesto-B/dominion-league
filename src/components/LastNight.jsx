import { Fragment, Suspense, lazy, useState } from 'react';
import { usePage } from '../PageContext.js';
import { useOpenGames } from '../lib/entryState.js';
import { long, sgn } from '../lib/format.js';
import GameFinish, { ordered } from './GameFinish.jsx';
import GameDetail from './GameDetail.jsx';
import TypePill from './TypePill.jsx';
import GameCards from './GameCards.jsx';

export const RECENT_DAYS = 2;

const GameModal = lazy(() => import('./GameModal.jsx'));   // the Add/Edit dialog loads only when someone opens it

// The last two days on which tables were played, newest first and grouped by date, each table expandable into its per-player breakdown.
export default function LastNight({ games }) {
  const { me } = usePage();
  const [open, toggle] = useOpenGames('last-night');   // kept for Back (lib/entryState.js)
  const [modal, setModal] = useState(null);             // null, or { editId }: the same Edit game dialog the Games page opens
  const onEdit = me && me.is_admin ? id => setModal({ editId: id }) : undefined;
  if (!games.length) return null;
  const days = [...new Set(games.map(g => g.day))].sort((a, b) => b - a).slice(0, RECENT_DAYS);   // days with games, not calendar days: a weekly league would otherwise show one
  const title = days.length === 1 ? 'Last night' : `Last ${days.length} nights`;
  return (
    <>
      <h2>{title}</h2>
      {modal && <Suspense fallback={null}><GameModal key={String(modal.editId)} editId={modal.editId} onClose={() => setModal(null)} /></Suspense>}
      {days.map(day => {
        const todays = games.filter(g => g.day === day).slice().reverse();
        return (
          <section key={day} className="recent-day" aria-label={long(todays[0].date)}>
            <h3 className="recent-date">{long(todays[0].date)}</h3>
            <DayTables games={todays} open={open} toggle={toggle} onEdit={onEdit} />
          </section>
        );
      })}
    </>
  );
}

function DayTables({ games: todays, open, toggle, onEdit }) {
  return (
    <div className="gview-cards">
      <div className="tablewrap gtable"><table className="plain">
        <thead><tr><th></th><th className="l">Finish</th><th></th><th className="l">Elo change</th></tr></thead>
        <tbody>{todays.map(g => {
          const isOpen = open.has(g.line);
          const ch = ordered(g).filter(n => g.elo[n]).map(n => {
            const d = g.elo[n].after - g.elo[n].before;
            return <span className="chg" key={n}>{n} <b className={d > 0.5 ? 'up-t' : d < -0.5 ? 'down-t' : ''}>{sgn(d)}</b></span>;
          });
          return (
            <Fragment key={g.line}>
              <tr className={'grow' + (isOpen ? ' open' : '')} data-g={g.line} onClick={() => toggle(g.line)}>
                <td className="chev">▸</td>
                <td className="wrap"><GameFinish game={g} /></td>
                <td><TypePill type={g.type} /></td>
                <td className="wrap chgs">{ch.length ? ch : <span className="meta">No rating change</span>}</td>
              </tr>
              <tr className="gdetail" data-g={g.line} hidden={!isOpen}><td colSpan={4}><GameDetail game={g} onEdit={onEdit} editShown /></td></tr>
            </Fragment>
          );
        })}</tbody>
      </table></div>
      <GameCards games={todays} open={open} toggle={toggle} onEdit={onEdit} />
    </div>
  );
}
