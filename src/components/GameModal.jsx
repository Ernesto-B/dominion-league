import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import * as Eng from '../lib/engine.js';
import { f0, pc, sgn } from '../lib/format.js';
import { SET_NAMES, LANDSCAPES } from '../lib/sets.js';
import NameIcon from './NameIcon.jsx';
import PlayerLink from './PlayerLink.jsx';
import SetIcon from './SetIcon.jsx';
import KingdomPicker from './KingdomPicker.jsx';
import { toPayload } from '../dominion/kingdom.js';

const blank = () => ({ date: Eng.fmtDay(Eng.todayDay()), type: '', picked: [], tie: {}, sets: [], landscapes: [], kingdom: [], kingdomTouched: false, vp: {}, notes: '', editId: null });

// Form state for editing an existing game: players in finishing order, with `tie` marking everyone
// who shares a place with the player above them.
function fromGame(D, editId) {
  const g = D.games.find(x => x.line === editId);
  if (!g) return blank();
  const byPlace = {};
  g.names.forEach(n => { (byPlace[g.places[n]] = byPlace[g.places[n]] || []).push(n); });
  const picked = [], tie = {};
  Object.keys(byPlace).map(Number).sort((a, b) => a - b).forEach(place => {
    byPlace[place].forEach((n, i) => { picked.push(n); if (i > 0) tie[n] = true; });
  });
  return { date: g.date, type: g.type === 'Regular' ? '' : g.type, picked, tie, sets: g.sets.slice(), landscapes: (g.landscapes || []).slice(), kingdom: (g.kingdom || []).map(k => ({ ...k })), kingdomTouched: false, vp: Object.assign({}, g.playerVP), notes: g.notes, editId };
}

// Re-sorts picked by VP descending (blank VP sinks to the bottom, keeping its prior relative order —
// Array#sort is stable) and recomputes ties from equal consecutive VP. A no-op until at least one VP
// is entered, since there's nothing yet to sort by.
function resortByVP(b) {
  const val = n => { const v = b.vp[n]; return v !== undefined && v !== '' && !isNaN(+v) ? +v : null; };
  if (!b.picked.some(n => val(n) != null)) return b;
  const picked = b.picked.slice().sort((a, c) => (val(c) ?? -Infinity) - (val(a) ?? -Infinity));
  const tie = {};
  for (let i = 1; i < picked.length; i++) {
    const va = val(picked[i - 1]), vb = val(picked[i]);
    if (va != null && vb != null && va === vb) tie[picked[i]] = true;
  }
  return { ...b, picked, tie };
}

const toggle = (arr, n) => arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n];

function Preview({ picked }) {
  const { D } = usePage();
  const pv = D.preview(picked);
  if (!pv.length) return null;
  return (
    <>
      <h3>Before you play</h3>
      <div className="tablewrap"><table className="plain">
        <thead><tr><th className="l">Player</th><th>Elo</th><th>Expected score</th><th>Elo if 1st</th><th>Elo if last</th></tr></thead>
        <tbody>{pv.map(x => (
          <tr key={x.name}><td className="name"><PlayerLink name={x.name} /></td><td>{f0(x.elo)}</td><td>{pc(x.expected)}</td><td className="up-t">{sgn(x.ifWin)}</td><td className="down-t">{sgn(x.ifLast)}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="note">Expected score is the share of the available points a player would average at this table; 50% means an even table. Use it to see who has the most at stake, or to balance seating.</p>
    </>
  );
}

// Add / edit a game (admin only; the server re-checks via the add_game / edit_game / delete_game RPCs).
// `draft` ({ items, sets, landscapes }) pre-fills a NEW game, e.g. with a kingdom from the Randomizer.
export default function GameModal({ editId, draft, onClose }) {
  const { D, gid, allGroups, enabledSets, playerIdByName, reload } = usePage();
  const [bs, setBs] = useState(() => editId != null ? fromGame(D, editId)
    : draft ? { ...blank(), kingdom: draft.items, kingdomTouched: true, sets: draft.sets || [], landscapes: draft.landscapes || [] } : blank());
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const boxRef = useRef(null);
  const vpAtFocus = useRef('');
  const closeRef = useRef(onClose);   // latest onClose without re-running the mount effect below on every render
  closeRef.current = onClose;
  const set = patch => setBs(b => ({ ...b, ...patch }));

  // Escape closes, the page behind doesn't scroll, and focus moves into the dialog.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    if (boxRef.current) boxRef.current.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);

  const roster = D.roster.slice().sort((a, b) => a.localeCompare(b));
  const curGroupName = (allGroups.find(g => g.id === gid) || {}).name;
  const pick = (key, n) => e => { e.preventDefault(); setBs(b => key === 'picked' ? { ...b, picked: toggle(b.picked, n), tie: b.picked.includes(n) ? Object.fromEntries(Object.entries(b.tie).filter(([k]) => k !== n)) : b.tie } : { ...b, [key]: toggle(b[key], n) }); };
  const move = (i, j) => setBs(b => { const p = b.picked.slice(); [p[j], p[i]] = [p[i], p[j]]; return { ...b, picked: p }; });
  // VP drives the finishing order: once a score is committed (blur or Enter — not every keystroke, so
  // typing a multi-digit score doesn't yank focus away) the whole table re-sorts by VP.
  const commitVP = e => { if (e.target.value !== vpAtFocus.current) { vpAtFocus.current = e.target.value; setBs(resortByVP); } };

  const save = async () => {
    if (bs.picked.length < 2) { setMsg('Pick at least 2 players.'); return; }
    if (!bs.date) { setMsg('Pick a date.'); return; }
    let pos = 1; const results = [];
    bs.picked.forEach((n, i) => {
      if (i > 0 && !bs.tie[n]) pos = i + 1;
      const id = playerIdByName.get(n);
      const vp = bs.vp[n] !== undefined && bs.vp[n] !== '' ? +bs.vp[n] : null;
      if (id) results.push({ player_id: id, place: pos, vp });
    });
    const args = {
      p_date: bs.date, p_type: bs.type || '', p_sets: bs.sets.length ? SET_NAMES.filter(n => bs.sets.includes(n)).join('; ') : null, p_strategy: null,
      p_landscapes: bs.landscapes.length ? LANDSCAPES.filter(n => bs.landscapes.includes(n)).join('; ') : null,
      p_winner_vp: null, p_minutes: null, p_notes: bs.notes || null,
      p_group_id: gid, p_results: results,
      // sent only when there is something to say: an edit that never touched the kingdom leaves it alone on the server
      ...(bs.kingdomTouched || (!bs.editId && bs.kingdom.length) ? { p_kingdom: toPayload(bs.kingdom) } : {}),
    };
    setSaving(true); setMsg('Saving…');
    const { error } = bs.editId ? await sb.rpc('edit_game', { p_game_id: bs.editId, ...args }) : await sb.rpc('add_game', args);
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    onClose();
    await reload();
  };
  const del = async () => {
    if (!confirm('Delete this game? This cannot be undone.')) return;
    const { error } = await sb.rpc('delete_game', { p_game_id: bs.editId });
    if (error) { setMsg(error.message); return; }
    onClose();
    await reload();
  };

  return createPortal(
    <div className="modal-overlay" id="modalOverlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" tabIndex={-1} ref={boxRef}>
        <button className="modal-close" id="modalClose" type="button" aria-label="Close" onClick={onClose}>×</button>
        <h2 style={{ marginTop: 0 }}>{bs.editId ? 'Edit game' : 'Add a game'}</h2>
        <p className="lede">{bs.editId ? 'Change the details and save.' : 'Pick who played, in finishing order, and save.'}{curGroupName ? ` For ${curGroupName} — only that group's players are listed below.` : ''}</p>
        <div className="controls">
          <label className="f">Date <input type="date" id="bd" value={bs.date} onChange={e => set({ date: e.target.value })} /></label>
          <label className="f">Type <select id="bty" value={bs.type} onChange={e => set({ type: e.target.value })}>
            {['', 'Playoff', 'Friendly'].map(t => <option key={t} value={t}>{t || 'Regular'}</option>)}
          </select></label>
        </div>
        <p className="meta">1. Click everyone who played.</p>
        <div className="pills" id="bpick">
          {roster.map(n => <a key={n} href="#" data-n={n} aria-current={bs.picked.includes(n) ? 'true' : undefined} onClick={pick('picked', n)}><NameIcon name={n} size={18} />{n}</a>)}
        </div>
        <p className="meta">2. Fill in each player's VP and the order sorts itself (ties too, for equal scores). No VP tracked? Use the arrows and the "tied" box instead.</p>
        <ol className="order" id="border">
          {bs.picked.map((n, i) => (
            <li key={n}>
              <span className="nm">{`${i + 1}. ${n}`}</span>
              <button className="ghost" data-up={i} type="button" aria-label={`Move ${n} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
              <button className="ghost" data-dn={i} type="button" aria-label={`Move ${n} down`} disabled={i === bs.picked.length - 1} onClick={() => move(i, i + 1)}>↓</button>
              <label className="f vp">VP <input type="text" data-vp={n} size={3} value={bs.vp[n] ?? ''}
                onFocus={e => { vpAtFocus.current = e.target.value; }} onChange={e => { const v = e.target.value; setBs(b => ({ ...b, vp: { ...b.vp, [n]: v } })); }}
                onBlur={commitVP} onKeyDown={e => { if (e.key === 'Enter') commitVP(e); }} /></label>
              {i > 0 && <label className="f tie"><input type="checkbox" data-tie={n} checked={!!bs.tie[n]} onChange={e => { const on = e.target.checked; setBs(b => ({ ...b, tie: { ...b.tie, [n]: on } })); }} /> tied with above</label>}
            </li>
          ))}
          {!bs.picked.length && <li className="meta">No players chosen yet.</li>}
        </ol>
        <Preview picked={bs.picked} />
        <p className="meta">3. Which expansions were in play?</p>
        <div className="pills" id="bsets">
          {SET_NAMES.filter(n => enabledSets.has(n) || bs.sets.includes(n)).map(n => <a key={n} href="#" data-n={n} aria-current={bs.sets.includes(n) ? 'true' : undefined} onClick={pick('sets', n)}><SetIcon name={n} size={18} />{n}</a>)}
        </div>
        <p className="meta" style={{ marginTop: 14 }}>4. Any landscape cards in play?</p>
        <div className="pills" id="bland">
          {LANDSCAPES.map(n => <a key={n} href="#" data-n={n} aria-current={bs.landscapes.includes(n) ? 'true' : undefined} onClick={pick('landscapes', n)}>{n}</a>)}
        </div>
        <p className="meta" style={{ marginTop: 14 }}>5. The Kingdom — optional. Which cards and landscapes did you play with?</p>
        <KingdomPicker items={bs.kingdom} onChange={(kingdom, implied) => setBs(b => ({
          ...b, kingdom, kingdomTouched: true,
          sets: [...new Set([...b.sets, ...implied.sets])], landscapes: [...new Set([...b.landscapes, ...implied.landscapes])],
        }))} />
        <p className="meta" style={{ marginTop: 14 }}>6. Optional details.</p>
        <label className="f">Notes <input type="text" id="bn" size={50} value={bs.notes} onChange={e => set({ notes: e.target.value })} /></label>
        <div className="controls" style={{ marginTop: 14 }}>
          <button id="bsave" type="button" disabled={saving} onClick={save}>{bs.editId ? 'Save changes' : 'Save game'}</button>
          {bs.editId && <><button id="bdel" className="ghost" type="button" onClick={del}>Delete game</button><button id="bcancel" className="ghost" type="button" onClick={onClose}>Cancel</button></>}
          <span className="meta" id="bmsg" role="status">{msg}</span>
        </div>
        <p className="note" style={{ marginTop: 20 }}>Manage seasons and friend groups from the <a href="#/admin">Admin page</a>. To add a brand-new player, create their Supabase account first (see README), then they'll show up in the picker above.</p>
      </div>
    </div>,
    document.getElementById('modalRoot'),
  );
}
