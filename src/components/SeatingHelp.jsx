import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import { f0 } from '../lib/format.js';
import { MAX_PLAYERS, MAX_SEATS, firstTimers, metPairs, suggestSplit } from '../lib/seating.js';

/* Under the player pills on Game night: a table seats MAX_PLAYERS at most. With more picked it offers a fair split over two tables (and says how many pairs would sit together for the
   first time); with a table-sized group it just points out who has never played each other. `canSeat` is false when the other table is already under way. */
export default function SeatingHelp({ picked, canSeat, onSeat }) {
  const { D } = usePage();
  const met = useMemo(() => metPairs(D.games), [D.games]);
  const over = picked.length > MAX_PLAYERS;
  const split = useMemo(() => {
    if (!over || picked.length > MAX_SEATS) return null;
    return suggestSplit(D.preview(picked).map(x => ({ name: x.name, elo: x.elo })), met);
  }, [over, picked, D, met]);
  if (over) {
    return (
      <div className="seating" role="group" aria-label="Seating">
        <p className="night-nudge seating-warn" role="alert">A table seats at most {MAX_PLAYERS} players. {picked.length > MAX_SEATS ? `That is more than two tables can seat (${MAX_SEATS}): take ${picked.length - MAX_SEATS} off.` : 'Split the group over two tables:'}</p>
        {split && (
          <>
            <div className="seating-split">
              {[['Table 1', split.a, split.avgA], ['Table 2', split.b, split.avgB]].map(([label, names, avg]) => (
                <div key={label} className="seating-table"><b>{label}</b> <span className="meta">avg Elo {f0(avg)}</span><p>{names.join(' · ')}</p></div>
              ))}
            </div>
            <p className="meta">Balanced on average Elo{split.firstTimes ? `, with ${split.firstTimes} pairing${split.firstTimes === 1 ? '' : 's'} who have never played each other sitting together` : ''}.</p>
            <button type="button" className="ghost" disabled={!canSeat} onClick={() => onSeat(split.a, split.b)}>Seat them at two tables</button>
            {!canSeat && <p className="meta">The other table is already under way, so it can’t be re-seated from here.</p>}
          </>
        )}
      </div>
    );
  }
  const pairs = picked.length >= 2 ? firstTimers(picked, met) : [];
  if (!pairs.length) return null;
  const shown = pairs.slice(0, 4);
  return (
    <p className="meta seating-new">First time at a table together: {shown.map(([a, b]) => `${a} & ${b}`).join(', ')}{pairs.length > shown.length ? ` and ${pairs.length - shown.length} more` : ''}.</p>
  );
}
