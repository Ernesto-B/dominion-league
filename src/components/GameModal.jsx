import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import * as Eng from '../lib/engine.js';
import { SET_NAMES, LANDSCAPES } from '../lib/sets.js';
import NameIcon from './NameIcon.jsx';
import SetIcon from './SetIcon.jsx';
import KingdomPicker from './KingdomPicker.jsx';
import EloPreview from './EloPreview.jsx';
import FinishOrder from './FinishOrder.jsx';
import { buildGameArgs, resortByVP, toggle } from '../lib/gameForm.js';

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

// Add / edit a game (admin only; the server re-checks via the add_game / edit_game / delete_game RPCs).
// `draft` ({ items, sets, landscapes }) pre-fills a NEW game, e.g. with a kingdom from the Randomizer.
export default function GameModal({ editId, draft, onClose }) {
  const { D, gid, allGroups, enabledSets, playerIdByName, reload } = usePage();
  const [bs, setBs] = useState(() => editId != null ? fromGame(D, editId)
    : draft ? { ...blank(), kingdom: draft.items, kingdomTouched: true, sets: draft.sets || [], landscapes: draft.landscapes || [] } : blank());
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const boxRef = useRef(null);
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
  const save = async () => {
    if (bs.picked.length < 2) { setMsg('Pick at least 2 players.'); return; }
    if (!bs.date) { setMsg('Pick a date.'); return; }
    const args = buildGameArgs(bs, gid, playerIdByName);
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
        <FinishOrder bs={bs} setBs={setBs} resort={resortByVP} />
        <EloPreview picked={bs.picked} />
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
