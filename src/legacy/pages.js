/* LEGACY page renderers (template-literal strings written into <main>), kept
   running while pages are ported to React one at a time. React owns the data,
   auth, routing and shell now; it calls renderLegacyPage() with everything a
   page needs. Indentation is left as it was inside the old IIFE on purpose —
   this file is being deleted piece by piece, not maintained. */
import * as Eng from '../lib/engine.js';
import { sb } from '../lib/supabase.js';
import { esc, f0, f1, f2, f3, pc, sgn, short, long, ord, slugify } from '../lib/format.js';
import { SET_NAMES, LANDSCAPES, setIconPath } from '../lib/sets.js';
import { pickD } from '../lib/league.js';
import { hashFor as hashForRoute } from '../lib/route.js';

  const $ = s => document.querySelector(s);
  let main = null;     // the <main> element React hands us (see renderLegacyPage)
  let ctx = null;      // latest context from React
  let D = null;        // computed model for the group currently being viewed (computedByGroup[curGid])
  let cfg = null;       // data/config.json
  let me = null;         // signed-in player's own players row
  let playerIdByName = new Map();  // name -> uuid, for admin writes
  let seasonDbIds = [];      // rawSeasons[i] -> seasons.id row, for admin edit links
  let curGid = null;       // group currently being viewed — null only in true no-groups-configured mode
  let enabledSets = new Set();  // sets the admin has marked as owned; populated in boot()
  // Each group gets its own independent Eng.compute() call (see boot()) so a
  // player in two groups gets two completely separate results — not one
  // shared Elo/stat track filtered two ways. render() picks the right one
  // into D before calling a page function, so page functions below read D
  // exactly as if there were only ever one group.
  let computedByGroup = {};
  let allGroups = [];       // groups this viewer can see: [{id, name}]
  let rawPlayers = [];       // every player row this viewer can see (admin sees all) — for Admin page only
  let rawSeasons = [];       // every season row this viewer can see, raw (unparsed) — for Admin page only


  /* ---------- hash helpers (group-aware once more than one group exists) ---------- */
  const hashFor = (route, gid, rest) => hashForRoute(route, gid, rest, allGroups);

  /* ---------- shared bits ---------- */
  // A tier icon is icons/<id>.png (drop in your own artwork). 'champion' is the bundled trophy SVG.
  // A value containing a slash is used exactly as written.
  const icon = (id, size, alt) => {
    const explicit = /\//.test(id);
    const src = explicit ? id : 'icons/' + id + '.png';
    const fb = explicit ? '' : ` onerror="this.onerror=null;this.src='icons/${esc(id)}.svg'"`;
    return `<img class="tier" src="${esc(src)}" width="${size}" height="${size}" alt="${esc(alt == null ? id : alt)}"${fb}>`;
  };
  const setIcon = (name, size) => {
    const src = setIconPath(name);
    return src ? `<img class="tier seticon" src="${src}" width="${size}" height="${size}" alt="${esc(name)}" title="${esc(name)}">` : '';
  };
  const tierOf = n => { const p = D && D.byName && D.byName[n]; return p && p.tier; };
  const nameIcon = (n, size) => { const t = tierOf(n); return t ? icon(t.icon, size || 18, t.name + ' tier') : ''; };
  const link = n => {
    // Every page is rendered within one group's context (D is already
    // scoped to curGid), so a link to a player always stays in that same
    // group — there's no cross-group "their real page" to resolve anymore.
    return `<a class="pl" href="${hashFor('players', curGid, encodeURIComponent(n))}">${nameIcon(n, 20)}<span>${esc(n)}</span></a>`;
  };


  /* ---------- add / edit a game (admin only) ---------- */
  const blankBS = () => ({ date: Eng.fmtDay(Eng.todayDay()), type: '', picked: [], tie: {}, sets: [], landscapes: [], vp: {}, notes: '', editId: null });
  let bs = blankBS();
  function previewBlock() {
    const pv = D.preview(bs.picked);
    if (!pv.length) return '';
    return `<h3>Before you play</h3><div class="tablewrap"><table class="plain"><thead><tr><th class="l">Player</th><th>Elo</th><th>Expected score</th><th>Elo if 1st</th><th>Elo if last</th></tr></thead><tbody>${pv.map(x => `<tr><td class="name">${link(x.name)}</td><td>${f0(x.elo)}</td><td>${pc(x.expected)}</td><td class="up-t">${sgn(x.ifWin)}</td><td class="down-t">${sgn(x.ifLast)}</td></tr>`).join('')}</tbody></table></div><p class="note">Expected score is the share of the available points a player would average at this table; 50% means an even table. Use it to see who has the most at stake, or to balance seating.</p>`;
  }
  function loadGameIntoBuilder(editId) {
    const g = D.games.find(x => x.line === editId);
    if (!g) { bs = blankBS(); return; }
    const byPlace = {};
    g.names.forEach(n => { (byPlace[g.places[n]] = byPlace[g.places[n]] || []).push(n); });
    const picked = [], tie = {};
    Object.keys(byPlace).map(Number).sort((a, b) => a - b).forEach(place => {
      byPlace[place].forEach((n, i) => { picked.push(n); if (i > 0) tie[n] = true; });
    });
    bs = {
      date: g.date, type: g.type === 'Regular' ? '' : g.type, picked, tie,
      sets: g.sets.slice(), landscapes: (g.landscapes || []).slice(), vp: Object.assign({}, g.playerVP), notes: g.notes, editId,
    };
  }
  function addFormHTML() {
    const roster = D.roster.slice().sort((a, b) => a.localeCompare(b));
    const curGroupName = (allGroups.find(g => g.id === curGid) || {}).name;
    return `<h2 style="margin-top:0">${bs.editId ? 'Edit game' : 'Add a game'}</h2><p class="lede">${bs.editId ? 'Change the details and save.' : 'Pick who played, in finishing order, and save.'}${curGroupName ? ` For ${esc(curGroupName)} — only that group's players are listed below.` : ''}</p>
      <div class="controls"><label class="f">Date <input type="date" id="bd" value="${esc(bs.date)}"></label>
      <label class="f">Type <select id="bty">${['', 'Playoff', 'Friendly'].map(t => `<option value="${t}"${bs.type === t ? ' selected' : ''}>${t || 'Regular'}</option>`).join('')}</select></label></div>
      <p class="meta">1. Click everyone who played.</p><div class="pills" id="bpick">${roster.map(n => `<a href="#" data-n="${esc(n)}" ${bs.picked.includes(n) ? 'aria-current="true"' : ''}>${nameIcon(n, 18)}${esc(n)}</a>`).join('')}</div>
      <p class="meta">2. Fill in each player's VP and the order sorts itself (ties too, for equal scores). No VP tracked? Use the arrows and the "tied" box instead.</p>
      <ol class="order" id="border">${bs.picked.map((n, i) => `<li><span class="nm">${i + 1}. ${esc(n)}</span><button class="ghost" data-up="${i}" type="button" aria-label="Move ${esc(n)} up"${i === 0 ? ' disabled' : ''}>↑</button><button class="ghost" data-dn="${i}" type="button" aria-label="Move ${esc(n)} down"${i === bs.picked.length - 1 ? ' disabled' : ''}>↓</button><label class="f vp">VP <input type="text" data-vp="${esc(n)}" size="3" value="${esc(bs.vp[n] ?? '')}"></label>${i ? `<label class="f tie"><input type="checkbox" data-tie="${esc(n)}"${bs.tie[n] ? ' checked' : ''}> tied with above</label>` : ''}</li>`).join('') || '<li class="meta">No players chosen yet.</li>'}</ol>
      ${previewBlock()}
      <p class="meta">3. Which expansions were in play?</p><div class="pills" id="bsets">${SET_NAMES.filter(n => enabledSets.has(n) || bs.sets.includes(n)).map(n => `<a href="#" data-n="${esc(n)}" ${bs.sets.includes(n) ? 'aria-current="true"' : ''}>${setIcon(n, 18)}${esc(n)}</a>`).join('')}</div>
      <p class="meta" style="margin-top:14px">4. Any landscape cards in play?</p><div class="pills" id="bland">${LANDSCAPES.map(n => `<a href="#" data-n="${esc(n)}" ${bs.landscapes.includes(n) ? 'aria-current="true"' : ''}>${esc(n)}</a>`).join('')}</div>
      <p class="meta" style="margin-top:14px">5. Optional details.</p>      <label class="f">Notes <input type="text" id="bn" size="50" value="${esc(bs.notes)}"></label>
      <div class="controls" style="margin-top:14px">
      <button id="bsave" type="button">${bs.editId ? 'Save changes' : 'Save game'}</button>
      ${bs.editId ? '<button id="bdel" class="ghost" type="button">Delete game</button><button id="bcancel" class="ghost" type="button">Cancel</button>' : ''}
      <span class="meta" id="bmsg" role="status"></span></div>
    <p class="note" style="margin-top:20px">Manage seasons and friend groups from the <a href="#/admin">Admin page</a>. To add a brand-new player, create their Supabase account first (see README), then they'll show up in the picker above.</p>`;
  }
  function modalEscHandler(e) { if (e.key === 'Escape') closeAddModal(); }
  function closeAddModal() {
    const root = $('#modalRoot');
    if (root) root.innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', modalEscHandler);
  }
  function renderAddModal() {
    const root = $('#modalRoot');
    if (!root) return;
    // The overlay is the scroll container and gets rebuilt on every state
    // change, so carry its scroll position across the re-render instead of
    // snapping back to the top.
    const oldOverlay = $('#modalOverlay');
    const scrollTop = oldOverlay ? oldOverlay.scrollTop : 0;
    root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" tabindex="-1">
      <button class="modal-close" id="modalClose" type="button" aria-label="Close">×</button>
      ${addFormHTML()}</div></div>`;
    document.body.style.overflow = 'hidden';
    wireAdd();
    $('#modalClose').addEventListener('click', closeAddModal);
    $('#modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeAddModal(); });
    document.addEventListener('keydown', modalEscHandler);
    $('#modalOverlay').scrollTop = scrollTop;
    const box = $('.modal-box'); if (box) box.focus({ preventScroll: true });
  }
  function openAddModal(editId) {
    if (!me || !me.is_admin) return;
    if (editId == null) bs = blankBS(); else loadGameIntoBuilder(editId);
    renderAddModal();
  }
  // Re-sorts bs.picked by VP descending (blank VP sinks to the bottom,
  // keeping its prior relative order — Array#sort is spec-guaranteed
  // stable) and recomputes bs.tie from equal consecutive VP values. A
  // no-op until at least one VP is entered, since there's nothing yet to
  // sort by.
  function resortByVP() {
    const val = n => { const v = bs.vp[n]; return v !== undefined && v !== '' && !isNaN(+v) ? +v : null; };
    if (!bs.picked.some(n => val(n) != null)) return;
    bs.picked.sort((a, b) => (val(b) ?? -Infinity) - (val(a) ?? -Infinity));
    const newTie = {};
    for (let i = 1; i < bs.picked.length; i++) {
      const va = val(bs.picked[i - 1]), vb = val(bs.picked[i]);
      if (va != null && vb != null && va === vb) newTie[bs.picked[i]] = true;
    }
    bs.tie = newTie;
  }
  function wireAdd() {
    const rer = () => renderAddModal();
    const bind = (id, k) => { const el = $(id); el && el.addEventListener('input', () => { bs[k] = el.value; }); };
    bind('#bd', 'date'); bind('#bty', 'type'); bind('#bn', 'notes');
    const pick = $('#bpick');
    pick && pick.addEventListener('click', e => {
      const a = e.target.closest('a[data-n]'); if (!a) return; e.preventDefault();
      const n = a.dataset.n, i = bs.picked.indexOf(n);
      if (i >= 0) { bs.picked.splice(i, 1); delete bs.tie[n]; } else bs.picked.push(n);
      rer();
    });
    const setsPick = $('#bsets');
    setsPick && setsPick.addEventListener('click', e => {
      const a = e.target.closest('a[data-n]'); if (!a) return; e.preventDefault();
      const n = a.dataset.n, i = bs.sets.indexOf(n);
      if (i >= 0) bs.sets.splice(i, 1); else bs.sets.push(n);
      rer();
    });
    const landPick = $('#bland');
    landPick && landPick.addEventListener('click', e => {
      const a = e.target.closest('a[data-n]'); if (!a) return; e.preventDefault();
      const n = a.dataset.n, i = bs.landscapes.indexOf(n);
      if (i >= 0) bs.landscapes.splice(i, 1); else bs.landscapes.push(n);
      rer();
    });
    const order = $('#border');
    order && order.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const up = b.dataset.up, dn = b.dataset.dn, p = bs.picked;
      if (up != null) { const i = +up; [p[i - 1], p[i]] = [p[i], p[i - 1]]; }
      if (dn != null) { const i = +dn; [p[i + 1], p[i]] = [p[i], p[i + 1]]; }
      rer();
    });
    order && order.addEventListener('change', e => {
      const t = e.target.dataset.tie;
      if (t) { bs.tie[t] = e.target.checked; return; }
      // VP drives the finishing order: once a player's score is entered,
      // re-sort the whole table by VP (ties = equal VP) instead of making
      // the admin manually drag/click everyone into place. Fires on blur,
      // not every keystroke, so typing a multi-digit score doesn't yank
      // focus out from under the cursor. Arrows/tie checkbox stay as a
      // manual override for whenever VP isn't tracked.
      if (e.target.dataset.vp) { resortByVP(); rer(); }
    });
    order && order.addEventListener('input', e => { const v = e.target.dataset.vp; if (v) bs.vp[v] = e.target.value; });
    const msg = t => { const el = $('#bmsg'); if (el) el.textContent = t; };
    const save = $('#bsave');
    save && save.addEventListener('click', async () => {
      if (bs.picked.length < 2) { msg('Pick at least 2 players.'); return; }
      if (!bs.date) { msg('Pick a date.'); return; }
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
        p_group_id: curGid, p_results: results,
      };
      save.disabled = true; msg('Saving…');
      const { error } = bs.editId
        ? await sb.rpc('edit_game', { p_game_id: bs.editId, ...args })
        : await sb.rpc('add_game', args);
      save.disabled = false;
      if (error) { msg(error.message); return; }
      bs = blankBS();
      closeAddModal();
      await boot();
    });
    const del = $('#bdel');
    del && del.addEventListener('click', async () => {
      if (!confirm('Delete this game? This cannot be undone.')) return;
      const { error } = await sb.rpc('delete_game', { p_game_id: bs.editId });
      if (error) { msg(error.message); return; }
      bs = blankBS();
      closeAddModal();
      await boot();
    });
    const cancel = $('#bcancel');
    cancel && cancel.addEventListener('click', () => { bs = blankBS(); closeAddModal(); });
  }

  /* ---------- admin: groups and seasons ---------- */
  const blankGroupForm = () => ({ name: '' });
  let gform = blankGroupForm();
  const blankSeasonForm = () => ({ editId: null, group_id: '', name: '', start_date: '', weeks: '', target_games: '', qualify_pct: '', playoff_spots: '', champion_player_id: '', notes: '' });
  let sform = blankSeasonForm();
  function loadSeasonIntoForm(editId) {
    const i = seasonDbIds.indexOf(editId);
    const s = i >= 0 ? rawSeasons[i] : null;
    if (!s) { sform = blankSeasonForm(); return; }
    sform = {
      editId, group_id: s.group || '', name: s.name, start_date: s.start || '',
      weeks: s.weeks || '', target_games: s.targetGames || '', qualify_pct: s.qualifyPct ?? '', playoff_spots: s.playoffSpots || '',
      champion_player_id: s.champion ? (playerIdByName.get(s.champion) || '') : '', notes: s.notes || '',
    };
  }
  const blankPlayerForm = () => ({ name: '', group_ids: [] });
  let pform = blankPlayerForm();
  // The Admin page manages the whole site, not just the group currently
  // being viewed — it reads allGroups/rawPlayers/rawSeasons (unfiltered,
  // set once in boot()) rather than D, which is scoped to one group.
  function pageAdmin(gid, arg) {
    if (!me || !me.is_admin) return '<h1>Admin</h1><p class="empty">Only the admin can manage groups and seasons.</p>';
    const m = /^season\/edit\/(\d+)$/.exec(arg || '');
    const editId = m ? +m[1] : null;
    if (editId !== sform.editId) { if (editId == null) sform = blankSeasonForm(); else loadSeasonIntoForm(editId); }
    if (!sform.editId && !sform.group_id && allGroups.length) sform.group_id = allGroups[0].id;
    if (!pform.group_ids.length && allGroups.length) pform.group_ids = [allGroups[0].id];

    let h = '<h1>Admin</h1><p class="lede">Manage friend groups and seasons.</p>';

    h += '<h2>Players</h2>';
    h += allGroups.length
      ? `<div class="builder"><div class="controls">
        <label class="f">New player's name <input type="text" id="pfName" value="${esc(pform.name)}"></label></div>
        <p class="meta">Group(s) — tick every friend circle they play with</p>
        <div class="controls" id="pfGroups">${allGroups.map(g => `<label class="f"><input type="checkbox" data-pg="${esc(g.id)}"${pform.group_ids.includes(g.id) ? ' checked' : ''}> ${esc(g.name)}</label>`).join('')}</div>
        <div class="controls" style="margin-top:10px"><button id="pfSave" type="button">Add player</button><span class="meta" id="pfMsg" role="status"></span></div>
        <p class="note">Creates their account with the preset password <code>dominion</code> — tell them their name and that password, and they'll set a real one on first sign-in.</p></div>`
      : '<p class="empty">Create a group below first.</p>';

    if (allGroups.length && rawPlayers.length) {
      h += `<div class="builder" style="margin-top:12px"><p class="meta" style="margin-top:0">Existing players' groups — a player in more than one has a completely separate Elo and stats per group; they don't mix. Each game belongs to exactly one group, picked when it's logged.</p>
        <div class="tablewrap"><table class="plain"><thead><tr><th class="l">Player</th>${allGroups.map(g => `<th>${esc(g.name)}</th>`).join('')}</tr></thead><tbody id="pgTable">${rawPlayers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => {
          const mine = new Set(p.group_ids || []);
          return `<tr><td class="l">${esc(p.name)}</td>${allGroups.map(g => `<td><input type="checkbox" data-pid="${esc(p.id)}" data-pg="${esc(g.id)}"${mine.has(g.id) ? ' checked' : ''}></td>`).join('')}</tr>`;
        }).join('')}</tbody></table></div><span class="meta" id="pgMsg" role="status"></span></div>`;
    }

    h += '<h2>Sets</h2><div class="builder"><p class="note" style="margin-top:0">Untick a set you don\'t currently own — it disappears from the Add A Game picker. Games already logged with it are unaffected.</p><div class="controls" id="setsToggle">' +
      SET_NAMES.map(n => `<label class="f"><input type="checkbox" data-set="${esc(n)}"${enabledSets.has(n) ? ' checked' : ''}> ${setIcon(n, 18)}${esc(n)}</label>`).join('') +
      '</div><span class="meta" id="setsMsg" role="status"></span></div>';

    h += '<h2>Groups</h2>';
    h += allGroups.length
      ? `<div class="tablewrap"><table class="plain"><thead><tr><th class="l">Name</th><th class="l">Id</th><th></th></tr></thead><tbody>${allGroups.map(g => `<tr><td class="l">${esc(g.name)}</td><td class="l"><code>${esc(g.id)}</code></td><td><a href="#" data-delgroup="${esc(g.id)}">Delete</a></td></tr>`).join('')}</tbody></table></div><span class="meta" id="dgMsg" role="status"></span>`
      : '<p class="empty">No groups yet.</p>';
    h += `<div class="builder" style="margin-top:12px"><div class="controls">
      <label class="f">New group name <input type="text" id="gfName" value="${esc(gform.name)}"></label>
      <button id="gfSave" type="button">Add group</button><span class="meta" id="gfMsg" role="status"></span></div>
      <p class="note">Id will be <code>${esc(slugify(gform.name) || '…')}</code> — it'll show up as a checkbox option in the Players section above once saved.</p></div>`;

    h += '<h2>Seasons</h2>';
    h += rawSeasons.length
      ? `<div class="tablewrap"><table class="plain"><thead><tr><th class="l">Name</th><th class="l">Group</th><th class="l">Dates</th><th class="l">Champion</th><th></th></tr></thead><tbody>${rawSeasons.map((s, i) => {
          const gname = (allGroups.find(g => g.id === s.group) || {}).name || s.group || '—';
          const sEnd = s.start ? Eng.fmtDay(Eng.parseISO(s.start) + 7 * (+s.weeks || 0) - 1) : '';
          return `<tr><td class="l">${esc(s.name)}</td><td class="l">${esc(gname)}</td><td class="l">${s.start ? s.start + ' to ' + sEnd : '—'}</td><td class="l">${esc(s.champion) || '—'}</td><td><a href="#/admin/season/edit/${seasonDbIds[i]}">Edit</a></td></tr>`;
        }).join('')}</tbody></table></div>`
      : '<p class="empty">No seasons yet.</p>';

    if (!allGroups.length) return h + '<p class="empty">Create a group above before adding a season.</p>';

    const championRoster = sform.group_id ? rawPlayers.filter(p => (p.group_ids || []).includes(sform.group_id)).map(p => p.name) : [];
    h += `<div class="builder" style="margin-top:12px"><h3 style="margin-top:0">${sform.editId ? 'Edit season' : 'Add a season'}</h3>
      <div class="controls">
      <label class="f">Group <select id="sfGroup">${allGroups.map(g => `<option value="${esc(g.id)}"${sform.group_id === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
      <label class="f">Name <input type="text" id="sfName" value="${esc(sform.name)}"></label></div>
      <div class="controls">
      <label class="f">Start date <input type="date" id="sfStart" value="${esc(sform.start_date)}"></label>
      <label class="f">Weeks <input type="text" id="sfWeeks" size="4" value="${esc(sform.weeks)}"></label>
      <label class="f">Target games <input type="text" id="sfTarget" size="4" value="${esc(sform.target_games)}"></label>
      <label class="f">Qualify % (0–1) <input type="text" id="sfPct" size="4" value="${esc(sform.qualify_pct)}"></label>
      <label class="f">Playoff spots <input type="text" id="sfSpots" size="4" value="${esc(sform.playoff_spots)}"></label></div>
      <div class="controls"><label class="f">Champion <select id="sfChamp"><option value="">Not decided</option>${championRoster.map(n => `<option value="${esc(playerIdByName.get(n) || '')}"${playerIdByName.get(n) === sform.champion_player_id ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      <label class="f">Notes <input type="text" id="sfNotes" size="50" value="${esc(sform.notes)}"></label>
      <div class="controls" style="margin-top:10px"><button id="sfSave" type="button">${sform.editId ? 'Save changes' : 'Add season'}</button>${sform.editId ? '<a class="btn ghost" href="#/admin">Cancel</a>' : ''}<span class="meta" id="sfMsg" role="status"></span></div></div>`;
    return h;
  }
  function wireAdmin() {
    const setsToggle = $('#setsToggle');
    setsToggle && setsToggle.addEventListener('change', async e => {
      const cb = e.target.closest('input[data-set]');
      if (!cb) return;
      if (cb.checked) enabledSets.add(cb.dataset.set); else enabledSets.delete(cb.dataset.set);
      const msg = $('#setsMsg');
      if (msg) msg.textContent = 'Saving…';
      const { error } = await sb.from('settings').update({ enabled_sets: [...enabledSets] }).eq('id', true);
      if (msg) msg.textContent = error ? error.message : 'Saved.';
    });
    const pName = $('#pfName');
    pName && pName.addEventListener('input', () => { pform.name = pName.value; });
    const pGroups = $('#pfGroups');
    pGroups && pGroups.addEventListener('change', e => {
      const cb = e.target.closest('input[data-pg]'); if (!cb) return;
      const gid2 = cb.dataset.pg;
      if (cb.checked) { if (!pform.group_ids.includes(gid2)) pform.group_ids.push(gid2); }
      else pform.group_ids = pform.group_ids.filter(x => x !== gid2);
    });
    const pMsg = t => { const el = $('#pfMsg'); if (el) el.textContent = t; };
    const pSave = $('#pfSave');
    pSave && pSave.addEventListener('click', async () => {
      const name = (pform.name || '').trim();
      if (!name) { pMsg('Type a name first.'); return; }
      if (!pform.group_ids.length) { pMsg('Pick at least one group first.'); return; }
      pSave.disabled = true; pMsg('Creating…');
      const { data, error } = await sb.functions.invoke('create-player', { body: { name, group_ids: pform.group_ids } });
      pSave.disabled = false;
      if (error) {
        // supabase-js surfaces a non-2xx function response as an error whose
        // .context is the raw Response — the function's own {error: "..."}
        // JSON body (the actual useful message) lives there, not on error.message.
        let msg = error.message || 'Could not create the player.';
        if (error.context && typeof error.context.json === 'function') {
          try { const body = await error.context.json(); if (body && body.error) msg = body.error; } catch (e) { /* fall back to msg */ }
        }
        pMsg(msg); return;
      }
      if (data && data.error) { pMsg(data.error); return; }
      pform = blankPlayerForm();
      pMsg(`Created ${data.name}. Tell them to sign in with their name and "dominion".`);
      await boot();
    });
    const pgTable = $('#pgTable');
    pgTable && pgTable.addEventListener('change', async e => {
      const cb = e.target.closest('input[data-pid]'); if (!cb) return;
      const pid = cb.dataset.pid;
      const row = cb.closest('tr');
      const ids = [...row.querySelectorAll('input[data-pg]:checked')].map(x => x.dataset.pg);
      const msg = $('#pgMsg');
      if (msg) msg.textContent = 'Saving…';
      const { error } = await sb.from('players').update({ group_ids: ids }).eq('id', pid);
      if (msg) msg.textContent = error ? error.message : 'Saved.';
      if (!error) await boot();
    });

    const gName = $('#gfName');
    gName && gName.addEventListener('input', () => { gform.name = gName.value; render(); });
    const gMsg = t => { const el = $('#gfMsg'); if (el) el.textContent = t; };
    const gSave = $('#gfSave');
    gSave && gSave.addEventListener('click', async () => {
      const name = (gform.name || '').trim(), id = slugify(name);
      if (!name || !id) { gMsg('Type a name first.'); return; }
      if (allGroups.some(g => g.id === id)) { gMsg('A group with that id already exists.'); return; }
      gSave.disabled = true; gMsg('Saving…');
      const { error } = await sb.from('groups').insert({ id, name });
      gSave.disabled = false;
      if (error) { gMsg(error.message); return; }
      gform = blankGroupForm();
      await boot();
    });
    document.querySelectorAll('a[data-delgroup]').forEach(a => {
      a.addEventListener('click', async e => {
        e.preventDefault();
        const id = a.dataset.delgroup;
        const g = allGroups.find(x => x.id === id);
        const cd = computedByGroup[id];
        const gameCount = cd ? cd.games.filter(x => x.n >= 2).length : 0;
        const seasonCount = rawSeasons.filter(s => s.group === id).length;
        const sure = confirm(`Delete "${g ? g.name : id}"? This permanently deletes its ${gameCount} game${gameCount === 1 ? '' : 's'} and ${seasonCount} season${seasonCount === 1 ? '' : 's'}, and removes it from every player's group list. This cannot be undone.`);
        if (!sure) return;
        const msg = $('#dgMsg');
        if (msg) msg.textContent = 'Deleting…';
        const { error } = await sb.rpc('delete_group', { p_group_id: id });
        if (error) { if (msg) msg.textContent = error.message; return; }
        await boot();
      });
    });

    const bindS = (id, k) => { const el = $(id); el && el.addEventListener('input', () => { sform[k] = el.value; }); };
    bindS('#sfName', 'name'); bindS('#sfStart', 'start_date'); bindS('#sfWeeks', 'weeks');
    bindS('#sfTarget', 'target_games'); bindS('#sfPct', 'qualify_pct'); bindS('#sfSpots', 'playoff_spots'); bindS('#sfNotes', 'notes');
    const sGroup = $('#sfGroup');
    sGroup && sGroup.addEventListener('change', () => { sform.group_id = sGroup.value; sform.champion_player_id = ''; render(); });
    const sChamp = $('#sfChamp');
    sChamp && sChamp.addEventListener('change', () => { sform.champion_player_id = sChamp.value; });
    const sMsg = t => { const el = $('#sfMsg'); if (el) el.textContent = t; };
    const sSave = $('#sfSave');
    sSave && sSave.addEventListener('click', async () => {
      if (!sform.group_id || !sform.name.trim() || !sform.start_date || !(+sform.weeks > 0)) {
        sMsg('Fill in group, name, start date, and at least 1 week.'); return;
      }
      const payload = {
        group_id: sform.group_id, name: sform.name.trim(), start_date: sform.start_date,
        weeks: +sform.weeks, target_games: sform.target_games ? +sform.target_games : 8,
        qualify_pct: sform.qualify_pct ? +sform.qualify_pct : 0.6,
        playoff_spots: sform.playoff_spots ? +sform.playoff_spots : 4,
        champion_player_id: sform.champion_player_id || null, notes: sform.notes || null,
      };
      sSave.disabled = true; sMsg('Saving…');
      const { error } = sform.editId
        ? await sb.from('seasons').update(payload).eq('id', sform.editId)
        : await sb.from('seasons').insert(payload);
      sSave.disabled = false;
      if (error) { sMsg(error.message); return; }
      sform = blankSeasonForm();
      location.hash = '#/admin';
      await boot();
    });
  }

  /* ---------- sortable tables ---------- */
  function makeSortable(root) {
    root.querySelectorAll('.tablewrap table:not(.matrix):not(.plain)').forEach(t => {
      if (!t.tHead || !t.tBodies[0]) return;
      const heads = [...t.tHead.rows[0].cells];
      const val = (r, ci) => {
        const s = (r.cells[ci] ? r.cells[ci].textContent : '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^[-+−]?\d/.test(s)) { const n = parseFloat(s.replace(/[%+,]/g, '').replace('−', '-')); if (!isNaN(n)) return n; }
        return s.toLowerCase();
      };
      heads.forEach((th, ci) => {
        if (!th.textContent.trim()) return;
        th.classList.add('sortable'); th.tabIndex = 0; th.setAttribute('role', 'button'); th.title = 'Sort by this column';
        const go = () => {
          const dir = th.dataset.dir === 'desc' ? 'asc' : 'desc';
          heads.forEach(x => { delete x.dataset.dir; x.removeAttribute('aria-sort'); });
          th.dataset.dir = dir; th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
          const rows = [...t.tBodies[0].rows];
          rows.sort((ra, rb) => {
            const x = val(ra, ci), y = val(rb, ci);
            const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
            return dir === 'asc' ? r : -r;
          });
          rows.forEach(r => t.tBodies[0].appendChild(r));
        };
        th.addEventListener('click', go);
        th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    });
  }

  /* ---------- entry point (called by src/components/LegacyPage.jsx) ---------- */
  // Data writes (admin forms, add/edit/delete game) call boot() to refetch
  // and recompute; that now means asking React to reload, which re-renders
  // this page with fresh data.
  const boot = () => ctx.reload();

  function bindContext(c) {
    ctx = c;
    ({ cfg, me, allGroups, computedByGroup, rawPlayers, rawSeasons, playerIdByName, seasonDbIds, enabledSets } = c);
    curGid = c.gid;
    D = pickD(c, c.gid);
  }

  export function renderLegacyPage(el, c) {
    main = el;
    bindContext(c);
    render();
  }

  // The Add/Edit Game modal is still legacy; ported pages open it through here. editId null = new game.
  export function openGameModal(c, editId) {
    bindContext(c);
    openAddModal(editId);
  }

  // A React page took over the route: drop the Add/Edit Game modal if it was left open.
  export function resetLegacyChrome() { closeAddModal(); }

  // Re-renders the current page from the same context — used by filters and
  // admin forms that change local state but not the data.
  function render() {
    if (!ctx) return;
    const { route, gid, arg } = ctx;
    curGid = gid;
    D = pickD(ctx, gid);
    closeAddModal();
    const pages = { admin: pageAdmin };
    const fn = pages[route];   // unknown routes are mapped to Home (ported) by App before they get here
    main.innerHTML = fn(gid, arg);
    makeSortable(main);
    if (route === 'admin') wireAdmin();
  }
