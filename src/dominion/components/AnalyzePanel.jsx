import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { analyseKingdom, verdictOf } from '../analysis.js';
import { cardHref } from '../links.js';
import { ExpansionBadge } from './bits.jsx';
import Fold from './Fold.jsx';
import { PageShortcuts } from '../../components/Shortcuts.jsx';
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
  // On a phone the in-bar button is not shown (style.css); the floating one is there while the kingdom's CARDS are on screen: from the moment the first card shows, not before, to the last.
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const sec = btn.current && btn.current.closest('.dn-rz-result');
    const grids = sec ? [...sec.querySelectorAll('.dn-rzgrid')] : [];
    if (!grids.length || typeof IntersectionObserver === 'undefined') return undefined;
    const seen = new Set();
    const io = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); setOnScreen(seen.size > 0); });
    grids.forEach(g => io.observe(g));
    return () => io.disconnect();
  }, [slots]);   // a new roll can bring a landscape grid with it
  const floating = !open && onScreen;
  useEffect(() => {   // Game night's "Fix it" asks for the panel
    const ask = () => { if (takeAnalyzeRequest()) setOpen(true); };
    ask();
    return onAnalyzeRequest(ask);
  }, []);
  return (
    <>
      <PageShortcuts bindings={[{ key: 'a', label: 'Analyze the kingdom (open or close)', run: () => set(!open) }]} />
      <button type="button" ref={btn} className={'ghost dn-az-btn' + (open ? ' on' : '')} aria-expanded={open} aria-controls="kingdom-analysis" onClick={() => set(!open)} title="What this kingdom is made of: drawing, villages, trashing and more">
        Analyze{a.flags > 0 && <i className="dn-az-dot" aria-label={`${a.flags} thing${a.flags === 1 ? '' : 's'} to look at`} />}
      </button>
      {typeof document !== 'undefined' && floating && createPortal(
        <button type="button" className={'dn-az-fab' + (document.querySelector('.night-actions') ? ' above-bar' : '')} aria-controls="kingdom-analysis" onClick={() => set(true)} title="What this kingdom is made of: drawing, villages, trashing and more">
          {a.flags > 0 && <i className="dn-az-dot" aria-label={`${a.flags} thing${a.flags === 1 ? '' : 's'} to look at`} />}Analyze
        </button>, document.body)}
      {typeof document !== 'undefined' && createPortal(<Sheet a={a} open={open} onFix={onFix} onPick={pile => { if (!onPick) return; if (!wide()) set(false); onPick(pile); }} onClose={() => { set(false); btn.current?.focus({ preventScroll: true }); }} />, document.body)}
    </>
  );
}

function Sheet({ a, open, onClose, onPick, onFix }) {
  const [drag, setDrag] = useState(0);
  const [said, setSaid] = useState(null);   // what the last Fix did: { ok, message, pile }
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => { if (open) setDrag(0); else setSaid(null); }, [open]);
  // on a phone the whole sheet is pulled down to close it: from the handle or the title bar at any time, and from the list as soon as it is scrolled to its top (a pull on the list while
  // it can still scroll up just scrolls it). Native, non-passive listeners: the pull must stop the page behind from scrolling too.
  const sheet = useRef(null), closeRef = useRef(onClose);
  closeRef.current = onClose;   // the listeners below live as long as the sheet is open, so they must not be rebuilt (and lose a pull in progress) each time the page redraws
  useEffect(() => {
    const el = sheet.current;
    if (!open || !el) return undefined;
    let last = null, from = 0, pulling = false, moved = 0;
    const phone = () => !wide();
    const body = () => el.querySelector('.dn-az-body');
    const down = e => { if (!phone()) return; last = e.touches[0].clientY; pulling = false; moved = 0; };
    const move = e => {
      if (last == null || !phone()) return;
      const y = e.touches[0].clientY, b = body();
      if (!pulling) {
        const inList = b && b.contains(e.target);
        if (y > last && (!inList || b.scrollTop <= 0)) { pulling = true; from = y; }   // moving down, and the list (if that is where the finger is) has nothing left above
        else { last = y; return; }
      }
      e.preventDefault();
      moved = Math.max(0, y - from); setDrag(moved);
    };
    const end = () => { if (pulling && moved > 90) closeRef.current(); pulling = false; last = null; setDrag(0); };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', down); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, [open]);
  const maxBin = Math.max(1, ...a.cost.bins.map(b => b.count));
  return (
    <>
      <div className={'dn-az-scrim' + (open ? ' open' : '')} onClick={onClose} aria-hidden="true" />
      <aside id="kingdom-analysis" ref={sheet} className={'dn-az' + (open ? ' open' : '')} aria-label="Kingdom analysis" aria-hidden={!open} inert={!open} style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}>
        <div className="dn-az-top">
          <div className="dn-az-grab" aria-hidden="true"><span /></div>
          <header className="dn-az-head">
            <h3>Kingdom analysis</h3>
            <button type="button" className="ghost dn-az-x" onClick={onClose} aria-label="Close the analysis">Close</button>
          </header>
        </div>
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
