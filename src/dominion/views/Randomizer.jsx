import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { usePage } from '../../PageContext.js';
import { writeQuery } from '../urlState.js';
import { cardHref, landscapeHref } from '../links.js';
import { setKingdomDraft } from '../kingdomDraft.js';
import { displayName, impliedSets, primaryType, resolveKingdom } from '../kingdom.js';
import { pilesPlayed } from '../playStats.js';
import { useLeagueGames } from '../useLeagueGames.js';
import {
  DEFAULT_OPTIONS, generate, kingdomFromParams, kingdomToParams, optionsFromParams, optionsToParams,
  rerollLandscape, rerollSlot, toGameItems,
} from '../randomizer.js';
import { expansionMeta } from '../constants.js';
import { CardText, ExpansionBadge, LandscapePill, TypePills } from '../components/bits.jsx';
import CostIcons from '../components/Cost.jsx';
import RandomizerOptions from '../components/RandomizerOptions.jsx';
import { KingdomChip } from '../components/KingdomChips.jsx';
import { uxOn } from '../../ux.js';
import { renderKingdomImage, shareKingdomImage } from '../kingdomImage.js';

const expansionName = e => expansionMeta(e).label;

/* The Kingdom randomizer. Everything — the options AND the kingdom that was rolled — lives in the URL
   (#/dominion/randomizer?exp=Seaside&c=...), so a kingdom can be shared, reopened, and left for a card page and come back
   to with Back. The draw itself is src/dominion/randomizer.js. */
export default function Randomizer({ query = '' }) {
  const { catalog } = useCatalog();
  const page = usePage();   // null outside the league (tests); gives the logged games and whether this viewer can log one
  const params = useMemo(() => new URLSearchParams(query.replace(/^\?/, '')), [query]);
  const opts = useMemo(() => optionsFromParams(params), [params]);
  const state = useMemo(() => kingdomFromParams(catalog, params), [catalog, params]);

  const [locked, setLocked] = useState(() => new Set());        // pile keys kept on a re-roll
  const [lockedL, setLockedL] = useState(() => new Set());      // landscape ids kept on a re-roll
  const [message, setMessage] = useState('');
  const [showText, setShowText] = useState(false);
  const [fresh, setFresh] = useState(null);                     // the tile that just changed, briefly highlighted
  const [copied, setCopied] = useState('');
  const resultRef = useRef(null);

  const lg = useLeagueGames();
  const plays = useMemo(() => (lg && lg.stats ? pilesPlayed(lg.stats) : null), [lg]);
  const canFavor = !!plays && plays.size > 0;
  const canLog = !!(page && page.me && page.me.is_admin);

  const write = (nextOpts, nextState) => {
    const p = optionsToParams(nextOpts); if (nextState) kingdomToParams(nextState, p);
    const s = p.toString(); writeQuery(s ? '?' + s : '');
  };
  const setOpts = patch => { setMessage(''); write({ ...opts, ...patch }, state); };
  const gen = extra => generate(catalog, opts, { plays: opts.favor ? plays : null, ...extra });

  const roll = () => {
    const res = gen({ keep: [...locked], keepLandscapes: [...lockedL] });
    if (!res.ok) { setMessage(res.message); return; }
    setMessage(''); setFresh(null); write(opts, res);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  const swapSlot = i => {
    const res = rerollSlot(catalog, opts, state, i, { plays: opts.favor ? plays : null });
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.slots.map(s => s.key));
    setMessage(''); setFresh(res.slots.find(s => !was.has(s.key))?.key ?? null); write(opts, res);
  };
  const swapLandscape = i => {
    const res = rerollLandscape(catalog, opts, state, i);
    if (!res.ok) { setMessage(res.message); return; }
    const was = new Set(state.landscapes.map(l => l.landscape.id));
    setMessage(''); setFresh(res.landscapes.find(l => !was.has(l.landscape.id))?.landscape.id ?? null); write(opts, res);
  };
  const reset = () => { setMessage(''); setLocked(new Set()); setLockedL(new Set()); write(DEFAULT_OPTIONS, state); };

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied('Link copied'); } catch { setCopied('Couldn’t copy — copy the address from your browser’s address bar.'); }
    setTimeout(() => setCopied(''), 3500);
  };
  const shareImage = async () => {
    setCopied('Making the picture…');
    try {
      const blob = await renderKingdomImage(state, { title: 'Kingdom', subtitle: `${[...new Set(state.slots.map(s => s.expansion))].map(e => expansionName(e)).join(' · ')}` });
      const how = await shareKingdomImage(blob, { name: 'kingdom.png', title: 'Dominion kingdom' });
      setCopied(how === 'shared' ? '' : how === 'downloaded' ? 'Picture saved to your downloads' : '');
    } catch { setCopied('The picture couldn’t be made on this device.'); }
    setTimeout(() => setCopied(''), 3500);
  };
  const logIt = () => {
    const items = toGameItems(state), implied = impliedSets(resolveKingdom(catalog, items));
    setKingdomDraft({ items, sets: implied.sets, landscapes: implied.landscapes });
    window.location.hash = page.hashFor('games', page.gid);
  };

  useEffect(() => { if (fresh == null) return; const t = setTimeout(() => setFresh(null), 1800); return () => clearTimeout(t); }, [fresh]);

  const changed = JSON.stringify(opts) !== JSON.stringify(DEFAULT_OPTIONS);

  return (
    <>
      <div className="head"><div><h1>Kingdom randomizer</h1><p className="lede">Roll a Kingdom for your next game. Choose the expansions and any rules, roll, then lock the cards you like and re-roll the rest.</p></div></div>

      <form className="builder dn-filters dn-rz-opts" aria-label="Randomizer options" onSubmit={e => { e.preventDefault(); roll(); }}>
        <RandomizerOptions catalog={catalog} opts={opts} setOpts={setOpts} canFavor={canFavor} />

        <div className="controls dn-rz-go">
          <button type="submit">{state ? 'Roll a new kingdom' : 'Roll a kingdom'}</button>
          <button type="button" className="ghost" onClick={reset} disabled={!changed}>Reset options</button>
          {(locked.size > 0 || lockedL.size > 0) && state && <span className="meta">Locked cards stay when you roll again.</span>}
        </div>
        {message && <p className="dn-rz-msg" role="alert">{message}</p>}
      </form>

      {state ? (
        <section aria-labelledby="rz-result" ref={resultRef} className="dn-rz-result">
          <div className="dn-rz-bar">
            <h2 id="rz-result">Your kingdom</h2>
            <div className="dn-rz-actions">
              <label className="dn-check"><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Show card text</label>
              <button type="button" className="ghost" onClick={copy}>Copy link</button>
              {uxOn('share') && <button type="button" className="ghost" onClick={shareImage}>Share image</button>}
              {canLog && <button type="button" className="ghost" onClick={logIt} title="Open Add a game with this kingdom filled in">Use for a game →</button>}
              <span className="meta" role="status" aria-live="polite">{copied}</span>
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
        <p className="dn-rz-empty">Nothing rolled yet. Choose your options above, then <b>Roll a kingdom</b>.</p>
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
