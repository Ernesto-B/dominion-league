import { Fragment, useState } from 'react';
import { long, sgn } from '../lib/format.js';
import GameFinish, { ordered } from './GameFinish.jsx';
import GameDetail from './GameDetail.jsx';
import TypePill from './TypePill.jsx';
import GameCards from './GameCards.jsx';

// The most recent night's tables, newest first, each expandable into its per-player breakdown.
export default function LastNight({ games }) {
  const [open, setOpen] = useState(() => new Set());
  if (!games.length) return null;
  const { day, date } = games[games.length - 1];
  const todays = games.filter(g => g.day === day).slice().reverse();
  const toggle = line => setOpen(o => { const n = new Set(o); n.has(line) ? n.delete(line) : n.add(line); return n; });
  return (
    <>
      <h2>Last night, {long(date)}</h2>
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
              <tr className="gdetail" data-g={g.line} hidden={!isOpen}><td colSpan={4}><GameDetail game={g} /></td></tr>
            </Fragment>
          );
        })}</tbody>
      </table></div>
      <GameCards games={todays} open={open} toggle={toggle} link />
      </div>
    </>
  );
}
