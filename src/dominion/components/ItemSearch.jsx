import { useState } from 'react';
import { displayName, searchKingdom } from '../kingdom.js';
import CostIcons from './Cost.jsx';
import { ExpansionBadge, LandscapePill } from './bits.jsx';

/* A name search over the catalog's cards and/or landscapes, with the matches listed under it as buttons. Used wherever the
   viewer builds a list by name: a game's kingdom in the Add Game dialog, Game night's hand-picking, and the Randomizer's "always / never include". Each match leads with its expansion's icon (the box it lives in).
   `onAdd(match)` may return a string to say why it wasn't added (it is shown, and the search kept). Enter adds the top
   match; Escape clears the search first (and stops there, so it doesn't also close a dialog around it). */
export default function ItemSearch({ catalog, taken = [], kind = null, label, placeholder = 'Start typing a name…', onAdd }) {
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const results = searchKingdom(catalog, q, taken, 8, kind);
  const add = x => { const why = onAdd(x); if (typeof why === 'string' && why) setNote(why); else { setNote(''); setQ(''); } };
  const onKey = e => {
    if (e.key === 'Enter') { e.preventDefault(); if (results[0]) add(results[0]); }
    else if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); setNote(''); }
  };
  return (
    <>
      <label className="f dn-kpicker-search">{label}
        <input type="search" value={q} onChange={e => { setQ(e.target.value); setNote(''); }} onKeyDown={onKey} placeholder={placeholder} autoComplete="off" />
      </label>
      {note && <p className="meta dn-kpicker-note" role="alert">{note}</p>}
      {q.trim() && (results.length ? (
        <ul className="dn-kresults" aria-label="Matches">{results.map(x => (
          <li key={`${x.kind}:${x.obj.id}`}><button type="button" onClick={() => add(x)}>
            <ExpansionBadge name={x.obj.expansion} size={20} iconOnly />
            {x.kind === 'card' ? <CostIcons coins={x.obj.coins} debt={x.obj.debt} overpay={x.obj.overpay} size={22} /> : <>{x.obj.coins != null && <CostIcons coins={x.obj.coins} debt={x.obj.debt} size={22} />}<LandscapePill type={x.obj.type} /></>}
            <span className="dn-kresults-name">{x.kind === 'card' ? displayName(x.obj) : x.obj.name}</span>
            <span className="meta">{x.kind === 'card' ? x.obj.types.join(' · ') : x.obj.expansion}</span>
          </button></li>
        ))}</ul>
      ) : <p className="meta">Nothing called “{q.trim()}”.</p>)}
    </>
  );
}
