import { useMemo, useState } from 'react';
import { RECOMMENDED, extrasNote, itemsOfSet } from '../recommended.js';
import { SET_NAMES } from '../../lib/sets.js';
import SetIcon from '../../components/SetIcon.jsx';
import { Chip } from './bits.jsx';

/* Game night's "Recommended" way: the rulebooks' suggested kingdoms. A row of expansion buttons narrows the list to the sets that use it; a set that needs a card the catalog
   does not have (an expansion switched off in Admin) or one already at the other table is not offered. Choosing one hands its items (and Bane) to `onChoose`.
   catalog; avoid ([{id}], the other table's cards and landscapes); onChoose(items, baneId, set) */
export default function RecommendedPicker({ catalog, avoid = [], onChoose }) {
  const [exp, setExp] = useState('all');
  const taken = useMemo(() => new Set((avoid || []).map(i => i.id)), [avoid]);
  const offered = useMemo(() => RECOMMENDED.map(set => ({ set, ...itemsOfSet(catalog, set) })).filter(x => !x.missing.length), [catalog]);
  const expansions = SET_NAMES.filter(n => offered.some(x => x.set.sets.includes(n)));
  const shown = offered.filter(x => exp === 'all' || x.set.sets.includes(exp));
  const label = sets => (sets.length > 1 && sets[0] === 'Base' ? ['Dominion', ...sets.slice(1)] : sets).join(' + ');
  return (
    <section className="dn-rec" aria-label="Recommended kingdoms">
      <p className="night-q">Which recommended kingdom?</p>
      <div className="dn-chips" role="group" aria-label="Expansion">
        <Chip pressed={exp === 'all'} onClick={() => setExp('all')}>All</Chip>
        {expansions.map(n => <Chip key={n} pressed={exp === n} label={n} onClick={() => setExp(n)}><SetIcon name={n} size={22} /></Chip>)}
      </div>
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
