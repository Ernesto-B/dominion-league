import { useId, useState } from 'react';
import { usePage } from '../PageContext.js';
import TierIcon from './TierIcon.jsx';
import { TIERS, MAX_PINS, pinKey, pinnedBadges, grouped } from '../lib/achievements.js';
import { usePins } from '../usePins.js';
import { badgesFor } from '../lib/xp.js';
import SetIcon from './SetIcon.jsx';
import { short } from '../lib/format.js';

const KEY = 'dl.badgesopen';
const readOpen = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };   // open unless the viewer closed it

/* The badges on a Player page: earned ones with the game that earned them, the rest dimmed with how to get them. */
export default function Badges({ p }) {
  const { D, gid, hashFor, catalog } = usePage();
  const list = badgesFor(D, p, catalog);
  const [open, setOpen] = useState(readOpen);
  const got = list.filter(b => b.earned).length;
  const pins = usePins(p.name);
  // "Pin badges" mode: null normally, else the keys chosen so far (a badge's id, or 'track:<id>'). Saved once, on "Save pins".
  const [picking, setPicking] = useState(null);
  const pick = picking && pins.mine ? { sel: picking, toggle: k => setPicking(d => (d.includes(k) ? d.filter(x => x !== k) : d.length >= MAX_PINS ? d : [...d, k])) } : null;
  const savePicks = async () => { if (await pins.save(picking)) setPicking(null); };
  const [q, setQ] = useState('');
  const [owned, setOwned] = useState(false);
  const [tiers, setTiers] = useState([]);   // empty = every difficulty
  const flipTier = id => setTiers(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));
  const secs = filterSections(grouped(list), { q, owned, tiers });
  const filtering = q.trim() || owned || tiers.length > 0;
  const when = b => b.earned && (b.earned.line != null ? <small className="badge-when">Earned <a href={hashFor('games', gid, b.earned.line)}>{short(b.earned.date)}</a></small> : <small className="badge-when">Earned</small>);
  return (
    <details className="badges-fold" open={open} onToggle={e => { const o = e.currentTarget.open; setOpen(o); try { localStorage.setItem(KEY, o ? '1' : '0'); } catch { /* not remembered */ } }}>
      <summary><h2>Badges <span className="meta">{got} of {list.length}</span></h2></summary>
      <div className="badge-bar">
      <p className="tier-legend" aria-label="Show only badges of a difficulty">{TIERS.map(t => (
        <button type="button" key={t.id} title={t.hint} aria-pressed={tiers.includes(t.id)} className={tiers.includes(t.id) ? 'on' : ''} onClick={() => flipTier(t.id)}><i className={'tier-dot td-' + t.id}></i>{t.label}</button>
      ))}</p>
      <div className="badge-tools">
        <label><input type="checkbox" checked={owned} onChange={e => setOwned(e.target.checked)} /> Only owned</label>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search badges" aria-label="Search badges by name or description" />
        {pins.mine && !picking && <button type="button" className="ghost" onClick={() => setPicking(pinnedBadges(pins.ids, list).map(pinKey))}>Pin badges</button>}
        {pick && <><button type="button" className="badge-save" disabled={pins.busy} onClick={savePicks}>Save pins · {picking.length} of {MAX_PINS}</button><button type="button" className="ghost" onClick={() => setPicking(null)}>Cancel</button></>}
        {filtering && <button type="button" className="ghost dn-hide-sm" onClick={() => { setQ(''); setOwned(false); setTiers([]); }}>Clear</button>}
      </div>
      </div>
      {pins.error && <p className="meta badge-pinnote"><b className="down-t">{pins.error}</b></p>}
      {filtering && !secs.length && <p className="empty">No badges match.</p>}
      {secs.map(sec => (
        <section key={sec.group} className="badge-sec">
          <h3>{sec.group} <span className="meta">{sec.got} of {sec.of}</span></h3>
          <ul className="badges">
            {sec.items.map(it => it.kind === 'track' ? <Track key={it.id} t={it} when={when} pick={pick} /> : <Badge key={it.id} b={it.badge} when={when} pick={pick} />)}
          </ul>
        </section>
      ))}
    </details>
  );
}

// keeps the entries that match the search (name or description; a track by its name or any step), the owned switch and the chosen difficulties
// (a track by any of its steps); a section with nothing left is dropped. Counts still describe the whole section.
export function filterSections(secs, { q, owned, tiers }) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = b => `${b.name} ${b.hint}`.toLowerCase();
  const keep = it => {
    const bs = it.kind === 'track' ? it.steps : [it.badge];
    if (owned && !bs.some(b => b.earned)) return false;
    if (tiers.length && !bs.some(b => tiers.includes(b.tier))) return false;
    if (!words.length) return true;
    const hay = (it.kind === 'track' ? it.name.toLowerCase() + ' ' : '') + bs.map(text).join(' ');
    return words.every(w => hay.includes(w));
  };
  return secs.map(sec => ({ ...sec, items: sec.items.filter(keep) })).filter(sec => sec.items.length);
}

const LABEL = Object.fromEntries(TIERS.map(t => [t.id, t.label]));
// the small coloured dot that says how hard a badge is (the colour key is the legend at the top of the section)
const Dot = ({ tier }) => (tier ? <i className={'tier-dot td-' + tier} title={LABEL[tier]} aria-label={LABEL[tier]} role="img"></i> : null);

const icon = b => b.set ? <SetIcon name={b.set} size={26} /> : b.tierIcon ? <TierIcon id={b.tierIcon.icon} size={26} alt="" /> : b.id === 'champion' ? <TierIcon id="champion" size={26} alt="" /> : b.earned ? '★' : '☆';

// While choosing pins, the star of an earned badge becomes a circle to fill (a fourth is ignored until one is taken off)
const PickMark = ({ n }) => <span className={'badge-pick' + (n ? ' on' : '')}>{n || ''}</span>;
const pickState = (b, pick) => {
  const key = b && pinKey(b), ok = !!(pick && b && b.earned), n = ok ? pick.sel.indexOf(key) + 1 : 0, on = n > 0;
  return { key, ok, on, n, blocked: ok && !on && pick.sel.length >= MAX_PINS };
};

function Badge({ b, when, pick }) {
  const { key, ok, on, n, blocked } = pickState(b, pick);
  return (
    <li className={(b.earned ? 'got' : 'locked') + (ok ? ' pickable' : '') + (blocked ? ' blocked' : '')}
      {...(ok ? { role: 'checkbox', 'aria-checked': on, tabIndex: 0, onClick: e => { if (!e.target.closest('a')) pick.toggle(key); }, onKeyDown: e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick.toggle(key); } } } : {})}>
      <span className="badge-ico" aria-hidden="true">{ok ? <PickMark n={n} /> : icon(b)}</span>
      <span className="badge-txt"><b><Dot tier={b.tier} />{b.name}</b><small>{b.hint}</small>{when(b)}</span>
    </li>
  );
}

/* A ladder of badges as one box: the step you are on, a rail of every step (earned ones filled in, the next one marked) and how far to the
   next; tapping the box slides open the detail (what each step asks for and when it was earned). */
function Track({ t, when, pick }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const cur = t.current, nx = t.next, ref = nx || cur;
  const fill = Math.min(100, (t.got + (nx && nx.value != null ? Math.min(1, Math.max(0, nx.value / nx.target)) : 0)) / t.of * 100);
  const { key, ok, on, n, blocked } = pickState(cur, pick);
  const pct = nx && nx.value != null ? Math.max(0, Math.min(100, Math.round(nx.value / nx.target * 100))) : 100;
  return (
    <li className={'badge-track ' + (cur ? 'got' : 'locked') + (open ? ' open' : '') + (ok ? ' pickable' : '') + (blocked ? ' blocked' : '')} onClick={e => { if (e.target.closest('a')) return; if (ok) pick.toggle(key); else setOpen(o => !o); }}>
      <button type="button" className="badge-head" {...(ok ? { 'aria-pressed': on } : { 'aria-expanded': open, 'aria-controls': id })}>
        <span className="badge-ico" aria-hidden="true">{ok ? <PickMark n={n} /> : icon(cur || ref)}</span>
        <span className="badge-txt">
          <b><Dot tier={ref && ref.tier} />{t.name} <span className="meta">{t.got} of {t.of}</span></b>
          <small>{cur ? cur.name : 'Not started'}{nx ? <> → {nx.name}</> : ' · all done'}</small>
        </span>
        <span className="badge-chev" aria-hidden="true">▾</span>
      </button>
      <div className="badge-rail" role="img" aria-label={`${t.got} of ${t.of} steps${nx && nx.value != null ? `, ${pct}% of the way to ${nx.name}` : ''}`} style={{ '--fill': fill + '%' }}>
        {t.steps.map((b, k) => <i key={b.id} className={b.earned ? 'got' : b === nx ? 'next' : ''} title={b.name} style={{ left: ((k + 1) / t.of * 100) + '%' }}></i>)}
      </div>
      <div className="badge-more" id={id}>
        <ol className="badge-steps">
          {t.steps.map(b => <li key={b.id} className={b.earned ? 'got' : 'locked'}><span aria-hidden="true">{b.earned ? '✓' : '○'}</span><span><b><Dot tier={b.tier} />{b.name}</b> <small>{b.hint}</small> {when(b)}</span></li>)}
        </ol>
      </div>
    </li>
  );
}
