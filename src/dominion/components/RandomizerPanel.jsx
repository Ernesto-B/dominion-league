import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_CARDS, MAX_LANDSCAPES, displayName, impliedSets, primaryType, resolveKingdom } from '../kingdom.js';
import { decodeKingdom, encodeKingdom, looksLikeCode } from '../kingdomCode.js';
import { startKingdomPick, takeKingdomPick } from '../kingdomPick.js';
import { DEFAULT_OPTIONS, formatSeed, newSeed, parseSeed, playsFor, rerollLandscape, rerollSlot, rollSeeded, slotCardId, toGameItems, withAvoid } from '../randomizer.js';
import { cardHref, dominionHref, landscapeHref } from '../links.js';
import { CardText, Chip, ExpansionBadge, LandscapePill, ShowTextButton, TypePills } from './bits.jsx';
import CostIcons from './Cost.jsx';
import RandomizerOptions from './RandomizerOptions.jsx';
import { KingdomChip } from './KingdomChips.jsx';
import { openPeek } from './CardPeek.jsx';
import CardFace from './CardFace.jsx';
import { slotFaceId, useCardImages, useCardView } from '../cardImages.js';

/* The Kingdom randomizer's working part: the options, the roll, the tiles with Lock and Re-roll, the landscapes and the setup notes.
   It is CONTROLLED, so the same panel serves two homes:
     - the Collection's Randomizer page, where the options and the kingdom live in the URL;
     - the Game night Kingdom step, where they live in the step (and the kingdom becomes the game's kingdom).
   opts / setOpts(patch)   the options (see DEFAULT_OPTIONS) and a merge-in setter
   state / onState(next)   the rolled kingdom ({ slots, landscapes, setup }, or null) and what to do with a new one
   onReset()               put the options back to their defaults
   actions                 extra buttons for the bar above the tiles (Copy link, Use for a game, ...)
   kept / onKeep           the locked cards and the typed seed ({ cards, lands, seed }) to start from, and a callback for every change (the page keeps them in its own state)
   extraControls / below   a button for the Roll / Reset row, and what that button opens (kept outside the form, so typing in it never rolls)
   editing / onEdit(items, implied, baneId)   hand-editing: every tile gets Replace and Remove, and an Add tile ends each grid. The caller turns the edited list of items back into a kingdom (stateFromItems)
   plays                   Map(pile key -> games played), for "favor cards we've played less"; null when there are no logged games */
export default function RandomizerPanel({ catalog, opts, setOpts: setOptsProp, state, onState, onReset, plays = null, actions = null, emptyHint = true, foldExpansions = false, extraControls = null, below = null, kept = null, onKeep = null, avoid = null, editing = false, onEdit = null }) {
  const [locked, setLocked] = useState(() => new Set(kept?.cards));        // pile keys kept on a re-roll
  const [lockedL, setLockedL] = useState(() => new Set(kept?.lands));      // landscape ids kept on a re-roll
  const [message, setMessage] = useState('');
  const [seedText, setSeedText] = useState(kept?.seed || '');                // a seed typed in to repeat a roll; empty = a new random one
  const [showText, setShowText] = useState(false);
  const { get: picture, any: anyPictures } = useCardImages();
  const [cardView, setCardView] = useCardView();
  const faces = anyPictures && cardView === 'faces';   // the cards drawn as the cards themselves (a card with no picture keeps its text tile)
  const faceOf = s => { const id = slotFaceId(s); return id ? { id } : null; };
  const [fresh, setFresh] = useState(null);                     // the tile that just changed, briefly highlighted
  const resultRef = useRef(null);
  const editable = editing && !!onEdit;
  const shown = state || (editable ? { slots: [], landscapes: [], seed: null, setup: {} } : null);   // hand-editing can start from nothing
  const items = () => (state ? toGameItems(state) : []);
  const baneId = state && state.setup.bane ? slotCardId(state.setup.bane) : null;
  const none = { sets: [], landscapes: [] };
  const commit = (next, added) => { setMessage(''); onEdit(next, added ? impliedSets(resolveKingdom(catalog, [added])) : none, baneId); };
  const unhost = (list, id) => list.map(it => (it.on === id ? { kind: it.kind, id: it.id } : it));   // a Trait on a card that left is on nothing
  const removeCard = i => { const id = slotCardId(state.slots[i]); commit(unhost(items().filter(it => !(it.kind === 'card' && it.id === id)), id)); };
  const removeLand = i => { const id = state.landscapes[i].landscape.id; commit(items().filter(it => !(it.kind === 'landscape' && it.id === id))); };
  // put a chosen card or landscape in: at the end, or in place of the slot being replaced
  const put = ({ kind, id, index }) => {
    const added = { kind, id }, list = items();
    if (index == null) commit([...list, added], added);
    else if (kind === 'card') { const old = slotCardId(state.slots[index]); commit(unhost(list.map(it => (it.kind === 'card' && it.id === old ? added : it)), old), added); }
    else { const old = state.landscapes[index].landscape.id; commit(list.map(it => (it.kind === 'landscape' && it.id === old ? added : it)), added); }
  };
  // Add / Replace take the viewer to the full list to choose from, and the choice is waiting here when they come back
  const choose = (kind, index) => {
    const label = index == null ? null : kind === 'card' ? state.slots[index].name : state.landscapes[index].landscape.name;
    startKingdomPick({ kind, index, label, labelId: index == null ? null : kind === 'card' ? slotCardId(state.slots[index]) : state.landscapes[index].landscape.id, taken: [...items(), ...(avoid || [])].map(i => i.id), returnHash: window.location.hash, scrollY: window.scrollY });
    window.location.hash = dominionHref(kind === 'card' ? 'cards' : 'landscapes');
  };
  useEffect(() => {
    const r = onEdit ? takeKingdomPick() : null;
    if (r && (r.index == null || (r.kind === 'card' ? state?.slots[r.index] : state?.landscapes[r.index]))) put(r);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const canFavor = !!plays && plays.size > 0;
  const setOpts = patch => { setMessage(''); setOptsProp(patch); };

  const drawOpts = withAvoid(opts, avoid);   // what the draw uses: the options, with another table's cards and landscapes kept out (the options on screen are left as they are)
  const roll = () => {
    // a locked card keeps its place on the table as well as its seat in the kingdom
    const at = (list, keyOf, held) => new Map(list.flatMap((x, i) => (held.has(keyOf(x)) ? [[keyOf(x), i]] : [])));
    if (looksLikeCode(seedText)) {   // a kingdom code typed where a seed goes: load that kingdom instead of rolling
      const got = decodeKingdom(catalog, seedText);
      if (got.error) { setMessage(got.error); return; }
      setMessage(''); setFresh(null); onState(got.state); return;
    }
    if (seedText.trim() && parseSeed(seedText) == null) { setMessage('A seed is a number, like 182736 (or a kingdom code, starting with K-).'); return; }
    const res = rollSeeded(catalog, drawOpts, parseSeed(seedText) ?? newSeed(), {
      plays: playsFor(opts, plays), keep: [...locked], keepLandscapes: [...lockedL],
      lockedAt: state ? at(state.slots, s => s.key, locked) : null, lockedLandscapeAt: state ? at(state.landscapes, l => l.landscape.id, lockedL) : null,
    });
    if (!res.ok) { setMessage(res.message); return; }
    setMessage(''); setFresh(null); onState(res);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  const swapSlot = i => {
    const res = rerollSlot(catalog, drawOpts, state, i, { plays: playsFor(opts, plays) });
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.slots.map(s => s.key));
    setMessage(''); setFresh(res.slots.find(s => !was.has(s.key))?.key ?? null); onState(res);
  };
  const swapLandscape = i => {
    const res = rerollLandscape(catalog, drawOpts, state, i);
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.landscapes.map(l => l.landscape.id));
    setMessage(''); setFresh(res.landscapes.find(l => !was.has(l.landscape.id))?.landscape.id ?? null); onState(res);
  };
  // a caller that keeps these (Game night) hears every change, so a look at a card's page doesn't lose the locks or the typed seed
  useEffect(() => { if (onKeep) onKeep({ cards: [...locked], lands: [...lockedL], seed: seedText }); }, [locked, lockedL, seedText]);   // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setMessage(''); setLocked(new Set()); setLockedL(new Set()); onReset(); };

  useEffect(() => { if (fresh == null) return; const t = setTimeout(() => setFresh(null), 1800); return () => clearTimeout(t); }, [fresh]);

  const changed = JSON.stringify(opts) !== JSON.stringify(DEFAULT_OPTIONS);

  return (
    <>
      <form className="builder dn-filters dn-rz-opts" aria-label="Randomizer options" onSubmit={e => { e.preventDefault(); roll(); }}>
        <RandomizerOptions catalog={catalog} opts={opts} setOpts={setOpts} canFavor={canFavor} foldExpansions={foldExpansions} />

        <div className="controls dn-rz-go">
          <button type="submit">{state ? 'Roll a new kingdom' : 'Roll a kingdom'}</button>
          <label className="f dn-seed-in">Seed <input type="text" size={8} placeholder="random or K-…" autoComplete="off" spellCheck={false} value={seedText} onChange={e => setSeedText(e.target.value.replace(/[^0-9A-Za-z\- ]/g, '').slice(0, 80))} /></label>
          <button type="button" className="ghost" onClick={reset} disabled={!changed}>Reset options</button>
          {extraControls}
          {(locked.size > 0 || lockedL.size > 0) && state && <span className="meta">Locked cards stay when you roll again.</span>}
        </div>
        {message && <p className="dn-rz-msg" role="alert">{message}</p>}
      </form>
      {below}

      {shown ? (
        <section aria-label="Your kingdom" ref={resultRef} className="dn-rz-result">
          <div className="dn-rz-bar">
            <div className="dn-rz-actions">
              {anyPictures && (
                <div className="dn-mode" role="group" aria-label="How to show the kingdom">
                  <Chip pressed={cardView === 'faces'} onClick={() => setCardView('faces')}>Card faces</Chip>
                  <Chip pressed={cardView === 'list'} onClick={() => setCardView('list')}>List</Chip>
                </div>
              )}
              {!(faces && shown.slots.every(faceOf) && shown.landscapes.every(l => picture(l.landscape.id))) && <ShowTextButton on={showText} onClick={() => setShowText(t => !t)} />}
              {shown.seed != null ? <SeedButton text={formatSeed(shown.seed)} /> : shown.slots.length > 0 && <SeedButton code text={encodeKingdom(catalog, shown)} />}
            </div>
            {actions && <div className="dn-rz-actions">{actions}</div>}
          </div>

          <ul className={'dn-rzgrid' + (faces ? ' faces' : '')} aria-label="Kingdom cards">
            {shown.slots.map((s, i) => (faces && faceOf(s) ? (
              <FaceTile editing={editable} onReplace={() => choose('card', i)} onRemove={() => removeCard(i)} key={s.key} id={faceOf(s).id} name={s.name} caption={null} fresh={fresh === s.key} locked={locked.has(s.key)}
                onLock={() => setLocked(l => { const n = new Set(l); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n; })} onReroll={() => swapSlot(i)} onPeek={() => openPeek(catalog, { kind: 'card', s, face: faceOf(s).id })} />
            ) : (
              <Tile editing={editable} onReplace={() => choose('card', i)} onRemove={() => removeCard(i)} key={s.key} fresh={fresh === s.key} tone={primaryType(s.cards.find(c => primaryType(c) === 'Attack') || s.cards[0])}
                locked={locked.has(s.key)} onLock={() => setLocked(l => { const n = new Set(l); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n; })} onReroll={() => swapSlot(i)} onPeek={() => openPeek(catalog, { kind: 'card', s })} what={s.name}>
                <div className="dn-rz-cost"><CostIcons coins={s.cards[0].coins} debt={s.cards[0].debt} overpay={s.cards[0].overpay} size={30} /></div>
                <div className="dn-rz-main">
                  <p className="dn-rz-name">{s.cards.length === 1 ? <a href={cardHref(s.cards[0].id)}>{s.name}</a> : s.name}</p>
                  {s.cards.length > 1 && <p className="dn-rz-members meta">{s.cards.map((c, k) => <span key={c.id}>{k > 0 && ' · '}<a href={cardHref(c.id)}>{c.name}</a></span>)}</p>}
                  <TypePills types={[...new Set(s.cards.flatMap(c => c.types))]} />
                  <p className="meta dn-rz-exp"><ExpansionBadge name={s.expansion} size={14} /></p>
                  {showText && s.cards.map(c => <div key={c.id} className="dn-rz-text">{s.cards.length > 1 && <p className="meta dn-rz-textname">{c.name}</p>}<CardText text={c.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>)}
                </div>
              </Tile>
            )))}
            {editable && shown.slots.length < MAX_CARDS && <AddTile faces={faces} label="Add a card" onClick={() => choose('card', null)} />}
          </ul>

          {(shown.landscapes.length > 0 || editable) && (
            <>
              <h3 className="dn-rz-sub">Landscapes</h3>
              <ul className={'dn-rzgrid' + (faces ? ' faces land' : '')} aria-label="Landscapes">
                {shown.landscapes.map((l, i) => (faces && picture(l.landscape.id) ? (
                  <FaceTile editing={editable} onReplace={() => choose('landscape', i)} onRemove={() => removeLand(i)} key={l.landscape.id} id={l.landscape.id} name={l.landscape.name} caption={l.on ? `on ${displayName(catalog.cardsById.get(l.on) || { name: l.on })}` : null} fresh={fresh === l.landscape.id} locked={lockedL.has(l.landscape.id)}
                    onLock={() => setLockedL(s => { const n = new Set(s); n.has(l.landscape.id) ? n.delete(l.landscape.id) : n.add(l.landscape.id); return n; })} onReroll={() => swapLandscape(i)} onPeek={() => openPeek(catalog, { kind: 'landscape', l, face: l.landscape.id })} />
                ) : (
                  <Tile editing={editable} onReplace={() => choose('landscape', i)} onRemove={() => removeLand(i)} key={l.landscape.id} fresh={fresh === l.landscape.id} tone={l.landscape.type} locked={lockedL.has(l.landscape.id)} what={l.landscape.name}
                    onLock={() => setLockedL(s => { const n = new Set(s); n.has(l.landscape.id) ? n.delete(l.landscape.id) : n.add(l.landscape.id); return n; })} onReroll={() => swapLandscape(i)} onPeek={() => openPeek(catalog, { kind: 'landscape', l })}>
                    <div className="dn-rz-main">
                      <p className="dn-rz-name"><a href={landscapeHref(l.landscape.id)}>{l.landscape.name}</a></p>
                      <p><LandscapePill type={l.landscape.type} />{l.on && <span className="meta"> on {displayName(catalog.cardsById.get(l.on) || { name: l.on })}</span>}</p>
                      <p className="meta dn-rz-exp"><ExpansionBadge name={l.landscape.expansion} size={14} /></p>
                      {showText && <div className="dn-rz-text"><CardText text={l.landscape.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>}
                    </div>
                  </Tile>
                )))}
                {editable && shown.landscapes.length < MAX_LANDSCAPES && <AddTile faces={faces} land label="Add a landscape" onClick={() => choose('landscape', null)} />}
              </ul>
            </>
          )}

          <Setup catalog={catalog} setup={shown.setup} />
        </section>
      ) : (
        emptyHint ? <p className="dn-rz-empty">Nothing rolled yet. Choose your options above, then <b>Roll a kingdom</b>.</p> : null
      )}
    </>
  );
}

// a card or landscape drawn as itself: the picture (tap to enlarge), with Lock and Re-roll under it
function FaceTile({ id, name, caption, fresh, locked, onLock, onReroll, onPeek, editing, onReplace, onRemove }) {
  return (
    <li className={'dn-rzface' + (fresh ? ' fresh' : '') + (locked ? ' locked' : '')}>
      <CardFace id={id} name={name} onOpen={onPeek} />
      <div className="dn-rztile-btns">{editing ? <EditButtons name={name} onReplace={onReplace} onRemove={onRemove} /> : <>
        <button type="button" className="ghost" aria-pressed={locked} onClick={onLock} title={locked ? `Unlock ${name}` : `Keep ${name} when you roll again`}>{locked ? 'Locked' : 'Lock'}</button>
        <button type="button" className="ghost" onClick={onReroll} disabled={locked} title={locked ? 'Unlock it to re-roll' : `Swap ${name} for another card`}>Re-roll</button>
      </>}</div>
      {caption && <p className="dn-rzface-cap meta">{caption}</p>}   {/* under the buttons, so every card's buttons line up (only a Trait's "on <card>" has one) */}
    </li>
  );
}

// one card or landscape of the roll, with its Lock and Re-roll buttons
function Tile({ children, tone, fresh, locked, onLock, onReroll, onPeek, what, editing, onReplace, onRemove }) {
  return (
    <li className={'dn-rztile' + (tone ? ' t-' + tone.toLowerCase() : '') + (fresh ? ' fresh' : '') + (locked ? ' locked' : '')}>
      <div className="dn-rztile-body">{children}</div>
      <div className="dn-rztile-btns">{editing ? <EditButtons name={what} onReplace={onReplace} onRemove={onRemove} /> : <>
        <button type="button" className="ghost" aria-pressed={locked} onClick={onLock} title={locked ? `Unlock ${what}` : `Keep ${what} when you roll again`}>{locked ? 'Locked' : 'Lock'}</button>
        <button type="button" className="ghost" onClick={onReroll} disabled={locked} title={locked ? 'Unlock it to re-roll' : `Swap ${what} for another card`}>Re-roll</button>
      </>}</div>
      <button type="button" className="dn-rztile-more" aria-label={`Show the text of ${what}`} onClick={onPeek}>⌄</button>
    </li>
  );
}

// the usual "copy" mark (two overlapping sheets), drawn in the text's own colour and size
const CopyGlyph = () => (
  <svg className="dn-copyglyph" viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
    <rect x="5.5" y="5.5" width="8" height="8.5" rx="1.5" /><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3.5A1.5 1.5 0 0 0 2 3v6.5A1.5 1.5 0 0 0 3.5 11H4" />
  </svg>
);

// the roll's seed (or, for a kingdom no seed describes, its code), as a button in line with the others on the bar: pressing it copies the number
function SeedButton({ text, code = false }) {
  const [done, setDone] = useState(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone('Copied'); } catch { setDone('Press Ctrl/⌘+C'); }
    setTimeout(() => setDone(null), 1800);
  };
  return <button type="button" className="dn-seed" onClick={copy} title={code ? 'Copy this kingdom\'s code. Paste it where a seed goes (here or on Game night) to get exactly this kingdom.' : 'Copy this roll\'s seed. Roll again with this seed and the same options to get this exact kingdom.'}>{code ? 'Code' : 'Seed'} <b>{text}</b><CopyGlyph />{done && <span className="meta" role="status"> · {done}</span>}</button>;
}

// while editing by hand a tile's two buttons are Replace (search for another) and Remove
function EditButtons({ name, onReplace, onRemove }) {
  return <>
    <button type="button" className="ghost" onClick={onReplace} title={`Swap ${name} for a card you pick`}>Replace</button>
    <button type="button" className="ghost dn-remove" onClick={onRemove} title={`Take ${name} out of the kingdom`}>Remove</button>
  </>;
}

// the dashed place at the end of a grid that adds one more
function AddTile({ faces, land, label, onClick }) {
  return <li className={'dn-rzadd' + (faces ? ' faces' : '') + (land ? ' land' : '')}><button type="button" onClick={onClick}><span aria-hidden="true">+</span>{label}</button></li>;
}

// what to put on the table besides the Kingdom cards (also shown when a snake draft is done)
export function Setup({ catalog, setup }) {
  const notes = [];
  if (setup.needsBane) notes.push(<li key="bane"><b>Young Witch</b> needs a Bane card: add a Kingdom card that costs $2 or $3 to the kingdom.</li>);
  if (setup.bane) notes.push(<li key="bane"><b>Young Witch</b> needs a Bane card: <KingdomChip r={{ kind: 'card', id: setup.bane.cards[0].id, obj: setup.bane.cards[0] }} />. It’s an extra Kingdom pile.</li>);
  const why = (exp, n, chance) => (setup.hand ? `${n} of the ${setup.hand.total} kingdom cards are from ${exp}; half or more uses it.` : chance);
  if (setup.platinumColony != null) notes.push(<li key="pc"><b>{setup.platinumColony ? 'Use' : 'Don’t use'} Platinum and Colony.</b> <span className="meta">{why('Prosperity', setup.hand?.prosperity, 'Decided by chance in proportion to how many Prosperity cards are in the kingdom.')}</span></li>);
  if (setup.shelters != null) notes.push(<li key="sh"><b>{setup.shelters ? 'Use Shelters' : 'Use Estates'}</b> {setup.shelters ? 'instead of the three starting Estates.' : '(no Shelters).'} <span className="meta">{why('Dark Ages', setup.hand?.darkAges, 'Decided by chance in proportion to how many Dark Ages cards are in the kingdom.')}</span></li>);
  if (setup.ruins) notes.push(<li key="ruins">A <b>Looter</b> is in the kingdom, so add the <b>Ruins</b> pile.</li>);
  if (!notes.length) return null;
  return <section aria-labelledby="rz-setup" className="dn-rz-setup"><h3 id="rz-setup" className="dn-rz-sub">Don’t forget the setup</h3><ul className="dn-plain-list">{notes}</ul></section>;
}
