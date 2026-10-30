import { useCatalogLoad } from '../dominion/CatalogContext.jsx';
import { KingdomChip, ShelfGroups } from '../dominion/components/KingdomChips.jsx';
import ItemSearch from '../dominion/components/ItemSearch.jsx';
import { openPeek } from '../dominion/components/CardPeek.jsx';
import { MAX_CARDS, MAX_LANDSCAPES, displayName, impliedSets, resolveKingdom } from '../dominion/kingdom.js';

/* The Kingdom section of the Add/Edit Game dialog. `items` is the kingdom so far; `onChange(items, implied)` reports every
   change, `implied` being the Sets / landscape groups the newly added item belongs to (so the dialog can tick them for you). */
export default function KingdomPicker({ items, onChange }) {
  const cat = useCatalogLoad();

  if (cat.status === 'loading') return <p className="meta">Loading the card list…</p>;
  if (cat.status === 'error') return (
    <p className="meta">The card list isn’t available right now, so a kingdom can’t be picked. You can still save the game without one{items.length ? ' (the kingdom already saved is kept as it is)' : ''}. <button type="button" className="ghost" onClick={cat.retry}>Try again</button></p>
  );

  const catalog = cat.catalog;
  const resolved = resolveKingdom(catalog, items);
  const nCards = items.filter(i => i.kind === 'card').length, nLands = items.length - nCards;
  const traits = resolved.filter(r => r.kind === 'landscape' && r.obj?.type === 'Trait');
  const nothing = { sets: [], landscapes: [] };

  const add = x => {
    if (x.kind === 'card' ? nCards >= MAX_CARDS : nLands >= MAX_LANDSCAPES) return x.kind === 'card' ? `A kingdom can have at most ${MAX_CARDS} cards.` : `A kingdom can have at most ${MAX_LANDSCAPES} landscapes.`;
    onChange([...items, { kind: x.kind, id: x.obj.id }], impliedSets(resolveKingdom(catalog, [{ kind: x.kind, id: x.obj.id }])));
  };
  const remove = idx => onChange(items.filter((_, i) => i !== idx).map(i => (i.on && items[idx].kind === 'card' && i.on === items[idx].id ? { kind: i.kind, id: i.id } : i)), nothing);
  const setOn = (id, on) => onChange(items.map(i => (i.kind === 'landscape' && i.id === id ? { kind: i.kind, id: i.id, ...(on ? { on } : {}) } : i)), nothing);
  const cardItems = resolved.filter(r => r.kind === 'card' && !r.missing);

  const chipFor = (r, i) => (<KingdomChip key={`${r.kind}:${r.id}`} r={r} expansion onRemove={() => remove(i)} onPeek={r.missing ? undefined : () => openPeek(catalog, r.kind === 'card' ? { kind: 'card', s: { name: displayName(r.obj), cards: [r.obj], expansion: r.obj.expansion } } : { kind: 'landscape', l: { landscape: r.obj } })} />);

  return (
    <div className="dn-kpicker">
      {items.length > 0 && (
        <>
          <p className="meta dn-kpicker-count" role="status">{nCards} {nCards === 1 ? 'card' : 'cards'}{nLands ? `, ${nLands} ${nLands === 1 ? 'landscape' : 'landscapes'}` : ''}</p>
          <ShelfGroups entries={resolved.flatMap((r, i) => (r.kind === 'card' || r.missing ? [{ r, node: chipFor(r, i) }] : []))} />
          {nLands > 0 && <><p className="meta dn-shelf-sub">Landscapes</p><ShelfGroups entries={resolved.flatMap((r, i) => (r.kind === 'landscape' && !r.missing ? [{ r, node: chipFor(r, i) }] : []))} /></>}
        </>
      )}
      {traits.map(t => (
        <label key={t.id} className="f dn-kpicker-on">{t.obj.name} is on
          <select value={t.on || ''} onChange={e => setOn(t.id, e.target.value)}>
            <option value="">(not recorded)</option>
            {cardItems.map(c => <option key={c.id} value={c.id}>{displayName(c.obj)}</option>)}
          </select>
        </label>
      ))}
      <ItemSearch catalog={catalog} taken={items} label="Add a card or landscape" onAdd={add} />
    </div>
  );
}
