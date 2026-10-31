import KingdomPicker from './KingdomPicker.jsx';
import RandomizerPanel from '../dominion/components/RandomizerPanel.jsx';
import SnakeDraft from '../dominion/components/SnakeDraft.jsx';
import { draftState, handSwaps } from '../dominion/draft.js';
import { resolveKingdom, shelfOrder } from '../dominion/kingdom.js';
import { Setup } from '../dominion/components/RandomizerPanel.jsx';
import { KingdomChip, ShelfGroups } from '../dominion/components/KingdomChips.jsx';
import { formatSeed } from '../dominion/randomizer.js';
import { toGameItems } from '../dominion/randomizer.js';

const CHOICES = [
  { id: 'random', title: 'Random', text: 'Roll a kingdom with your own rules. Lock the cards you like and re-roll the rest.' },
  { id: 'manual', title: 'Manual', text: 'Type in and pick every card yourself.' },
  { id: 'draft', title: 'Snake draft', text: 'Take turns choosing from a pool of cards, the last seat picking twice.' },
];

/* Game night step 2. It opens on one question, "How do you want to decide your kingdom?", and each answer is its own screen and Night's Back button returns
   to the question. The Random screen is the Randomizer's own panel; the Snake draft is the same draft as the Collection's, shaped by the same
   options. Whatever is chosen ends up as `items` (the game's kingdom), which Night's "Start Game & Timer" button takes to the Play step.
   mode / setMode        null (the question) or 'random' | 'manual' | 'draft'
   roll / setRollOpts / resetRoll   the randomizer options; kept / onKeep the locked cards and typed seed; hand / setHand whether the hand-pick panel is open; draftSave / onDraft / onRestartDraft a snake draft
   (in progress or finished): all kept in the saved night, so they survive going back to the question or a look at a card
   applyKingdom(items, rolled)      stores a roll, a draft or a hand-picked list as the game's kingdom
   onSkip()              leave the kingdom out and go on to the scores (a game can be saved without one) */
export default function KingdomStep({ catalog, mode, setMode, players, roll, setRollOpts, resetRoll, kept, onKeep, hand, setHand, draftSave, onDraft, onRestartDraft, plays, items, resolved, rolled, setupNow, handEdited, randomDone, randomOriginal, setRandomDone, applyKingdom, onPick, onSkip, text, avoid = [] }) {
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
        hand={hand} setHand={setHand} handPanel={<div className="night-hand"><KingdomPicker items={items} onChange={onPick} avoid={avoid} /></div>} />
    </>
  );
  if (mode === 'manual') return (
    <>
      <p className="meta">Add the cards and landscapes in play. Remove any with its ✕.</p>
      <KingdomPicker items={items} onChange={onPick} avoid={avoid} />
      {handEdited && items.length > 0 && setupNow && <Setup catalog={catalog} setup={setupNow} />}
      {items.length > 0 && text}
    </>
  );
  return <RandomRoll {...{ catalog, roll, setRollOpts, resetRoll, kept, onKeep, hand, setHand, setupNow, handEdited, randomDone, randomOriginal, setRandomDone, plays, items, resolved, rolled, applyKingdom, onPick, text, avoid }} />;
}

// the Random screen: the options and Roll row, with "Pick cards by hand" beside Reset (it opens the hand-picker under the options)
function RandomRoll({ catalog, roll, setRollOpts, resetRoll, kept, onKeep, hand, setHand, setupNow, handEdited, randomDone, randomOriginal, setRandomDone, plays, items, resolved, rolled, applyKingdom, onPick, text, avoid }) {
  // "Use this kingdom" (the bottom bar's button on this screen) closes the roll into a summary of what was chosen, like a finished draft: the cards, the landscapes, the setup, and a way back
  if (randomDone && items.length) {
    // on the summary the cards are laid out like the boxes (a row per expansion, A to Z in it) with each one's expansion icon: the table finds them that way
    const cards = resolved.filter(r => r.kind === 'card' && !r.missing).sort(shelfOrder), lands = resolved.filter(r => r.kind === 'landscape' && !r.missing).sort(shelfOrder);
    // cards taken out by hand stay where they were rolled, struck through, with the card typed in beside them (as on a finished draft)
    const swaps = randomOriginal ? handSwaps(randomOriginal, cards.map(r => r.id)) : null;
    const chip = id => { const r = resolveKingdom(catalog, [{ kind: 'card', id }])[0]; return <KingdomChip key={id} r={r} plain expansion />; };
    const found = ids => resolveKingdom(catalog, ids.map(id => ({ kind: 'card', id }))).filter(r => !r.missing);
    // one entry per card, filed under its own expansion: a swapped-out card sits in ITS expansion's row with its replacement beside it; a card only added by hand is filed under its own
    const entries = swaps
      ? [...found(randomOriginal).map(r => ({ r, node: swaps.removed.includes(r.id)
          ? <span key={r.id} className="dn-swapped"><span className="gone">{chip(r.id)}</span>{swaps.replacedBy.has(r.id) ? <><b className="dn-swap-in">→</b>{chip(swaps.replacedBy.get(r.id))}</> : <em className="meta">removed</em>}</span>
          : chip(r.id) })),
         ...found(swaps.extra).map(r => ({ r, node: <span key={'+' + r.id} className="dn-swapped"><b className="dn-swap-in">+</b>{chip(r.id)}</span> }))]
      : cards.map(r => ({ r, node: <KingdomChip key={r.id} r={r} plain expansion /> }));
    return (
      <section className="builder dn-draft" aria-label="Kingdom chosen">
        <p className="dn-draft-done"><b>Kingdom Chosen</b>{rolled && rolled.seed != null && <span className="meta"> · Seed {formatSeed(rolled.seed)}</span>}</p>
        <p className="meta" style={{ margin: '0 0 6px' }}>{cards.length} Kingdom card{cards.length === 1 ? '' : 's'}</p>
        <ShelfGroups entries={entries} />
        {lands.length > 0 && <><p className="meta" style={{ margin: '12px 0 6px' }}>Landscapes</p><ShelfGroups entries={lands.map(r => ({ r, node: <KingdomChip key={r.id} r={r} plain expansion /> }))} /></>}
        {setupNow && <Setup catalog={catalog} setup={setupNow} />}
        <div className="controls dn-rz-go">
          <button type="button" className="ghost" onClick={() => setRandomDone(false)}>Back to the roll</button>
          <button type="button" className="ghost" aria-expanded={hand} onClick={() => setHand(!hand)}>{hand ? 'Hide hand-picking' : 'Pick cards by hand'}</button>
        </div>
        {hand && <div className="night-hand"><KingdomPicker items={items} onChange={onPick} avoid={avoid} /></div>}
        {text}
      </section>
    );
  }
  return (
    <>
      <RandomizerPanel catalog={catalog} opts={roll} setOpts={setRollOpts} state={rolled} plays={plays} emptyHint={false} avoid={avoid}
        onState={res => applyKingdom(toGameItems(res), res)} onReset={resetRoll} kept={kept} onKeep={onKeep}
        extraControls={<button type="button" className="ghost" aria-expanded={hand} onClick={() => setHand(!hand)}>{hand ? 'Hide hand-picking' : 'Pick cards by hand'}</button>}
        below={hand ? <div className="night-hand"><KingdomPicker items={items} onChange={onPick} avoid={avoid} /></div> : null} />
      {hand && handEdited && items.length > 0 && setupNow && <Setup catalog={catalog} setup={setupNow} />}
      {items.length > 0 && !rolled && text}
    </>
  );
}
