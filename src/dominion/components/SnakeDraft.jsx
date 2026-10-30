import { useEffect, useMemo, useRef, useState } from 'react';
import { POOL_SIZES, bansNeeded, finishDraft, handSwaps, poolSizeFor, rollPool, shuffled, snakeOrder } from '../draft.js';
import { toGameItems } from '../randomizer.js';
import { CardText, ExpansionBadge, LandscapePill, ShowTextButton, TypePills } from './bits.jsx';
import CostIcons from './Cost.jsx';
import RandomizerOptions from './RandomizerOptions.jsx';
import { displayName, primaryType } from '../kingdom.js';
import { Setup } from './RandomizerPanel.jsx';
import Peek from './CardPeek.jsx';

/* Pick the kingdom in turns. One device is enough: pass it round, or let one person tap each player's choice.
   The draft is CONTROLLED: its whole state (`value`, see draftState in draft.js) lives in the saved Game night, so leaving the page, or the
   Back button, loses nothing. The Start button of the options page is Game night's own (the bar at the bottom of the screen).
   players          the names at the table
   opts / setOpts   the randomizer options (the same ones the roll uses): they shape the pool
   value / onChange the draft state and a setter for the whole of it
   onDone(result)   the finished kingdom, shaped like a roll
   onRestart()      take every pick and ban back and start the same pool again (the caller also clears the kingdom)
   onReset()        put the options back to their defaults
   items            the kingdom as it is now (a hand-pick after the draft shows what it changed)
   setup            the setup notes for the kingdom as it is now (they follow hand-picks)
   hand / setHand / handPanel   the emergency "Pick cards by hand" button of the finished screen and the panel it opens */
// each seat gets its own colour, used on the seat's box, its picks and the cards it took, so who has what reads at a glance
const seatColor = i => `hsl(${(i * 67 + 24) % 360} 68% 62%)`;

export default function SnakeDraft({ catalog, players, opts, setOpts, plays = null, value, onChange, onDone, onRestart, onReset, items = [], setup = null, hand = false, setHand = () => {}, handPanel = null }) {
  const { seats } = value;
  const set = patch => onChange({ ...value, ...patch });
  const [peek, setPeek] = useState(null);          // the card or landscape whose text is open
  const top = useRef(null);
  const canFavor = !!plays && plays.size > 0;

  const rolled = useMemo(() => (value.draft ? rollPool(catalog, value.draft.options, value.draft.seed, { plays, n: value.draft.n, size: value.draft.size }) : null), [catalog, value.draft, plays]);
  const draft = rolled && rolled.ok ? rolled : null;
  // what was saved may not fit the pool rolled now (a draft kept from an older version, or a changed catalog): only picks and bans that are really in it count
  const inPool = draft ? new Set(draft.pool.map(s => s.key)) : null;
  const picks = draft ? [...new Set(value.picks)].filter(k => inPool.has(k)).slice(0, draft.n) : value.picks;
  const banned = draft ? value.banned.map(k => (k && inPool.has(k) && !picks.includes(k) ? k : null)) : value.banned;
  // a draft that can no longer be rebuilt (the catalog changed under it) goes back to the options page
  useEffect(() => { if (value.draft && rolled && !rolled.ok) set({ draft: null, picks: [], banned: [], finished: false, error: rolled.message }); }, [rolled]);   // eslint-disable-line react-hooks/exhaustive-deps
  // the first cards (and whose turn it is) come into view when the draft starts
  useEffect(() => {
    if (draft && !value.finished && top.current) top.current.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [!!draft]);   // eslint-disable-line react-hooks/exhaustive-deps

  const size = value.poolSize ?? poolSizeFor(seats.length);
  const needed = bansNeeded(value);

  // ---- the options page
  if (!draft) return (
    <div className="builder dn-draft-setup">
      <p className="meta" style={{ marginTop: 0 }}>Everyone takes turns choosing the kingdom from a pool of cards, in snake order (1-2-3-3-2-1…).</p>
      <h3 className="dn-rz-sub">Seating order</h3>
      <ol className="dn-draft-seats">{seats.map((n, i) => (
        <li key={n}><span>{n}</span>
          <button type="button" className="ghost" disabled={i === 0} onClick={() => set({ seats: swap(seats, i, i - 1) })} aria-label={`Move ${n} up`}>↑</button>
          <button type="button" className="ghost" disabled={i === seats.length - 1} onClick={() => set({ seats: swap(seats, i, i + 1) })} aria-label={`Move ${n} down`}>↓</button>
        </li>))}</ol>
      <div className="dn-draft-row">
        <button type="button" className="ghost" onClick={() => set({ seats: shuffled(seats) })}>Shuffle the order</button>
        <button type="button" className={'dn-chip dn-bans'} aria-pressed={value.bans} onClick={() => set({ bans: !value.bans })} title="Before the picks, each player bans one card from the pool">Bans: {value.bans ? 'On' : 'Off'}</button>
        <span className="meta">{value.bans ? 'Each player bans one card before the picks.' : 'No bans.'}</span>
      </div>
      <div className="dn-filters dn-rz-opts" aria-label="Draft options">
        <RandomizerOptions catalog={catalog} opts={opts} setOpts={p => { set({ error: '' }); setOpts(p); }} canFavor={canFavor}
          cardCount={<label className="f">Cards to draft from <select value={size} onChange={e => set({ poolSize: Number(e.target.value) })}>{POOL_SIZES.map(n => <option key={n} value={n}>{n}{n === poolSizeFor(seats.length) ? ' (suggested)' : ''}</option>)}</select></label>} />
        <div className="controls dn-rz-go"><button type="button" className="ghost" onClick={() => { set({ poolSize: null, error: '' }); onReset(); }}>Reset options</button></div>
      </div>
      {value.error && <p className="dn-rz-msg" role="alert">{value.error}</p>}
    </div>
  );

  // ---- the draft itself, and the finished screen
  const order = snakeOrder(seats, draft.n);
  const phase = banned.length < needed ? 'ban' : 'pick';
  const seatOf = n => seats.indexOf(n);
  const taken = new Map([...banned.flatMap((k, i) => (k ? [[k, { by: seats[i], n: i + 1, ban: true }]] : [])), ...picks.map((k, i) => [k, { by: order[i], n: i + 1 }])]);
  const turn = phase === 'ban' ? seats[banned.length] : order[picks.length];
  const round = Math.floor(picks.length / seats.length) + 1;
  const take = key => {
    if (value.finished || taken.has(key)) return;
    if (phase === 'ban') { set({ banned: [...banned, key] }); return; }
    const next = [...picks, key];
    if (next.length < draft.n) { set({ picks: next }); return; }
    const res = finishDraft(catalog, draft, next);
    if (!res.ok) { set({ error: res.message }); return; }
    onChange({ ...value, picks: next, finished: true, error: '', original: toGameItems(res).filter(i => i.kind === 'card').map(i => i.id) });
    onDone(res);
  };
  // a random card for whoever is up (a pick, not a ban: a ban can always be skipped)
  const pickRandom = () => { const free = draft.pool.filter(s => !taken.has(s.key)); if (free.length) take(free[Math.floor(Math.random() * free.length)].key); };
  const undo = () => (picks.length ? set({ picks: picks.slice(0, -1) }) : set({ banned: banned.slice(0, -1) }));

  // after a finished draft, cards taken out by hand are struck through where they were drafted, with the card typed in beside them
  const swaps = value.finished && value.original ? handSwaps(value.original, items.filter(i => i.kind === 'card').map(i => i.id)) : null;
  const nameOf = id => { const c = catalog.cardsById.get(id); return c ? displayName(c) : id; };
  const seatsSummary = (
    <ul className="dn-draft-picks">{seats.map((n, si) => {
      const mine = picks.map((k, i) => (order[i] === n ? { key: k, n: i + 1, slot: draft.pool.find(x => x.key === k) } : null)).filter(Boolean);
      const bans = banned.map((k, i) => (seats[i] === n ? (k ? draft.pool.find(x => x.key === k) : { key: 'skip' + i, skipped: true }) : null)).filter(Boolean);
      const left = order.filter((o, i) => i >= picks.length && o === n).length;
      return (
        <li key={n} className={'dn-draft-seat' + (!value.finished && n === turn ? ' now' : '')} style={{ '--seat': seatColor(si) }}>
          <p className="dn-draft-seat-head"><b>{n}</b><span className="meta">{!value.finished && n === turn ? `${phase === 'ban' ? 'banning' : 'picking'} now · ` : ''}{mine.length} picked{value.finished ? '' : left ? `, ${left} to go` : ', done'}</span></p>
          {bans.map(b => (b.skipped ? <p key={b.key} className="dn-draft-ban skipped"><span className="n">Ban</span><em>skipped</em></p> : <p key={b.key} className="dn-draft-ban"><span className="n">Ban</span>{b.name}</p>))}
          {mine.length ? (
            <ol className="dn-draft-mine">{mine.map(m => (
              swaps && swaps.removed.includes(m.slot.cards[0].id)
                ? <li key={m.key} className="replaced"><span className="n">#{m.n}</span><s>{m.slot.name}</s>{swaps.replacedBy.has(m.slot.cards[0].id) ? <b className="dn-swap-in" title="Picked by hand instead">→ {nameOf(swaps.replacedBy.get(m.slot.cards[0].id))}</b> : <em className="meta"> removed</em>}</li>
                : <li key={m.key} className={'t-' + primaryType(m.slot.cards.find(c => primaryType(c) === 'Attack') || m.slot.cards[0]).toLowerCase()}><span className="n">#{m.n}</span>{m.slot.name}</li>
            ))}</ol>
          ) : <p className="meta" style={{ margin: 0 }}>Nothing yet</p>}
        </li>
      );
    })}</ul>
  );

  if (value.finished) return (
    <section className="builder dn-draft" aria-label="Draft finished" ref={top}>
      <p className="dn-draft-done"><b>Draft Completed</b></p>
      {seatsSummary}
      {swaps && swaps.extra.length > 0 && <p className="meta">Also added by hand: {swaps.extra.map(nameOf).join(', ')}.</p>}
      {setup && <Setup catalog={catalog} setup={setup} />}
      {draft.landscapes.length > 0 && <p className="meta">Landscapes in this game: {draft.landscapes.map(l => l.landscape.name).join(', ')}.</p>}
      <div className="controls dn-rz-go">
        <button type="button" className="ghost" onClick={onRestart}>Restart draft</button>
        <button type="button" className="ghost" aria-expanded={hand} onClick={() => setHand(!hand)}>{hand ? 'Hide hand-picking' : 'Pick cards by hand'}</button>
      </div>
      {hand && handPanel}
    </section>
  );

  return (
    <section className="builder dn-draft" aria-label="Snake draft" ref={top}>
      <div className="dn-draft-turn" key={banned.length + ':' + picks.length} style={{ '--seat': seatColor(seatOf(turn)) }}>
        <span className="dn-draft-turn-who" role="status" aria-live="polite"><span className="meta">{phase === 'ban' ? 'Ban a card' : picks.length ? 'Pass it to' : 'First pick'}</span><b>{turn}</b></span>
        <span className="dn-draft-turn-right">
          <span className="meta dn-draft-turn-n">{phase === 'ban' ? <>Ban {banned.length + 1} of {needed}</> : <>Pick {picks.length + 1} of {draft.n}<br />round {round}</>}</span>
          {phase === 'ban'
            ? <button type="button" className="dn-draft-act" onClick={() => set({ banned: [...banned, null] })} title="Bans are optional: pass without banning a card">Skip ban</button>
            : <button type="button" className="dn-draft-act" onClick={pickRandom} title="Take a random card from the pool for this player">Pick random</button>}
        </span>
      </div>
      <div className="dn-draft-bar">
        <ShowTextButton className="dn-draft-textbtn" on={value.showText} onClick={() => set({ showText: !value.showText })} />
        <button type="button" className="ghost" disabled={!picks.length && !banned.length} onClick={undo}>{picks.length || !banned.length ? 'Undo last pick' : 'Undo last ban'}</button>
        <button type="button" className="ghost" onClick={onRestart}>Restart Drafting</button>
      </div>
      <ul className="dn-rzgrid dn-draft-pool" aria-label="Cards to choose from">
        {draft.pool.map(s => {
          const t = taken.get(s.key);
          return (
            <li key={s.key} onClick={t ? undefined : () => take(s.key)} className={'dn-rztile dn-draft-tile t-' + primaryType(s.cards.find(c => primaryType(c) === 'Attack') || s.cards[0]).toLowerCase() + (t ? ' taken' : '') + (t && t.ban ? ' banned' : '')} style={t ? { '--seat': seatColor(seatOf(t.by)) } : undefined}>
              <button type="button" className="dn-draft-take" disabled={!!t} aria-label={t ? `${s.name}, ${t.ban ? 'banned' : 'taken'} by ${t.by}` : `${turn} ${phase === 'ban' ? 'bans' : 'takes'} ${s.name}`}>
                <span className="dn-rz-cost"><CostIcons coins={s.cards[0].coins} debt={s.cards[0].debt} overpay={s.cards[0].overpay} size={28} /></span>
                <span className="dn-rz-main">
                  <span className="dn-rz-name">{s.name}</span>
                  <span className="dn-draft-sub"><TypePills types={[...new Set(s.cards.flatMap(c => c.types))]} /><span className="meta dn-rz-exp"><ExpansionBadge name={s.expansion} size={14} /></span></span>
                </span>
                {t && <span className="dn-draft-by">{t.ban ? 'Banned' : '#' + t.n} · {t.by}</span>}
              </button>
              {value.showText && s.cards.map(c => <div key={c.id} className="dn-rz-text">{s.cards.length > 1 && <p className="meta dn-rz-textname">{c.name}</p>}<CardText text={c.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>)}
              <button type="button" className="dn-draft-more" aria-label={`Show the text of ${s.name}`} onClick={e => { e.stopPropagation(); setPeek({ kind: 'card', s }); }}>⌄</button>
            </li>
          );
        })}
      </ul>
      {draft.landscapes.length > 0 && (
        <>
          <h3 className="dn-rz-sub">Landscapes in this game</h3>
          <p className="meta" style={{ marginTop: 0 }}>These are in play whichever cards you pick. They aren’t drafted.</p>
          <ul className="dn-rzgrid dn-draft-pool dn-draft-lands" aria-label="Landscapes">
            {draft.landscapes.map(l => (
              <li key={l.landscape.id} className={'dn-rztile dn-draft-tile land t-' + l.landscape.type.toLowerCase()}>
                <div className="dn-draft-take">
                  <span className="dn-rz-main">
                    <span className="dn-rz-name">{l.landscape.name}</span>
                    <span className="dn-draft-sub"><LandscapePill type={l.landscape.type} /><span className="meta dn-rz-exp"><ExpansionBadge name={l.landscape.expansion} size={14} /></span></span>
                    {l.landscape.type === 'Trait' && <span className="meta">Goes on one of the Kingdom cards once they are chosen.</span>}
                  </span>
                </div>
                {value.showText && <div className="dn-rz-text"><CardText text={l.landscape.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>}
                <button type="button" className="dn-draft-more" aria-label={`Show the text of ${l.landscape.name}`} onClick={() => setPeek({ kind: 'landscape', l })}>⌄</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="dn-rz-sub">{needed ? 'Bans and picks so far' : 'Picked so far'}</h3>
      {seatsSummary}
      {value.error && <p className="dn-rz-msg" role="alert">{value.error}</p>}
      {peek && <Peek catalog={catalog} peek={peek} onClose={() => setPeek(null)} />}
    </section>
  );
}

const swap = (list, a, b) => { const x = list.slice(); [x[a], x[b]] = [x[b], x[a]]; return x; };
