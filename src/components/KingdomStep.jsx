import ConfirmDialog from './ConfirmDialog.jsx';
import RandomizerPanel from '../dominion/components/RandomizerPanel.jsx';
import SnakeDraft from '../dominion/components/SnakeDraft.jsx';
import { draftState, handSwaps } from '../dominion/draft.js';
import { useState } from 'react';
import { impliedSets, resolveKingdom, shelfOrder } from '../dominion/kingdom.js';
import { decodeKingdom, looksLikeCode } from '../dominion/kingdomCode.js';
import { Setup } from '../dominion/components/RandomizerPanel.jsx';
import { KingdomChip, ShelfGroups } from '../dominion/components/KingdomChips.jsx';
import SetIcon from './SetIcon.jsx';
import RecommendedPicker from '../dominion/components/RecommendedPicker.jsx';
import { formatSeed, parseSeed, playsFor, rollSeeded, stateFromItems, toGameItems, withAvoid } from '../dominion/randomizer.js';

const CHOICES = [
  { id: 'random', title: 'Random', text: 'Roll a kingdom with your own rules. Lock the cards you like and re-roll the rest.' },
  { id: 'recommended', title: 'Recommended Sets', text: 'Start from a kingdom the rulebooks suggest, such as First Game.' },
  { id: 'draft', title: 'Snake draft', text: 'Take turns choosing from a pool of cards, the last seat picking twice.' },
  { id: 'manual', title: 'Manual', text: 'Type in and pick every card yourself.' },
];

/* Game night step 2. It opens on one question, "How do you want to decide your kingdom?", and each answer is its own screen and Night's Back button returns
   to the question. The Random screen is the Randomizer's own panel; the Snake draft is the same draft as the Collection's, shaped by the same
   options. Whatever is chosen ends up as `items` (the game's kingdom), which Night's "Start Game & Timer" button takes to the Play step.
   mode / setMode        null (the question) or 'random' | 'manual' | 'draft'
   roll / setRollOpts / resetRoll   the randomizer options; kept / onKeep the locked cards and typed seed; hand / setHand whether the hand-pick panel is open; draftSave / onDraft / onRestartDraft a snake draft
   (in progress or finished): all kept in the saved night, so they survive going back to the question or a look at a card
   applyKingdom(items, rolled)      stores a roll, a draft or a hand-picked list as the game's kingdom
   onSkip()              leave the kingdom out and go on to the scores (a game can be saved without one) */
export default function KingdomStep({ recDef = null, recChanged = false, catalog, mode, setMode, players, roll, setRollOpts, resetRoll, kept, onKeep, hand, setHand, draftSave, onDraft, onRestartDraft, plays, items, resolved, rolled, setupNow, handEdited, randomDone, randomOriginal, setRandomDone, applyKingdom, onPick, onRecommend, picking, onSkip, text, avoid = [], handBane = null }) {
  const [ask, setAsk] = useState(false);   // the Manual screen's "Remove everything?" question is open
  if (!mode) return (
    <>
      <p className="night-q">How do you want to decide your kingdom?</p>
      <ul className="night-choices">
        {CHOICES.map(c => (
          <li key={c.id}><button type="button" className="night-choice" onClick={() => setMode(c.id)}><b>{c.title}</b><span>{c.text}</span></button></li>
        ))}
      </ul>
      {items.length > 0 && <p className="meta">A kingdom is already chosen for this game. Pick a way above to change it, or press <b>Start Game &amp; Timer</b> to keep it.</p>}
      <p className="meta night-skip">Not tracking cards tonight? <button type="button" className="linkish" onClick={onSkip}>Skip the kingdom</button></p>
    </>
  );
  if (mode === 'draft') return (
    <>
      <SnakeDraft catalog={catalog} players={players} opts={roll} setOpts={setRollOpts} plays={plays} value={draftState(draftSave, players)} onChange={onDraft}
        onDone={res => applyKingdom(toGameItems(res), res)} onRestart={onRestartDraft} onReset={resetRoll} items={items} setup={setupNow}
        hand={hand} setHand={setHand} handPanel={<RandomizerPanel bare editing catalog={catalog} opts={roll} setOpts={setRollOpts} state={stateFromItems(catalog, items, handBane)} onState={() => {}} onReset={() => {}} onEdit={(next, implied) => onPick(next, implied)} avoid={avoid} />} />
    </>
  );
  if (mode === 'recommended') return <RecommendedRoll {...{ catalog, roll, setRollOpts, items, handBane, avoid, setupNow, handEdited, onPick, onChoose: onRecommend, picking: picking || items.length === 0, randomDone, randomOriginal, resolved, rolled, recDef, recChanged }} />;
  if (mode === 'manual') return (
    <>
      <div className="dn-manual-head">
        <SeedLoader catalog={catalog} roll={roll} plays={plays} avoid={avoid} onLoad={state => onPick(toGameItems(state), impliedSets(resolveKingdom(catalog, toGameItems(state))))} />
        {items.length > 0 && <button type="button" className="ghost dn-remove" onClick={() => setAsk(true)}>Remove all</button>}
      </div>
      <RandomizerPanel bare editing catalog={catalog} opts={roll} setOpts={setRollOpts} state={stateFromItems(catalog, items, handBane)} onState={() => {}} onReset={() => {}} onEdit={(next, implied) => onPick(next, implied)} avoid={avoid} />
      {ask && <ConfirmDialog danger title="Remove everything?" text="Every card and landscape comes out of this kingdom." confirmLabel="Remove all" onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); onPick([], { sets: [], landscapes: [] }); }} />}
      {handEdited && items.length > 0 && setupNow && <Setup catalog={catalog} setup={setupNow} />}
    </>
  );
  return <RandomRoll {...{ catalog, roll, setRollOpts, resetRoll, kept, onKeep, hand, setHand, setupNow, handEdited, randomDone, randomOriginal, setRandomDone, plays, items, resolved, rolled, applyKingdom, onPick, text, avoid, handBane }} />;
}

/* A seed or a kingdom code typed (or pasted) on the Manual screen: a code puts exactly that kingdom in; a seed rolls it with the current options (the same seed and options give the same kingdom as on the Random way). */
function SeedLoader({ catalog, roll, plays, avoid, onLoad }) {
  const [text, setText] = useState(''), [msg, setMsg] = useState('');
  const load = () => {
    if (!text.trim()) return;
    if (looksLikeCode(text)) {
      const got = decodeKingdom(catalog, text);
      if (got.error) { setMsg(got.error); return; }
      setMsg(''); setText(''); onLoad(got.state); return;
    }
    const seed = parseSeed(text);
    if (seed == null) { setMsg('A seed is a number, like 182736 (or a kingdom code, starting with K-).'); return; }
    const res = rollSeeded(catalog, withAvoid(roll, avoid), seed, { plays: playsFor(roll, plays) });
    if (!res.ok) { setMsg(res.message); return; }
    setMsg(''); setText(''); onLoad(res);
  };
  return (
    <div className="dn-seedload">
      <label className="f dn-seed-in">Seed or code <input type="text" size={14} placeholder="182736 or K-…" autoComplete="off" spellCheck={false} value={text}
        onChange={e => { setText(e.target.value.replace(/[^0-9A-Za-z\- ]/g, '').slice(0, 80)); setMsg(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); load(); } }} /></label>
      <button type="button" className="ghost" onClick={load} disabled={!text.trim()}>Load</button>
      {msg && <p className="dn-rz-msg" role="alert">{msg}</p>}
    </div>
  );
}

// the Random screen: the options and Roll row, then the kingdom with Lock / Re-roll / Replace / Remove on each tile
function RandomRoll({ catalog, roll, setRollOpts, resetRoll, kept, onKeep, hand, setHand, setupNow, handEdited, randomDone, randomOriginal, setRandomDone, plays, items, resolved, rolled, applyKingdom, onPick, text, avoid, handBane }) {
  if (randomDone && items.length) return <ChosenSummary {...{ catalog, items, resolved, rolled, randomOriginal, setupNow }} />;
  // once cards are changed by hand the roll is gone (it is no longer what the seed makes), but the kingdom is still shown as the same tiles
  const shown = handEdited ? stateFromItems(catalog, items, handBane) : rolled;
  return (
    <>
      {handEdited && items.length > 0 && <p className="meta">This kingdom is as chosen before. <b>Re-roll</b> a card to swap just that one, or <b>Lock</b> the ones to keep and roll again.</p>}
      <RandomizerPanel catalog={catalog} opts={roll} setOpts={setRollOpts} state={shown} plays={plays} emptyHint={false} avoid={avoid}
        onState={res => applyKingdom(toGameItems(res), res)} onReset={resetRoll} kept={kept} onKeep={onKeep}
        onEdit={(next, implied) => onPick(next, implied)} />
      {items.length > 0 && !shown && text}
    </>
  );
}

// the Recommended screen: the list of sets until one is chosen, then the kingdom as tiles (hand-editable like Manual) with its setup notes. Night's Back returns to the list,
// and "Use in Random" (beside the step's heading in Night) carries the kingdom over to the Random screen as a starting point
function RecommendedRoll({ catalog, roll, setRollOpts, items, handBane, avoid, setupNow, handEdited, onPick, onChoose, picking, randomDone, randomOriginal, resolved, rolled, recDef, recChanged }) {
  if (randomDone && items.length && !picking) return <ChosenSummary {...{ catalog, items, resolved, rolled, randomOriginal, setupNow, recDef, recChanged }} />;   // after "Use this kingdom"
  if (picking) return <RecommendedPicker catalog={catalog} avoid={avoid} onChoose={onChoose} />;
  return (
    <>
      <RandomizerPanel bare editing catalog={catalog} opts={roll} setOpts={setRollOpts} state={stateFromItems(catalog, items, handBane)} onState={() => {}} onReset={() => {}} onEdit={(next, implied) => onPick(next, implied)} avoid={avoid} />
      {handEdited && items.length > 0 && setupNow && <Setup catalog={catalog} setup={setupNow} />}
    </>
  );
}

// "Use this kingdom" (the bottom bar's button, on the Random and the Recommended Sets screens) closes the kingdom into a summary of what was chosen, like a finished draft: the cards, the landscapes, the setup, and a way back
function ChosenSummary({ catalog, items, resolved, rolled, randomOriginal, setupNow, recDef = null, recChanged = false }) {
    // on the summary the cards are laid out like the boxes (a row per expansion, A to Z in it) with each one's expansion icon: the table finds them that way
    const cards = resolved.filter(r => r.kind === 'card' && !r.missing).sort(shelfOrder), lands = resolved.filter(r => r.kind === 'landscape' && !r.missing).sort(shelfOrder);
    // cards taken out by hand stay where they were rolled, struck through, with the card typed in beside them (as on a finished draft)
    const swaps = randomOriginal ? handSwaps(randomOriginal, cards.map(r => r.id)) : null;
    const chip = id => { const r = resolveKingdom(catalog, [{ kind: 'card', id }])[0]; return <KingdomChip key={id} r={r} plain expansion catalog={catalog} />; };
    const found = ids => resolveKingdom(catalog, ids.map(id => ({ kind: 'card', id }))).filter(r => !r.missing);
    // one entry per card, filed under its own expansion: a swapped-out card sits in ITS expansion's row with its replacement beside it; a card only added by hand is filed under its own
    const entries = swaps
      ? [...found(randomOriginal).map(r => ({ r, node: swaps.removed.includes(r.id)
          ? <span key={r.id} className="dn-swapped"><span className="gone">{chip(r.id)}</span>{swaps.replacedBy.has(r.id) ? <><b className="dn-swap-in">→</b>{chip(swaps.replacedBy.get(r.id))}</> : <em className="meta">removed</em>}</span>
          : chip(r.id) })),
         ...found(swaps.extra).map(r => ({ r, node: <span key={'+' + r.id} className="dn-swapped"><b className="dn-swap-in">+</b>{chip(r.id)}</span> }))]
      : cards.map(r => ({ r, node: <KingdomChip key={r.id} r={r} plain expansion catalog={catalog} /> }));
    return (
      <section className="builder dn-draft" aria-label="Kingdom chosen">
        <p className="dn-draft-done"><b>Kingdom Chosen</b>{rolled && rolled.seed != null && <span className="meta"> · Seed {formatSeed(rolled.seed)}</span>}</p>
        {recDef && <p className="dn-rec-chosen"><b>{recDef.name}</b><span className="dn-rec-sets">{recDef.sets.map(n => <SetIcon key={n} name={n} size={18} />)}</span>{recChanged && <span className="meta">with your changes</span>}</p>}
        <p className="meta" style={{ margin: '0 0 6px' }}>{cards.length} Kingdom card{cards.length === 1 ? '' : 's'}</p>
        <ShelfGroups entries={entries} />
        {lands.length > 0 && <><p className="meta" style={{ margin: '12px 0 6px' }}>Landscapes</p><ShelfGroups entries={lands.map(r => ({ r, node: <KingdomChip key={r.id} r={r} plain expansion catalog={catalog} /> }))} /></>}
        {setupNow && <Setup catalog={catalog} setup={setupNow} />}
      </section>
    );
}
