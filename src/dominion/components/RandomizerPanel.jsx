import { useEffect, useMemo, useRef, useState } from 'react';
import { displayName, primaryType } from '../kingdom.js';
import { DEFAULT_OPTIONS, formatSeed, newSeed, parseSeed, rerollLandscape, rerollSlot, rollSeeded } from '../randomizer.js';
import { cardHref, landscapeHref } from '../links.js';
import { CardText, ExpansionBadge, LandscapePill, TypePills } from './bits.jsx';
import CostIcons from './Cost.jsx';
import RandomizerOptions from './RandomizerOptions.jsx';
import { KingdomChip } from './KingdomChips.jsx';

/* The Kingdom randomizer's working part: the options, the roll, the tiles with Lock and Re-roll, the landscapes and the setup notes.
   It is CONTROLLED, so the same panel serves two homes:
     - the Collection's Randomizer page, where the options and the kingdom live in the URL;
     - the Game night Kingdom step, where they live in the step (and the kingdom becomes the game's kingdom).
   opts / setOpts(patch)   the options (see DEFAULT_OPTIONS) and a merge-in setter
   state / onState(next)   the rolled kingdom ({ slots, landscapes, setup }, or null) and what to do with a new one
   onReset()               put the options back to their defaults
   actions                 extra buttons for the bar above the tiles (Copy link, Use for a game, ...)
   plays                   Map(pile key -> games played), for "favor cards we've played less"; null when there are no logged games */
export default function RandomizerPanel({ catalog, opts, setOpts: setOptsProp, state, onState, onReset, plays = null, actions = null, heading = true, emptyHint = true, rulesOpen = false, foldExpansions = false }) {
  const [locked, setLocked] = useState(() => new Set());        // pile keys kept on a re-roll
  const [lockedL, setLockedL] = useState(() => new Set());      // landscape ids kept on a re-roll
  const [message, setMessage] = useState('');
  const [seedText, setSeedText] = useState('');                // a seed typed in to repeat a roll; empty = a new random one
  const [showText, setShowText] = useState(false);
  const [fresh, setFresh] = useState(null);                     // the tile that just changed, briefly highlighted
  const resultRef = useRef(null);
  const canFavor = !!plays && plays.size > 0;
  const setOpts = patch => { setMessage(''); setOptsProp(patch); };

  const roll = () => {
    // a locked card keeps its place on the table as well as its seat in the kingdom
    const at = (list, keyOf, held) => new Map(list.flatMap((x, i) => (held.has(keyOf(x)) ? [[keyOf(x), i]] : [])));
    if (seedText.trim() && parseSeed(seedText) == null) { setMessage('A seed is a number, like 182736.'); return; }
    const res = rollSeeded(catalog, opts, parseSeed(seedText) ?? newSeed(), {
      plays: opts.favor ? plays : null, keep: [...locked], keepLandscapes: [...lockedL],
      lockedAt: state ? at(state.slots, s => s.key, locked) : null, lockedLandscapeAt: state ? at(state.landscapes, l => l.landscape.id, lockedL) : null,
    });
    if (!res.ok) { setMessage(res.message); return; }
    setMessage(''); setFresh(null); onState(res);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  const swapSlot = i => {
    const res = rerollSlot(catalog, opts, state, i, { plays: opts.favor ? plays : null });
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.slots.map(s => s.key));
    setMessage(''); setFresh(res.slots.find(s => !was.has(s.key))?.key ?? null); onState(res);
  };
  const swapLandscape = i => {
    const res = rerollLandscape(catalog, opts, state, i);
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.landscapes.map(l => l.landscape.id));
    setMessage(''); setFresh(res.landscapes.find(l => !was.has(l.landscape.id))?.landscape.id ?? null); onState(res);
  };
  const reset = () => { setMessage(''); setLocked(new Set()); setLockedL(new Set()); onReset(); };

  useEffect(() => { if (fresh == null) return; const t = setTimeout(() => setFresh(null), 1800); return () => clearTimeout(t); }, [fresh]);

  const changed = JSON.stringify(opts) !== JSON.stringify(DEFAULT_OPTIONS);

  return (
    <>
      <form className="builder dn-filters dn-rz-opts" aria-label="Randomizer options" onSubmit={e => { e.preventDefault(); roll(); }}>
        <RandomizerOptions catalog={catalog} opts={opts} setOpts={setOpts} canFavor={canFavor} rulesOpen={rulesOpen} foldExpansions={foldExpansions} />

        <div className="controls dn-rz-go">
          <button type="submit">{state ? 'Roll a new kingdom' : 'Roll a kingdom'}</button>
          <label className="f dn-seed-in">Seed <input type="text" inputMode="numeric" size={8} placeholder="random" value={seedText} aria-describedby="rz-seed-help" onChange={e => setSeedText(e.target.value.replace(/[^\d]/g, '').slice(0, 9))} /></label>
          <button type="button" className="ghost" onClick={reset} disabled={!changed}>Reset options</button>
          {(locked.size > 0 || lockedL.size > 0) && state && <span className="meta">Locked cards stay when you roll again.</span>}
        </div>
        <p className="meta dn-rz-seedhelp" id="rz-seed-help">Every roll has a seed. Roll again with the same seed and the same options and you get the same kingdom.</p>
        {message && <p className="dn-rz-msg" role="alert">{message}</p>}
      </form>

      {state ? (
        <section aria-labelledby="rz-result" ref={resultRef} className="dn-rz-result">
          <div className="dn-rz-bar">
            {heading ? <h2 id="rz-result">Your kingdom</h2> : <h3 id="rz-result" style={{ margin: 0 }}>Your kingdom</h3>}
            <div className="dn-rz-actions">
              <label className="dn-check"><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Show card text</label>
              {state.seed != null && <span className="dn-seed" title="Roll again with this seed and the same options to get this exact kingdom">Seed <b>{formatSeed(state.seed)}</b></span>}
              {actions}
            </div>
          </div>

          <ul className="dn-rzgrid" aria-label="Kingdom cards">
            {state.slots.map((s, i) => (
              <Tile key={s.key} fresh={fresh === s.key} tone={primaryType(s.cards.find(c => primaryType(c) === 'Attack') || s.cards[0])}
                locked={locked.has(s.key)} onLock={() => setLocked(l => { const n = new Set(l); n.has(s.key) ? n.delete(s.key) : n.add(s.key); return n; })} onReroll={() => swapSlot(i)} what={s.name}>
                <div className="dn-rz-cost"><CostIcons coins={s.cards[0].coins} debt={s.cards[0].debt} overpay={s.cards[0].overpay} size={30} /></div>
                <div className="dn-rz-main">
                  <p className="dn-rz-name">{s.cards.length === 1 ? <a href={cardHref(s.cards[0].id)}>{s.name}</a> : s.name}</p>
                  {s.cards.length > 1 && <p className="dn-rz-members meta">{s.cards.map((c, k) => <span key={c.id}>{k > 0 && ' · '}<a href={cardHref(c.id)}>{c.name}</a></span>)}</p>}
                  <TypePills types={[...new Set(s.cards.flatMap(c => c.types))]} />
                  <p className="meta dn-rz-exp"><ExpansionBadge name={s.expansion} size={14} /></p>
                  {showText && s.cards.map(c => <div key={c.id} className="dn-rz-text">{s.cards.length > 1 && <p className="meta dn-rz-textname">{c.name}</p>}<CardText text={c.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>)}
                </div>
              </Tile>
            ))}
          </ul>

          {state.landscapes.length > 0 && (
            <>
              <h3 className="dn-rz-sub">Landscapes</h3>
              <ul className="dn-rzgrid" aria-label="Landscapes">
                {state.landscapes.map((l, i) => (
                  <Tile key={l.landscape.id} fresh={fresh === l.landscape.id} tone={l.landscape.type} locked={lockedL.has(l.landscape.id)} what={l.landscape.name}
                    onLock={() => setLockedL(s => { const n = new Set(s); n.has(l.landscape.id) ? n.delete(l.landscape.id) : n.add(l.landscape.id); return n; })} onReroll={() => swapLandscape(i)}>
                    <div className="dn-rz-main">
                      <p className="dn-rz-name"><a href={landscapeHref(l.landscape.id)}>{l.landscape.name}</a></p>
                      <p><LandscapePill type={l.landscape.type} />{l.on && <span className="meta"> on {displayName(catalog.cardsById.get(l.on) || { name: l.on })}</span>}</p>
                      <p className="meta dn-rz-exp"><ExpansionBadge name={l.landscape.expansion} size={14} /></p>
                      {showText && <div className="dn-rz-text"><CardText text={l.landscape.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>}
                    </div>
                  </Tile>
                ))}
              </ul>
            </>
          )}

          <Setup catalog={catalog} setup={state.setup} />
        </section>
      ) : (
        emptyHint ? <p className="dn-rz-empty">Nothing rolled yet. Choose your options above, then <b>Roll a kingdom</b>.</p> : null
      )}
    </>
  );
}

// one card or landscape of the roll, with its Lock and Re-roll buttons
function Tile({ children, tone, fresh, locked, onLock, onReroll, what }) {
  return (
    <li className={'dn-rztile' + (tone ? ' t-' + tone.toLowerCase() : '') + (fresh ? ' fresh' : '') + (locked ? ' locked' : '')}>
      <div className="dn-rztile-body">{children}</div>
      <div className="dn-rztile-btns">
        <button type="button" className="ghost" aria-pressed={locked} onClick={onLock} title={locked ? `Unlock ${what}` : `Keep ${what} when you roll again`}>{locked ? 'Locked' : 'Lock'}</button>
        <button type="button" className="ghost" onClick={onReroll} disabled={locked} title={locked ? 'Unlock it to re-roll' : `Swap ${what} for another card`}>Re-roll</button>
      </div>
    </li>
  );
}

// what to put on the table besides the Kingdom cards
function Setup({ catalog, setup }) {
  const notes = [];
  if (setup.bane) notes.push(<li key="bane"><b>Young Witch</b> needs a Bane card: <KingdomChip r={{ kind: 'card', id: setup.bane.cards[0].id, obj: setup.bane.cards[0] }} />. It’s an extra Kingdom pile.</li>);
  if (setup.platinumColony != null) notes.push(<li key="pc"><b>{setup.platinumColony ? 'Use' : 'Don’t use'} Platinum and Colony.</b> <span className="meta">Decided by chance in proportion to how many Prosperity cards are in the kingdom.</span></li>);
  if (setup.shelters != null) notes.push(<li key="sh"><b>{setup.shelters ? 'Use Shelters' : 'Use Estates'}</b> {setup.shelters ? 'instead of the three starting Estates.' : '(no Shelters).'} <span className="meta">Decided by chance in proportion to how many Dark Ages cards are in the kingdom.</span></li>);
  if (setup.ruins) notes.push(<li key="ruins">A <b>Looter</b> is in the kingdom, so add the <b>Ruins</b> pile.</li>);
  if (!notes.length) return null;
  return <section aria-labelledby="rz-setup" className="dn-rz-setup"><h3 id="rz-setup" className="dn-rz-sub">Setup</h3><ul className="dn-plain-list">{notes}</ul></section>;
}
