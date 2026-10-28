import { useEffect, useState } from 'react';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import * as Eng from '../lib/engine.js';
import { slugify } from '../lib/format.js';
import { SET_NAMES } from '../lib/sets.js';
import SetIcon from '../components/SetIcon.jsx';

/* The Admin page manages the whole site, not just the group being viewed, so it reads allGroups /
   rawPlayers / rawSeasons (unfiltered) rather than the group-scoped D. Every write here is gated by
   RLS / RPCs on the server (is_admin() is re-checked there); this page only hides the UI from non-admins.
   Single-table writes (groups, seasons, settings, players.group_ids) are direct client calls; the
   multi-table ones go through RPCs (delete_group) or the create-player Edge Function. */

const toggle = (arr, x) => arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x];

/* One status message for the whole page: the most recent action's, shown beside the section it came
   from. (The old page wiped every message whenever it re-rendered, so only the latest was ever
   visible; per-section state would leave a stale "Rejected by function" next to unrelated work.)
   `status` = { id, text }; `say(id, text)` sets it; `Msg` renders it only in its own section. */
const Msg = ({ id, status }) => <span className="meta" id={id} role="status">{status.id === id ? status.text : ''}</span>;

// ---- Players: create a login (Edge Function), and edit which groups each player is in ----
function NewPlayer({ status, say }) {
  const { allGroups, reload } = usePage();
  const firstGroup = () => allGroups.length ? [allGroups[0].id] : [];
  const [name, setName] = useState('');
  const [groupIds, setGroupIds] = useState(firstGroup);
  const setMsg = t => say('pfMsg', t);
  const [busy, setBusy] = useState(false);
  // the first group created is ticked by default, as soon as it exists
  useEffect(() => { if (!groupIds.length && allGroups.length) setGroupIds(firstGroup()); }, [allGroups]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!allGroups.length) return <p className="empty">Create a group below first.</p>;
  const save = async () => {
    const n = name.trim();
    if (!n) { setMsg('Type a name first.'); return; }
    if (!groupIds.length) { setMsg('Pick at least one group first.'); return; }
    setBusy(true); setMsg('Creating…');
    const { data, error } = await sb.functions.invoke('create-player', { body: { name: n, group_ids: groupIds } });
    setBusy(false);
    if (error) {
      // supabase-js surfaces a non-2xx function response as an error whose .context is the raw Response —
      // the function's own {error: "..."} JSON body (the actually useful message) lives there, not on error.message.
      let m = error.message || 'Could not create the player.';
      if (error.context && typeof error.context.json === 'function') {
        try { const body = await error.context.json(); if (body && body.error) m = body.error; } catch (e) { /* fall back to m */ }
      }
      setMsg(m); return;
    }
    if (data && data.error) { setMsg(data.error); return; }
    setName(''); setGroupIds(firstGroup());
    setMsg(`Created ${data.name}. Tell them to sign in with their name and "dominion".`);
    await reload();
  };
  return (
    <div className="builder">
      <div className="controls"><label className="f">New player's name <input type="text" id="pfName" value={name} onChange={e => { setName(e.target.value); if (status.id === 'pfMsg') setMsg(''); }} /></label></div>
      <p className="meta">Group(s) — tick every friend circle they play with</p>
      <div className="controls" id="pfGroups">
        {allGroups.map(g => <label className="f" key={g.id}><input type="checkbox" data-pg={g.id} checked={groupIds.includes(g.id)} onChange={() => setGroupIds(ids => toggle(ids, g.id))} /> {g.name}</label>)}
      </div>
      <div className="controls" style={{ marginTop: 10 }}><button id="pfSave" type="button" disabled={busy} onClick={save}>Add player</button><Msg id="pfMsg" status={status} /></div>
      <p className="note">Creates their account with the preset password <code>dominion</code> — tell them their name and that password, and they'll set a real one on first sign-in.</p>
    </div>
  );
}

function PlayerGroups({ status, say }) {
  const { allGroups, rawPlayers, reload } = usePage();
  const [pending, setPending] = useState({});   // pid -> Set of group ids, shown until the reload lands
  const setMsg = t => say('pgMsg', t);
  if (!allGroups.length || !rawPlayers.length) return null;
  const has = (p, gid) => (pending[p.id] ? pending[p.id].has(gid) : (p.group_ids || []).includes(gid));
  const change = async (p, gid) => {
    const next = new Set(allGroups.filter(g => has(p, g.id) !== (g.id === gid)).map(g => g.id));   // flip this one
    const ids = allGroups.filter(g => next.has(g.id)).map(g => g.id);
    setPending(s => ({ ...s, [p.id]: next }));
    setMsg('Saving…');
    const { error } = await sb.from('players').update({ group_ids: ids }).eq('id', p.id);
    setMsg(error ? error.message : 'Saved.');
    if (!error) await reload();
    setPending(s => { const n = { ...s }; delete n[p.id]; return n; });
  };
  return (
    <div className="builder" style={{ marginTop: 12 }}>
      <p className="meta" style={{ marginTop: 0 }}>Existing players' groups — a player in more than one has a completely separate Elo and stats per group; they don't mix. Each game belongs to exactly one group, picked when it's logged.</p>
      <div className="tablewrap"><table className="plain">
        <thead><tr><th className="l">Player</th>{allGroups.map(g => <th key={g.id}>{g.name}</th>)}</tr></thead>
        <tbody id="pgTable">{rawPlayers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => (
          <tr key={p.id}><td className="l">{p.name}</td>{allGroups.map(g => <td key={g.id}><input type="checkbox" data-pid={p.id} data-pg={g.id} checked={has(p, g.id)} onChange={() => change(p, g.id)} /></td>)}</tr>
        ))}</tbody>
      </table></div>
      <Msg id="pgMsg" status={status} />
    </div>
  );
}

// ---- Sets: which expansions the group owns (hidden from the Add Game picker when unticked) ----
function Sets({ status, say }) {
  const { enabledSets, reload } = usePage();
  const [local, setLocal] = useState(enabledSets);
  const setMsg = t => say('setsMsg', t);
  useEffect(() => setLocal(enabledSets), [enabledSets]);
  const change = async name => {
    const prev = local, next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    setLocal(next); setMsg('Saving…');
    const { error } = await sb.from('settings').update({ enabled_sets: [...next] }).eq('id', true);
    if (error) { setLocal(prev); setMsg(error.message); return; }   // keep the checkbox in step with what's actually saved
    setMsg('Saved.');
    await reload();                                                  // so the Games filter and Add Game picker see it
  };
  return (
    <div className="builder">
      <p className="note" style={{ marginTop: 0 }}>Untick a set you don't currently own — it disappears from the Add A Game picker. Games already logged with it are unaffected.</p>
      <div className="controls" id="setsToggle">
        {SET_NAMES.map(n => <label className="f" key={n}><input type="checkbox" data-set={n} checked={local.has(n)} onChange={() => change(n)} /> <SetIcon name={n} size={18} />{n}</label>)}
      </div>
      <Msg id="setsMsg" status={status} />
    </div>
  );
}

// ---- Groups ----
function Groups({ status, say }) {
  const { allGroups, rawSeasons, computedByGroup, reload } = usePage();
  const [name, setName] = useState('');
  const setMsg = t => say('gfMsg', t), setDelMsg = t => say('dgMsg', t);
  const [busy, setBusy] = useState(false);

  const remove = async (e, id) => {
    e.preventDefault();
    const g = allGroups.find(x => x.id === id);
    const cd = computedByGroup[id];
    const gameCount = cd ? cd.games.filter(x => x.n >= 2).length : 0;
    const seasonCount = rawSeasons.filter(s => s.group === id).length;
    const sure = confirm(`Delete "${g ? g.name : id}"? This permanently deletes its ${gameCount} game${gameCount === 1 ? '' : 's'} and ${seasonCount} season${seasonCount === 1 ? '' : 's'}, and removes it from every player's group list. This cannot be undone.`);
    if (!sure) return;
    setDelMsg('Deleting…');
    const { error } = await sb.rpc('delete_group', { p_group_id: id });
    if (error) { setDelMsg(error.message); return; }
    setDelMsg('');
    await reload();
  };
  const add = async () => {
    const n = name.trim(), id = slugify(n);
    if (!n || !id) { setMsg('Type a name first.'); return; }
    if (allGroups.some(g => g.id === id)) { setMsg('A group with that id already exists.'); return; }
    setBusy(true); setMsg('Saving…');
    const { error } = await sb.from('groups').insert({ id, name: n });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setName(''); setMsg('');
    await reload();
  };
  return (
    <>
      {allGroups.length ? <>
        <div className="tablewrap"><table className="plain">
          <thead><tr><th className="l">Name</th><th className="l">Id</th><th></th></tr></thead>
          <tbody>{allGroups.map(g => <tr key={g.id}><td className="l">{g.name}</td><td className="l"><code>{g.id}</code></td><td><a href="#" data-delgroup={g.id} onClick={e => remove(e, g.id)}>Delete</a></td></tr>)}</tbody>
        </table></div>
        <Msg id="dgMsg" status={status} />
      </> : <p className="empty">No groups yet.</p>}
      <div className="builder" style={{ marginTop: 12 }}>
        <div className="controls">
          <label className="f">New group name <input type="text" id="gfName" value={name} onChange={e => { setName(e.target.value); if (status.id === 'gfMsg') setMsg(''); }} /></label>
          <button id="gfSave" type="button" disabled={busy} onClick={add}>Add group</button><Msg id="gfMsg" status={status} />
        </div>
        <p className="note">Id will be <code>{slugify(name) || '…'}</code> — it'll show up as a checkbox option under People once saved.</p>
      </div>
    </>
  );
}

// ---- Seasons: list, plus an add/edit form driven by the URL (#/admin/season/edit/<id>) ----
const blankSeason = allGroups => ({ editId: null, group_id: allGroups.length ? allGroups[0].id : '', name: '', start_date: '', weeks: '', target_games: '', qualify_pct: '', playoff_spots: '', champion_player_id: '', notes: '' });

function loadSeason(ctx, editId) {
  const { rawSeasons, seasonDbIds, playerIdByName, allGroups } = ctx;
  const i = seasonDbIds.indexOf(editId), s = i >= 0 ? rawSeasons[i] : null;
  if (!s) return blankSeason(allGroups);
  return {
    editId, group_id: s.group || '', name: s.name, start_date: s.start || '',
    weeks: s.weeks || '', target_games: s.targetGames || '', qualify_pct: s.qualifyPct ?? '', playoff_spots: s.playoffSpots || '',
    champion_player_id: s.champion ? (playerIdByName.get(s.champion) || '') : '', notes: s.notes || '',
  };
}

function SeasonForm({ editId, status, say }) {
  const page = usePage();
  const { allGroups, rawPlayers, playerIdByName, reload } = page;
  const [f, setF] = useState(() => editId == null ? blankSeason(allGroups) : loadSeason(page, editId));
  const setMsg = t => say('sfMsg', t);
  const [busy, setBusy] = useState(false);
  const set = patch => { setF(x => ({ ...x, ...patch })); if (status.id === 'sfMsg') setMsg(''); };

  const championRoster = f.group_id ? rawPlayers.filter(p => (p.group_ids || []).includes(f.group_id)).map(p => p.name) : [];
  const save = async () => {
    if (!f.group_id || !f.name.trim() || !f.start_date || !(+f.weeks > 0)) { setMsg('Fill in group, name, start date, and at least 1 week.'); return; }
    const payload = {
      group_id: f.group_id, name: f.name.trim(), start_date: f.start_date,
      weeks: +f.weeks, target_games: f.target_games ? +f.target_games : 8,
      qualify_pct: f.qualify_pct ? +f.qualify_pct : 0.6,
      playoff_spots: f.playoff_spots ? +f.playoff_spots : 4,
      champion_player_id: f.champion_player_id || null, notes: f.notes || null,
    };
    setBusy(true); setMsg('Saving…');
    const { error } = f.editId ? await sb.from('seasons').update(payload).eq('id', f.editId) : await sb.from('seasons').insert(payload);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setF(blankSeason(allGroups)); setMsg('');
    location.hash = '#/admin';
    await reload();
  };
  return (
    <div className="builder" style={{ marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>{f.editId ? 'Edit season' : 'Add a season'}</h3>
      <div className="controls">
        <label className="f">Group <select id="sfGroup" value={f.group_id} onChange={e => set({ group_id: e.target.value, champion_player_id: '' })}>
          {allGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select></label>
        <label className="f">Name <input type="text" id="sfName" value={f.name} onChange={e => set({ name: e.target.value })} /></label>
      </div>
      <div className="controls">
        <label className="f">Start date <input type="date" id="sfStart" value={f.start_date} onChange={e => set({ start_date: e.target.value })} /></label>
        <label className="f">Weeks <input type="text" id="sfWeeks" size={4} value={f.weeks} onChange={e => set({ weeks: e.target.value })} /></label>
        <label className="f">Target games <input type="text" id="sfTarget" size={4} value={f.target_games} onChange={e => set({ target_games: e.target.value })} /></label>
        <label className="f">Qualify % (0–1) <input type="text" id="sfPct" size={4} value={f.qualify_pct} onChange={e => set({ qualify_pct: e.target.value })} /></label>
        <label className="f">Playoff spots <input type="text" id="sfSpots" size={4} value={f.playoff_spots} onChange={e => set({ playoff_spots: e.target.value })} /></label>
      </div>
      <div className="controls"><label className="f">Champion <select id="sfChamp" value={f.champion_player_id} onChange={e => set({ champion_player_id: e.target.value })}>
        <option value="">Not decided</option>
        {championRoster.map(n => <option key={n} value={playerIdByName.get(n) || ''}>{n}</option>)}
      </select></label></div>
      <label className="f">Notes <input type="text" id="sfNotes" size={50} value={f.notes} onChange={e => set({ notes: e.target.value })} /></label>
      <div className="controls" style={{ marginTop: 10 }}>
        <button id="sfSave" type="button" disabled={busy} onClick={save}>{f.editId ? 'Save changes' : 'Add season'}</button>
        {f.editId && <a className="btn ghost" href="#/admin">Cancel</a>}
        <Msg id="sfMsg" status={status} />
      </div>
    </div>
  );
}

function Seasons({ editId, status, say }) {
  const { allGroups, rawSeasons, seasonDbIds } = usePage();
  return (
    <>
      {rawSeasons.length ? (
        <div className="tablewrap"><table className="plain">
          <thead><tr><th className="l">Name</th><th className="l">Group</th><th className="l">Dates</th><th className="l">Champion</th><th></th></tr></thead>
          <tbody>{rawSeasons.map((s, i) => {
            const gname = (allGroups.find(g => g.id === s.group) || {}).name || s.group || '—';
            const sEnd = s.start ? Eng.fmtDay(Eng.parseISO(s.start) + 7 * (+s.weeks || 0) - 1) : '';
            return (
              <tr key={seasonDbIds[i]}>
                <td className="l">{s.name}</td><td className="l">{gname}</td><td className="l">{s.start ? s.start + ' to ' + sEnd : '—'}</td><td className="l">{s.champion || '—'}</td>
                <td><a href={`#/admin/season/edit/${seasonDbIds[i]}`}>Edit</a></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ) : <p className="empty">No seasons yet.</p>}
      {/* the form is re-keyed so choosing Edit / Cancel loads or clears it */}
      {allGroups.length
        ? <SeasonForm key={editId ?? 'new'} editId={editId} status={status} say={say} />
        : <p className="empty">Create a group above before adding a season.</p>}
    </>
  );
}

export default function Admin() {
  const { me, arg } = usePage();
  const [status, setStatus] = useState({ id: '', text: '' });
  const say = (id, text) => setStatus({ id, text });
  const p = { status, say };
  const m = /^season\/edit\/(\d+)$/.exec(arg || '');
  const editId = m ? +m[1] : null;
  // a season form's message belongs to that form: don't carry it into a different add/edit target
  useEffect(() => { setStatus(s => s.id === 'sfMsg' ? { id: '', text: '' } : s); }, [editId]);
  if (!me || !me.is_admin) return <><h1>Admin</h1><p className="empty">Only the admin can manage groups and seasons.</p></>;
  // editing a season (from its link) always lands on Settings
  const [tab, setTab] = useState('people');
  const shown = editId != null ? 'settings' : tab;
  return (
    <>
      <h1>Admin</h1>
      <p className="lede">Add people, and set up groups, sets and seasons.</p>
      <div className="gview-switch admin-tabs" role="tablist" aria-label="Admin sections">
        {[['people', 'People'], ['settings', 'Settings']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={shown === id} aria-pressed={shown === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {shown === 'people' ? <>
        <h2>New player</h2>
        <NewPlayer {...p} />
        <h2>Who plays in which group</h2>
        <PlayerGroups {...p} />
      </> : <>
        <h2>Sets</h2>
        <Sets {...p} />
        <h2>Groups</h2>
        <Groups {...p} />
        <h2>Seasons</h2>
        <Seasons editId={editId} {...p} />
      </>}
    </>
  );
}
