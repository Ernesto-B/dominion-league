import { useEffect, useId, useRef, useState } from 'react';
import SearchInput from './SearchInput.jsx';
import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';
import { TIERS, MAX_PINS, pinKey, pinnedBadges, grouped, viewHint } from '../lib/achievements.js';
import { usePins } from '../usePins.js';
import { badgesFor } from '../lib/xp.js';
import { badgeIcon } from './badgeIcon.jsx';
import { short } from '../lib/format.js';

const SAVE_DELAY = 700;   // a pin is saved this long after the last tap, so tapping three stars is one save

/* The Badges tab of a Player page: the whole collection, earned ones with the game that earned them, the rest dimmed with how to get them.
   One toolbar: All / Owned / Locked, a Difficulty menu, a search box and (for the viewer's own page) how many of the three pins are used; under it a chip per group.
   Pinning is a star on each earned badge, saved a moment after the last tap. */
export default function Badges({ p, focus = null, showOwned = false }) {
  const { D, gid, hashFor, catalog } = usePage();
  const list = badgesFor(D, p, catalog);
  const got = list.filter(b => b.earned).length;
  const pins = usePins(p.name);
  // the pinned keys as chosen on this screen (a badge's id, or 'track:<id>'); changes are saved by the effect below
  const [sel, setSel] = useState(() => pinnedBadges(pins.ids, list).map(pinKey));   // only pins that still show: a stale id would use up a place for nothing
  const [note, setNote] = useState('');   // '', 'Saving…', 'Saved'
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setNote('Saving…');
    const t = setTimeout(async () => { setNote((await pins.save(sel)) ? 'Saved' : ''); }, SAVE_DELAY);
    return () => clearTimeout(t);
  }, [sel]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (note !== 'Saved') return undefined; const t = setTimeout(() => setNote(''), 1800); return () => clearTimeout(t); }, [note]);
  const star = pins.mine ? { sel, toggle: k => setSel(d => (d.includes(k) ? d.filter(x => x !== k) : d.length >= MAX_PINS ? d : [...d, k])) } : null;

  const [q, setQ] = useState('');
  const [status, setStatus] = useState(showOwned ? 'owned' : 'all');   // all | owned | locked
  useEffect(() => { if (showOwned) setStatus('owned'); }, [showOwned]);   // a "+" pressed while already on this tab
  const [tiers, setTiers] = useState([]);        // empty = every difficulty
  const [group, setGroup] = useState(null);      // one group's name, or null for all
  const diff = useRef(null);   // the Difficulty menu closes on a press anywhere outside it, or on Escape
  useEffect(() => {
    const away = e => { const d = diff.current; if (d && d.open && !d.contains(e.target)) d.open = false; };
    const esc = e => { const d = diff.current; if (e.key === 'Escape' && d && d.open) { d.open = false; d.querySelector('summary').focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, []);
  const flipTier = id => setTiers(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));
  const sections = grouped(list);
  const secs = filterSections(sections, { q, owned: status === 'owned', locked: status === 'locked', tiers, group });
  const filtering = q.trim() || status !== 'all' || tiers.length > 0 || group;
  // arriving with ?badge=<id>: scroll to that badge (or the track holding it) and flash it once
  const holder = focus && sections.flatMap(sec => sec.items).find(it => (it.kind === 'track' ? it.steps.some(x => x.id === focus) : it.badge.id === focus));
  const holderDom = holder ? (holder.kind === 'track' ? 'bt-' + holder.id : 'bd-' + holder.badge.id) : null;
  const flashed = useRef(null);
  useEffect(() => {
    if (!focus || !holderDom || flashed.current === focus) return undefined;   // the badge list may still be loading: try again on the next render
    const t = setTimeout(() => {
      const el = document.getElementById(holderDom); if (!el) return;
      flashed.current = focus;
      el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.add('badge-flash'); setTimeout(() => el.classList.remove('badge-flash'), 2600);
    }, 450);
    return () => clearTimeout(t);
  }, [focus, holderDom]);
  const when = b => b.earned && (b.earned.line != null ? <small className="badge-when">Earned <a href={hashFor('games', gid) + '?game=' + b.earned.line}>{short(b.earned.date)}</a></small> : <small className="badge-when">Earned {short(b.earned.date)}</small>);
  const tierNote = tiers.length ? ` · ${tiers.length}` : '';
  return (
    <section className="badges-tab" aria-label="Badges">
      <div className="bt-head"><h2>Badges <span className="meta">{got} of {list.length}</span></h2>
        <div className="shelf-bar" role="img" aria-label={`${got} of ${list.length} earned`}><i style={{ width: (list.length ? Math.round(got / list.length * 100) : 0) + '%' }} /></div></div>

      <div className="bt-toolbar" role="search">
        <div className="bt-seg" role="group" aria-label="Which badges to show">
          {[['all', 'All'], ['owned', 'Owned'], ['locked', 'Locked']].map(([id, label]) => <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>{label}</button>)}
        </div>
        <details className="bt-diff" ref={diff}>
          <summary>Difficulty{tierNote}</summary>
          <div className="bt-diff-menu" role="group" aria-label="Show only badges of a difficulty">{TIERS.map(t => (
            <button type="button" key={t.id} aria-pressed={tiers.includes(t.id)} onClick={() => flipTier(t.id)}><i className={'tier-dot td-' + t.id} />{t.label}<small className="meta">{t.hint}</small></button>
          ))}</div>
        </details>
        <SearchInput value={q} onChange={setQ} placeholder="Search badges" aria-label="Search badges by name or description" />
        <button type="button" className="ghost bt-clear" disabled={!filtering} onClick={() => { setQ(''); setStatus('all'); setTiers([]); setGroup(null); }}>Clear</button>
        {star && <span className="bt-pins" role="status" aria-live="polite"><b>★ {sel.length} of {MAX_PINS} pinned</b>{note ? <span className="meta"> · {note}</span> : null}</span>}
      </div>
      <div className="bt-groups" role="group" aria-label="Badge groups">
        {sections.map(sec => <button key={sec.group} type="button" aria-pressed={group === sec.group} onClick={() => setGroup(g => (g === sec.group ? null : sec.group))}>{sec.group} <span className="meta">{sec.got}/{sec.of}</span></button>)}
      </div>
      {pins.error && <p className="meta badge-pinnote"><b className="down-t">{pins.error}</b></p>}
      {filtering && !secs.length && <p className="empty">No badges match.</p>}
      {secs.map(sec => (
        <section key={sec.group} className="badge-sec">
          <h3>{sec.group} <span className="meta">{sec.got} of {sec.of}</span></h3>
          <ul className="badges">
            {sec.items.map(it => it.kind === 'track' ? <Track key={it.id} t={it} when={when} star={star} focus={focus} /> : <Badge key={it.id} b={it.badge} when={when} star={star} mine={pins.mine} />)}
          </ul>
        </section>
      ))}
    </section>
  );
}

// keeps the entries that match the search (name or description; a track by its name or any step), the Owned / Locked switch, the chosen difficulties
// (a track by any of its steps) and the chosen group; a section with nothing left is dropped. Counts still describe the whole section.
export function filterSections(secs, { q, owned, locked = false, tiers, group = null }) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = b => `${b.name} ${b.hint}`.toLowerCase();
  const keep = it => {
    const bs = it.kind === 'track' ? it.steps : [it.badge];
    if (owned && !bs.some(b => b.earned)) return false;
    if (locked && bs.every(b => b.earned)) return false;   // a track with a step still to go counts as locked
    if (tiers.length && !bs.some(b => tiers.includes(b.tier))) return false;
    if (!words.length) return true;
    const hay = (it.kind === 'track' ? it.name.toLowerCase() + ' ' : '') + bs.map(text).join(' ');
    return words.every(w => hay.includes(w));
  };
  return secs.filter(sec => !group || sec.group === group).map(sec => ({ ...sec, items: sec.items.filter(keep) })).filter(sec => sec.items.length);
}

const LABEL = { ...Object.fromEntries(TIERS.map(t => [t.id, t.label])), secret: 'Secret' };
// the small coloured dot that says how hard a badge is (the colour key is the legend at the top of the section)
const Dot = ({ tier }) => (tier ? <i className={'tier-dot td-' + tier} title={LABEL[tier]} aria-label={LABEL[tier]} role="img"></i> : null);

const icon = b => badgeIcon(b);

// a small Pin / Pinned pill on an earned badge of the viewer's own page (at most three; a fourth is refused until one comes off)
function PinButton({ k, star, name }) {
  const on = star.sel.includes(k), full = !on && star.sel.length >= MAX_PINS;
  return <button type="button" className={'badge-pin' + (on ? ' on' : '')} aria-pressed={on} disabled={full} onClick={e => { e.stopPropagation(); star.toggle(k); }}
    aria-label={on ? `Unpin ${name}` : `Pin ${name} beside your name`} title={full ? 'Three are already pinned' : undefined}>{on ? '✓ Pinned' : 'Pin'}</button>;
}

function Badge({ b, when, star, mine }) {
  return (
    <li id={'bd-' + b.id} className={(b.earned ? 'got' : 'locked') + (b.secret ? ' secret' : '')}>
      <span className="badge-ico" aria-hidden="true">{icon(b)}</span>
      <span className="badge-txt"><b><Dot tier={b.tier} />{b.name}</b>{b.secret && b.earned && mine && b.quote ? <small className="badge-quote">“{b.quote}”</small> : null}<small>{viewHint(b, mine)}</small>{when(b)}{star && b.earned && <PinButton k={pinKey(b)} star={star} name={b.name} />}</span>
    </li>
  );
}

/* A ladder of badges as one box: the step you are on, a rail of every step (earned ones filled in, the next one marked) and how far to the
   next; tapping the box slides open the detail (what each step asks for and when it was earned). */
function Track({ t, when, star, focus }) {
  const [open, setOpen] = useState(() => !!focus && t.steps.some(x => x.id === focus));   // a link to one of its steps opens it

  const id = useId();
  const cur = t.current, nx = t.next, ref = nx || cur;
  const fill = Math.min(100, (t.got + (nx && nx.value != null ? Math.min(1, Math.max(0, nx.value / nx.target)) : 0)) / t.of * 100);
  const pct = nx && nx.value != null ? Math.max(0, Math.min(100, Math.round(nx.value / nx.target * 100))) : 100;
  return (
    <li id={'bt-' + t.id} className={'badge-track ' + (cur ? 'got' : 'locked') + (open ? ' open' : '')} onClick={e => { if (e.target.closest('a, .badge-pin')) return; setOpen(o => !o); }}>
      <button type="button" className="badge-head" aria-expanded={open} aria-controls={id}>
        <span className="badge-ico" aria-hidden="true">{icon(cur || ref)}</span>
        <span className="badge-txt">
          <b><Dot tier={ref && ref.tier} />{t.name} <span className="meta">{t.got} of {t.of}</span></b>
          <small>{cur ? cur.name : 'Not started'}{nx ? <> → {nx.name}</> : ' · all done'}</small>
        </span>
        <span className="badge-chev" aria-hidden="true">▾</span>
      </button>
      <div className="badge-rail" role="img" aria-label={`${t.got} of ${t.of} steps${nx && nx.value != null ? `, ${pct}% of the way to ${nx.name}` : ''}`} style={{ '--fill': fill + '%' }}>
        {t.steps.map((b, k) => <i key={b.id} className={b.earned ? 'got' : b === nx ? 'next' : ''} title={b.name} style={{ left: ((k + 1) / t.of * 100) + '%' }}></i>)}
      </div>
      {star && cur && <div className="badge-pinrow"><PinButton k={pinKey(cur)} star={star} name={t.name} /></div>}
      <div className="badge-more" id={id}>
        <ol className="badge-steps">
          {t.steps.map(b => <li key={b.id} className={b.earned ? 'got' : 'locked'}><span aria-hidden="true">{b.earned ? '✓' : '○'}</span><span><b><Dot tier={b.tier} />{b.name}</b> <small>{b.hint}</small> {when(b)}</span></li>)}
        </ol>
      </div>
    </li>
  );
}
