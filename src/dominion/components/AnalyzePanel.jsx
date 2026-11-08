import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { analyseKingdom, verdictOf } from '../analysis.js';
import { cardHref } from '../links.js';
import { ExpansionBadge } from './bits.jsx';
import Fold from './Fold.jsx';
import { onAnalyzeRequest, takeAnalyzeRequest } from '../analyzeBus.js';

// a card's name: on the kingdom shown, a tap points at its picture for a moment; with nowhere to point (no kingdom on screen) it opens the card's page
function Name({ c, onPick }) {
  return onPick ? <a href={cardHref(c.id)} onClick={e => { e.preventDefault(); onPick(c.pile); }} title="Show it in the kingdom">{c.name}</a> : <a href={cardHref(c.id)}>{c.name}</a>;
}

/* The Randomizer's optional "Analyze" panel: a button on the bar above the tiles that slides a panel in from the right (a bottom sheet on a phone) saying what the kingdom
   is made of. It reads the CURRENT cards, so a re-roll, a swap or a hand-pick updates it while it is open. Nothing is shown until it is asked for; the only trace on the screen
   is a small dot on the button when something stands out (a job with no card on record, or more pure specialists than Balance allows). Counts are recorded mechanics: a floor. */
const KEY = 'dl.analyze';
const wide = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 721px)').matches;
const remembered = () => { try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; } };

export default function Analyze({ catalog, slots, onPick = null, onFix = null }) {
  const a = useMemo(() => analyseKingdom(catalog, slots), [catalog, slots]);
  const [open, setOpen] = useState(() => wide() && remembered());   // a phone always starts closed; a computer reopens as it was left
  const set = v => { setOpen(v); try { if (wide()) window.localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* not remembered */ } };
  const btn = useRef(null);
  useEffect(() => {   // Game night's "Fix it" asks for the panel
    const ask = () => { if (takeAnalyzeRequest()) setOpen(true); };
    ask();
    return onAnalyzeRequest(ask);
  }, []);
  return (
    <>
      <button type="button" ref={btn} className={'ghost dn-az-btn' + (open ? ' on' : '')} aria-expanded={open} aria-controls="kingdom-analysis" onClick={() => set(!open)} title="What this kingdom is made of: drawing, villages, trashing and more">
        Analyze{a.flags > 0 && <i className="dn-az-dot" aria-label={`${a.flags} thing${a.flags === 1 ? '' : 's'} to look at`} />}
      </button>
      {typeof document !== 'undefined' && createPortal(<Sheet a={a} open={open} onFix={onFix} onPick={pile => { if (!onPick) return; if (!wide()) set(false); onPick(pile); }} onClose={() => { set(false); btn.current?.focus({ preventScroll: true }); }} />, document.body)}
    </>
  );
}

function Sheet({ a, open, onClose, onPick, onFix }) {
  const [drag, setDrag] = useState(0);
  const [said, setSaid] = useState(null);   // what the last Fix did: { ok, message, pile }
  const start = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => { if (open) setDrag(0); else setSaid(null); }, [open]);
  // dragging the handle down closes the sheet on a phone
  const down = e => { start.current = e.touches[0].clientY; };
  const move = e => { if (start.current != null) setDrag(Math.max(0, e.touches[0].clientY - start.current)); };
  const up = () => { if (drag > 90) onClose(); setDrag(0); start.current = null; };
  const maxBin = Math.max(1, ...a.cost.bins.map(b => b.count));
  return (
    <>
      <div className={'dn-az-scrim' + (open ? ' open' : '')} onClick={onClose} aria-hidden="true" />
      <aside id="kingdom-analysis" className={'dn-az' + (open ? ' open' : '')} aria-label="Kingdom analysis" aria-hidden={!open} inert={!open} style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}>
        <div className="dn-az-grab" onTouchStart={down} onTouchMove={move} onTouchEnd={up} aria-hidden="true"><span /></div>
        <header className="dn-az-head">
          <h3>Kingdom analysis</h3>
          <button type="button" className="ghost dn-az-x" onClick={onClose} aria-label="Close the analysis">Close</button>
        </header>
        <div className="dn-az-body">
          <p className={'dn-az-verdict' + (a.flags ? ' warn' : '')} role="status">{verdictOf(a)}</p>
          {said && <p className={'dn-az-said no'} role="status">{said.message}</p>}
          <ul className="dn-az-rows">
            {a.rows.map(r => (
              <li key={r.key} className={(r.count === 0 ? 'zero ' : '') + (r.heavy ? 'heavy' : '')}>
                <span className="dn-az-n">{r.count}</span>
                <div className="dn-az-what">
                  <b>{r.label}</b>
                  {r.heavy && <span className="dn-az-note"> {r.pure} pure {r.short}s, more than the usual {r.limit}</span>}
                  {onFix && r.fix && <button type="button" className="ghost dn-az-fix" title="Choose which card to swap. Nothing changes until you pick a replacement." onClick={() => { setSaid(null); const next = onFix(r.fix); if (next.ok) onClose(); else setSaid(next); }}>Fix</button>}
                  {r.count === 0 ? <span className="meta"> none recorded</span> : <p className="dn-az-names">{r.cards.map((c, i) => <span key={c.id}>{i > 0 && ', '}<Name c={c} onPick={onPick} /></span>)}</p>}
                </div>
              </li>
            ))}
          </ul>
          {a.gives.length > 0 && (
            <section aria-label="Gives">
              <ul className="dn-az-gives">{a.gives.map(g => <li key={g.key}><b>Gives {g.chip}</b> <span className="dn-az-names">{g.cards.map((c, i) => <span key={c.id}>{i > 0 && ', '}<Name c={c} onPick={onPick} /></span>)}</span></li>)}</ul>
            </section>
          )}
          {a.cost.avg != null && (
            <section aria-labelledby="az-cost">
              <h4 id="az-cost">Cost <span className="meta">average ${a.cost.avg.toFixed(1)}{a.cost.debt > 0 ? ` · ${a.cost.debt} with Debt` : ''}</span></h4>
              <ul className="dn-az-cost">{a.cost.bins.map(b => (
                <li key={b.label}><span className="dn-az-col"><i style={{ height: (b.count / maxBin) * 100 + '%' }} /></span><b>{b.count}</b><small>{b.label}</small></li>
              ))}</ul>
            </section>
          )}
          {a.expansions.length > 0 && (
            <Fold className="dn-az-fold" summary={<>Expansions <span className="meta">{a.expansions.length} in the kingdom</span></>}>
              <ul className="dn-az-exp">{a.expansions.map(e => <li key={e.name}><ExpansionBadge name={e.name} size={14} /><span className="meta">{e.count}</span></li>)}</ul>
            </Fold>
          )}
        </div>
      </aside>
    </>
  );
}
