import { useEffect, useMemo, useState } from 'react';
import { RECOMMENDED, extrasNote, itemsOfSet } from '../recommended.js';
import { SET_NAMES } from '../../lib/sets.js';
import SetIcon from '../../components/SetIcon.jsx';
import { Chip } from './bits.jsx';

/* Game night's "Recommended" way: the rulebooks' suggested kingdoms. A row of expansion buttons narrows the list to the sets that use it; a set that needs a card the catalog
   does not have (an expansion switched off in Admin) or one already at the other table is not offered. Choosing one hands its items (and Bane) to `onChoose`.
   Up to TWO expansions can be picked: the list then holds the sets that use both (a third is refused with a short note under the buttons).
   catalog; avoid ([{id}], the other table's cards and landscapes); onChoose(items, baneId, set) */
export default function RecommendedPicker({ catalog, avoid = [], onChoose }) {
  const [picked, setPicked] = useState([]);   // up to two expansions; none = all
  const [full, setFull] = useState(false);     // a third was tried: say so for a moment
  useEffect(() => { if (!full) return undefined; const t = setTimeout(() => setFull(false), 3500); return () => clearTimeout(t); }, [full]);
  const toggle = n => { if (picked.includes(n)) { setPicked(picked.filter(x => x !== n)); setFull(false); } else if (picked.length >= 2) setFull(true); else setPicked([...picked, n]); };
  const taken = useMemo(() => new Set((avoid || []).map(i => i.id)), [avoid]);
  const offered = useMemo(() => RECOMMENDED.map(set => ({ set, ...itemsOfSet(catalog, set) })).filter(x => !x.missing.length), [catalog]);
  const expansions = SET_NAMES.filter(n => offered.some(x => x.set.sets.includes(n)));
  const shown = offered.filter(x => picked.every(n => x.set.sets.includes(n)));
  const label = sets => (sets.length > 1 && sets[0] === 'Base' ? ['Dominion', ...sets.slice(1)] : sets).join(' + ');
  return (
    <section className="dn-rec" aria-label="Recommended kingdoms">
      <p className="night-q">Which recommended kingdom?</p>
      <div className="dn-chips" role="group" aria-label="Expansions (pick up to two)">
        <Chip pressed={!picked.length} onClick={() => { setPicked([]); setFull(false); }}>All</Chip>
        {expansions.map(n => <Chip key={n} pressed={picked.includes(n)} label={n} onClick={() => toggle(n)}><SetIcon name={n} size={22} /></Chip>)}
      </div>
      {full
        ? <p className="dn-rec-note warn" role="alert">You can pick at most two expansions. Tap one to take it off first.</p>
        : <p className="dn-rec-note meta" role="status">{picked.length === 2 ? `Sets that use ${picked.join(' and ')} · ${shown.length}` : picked.length === 1 ? `Sets that use ${picked[0]}. Pick a second expansion to narrow it · ${shown.length}` : 'Pick up to two expansions to narrow the list'}</p>}
      {picked.length > 0 && !shown.length && <p className="meta">No recommended kingdom uses both.</p>}
      {!offered.length && <p className="meta">No recommended kingdom fits the expansions that are switched on.</p>}
      <ul className="dn-rec-list">
        {shown.map(({ set, items, baneId }) => {
          const busy = items.some(i => taken.has(i.id)), note = extrasNote(set);
          return (
            <li key={set.id}>
              <button type="button" className="dn-rec-item" disabled={busy} onClick={() => onChoose(items, baneId, set)}>
                <span className="dn-rec-name">{set.name}</span>
                <span className="dn-rec-sets">{set.sets.map(n => <SetIcon key={n} name={n} size={16} />)}<span className="meta">{label(set.sets)}</span></span>
                {(set.landscapes.length > 0 || note.length > 0) && <span className="meta dn-rec-extra">{[...(set.landscapes.length ? [`${set.landscapes.length} landscape${set.landscapes.length === 1 ? '' : 's'}`] : []), ...note].join(' · ')}</span>}
                {busy && <span className="meta dn-rec-extra">in use at the other table</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
