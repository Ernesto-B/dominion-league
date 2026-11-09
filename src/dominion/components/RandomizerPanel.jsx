import { Pile } from './GivenCards.jsx';
import { pileByKey } from '../extras.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_CARDS, MAX_LANDSCAPES, displayName, impliedSets, primaryType, resolveKingdom } from '../kingdom.js';
import { decodeKingdom, encodeKingdom, looksLikeCode } from '../kingdomCode.js';
import { startKingdomPick, takeKingdomPick } from '../kingdomPick.js';
import { DEFAULT_OPTIONS, applyFix, fixChoices, fixPlan, formatSeed, newSeed, parseSeed, playsFor, rerollLandscape, rerollSlot, rollSeeded, slotCardId, toGameItems, withAvoid } from '../randomizer.js';
import { cardHref, dominionHref, landscapeHref } from '../links.js';
import { CardText, ExpansionBadge, LandscapePill, ShowTextButton, TypePills } from './bits.jsx';
import CostIcons from './Cost.jsx';
import RandomizerOptions from './RandomizerOptions.jsx';
import { KingdomChip } from './KingdomChips.jsx';
import { openPeek } from './CardPeek.jsx';
import CardFace from './CardFace.jsx';
import { slotFaceId, useCardImages } from '../cardImages.js';
import Analyze from './AnalyzePanel.jsx';
import { FixBar, UndoBar } from './FixPicker.jsx';

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
   bare                    just the tiles (no options, no bar, no setup notes): the finished snake draft's hand-editing, where those are already on the screen around it
   plays                   Map(pile key -> games played), for "favor cards we've played less"; null when there are no logged games */
export default function RandomizerPanel({ catalog, opts, setOpts: setOptsProp, state, onState, onReset, plays = null, actions = null, emptyHint = true, foldExpansions = false, extraControls = null, below = null, kept = null, onKeep = null, avoid = null, editing = false, onEdit = null, bare = false }) {
  const [locked, setLocked] = useState(() => new Set(kept?.cards));        // pile keys kept on a re-roll
  const [lockedL, setLockedL] = useState(() => new Set(kept?.lands));      // landscape ids kept on a re-roll
  const [message, setMessage] = useState('');
  const [seedText, setSeedText] = useState(kept?.seed || '');                // a seed typed in to repeat a roll; empty = a new random one
  const [showText, setShowText] = useState(false);
  const { get: picture, any: anyPictures } = useCardImages();
  const faces = anyPictures;   // the cards drawn as the cards themselves (a card with no picture keeps its text tile)
  const faceOf = s => { const id = slotFaceId(s); return id ? { id } : null; };
  const [fresh, setFresh] = useState(null);                     // the tile that just changed, briefly highlighted
  const resultRef = useRef(null);
  const canEdit = !!onEdit;                 // every tile can be replaced or removed, and each grid ends with an Add tile
  const editable = editing && canEdit;      // the bare tiles of a finished draft: Replace / Remove stand in for Lock / Re-roll
  const [blank, setBlank] = useState(false);   // "start from your own cards": an empty kingdom to add to
  const shown = state || ((editable || (blank && canEdit)) ? { slots: [], landscapes: [], seed: null, setup: {} } : null);   // hand-picking can start from nothing
  // turning hand-editing on scrolls down to the tiles, as a roll does (not when the page simply comes back already editing: the scroll is restored there)
  const wasEditing = useRef(editable);
  useEffect(() => {
    if (editable && !wasEditing.current) requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    wasEditing.current = editable;
  }, [editable]);
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
    startKingdomPick({ kind, index, label, labelId: index == null ? null : kind === 'card' ? slotCardId(state.slots[index]) : state.landscapes[index].landscape.id, taken: items().map(i => i.id), blocked: (avoid || []).map(i => i.id), returnHash: window.location.hash, scrollY: window.scrollY });
    window.location.hash = dominionHref(kind === 'card' ? 'cards' : 'landscapes');
  };
  useEffect(() => {
    const r = onEdit ? takeKingdomPick() : null;
    if (r && (r.index == null || (r.kind === 'card' ? state?.slots[r.index] : state?.landscapes[r.index]))) put(r);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const canFavor = !!plays && plays.size > 0;
  const isNew = key => !!((opts.favor || opts.favorPlayed) && plays && !plays.get(key));   // "Played cards" or "New cards" is on: a card nobody has played gets the New corner, as in a game report
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
    seenRef.current = new Set();
    setMessage(''); setFresh(null); onState(res);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  const seenRef = useRef(new Set());   // pile keys shown by re-rolls since the last full roll
  const swapSlot = i => {
    const res = rerollSlot(catalog, drawOpts, state, i, { plays: playsFor(opts, plays), recent: [...seenRef.current] });
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.slots.map(s => s.key)), now = res.slots.find(s => !was.has(s.key));
    seenRef.current.add(state.slots[i].key); if (now) seenRef.current.add(now.key);   // remembered, so the next Re-roll tries cards not shown yet before any it has already shown
    // only a few cards can replace this one (it is the only Attack, the only drawer... the rules ask for): say so, so a short cycle doesn't look like a bug
    setMessage(res.choices != null && res.choices <= 6 ? `Only ${res.choices} other card${res.choices === 1 ? '' : 's'} fit${res.choices === 1 ? 's' : ''} the rules for this slot, so re-rolls will repeat. Loosen a rule, or re-roll a different card.` : '');
    setFresh(now?.key ?? null); onState(res);
  };
  const swapLandscape = i => {
    const res = rerollLandscape(catalog, drawOpts, state, i);
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.landscapes.map(l => l.landscape.id));
    setMessage(''); setFresh(res.landscapes.find(l => !was.has(l.landscape.id))?.landscape.id ?? null); onState(res);
  };
  // a caller that keeps these (Game night) hears every change, so a look at a card's page doesn't lose the locks or the typed seed
  useEffect(() => { if (onKeep) onKeep({ cards: [...locked], lands: [...lockedL], seed: seedText }); }, [locked, lockedL, seedText]);   // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { seenRef.current = new Set(); setMessage(''); setLocked(new Set()); setLockedL(new Set()); onReset(); };

  // the Analyze panel's Fix, in the open: point at the card to replace (the rest dimmed) and a random card that closes the gap takes its place, with Undo for a few seconds.
  const [fix, setFix] = useState(null);   // { issue, plan, note }: while a card to replace is being picked
  const startFix = issue => {
    const plan = fixPlan(catalog, drawOpts, state, issue, { locked: [...locked] });
    if (!plan.ok) return { ok: false, message: plan.message };
    setFix({ issue, plan, slotKey: null, note: null });
    return { ok: true };
  };
  const cancelFix = () => setFix(null);
  // tapping the card to replace swaps it for a random card that closes the gap under the options' rules, and offers Undo
  const choosePick = key => {
    const choices = fixChoices(catalog, drawOpts, state, fix.issue, key, { locked: [...locked], recent: [...seenRef.current] });
    if (!choices.length) { setFix(f => ({ ...f, note: `Nothing fits the rules for ${fix.plan.cards.find(c => c.key === key)?.name ?? 'that card'}. Pick another card, or relax a rule.` })); return; }
    const res = applyFix(catalog, drawOpts, state, key, choices[0].key);
    if (!res.ok) { setMessage(res.message); setFix(null); return; }
    seenRef.current.add(res.removed.key); if (res.added) seenRef.current.add(res.added.key);
    const before = state;
    setMessage(''); setFix(null); setFresh(res.added?.key ?? null); onState(res); skipReset.current = true;
    setUndo({ text: `Swapped ${res.removed.name} for ${res.added?.name ?? 'another card'}.`, before });
    if (res.added) pointAt(res.added.key);
  };
  const [undo, setUndo] = useState(null);
  const skipReset = useRef(false);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 9000); return () => clearTimeout(t); }, [undo]);
  const doUndo = () => { const u = undo; setUndo(null); if (u) { seenRef.current = new Set(); setFresh(null); onState(u.before); } };
  useEffect(() => { setFix(null); if (skipReset.current) skipReset.current = false; else setUndo(null); }, [state]);   // the kingdom changed some other way: a half-made choice, and an Undo for an older swap, are out of date   // the kingdom changed some other way (a roll, a swap, a pick): a half-made choice is out of date
  // how a tile looks and acts while a card to replace is being picked
  const fixing = !!fix;
  const fx = key => {
    if (!fix) return {};
    const c = fix.plan.cards.find(x => x.key === key);
    if (!c) return {};
    if (!c.ok) return { cls: 'fix-no', attrs: { 'data-why': c.why } };
    const sug = key === fix.plan.suggested;
    return { cls: sug ? 'fix-ok fix-sug' : 'fix-ok', attrs: { role: 'button', tabIndex: 0, 'aria-label': `Replace ${c.name}`, 'data-why': sug ? 'Suggested' : undefined, onClick: () => choosePick(key), onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePick(key); } } } };
  };
  // the Analyze panel points at a card: scroll to it and ring it for a few seconds
  const [ping, setPing] = useState(null);
  const pointAt = key => {
    setPing(key);
    requestAnimationFrame(() => document.querySelector(`[data-pile="${CSS.escape(key)}"]`)?.scrollIntoView?.({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  useEffect(() => { if (ping == null) return; const t = setTimeout(() => setPing(null), 3500); return () => clearTimeout(t); }, [ping]);
  useEffect(() => { if (fresh == null) return; const t = setTimeout(() => setFresh(null), 1800); return () => clearTimeout(t); }, [fresh]);

  const changed = JSON.stringify(opts) !== JSON.stringify(DEFAULT_OPTIONS);

  return (
    <>
      {!bare && <form className="builder dn-filters dn-rz-opts" aria-label="Randomizer options" onSubmit={e => { e.preventDefault(); roll(); }}>
        <RandomizerOptions catalog={catalog} opts={opts} setOpts={setOpts} canFavor={canFavor} foldExpansions={foldExpansions} />

        <div className="controls dn-rz-go">
          <button type="submit">{state ? 'Roll a new kingdom' : 'Roll a kingdom'}</button>
          <label className="f dn-seed-in">Seed <input type="text" size={8} placeholder="random or K-…" autoComplete="off" spellCheck={false} value={seedText} onChange={e => setSeedText(e.target.value.replace(/[^0-9A-Za-z\- ]/g, '').slice(0, 80))} /></label>
          <button type="button" className="ghost" onClick={reset} disabled={!changed}>Reset options</button>
          {extraControls}
          {(locked.size > 0 || lockedL.size > 0) && state && <span className="meta">Locked cards stay when you roll again.</span>}
        </div>
        {message && <p className="dn-rz-msg" role="alert">{message}</p>}
      </form>}
      {below}

      {shown ? (
        <section aria-label="Your kingdom" ref={resultRef} className="dn-rz-result">
          {!bare && <div className="dn-rz-bar">
            <div className="dn-rz-actions">
              {!(faces && shown.slots.every(faceOf) && shown.landscapes.every(l => picture(l.landscape.id))) && <ShowTextButton on={showText} onClick={() => setShowText(t => !t)} />}
              {shown.slots.length > 0 && <Analyze catalog={catalog} slots={shown.slots} onPick={pointAt} onFix={editable ? null : startFix} />}
              {shown.seed != null ? <SeedButton text={formatSeed(shown.seed)} copy={encodeKingdom(catalog, shown)} /> : shown.slots.length > 0 && <SeedButton code text={encodeKingdom(catalog, shown)} />}
            </div>
            {actions && <div className="dn-rz-actions">{actions}</div>}
          </div>}

          {fixing && <FixBar plan={fix.plan} note={fix.note} onCancel={cancelFix} />}
          {undo && !fix && <UndoBar text={undo.text} onUndo={doUndo} onClose={() => setUndo(null)} />}
          <ul className={'dn-rzgrid' + (faces ? ' faces' : '') + (fix ? ' fixmode' : '')} aria-label="Kingdom cards">
            {shown.slots.map((s, i) => (faces && faceOf(s) ? (
              <FaceTile editing={editable} onReplace={canEdit ? () => choose('card', i) : null} onRemove={canEdit ? () => removeCard(i) : null} key={s.key} pile={s.key} ping={ping === s.key} fx={fx(s.key)} id={faceOf(s).id} name={s.name} isNew={isNew(s.key)} caption={null} fresh={fresh === s.key} locked={locked.has(s.key)}
                onLock={() => setLocked(l => { const n = new Set(l); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n; })} onReroll={() => swapSlot(i)} onPeek={() => openPeek(catalog, { kind: 'card', s, face: faceOf(s).id })} />
            ) : (
              <Tile editing={editable} onReplace={canEdit ? () => choose('card', i) : null} onRemove={canEdit ? () => removeCard(i) : null} key={s.key} pile={s.key} ping={ping === s.key} fx={fx(s.key)} fresh={fresh === s.key} tone={primaryType(s.cards.find(c => primaryType(c) === 'Attack') || s.cards[0])}
                locked={locked.has(s.key)} onLock={() => setLocked(l => { const n = new Set(l); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n; })} onReroll={() => swapSlot(i)} onPeek={() => openPeek(catalog, { kind: 'card', s })} what={s.name}>
                <div className="dn-rz-cost"><CostIcons coins={s.cards[0].coins} debt={s.cards[0].debt} overpay={s.cards[0].overpay} size={30} /></div>
                <div className="dn-rz-main">
                  <p className="dn-rz-name">{s.cards.length === 1 ? <a href={cardHref(s.cards[0].id)}>{s.name}</a> : s.name}{isNew(s.key) && <span className="pill dn-rz-new">New</span>}</p>
                  {s.cards.length > 1 && <p className="dn-rz-members meta">{s.cards.map((c, k) => <span key={c.id}>{k > 0 && ' · '}<a href={cardHref(c.id)}>{c.name}</a></span>)}</p>}
                  <TypePills types={[...new Set(s.cards.flatMap(c => c.types))]} />
                  <p className="meta dn-rz-exp"><ExpansionBadge name={s.expansion} size={14} /></p>
                  {showText && s.cards.map(c => <div key={c.id} className="dn-rz-text">{s.cards.length > 1 && <p className="meta dn-rz-textname">{c.name}</p>}<CardText text={c.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>)}
                </div>
              </Tile>
            )))}
            {canEdit && shown.slots.length < MAX_CARDS && <AddTile faces={faces} label="Add a card" onClick={() => choose('card', null)} />}
          </ul>

          {(shown.landscapes.length > 0 || canEdit) && (
            <>
              <h3 className="dn-rz-sub">Landscapes</h3>
              <ul className={'dn-rzgrid' + (faces ? ' faces land' : '')} aria-label="Landscapes">
                {shown.landscapes.map((l, i) => (faces && picture(l.landscape.id) ? (
                  <FaceTile editing={editable} onReplace={canEdit ? () => choose('landscape', i) : null} onRemove={canEdit ? () => removeLand(i) : null} key={l.landscape.id} id={l.landscape.id} name={l.landscape.name} caption={l.on ? `on ${displayName(catalog.cardsById.get(l.on) || { name: l.on })}` : null} fresh={fresh === l.landscape.id} locked={lockedL.has(l.landscape.id)}
                    onLock={() => setLockedL(s => { const n = new Set(s); n.has(l.landscape.id) ? n.delete(l.landscape.id) : n.add(l.landscape.id); return n; })} onReroll={() => swapLandscape(i)} onPeek={() => openPeek(catalog, { kind: 'landscape', l, face: l.landscape.id })} />
                ) : (
                  <Tile editing={editable} onReplace={canEdit ? () => choose('landscape', i) : null} onRemove={canEdit ? () => removeLand(i) : null} key={l.landscape.id} fresh={fresh === l.landscape.id} tone={l.landscape.type} locked={lockedL.has(l.landscape.id)} what={l.landscape.name}
                    onLock={() => setLockedL(s => { const n = new Set(s); n.has(l.landscape.id) ? n.delete(l.landscape.id) : n.add(l.landscape.id); return n; })} onReroll={() => swapLandscape(i)} onPeek={() => openPeek(catalog, { kind: 'landscape', l })}>
                    <div className="dn-rz-main">
                      <p className="dn-rz-name"><a href={landscapeHref(l.landscape.id)}>{l.landscape.name}</a></p>
                      <p><LandscapePill type={l.landscape.type} />{l.on && <span className="meta"> on {displayName(catalog.cardsById.get(l.on) || { name: l.on })}</span>}</p>
                      <p className="meta dn-rz-exp"><ExpansionBadge name={l.landscape.expansion} size={14} /></p>
                      {showText && <div className="dn-rz-text"><CardText text={l.landscape.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>}
                    </div>
                  </Tile>
                )))}
                {canEdit && shown.landscapes.length < MAX_LANDSCAPES && <AddTile faces={faces} land label="Add a landscape" onClick={() => choose('landscape', null)} />}
              </ul>
            </>
          )}

          {!bare && <Setup catalog={catalog} setup={shown.setup} />}
        </section>
      ) : (
        emptyHint ? <p className="dn-rz-empty">Nothing rolled yet. Choose your options above, then <b>Roll a kingdom</b>.{canEdit && <> Or <button type="button" className="linkish" onClick={() => setBlank(true)}>start from your own cards</button>.</>}</p> : null
      )}
    </>
  );
}

// a card or landscape drawn as itself: the picture (tap to enlarge), with Lock and Re-roll under it
function FaceTile({ id, name, isNew, caption, pile, ping, fx = {}, fresh, locked, onLock, onReroll, onPeek, editing, onReplace, onRemove }) {
  return (
    <li data-pile={pile} className={'dn-rzface' + (fresh ? ' fresh' : '') + (ping ? ' ping' : '') + (fx.cls ? ' ' + fx.cls : '') + (locked ? ' locked' : '')} {...fx.attrs}>
      <CardFace id={id} name={name} onOpen={onPeek} />
      <CornerActions name={name} editing={editing} onReplace={onReplace} onRemove={onRemove} />
      {isNew && <span className="gr-newtag left">New</span>}
      <TileButtons name={name} editing={editing} locked={locked} onLock={onLock} onReroll={onReroll} onReplace={onReplace} onRemove={onRemove} />
      {caption && <p className="dn-rzface-cap meta">{caption}</p>}   {/* under the buttons, so every card's buttons line up (only a Trait's "on <card>" has one) */}
    </li>
  );
}

// one card or landscape of the roll, with its Lock and Re-roll buttons
function Tile({ children, tone, pile, ping, fx = {}, fresh, locked, onLock, onReroll, onPeek, what, editing, onReplace, onRemove }) {
  return (
    <li data-pile={pile} className={'dn-rztile' + (tone ? ' t-' + tone.toLowerCase() : '') + (fresh ? ' fresh' : '') + (ping ? ' ping' : '') + (fx.cls ? ' ' + fx.cls : '') + (locked ? ' locked' : '')} {...fx.attrs}>
      <CornerActions name={what} editing={editing} onReplace={onReplace} onRemove={onRemove} />
      <div className="dn-rztile-body">{children}</div>
      <TileButtons name={what} editing={editing} locked={locked} onLock={onLock} onReroll={onReroll} onReplace={onReplace} onRemove={onRemove} />
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
function SeedButton({ text, copy: toCopy = null, code = false }) {
  const [done, setDone] = useState(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(toCopy || text); setDone('Copied'); } catch { setDone('Press Ctrl/⌘+C'); }
    setTimeout(() => setDone(null), 1800);
  };
  return <button type="button" className="dn-seed" onClick={copy} title={code || toCopy ? 'Copy this kingdom\'s code. Paste it where a seed goes (here or on Game night) to get exactly this kingdom, whatever options are set there. The number alone only repeats the roll under the same options.' : 'Copy this roll\'s seed. Roll again with this seed and the same options to get this exact kingdom.'}>{code ? 'Code' : 'Seed'} <b>{text}</b><CopyGlyph />{done && <span className="meta" role="status"> · {done}</span>}</button>;
}

// a tile's buttons: Lock and Re-roll under it (the bare draft tiles swap them for Replace / Remove)
function TileButtons({ name, editing, locked, onLock, onReroll, onReplace, onRemove }) {
  if (editing) return null;   // hand-picking (Manual, Recommended, a finished draft): Replace and Remove are the icons on the tile's corner, so nothing sits under it
  return (
    <div className="dn-rztile-btns">
      <button type="button" className="ghost" aria-pressed={locked} onClick={onLock} title={locked ? `Unlock ${name}` : `Keep ${name} when you roll again`}>{locked ? 'Locked' : 'Lock'}</button>
      <button type="button" className="ghost" onClick={onReroll} disabled={locked} title={locked ? 'Unlock it to re-roll' : `Swap ${name} for another card`}>Re-roll</button>
    </div>
  );
}

// Replace (choose another card) and Remove, always in view (on every way of editing a kingdom) as two round icon buttons hanging off the top-right corner of a tile
function CornerActions({ name, editing, onReplace, onRemove }) {
  if (!onReplace) return null;
  return (
    <div className="dn-corner">
      <button type="button" className="dn-corner-b" onClick={onReplace} aria-label={`Replace ${name} with a card you pick`} title={`Replace ${name} with a card you pick`}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6h10M10 3l3 3-3 3M13.5 10h-10M6 7l-3 3 3 3" /></svg>
      </button>
      <button type="button" className="dn-corner-b dn-remove" onClick={onRemove} aria-label={`Remove ${name} from the kingdom`} title={`Remove ${name} from the kingdom`}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
      </button>
    </div>
  );
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
  if (setup.platinumColony) notes.push(<li key="pc"><b>Use Platinum and Colony.</b> <span className="meta">{why('Prosperity', setup.hand?.prosperity, 'Decided by chance in proportion to how many Prosperity cards are in the kingdom.')}</span><Pile r={pileByKey('platinum-colony')} catalog={catalog} /></li>);
  if (setup.shelters) notes.push(<li key="sh"><b>Use Shelters</b> instead of the three starting Estates. <span className="meta">{why('Dark Ages', setup.hand?.darkAges, 'Decided by chance in proportion to how many Dark Ages cards are in the kingdom.')}</span><Pile r={pileByKey('shelters')} catalog={catalog} /></li>);
  if (setup.ruins) notes.push(<li key="ruins">A <b>Looter</b> is in the kingdom, so add the <b>Ruins</b> pile.<Pile r={pileByKey('ruins')} catalog={catalog} /></li>);
  if (!notes.length) return null;
  return <section aria-labelledby="rz-setup" className="dn-rz-setup"><h3 id="rz-setup" className="dn-rz-sub">Don’t forget the setup</h3><ul className="dn-plain-list">{notes}</ul></section>;
}
