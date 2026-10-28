import { useEffect, useMemo, useRef, useState } from 'react';
import { newSeed } from '../randomizer.js';
import { finishDraft, rollPool, shuffled, snakeOrder } from '../draft.js';
import { cardHref, landscapeHref } from '../links.js';
import { CardText, ExpansionBadge, LandscapePill, TypePills } from './bits.jsx';
import CostIcons from './Cost.jsx';
import RandomizerOptions from './RandomizerOptions.jsx';
import { primaryType } from '../kingdom.js';

/* Pick the kingdom in turns. One device is enough: pass it round, or let one person tap each player's choice.
   players        the names at the table, in seating order
   opts / setOpts the randomizer options (the same ones the roll uses): they shape the pool
   onDone(result) the finished kingdom, shaped like a roll; onCancel() leaves the draft. */
// each seat gets its own colour, used on the seat's box, its picks and the cards it took, so who has what reads at a glance
const seatColor = i => `hsl(${(i * 67 + 24) % 360} 68% 62%)`;

export default function SnakeDraft({ catalog, players, opts, setOpts, plays = null, onDone, onCancel }) {
  const [seats, setSeats] = useState(players);
  const [draft, setDraft] = useState(null);       // { pool, landscapes, n, seed, options } once started
  const [picks, setPicks] = useState([]);         // pile keys, in the order picked
  const [message, setMessage] = useState('');
  const [showText, setShowText] = useState(false);
  const canFavor = !!plays && plays.size > 0;
  const top = useRef(null);
  // starting the draft happens at the bottom of a long options form: bring the first cards (and whose turn it is) into view
  useEffect(() => {
    if (draft && top.current) top.current.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [draft]);

  const order = useMemo(() => (draft ? snakeOrder(seats, draft.n) : []), [seats, draft]);
  const start = () => {
    const res = rollPool(catalog, opts, newSeed(), { plays });
    if (!res.ok) { setMessage(res.message); return; }
    setMessage(''); setPicks([]); setDraft(res);
  };
  const take = key => {
    const next = [...picks, key];
    if (next.length < draft.n) { setPicks(next); return; }
    const res = finishDraft(catalog, draft, next);
    if (!res.ok) { setMessage(res.message); return; }
    onDone(res);
  };

  if (!draft) return (
    <div className="builder dn-draft-setup">
      <p className="meta" style={{ marginTop: 0 }}>Everyone takes turns choosing the kingdom from a pool of cards, in snake order (1-2-3-3-2-1…), so the last seat picks twice in a row. The options below shape the pool.</p>
      <h3 className="dn-rz-sub">Seating order</h3>
      <ol className="dn-draft-seats">{seats.map((n, i) => (
        <li key={n}><span>{n}</span>
          <button type="button" className="ghost" disabled={i === 0} onClick={() => setSeats(s => { const a = s.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })} aria-label={`Move ${n} up`}>↑</button>
          <button type="button" className="ghost" disabled={i === seats.length - 1} onClick={() => setSeats(s => { const a = s.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; })} aria-label={`Move ${n} down`}>↓</button>
        </li>))}</ol>
      <p><button type="button" className="ghost" onClick={() => setSeats(s => shuffled(s))}>Shuffle the order</button></p>
      <form className="dn-filters dn-rz-opts" aria-label="Draft options" onSubmit={e => { e.preventDefault(); start(); }}>
        <RandomizerOptions catalog={catalog} opts={opts} setOpts={p => { setMessage(''); setOpts(p); }} canFavor={canFavor} />
        <div className="controls dn-rz-go"><button type="submit">Start the draft</button><button type="button" className="ghost" onClick={onCancel}>Back to rolling</button></div>
      </form>
      {message && <p className="dn-rz-msg" role="alert">{message}</p>}
    </div>
  );

  const seatOf = n => seats.indexOf(n);
  const taken = new Map(picks.map((k, i) => [k, { by: order[i], n: i + 1 }]));
  const turn = order[picks.length];
  const round = Math.floor(picks.length / seats.length) + 1;
  return (
    <section className="builder dn-draft" aria-label="Snake draft" ref={top}>
      <div className="dn-draft-turn" key={picks.length} role="status" aria-live="polite" style={{ '--seat': seatColor(seatOf(turn)) }}>
        <span className="dn-draft-turn-who"><span className="meta">{picks.length ? 'Pass it to' : 'First pick'}</span><b>{turn}</b></span>
        <span className="meta dn-draft-turn-n">Pick {picks.length + 1} of {draft.n}<br />round {round}</span>
      </div>
      <div className="dn-draft-bar">
        <label className="dn-check"><input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} /> Show card text</label>
        <button type="button" className="ghost" disabled={!picks.length} onClick={() => setPicks(p => p.slice(0, -1))}>Undo last pick</button>
        <button type="button" className="ghost" onClick={() => { setDraft(null); setPicks([]); }}>Start over</button>
      </div>
      <ul className="dn-rzgrid dn-draft-pool" aria-label="Cards to choose from">
        {draft.pool.map(s => {
          const t = taken.get(s.key);
          return (
            <li key={s.key} onClick={t ? undefined : () => take(s.key)} className={'dn-rztile dn-draft-tile t-' + primaryType(s.cards.find(c => primaryType(c) === 'Attack') || s.cards[0]).toLowerCase() + (t ? ' taken' : '')} style={t ? { '--seat': seatColor(seatOf(t.by)) } : undefined}>
              <button type="button" className="dn-draft-take" disabled={!!t} onClick={() => take(s.key)} aria-label={t ? `${s.name}, taken by ${t.by}` : `${turn} takes ${s.name}`}>
                <span className="dn-rz-cost"><CostIcons coins={s.cards[0].coins} debt={s.cards[0].debt} overpay={s.cards[0].overpay} size={28} /></span>
                <span className="dn-rz-main">
                  <span className="dn-rz-name">{s.name}</span>
                  <span className="dn-draft-sub"><TypePills types={[...new Set(s.cards.flatMap(c => c.types))]} /><span className="meta dn-rz-exp"><ExpansionBadge name={s.expansion} size={14} /></span></span>
                </span>
                {t && <span className="dn-draft-by">{t.by} · #{t.n}</span>}
              </button>
              {showText && s.cards.map(c => <div key={c.id} className="dn-rz-text">{s.cards.length > 1 && <p className="meta dn-rz-textname">{c.name}</p>}<CardText text={c.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>)}
              {showText && <p className="meta" style={{ margin: 0 }}><a href={cardHref(s.cards[0].id)} onClick={e => e.stopPropagation()}>Card page</a></p>}
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
                {showText && <div className="dn-rz-text"><CardText text={l.landscape.text} hasAnyText={catalog.meta.textRecordCount > 0} /></div>}
                {showText && <p className="meta" style={{ margin: 0 }}><a href={landscapeHref(l.landscape.id)} onClick={e => e.stopPropagation()}>Landscape page</a></p>}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="dn-rz-sub">Picked so far</h3>
      <ul className="dn-draft-picks">{seats.map((n, si) => {
        const mine = picks.map((k, i) => (order[i] === n ? { key: k, n: i + 1, slot: draft.pool.find(x => x.key === k) } : null)).filter(Boolean);
        const left = order.filter((o, i) => i >= picks.length && o === n).length;
        return (
          <li key={n} className={'dn-draft-seat' + (n === turn ? ' now' : '')} style={{ '--seat': seatColor(si) }}>
            <p className="dn-draft-seat-head"><b>{n}</b><span className="meta">{n === turn ? 'picking now · ' : ''}{mine.length} picked{left ? `, ${left} to go` : ', done'}</span></p>
            {mine.length ? (
              <ol className="dn-draft-mine">{mine.map(m => (
                <li key={m.key} className={'t-' + primaryType(m.slot.cards.find(c => primaryType(c) === 'Attack') || m.slot.cards[0]).toLowerCase()}><span className="n">#{m.n}</span>{m.slot.name}</li>
              ))}</ol>
            ) : <p className="meta" style={{ margin: 0 }}>Nothing yet</p>}
          </li>
        );
      })}</ul>
      {message && <p className="dn-rz-msg" role="alert">{message}</p>}
    </section>
  );
}
