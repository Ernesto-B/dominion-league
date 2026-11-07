import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import { buildGameArgs, callGameRpc } from '../lib/gameForm.js';
import * as Eng from '../lib/engine.js';
import { pendingToForm, previewPending, usualMinutes } from '../lib/pending.js';
import GameCards from './GameCards.jsx';
import { useConfirm } from './ConfirmDialog.jsx';

const GameModal = lazy(() => import('./GameModal.jsx'));   // the Add/Edit dialog loads only when something is opened in it
const EVERY = 30 * 1000;

/* The admin's list of games hosted by players, waiting to be approved (supabase/schema.sql `pending_games`). One tap accepts a game as it was sent, "Edit" opens the Add Game dialog filled in first
   (fix a finish order, set the time), "Reject" throws it away. Nothing here counts for any rating until it is accepted, and it is polled lightly, like the new-games notice. Admin only. */
export default function PendingGames({ compact = false }) {   // compact: just a one-line pointer to the list (the front page), not the list itself
  const { me, gid, D, playerIdByName, reload, hashFor } = usePage();
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(null);   // a pending row open in the dialog
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const [ask, dialog] = useConfirm();
  const admin = !!(me && me.is_admin);
  const nameById = useMemo(() => new Map([...(playerIdByName || [])].map(([n, id]) => [id, n])), [playerIdByName]);
  const load = useCallback(async () => {
    const { data, error } = await sb.from('pending_games').select('*').eq('group_id', gid).order('created_at', { ascending: true });
    if (!error) setRows(data || []);   // a database without the table yet: nothing to show
  }, [gid]);
  useEffect(() => {
    if (!admin) return undefined;
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, EVERY);
    document.addEventListener('visibilitychange', load);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', load); };
  }, [admin, load]);
  // each pending game run through the league's own maths (Elo, season points, tiers), so its card reads like any logged game; opened by default
  const previews = useMemo(() => (rows || []).map(row => ({ row, game: previewPending(Eng, D, row, nameById) })).filter(p => p.game), [rows, D, nameById]);
  const [open, setOpen] = useState(() => new Set());
  useEffect(() => { setOpen(o => { const n = new Set(o); previews.forEach(p => n.add(p.game.line)); return n; }); }, [previews.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!admin || !rows || !rows.length) return null;
  if (compact) return <a className="pending-bar" href={hashFor('games', gid)}><span className="pending-n">{rows.length}</span> game{rows.length === 1 ? '' : 's'} waiting for your approval <span aria-hidden="true">→</span></a>;
  const usual = usualMinutes(D.games);

  const accept = async row => {
    setBusy(row.id); setMsg('');
    const form = { ...pendingToForm(row, nameById), startedAt: row.started_at ? Date.parse(row.started_at) : null, endedAt: row.ended_at ? Date.parse(row.ended_at) : null };
    const { error } = await callGameRpc(sb, 'add_game', buildGameArgs(form, gid, playerIdByName));
    if (error) { setBusy(null); setMsg(error.message); return; }
    await sb.rpc('discard_pending_game', { p_id: row.id });
    setBusy(null); await load(); await reload();
  };
  const reject = async row => {
    if (!(await ask({ title: 'Reject this game?', text: 'It is removed without counting for anything.', confirmLabel: 'Reject', danger: true }))) return;
    setBusy(row.id); setMsg('');
    const { error } = await sb.rpc('discard_pending_game', { p_id: row.id });
    setBusy(null); if (error) { setMsg(error.message); return; }
    await load();
  };
  const rowOf = new Map(previews.map(p => [p.game.line, p.row]));
  const footer = g => {
    const row = rowOf.get(g.line), by = nameById.get(row.created_by), noTime = row.minutes == null;
    return (
      <>
        <p className="meta pending-time">Hosted by {by || 'a player'}. {noTime ? <>No time recorded{row.clock_minutes ? ` (the clock ran ${row.clock_minutes} min, so it was left running)` : ''}{usual ? `; the group’s usual game is about ${usual} min` : ''}. Edit to set it.</> : <>{row.minutes} min.</>} <b>Not counted until you accept it.</b></p>
        <p className="pending-go">
          <button type="button" disabled={busy === row.id} onClick={() => accept(row)}>{busy === row.id ? 'Saving…' : 'Accept'}</button>
          <button type="button" className="ghost" disabled={busy === row.id} onClick={() => setModal(row)}>Edit</button>
          <button type="button" className="ghost" disabled={busy === row.id} onClick={() => reject(row)}>Reject</button>
        </p>
      </>
    );
  };
  return (
    <section className="pending" aria-label="Games waiting for approval">
      {dialog}
      <h2>Waiting for approval <span className="pending-n">{rows.length}</span></h2>
      <div className="gview-cards"><GameCards games={previews.map(p => p.game)} open={open} toggle={id => setOpen(o => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; })} showDate actions={footer} /></div>
      {msg && <p className="meta" role="alert">{msg}</p>}
      {modal && <Suspense fallback={null}><GameModal key={modal.id} pending={modal} onClose={() => { setModal(null); load(); }} /></Suspense>}
    </section>
  );
}
