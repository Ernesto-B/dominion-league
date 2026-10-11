(function () {
  'use strict';
  const Eng = window.DominionEngine;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const $ = s => document.querySelector(s);
  const main = $('#main');
  let D = null;        // computed model
  let cfg = null;       // data/config.json
  let me = null;         // signed-in player's own players row
  let playerIdByName = new Map();  // name -> uuid, for admin writes
  let seasonDbIds = [];      // D.seasons[i] (number = i+1) -> seasons.id row, for admin edit links
  let curGid = null;       // group currently being viewed
  let enabledSets = new Set();  // sets the admin has marked as owned; populated in boot()

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f0 = x => x == null ? '' : Math.round(x).toString();
  const f1 = x => x == null ? '' : x.toFixed(1);
  const f2 = x => x == null ? '' : x.toFixed(2);
  const f3 = x => x == null ? '' : x.toFixed(3);
  const pc = x => x == null ? '' : Math.round(x * 100) + '%';
  const sgn = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(Math.round(x));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const short = iso => { const [y, m, d] = iso.split('-'); return MON[+m - 1] + ' ' + (+d); };
  const long = iso => { const [y, m, d] = iso.split('-'); return MON[+m - 1] + ' ' + (+d) + ', ' + y; };
  const ord = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const slugify = n => String(n).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  /* ---------- hash helpers (group-aware once more than one group exists) ---------- */
  function hashFor(route, gid, rest) {
    const multi = D && D.groups.length > 1;
    return '#/' + route + (multi && gid ? '/' + encodeURIComponent(gid) : '') + (rest != null && rest !== '' ? '/' + rest : '');
  }
  function groupSwitcher(route, gid, rest) {
    if (!D || D.groups.length <= 1) return '';
    return `<div class="pills" aria-label="Choose a group">${D.groups.map(g => `<a href="${hashFor(route, g.id, rest)}" ${g.id === gid ? 'aria-current="true"' : ''}>${esc(g.name)}</a>`).join('')}</div>`;
  }

  /* ---------- shared bits ---------- */
  // A tier icon is icons/<id>.png (drop in your own artwork). 'champion' is the bundled trophy SVG.
  // A value containing a slash is used exactly as written.
  const icon = (id, size, alt) => {
    const explicit = /\//.test(id);
    const src = explicit ? id : 'icons/' + id + '.png';
    const fb = explicit ? '' : ` onerror="this.onerror=null;this.src='icons/${esc(id)}.svg'"`;
    return `<img class="tier" src="${esc(src)}" width="${size}" height="${size}" alt="${esc(alt == null ? id : alt)}"${fb}>`;
  };
  const SET_ICONS = {
    Base: 'base', Intrigue: 'intrigue', Seaside: 'seaside', Prosperity: 'prosperity',
    Hinterlands: 'hinterlands', 'Dark Ages': 'dark-ages', 'Cornucopia & Guilds': 'cornucopia-guilds',
    Adventures: 'adventures', Empires: 'empires', Renaissance: 'renaissance', Plunder: 'plunder',
  };
  const SET_NAMES = Object.keys(SET_ICONS);
  const setIconPath = name => { const slug = SET_ICONS[name]; return slug ? `icons/sets/${slug}.png` : null; };
  const setIcon = (name, size) => {
    const src = setIconPath(name);
    return src ? `<img class="tier seticon" src="${src}" width="${size}" height="${size}" alt="${esc(name)}" title="${esc(name)}">` : '';
  };
  // withPopup(): wraps a tile's markup with a follow-the-mouse popup, same
  // mechanism as the tier progress bar's (see wireHoverPopups). Pass no
  // popupHtml and a tile renders exactly as before — a no-op wrapper.
  function withPopup(bodyHtml, popupHtml) {
    return popupHtml ? `<div class="popwrap" tabindex="0">${bodyHtml}<div class="popbox">${popupHtml}</div></div>` : bodyHtml;
  }
  const popText = (text, extra) => `<div class="popdesc">${text}${extra ? `<b>${extra}</b>` : ''}</div>`;
  // statTile(): a .stat tile with an optional leading category icon. Tiles
  // built without one (icon = null/undefined) render byte-for-byte like the
  // plain .stat tiles used everywhere else on the site (Season/Records/Admin),
  // since .stat-body has no styling of its own — it's a no-op wrapper then.
  function statTile(iconSrc, big, label, iconClass, popupHtml) {
    const body = `<div class="stat${iconSrc ? ' has-icon' : ''}">${iconSrc ? `<img class="staticon${iconClass ? ' ' + iconClass : ''}" src="${iconSrc}" alt="">` : ''}<div class="stat-body"><b>${big}</b><span>${label}</span></div></div>`;
    return withPopup(body, popupHtml);
  }
  // Just the set's icon and a caption — no count. A raw number here (table
  // count) isn't a meaningful stat the way the other tiles' numbers are.
  function setStatTile(setName, label, popupHtml) {
    if (!setName) return '';
    const src = setIconPath(setName);
    const body = `<div class="stat seticon-stat">${src ? `<img class="seticon" src="${src}" alt="${esc(setName)}">` : ''}<span>${label}: ${esc(setName)}</span></div>`;
    return withPopup(body, popupHtml);
  }
  // Full breakdown of every currently-owned set (not just ones this player
  // has used), for the most/least-played set tiles — shows what's missing
  // as much as what's played. A set unticked in Admin > Sets drops out of
  // this list entirely, same as it does from the Add A Game picker.
  function setBreakdownPopup(setCounts) {
    const rows = SET_NAMES.filter(nm => enabledSets.has(nm)).sort((a, b) => (setCounts[b] || 0) - (setCounts[a] || 0) || a.localeCompare(b)).map(nm => {
      const n = setCounts[nm] || 0;
      return `<div class="poprow">${setIcon(nm, 20)}<b>${esc(nm)}</b><span>${n} game${n === 1 ? '' : 's'}</span></div>`;
    }).join('');
    return rows;
  }
  const tierOf = n => { const p = D && D.byName && D.byName[n]; return p && p.tier; };
  const nameIcon = (n, size) => { const t = tierOf(n); return t ? icon(t.icon, size || 18, t.name + ' tier') : ''; };
  const link = n => {
    const gid = D.groupOf(n);
    return `<a class="pl" href="${hashFor('players', gid, encodeURIComponent(n))}">${nameIcon(n, 20)}<span>${esc(n)}</span></a>`;
  };
  function tierLegend() {
    return `<div class="tiers" role="list" aria-label="Rank tiers">${D.tiers.map((t, i) => {
      const hi = D.tiers[i + 1] ? D.tiers[i + 1].min - 1 : null;
      const range = t.min === -Infinity ? `under ${D.tiers[i + 1].min}` : hi == null ? `${t.min}+` : `${t.min}–${hi}`;
      return `<div class="tierkey" role="listitem">${icon(t.icon, 40, '')}<b>${esc(t.name)}</b><span>${range}</span></div>`;
    }).join('')}<div class="tierkey" role="listitem">${icon('champion', 40, '')}<b>Champion</b><span>won a season</span></div></div>`;
  }
  function tierAnchor(tier) {
    return `<div class="tieranchor">${tier ? icon(tier.icon, 28, tier.name) : ''}<span>${tier ? esc(tier.name) : 'Top tier'}</span></div>`;
  }
  function dateAnchor(day, label) {
    const iso = Eng.fmtDay(day);
    return `<div class="tieranchor"><b title="${esc(iso)}">${short(iso)}</b><span>${esc(label)}</span></div>`;
  }
  function tierPopup() {
    const rows = D.tiers.map((t, i) => {
      const hi = D.tiers[i + 1] ? D.tiers[i + 1].min - 1 : null;
      const range = t.min === -Infinity ? `under ${D.tiers[i + 1].min}` : hi == null ? `${t.min}+` : `${t.min}–${hi}`;
      return `<div class="tierpoprow">${icon(t.icon, 22, t.name)}<b>${esc(t.name)}</b><span>${range}</span></div>`;
    }).join('');
    return `<div class="tierpopup">${rows}</div>`;
  }
  function tierProgressBar(p) {
    if (!p.tier) return '';
    if (!p.nextTier) return `<div class="tierbarwrap" tabindex="0">${tierPopup()}<div class="tierbar">${tierAnchor(p.tier)}<div class="progress" role="img" aria-label="Top tier reached"><i style="width:100%;background:var(--brass)"></i></div>${tierAnchor(null)}</div></div>`;
    const lower = p.tier.min === -Infinity ? D.E.start : p.tier.min;
    const upper = p.nextTier.tier.min;
    const pct = Math.max(0, Math.min(1, (p.elo - lower) / (upper - lower))) * 100;
    return `<div class="tierbarwrap" tabindex="0">${tierPopup()}<div class="tierbar">${tierAnchor(p.tier)}<div class="progress" role="img" aria-label="${Math.round(pct)}% of the way to ${esc(p.nextTier.tier.name)}"><i style="width:${pct}%"></i></div>${tierAnchor(p.nextTier.tier)}</div></div>`;
  }
  function storyCards(R, rk) {
    const cards = [];
    if (R.closestRace) cards.push(`<div class="story"><span class="slabel">Closest race</span>${link(R.closestRace.a)} leads ${link(R.closestRace.b)} by just <b>${f0(R.closestRace.gap)}</b> Elo</div>`);
    if (R.biggestUpset) cards.push(`<div class="story"><span class="slabel">Biggest upset</span>${link(R.biggestUpset.winner)} beat ${link(R.biggestUpset.loser)} despite trailing by <b>${f0(R.biggestUpset.deficit)}</b> Elo <span class="meta">(${short(R.biggestUpset.date)})</span></div>`);
    const streaker = (rk || []).filter(p => p.streak >= 3).sort((a, b) => b.streak - a.streak)[0];
    if (streaker) cards.push(`<div class="story"><span class="slabel">Hot streak</span>${link(streaker.name)} has won <b>${streaker.streak}</b> in a row 🔥</div>`);
    return cards.length ? `<div class="storyrow">${cards.join('')}</div>` : '';
  }
  function banner() {
    if (!D.warnings.length) return '';
    return `<div class="banner" role="status"><b>${D.warnings.length} thing${D.warnings.length > 1 ? 's' : ''} to fix in the data</b><ul>${D.warnings.slice(0, 8).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  }
  function seasonChip(gid) {
    const s = D.seasons[D.currentSeasonFor(gid) - 1];
    if (!s) return '';
    const live = s.status === 'In progress';
    return `<span class="chip ${live ? 'live' : ''}"><b>${esc(s.name)}</b> ${live ? 'in progress' : s.status.toLowerCase()}${live && s.weeksLeft ? `, ${s.weeksLeft} week${s.weeksLeft > 1 ? 's' : ''} left` : ''}</span>`;
  }
  function seasonOptions(sel, withAll, gid) {
    const list = D.seasons.filter(s => !gid || s.group === gid);
    return (withAll ? `<option value="all"${sel === 'all' ? ' selected' : ''}>All seasons</option>` : '') +
      list.map(s => `<option value="${s.number}"${String(sel) === String(s.number) ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  }

  /* ---------- rating chart ---------- */
  function ratingChart(hot, names) {
    const nights = D.nights;
    if (nights.length < 1) return '<p class="empty">The rating history appears after the first night is logged.</p>';
    const start = D.E.start;
    const series = names.map(n => ({ name: n, pts: [start].concat(nights.map(x => x.snapshot[n] ?? start)) }));
    const W = 880, H = 330, L = 46, R = 112, T = 12, B = 28;
    let lo = Infinity, hi = -Infinity;
    series.forEach(s => s.pts.forEach(v => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
    lo = Math.min(lo, start - 20); hi = Math.max(hi, start + 20);
    const step = (hi - lo) > 200 ? 50 : (hi - lo) > 80 ? 25 : 10;
    lo = Math.floor((lo - 5) / step) * step; hi = Math.ceil((hi + 5) / step) * step;
    const N = nights.length;
    const x = i => L + (N === 0 ? 0 : i / N) * (W - L - R);
    const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    let g = '';
    for (let v = lo; v <= hi; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    g += `<line class="base" x1="${L}" x2="${W - R}" y1="${y(start)}" y2="${y(start)}"/>`;
    const ticks = Math.min(N, 6);
    for (let t = 1; t <= ticks; t++) {
      const i = Math.round(t / ticks * N);
      g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${short(nights[i - 1].date)}</text>`;
    }
    if (!series.length) return '<p class="empty">No one in this group has a rated game yet.</p>';
    const sorted = series.slice().sort((a, b) => a.pts[N] - b.pts[N]);
    const ly = {}; let last = -Infinity;
    for (let i = sorted.length - 1; i >= 0; i--) { const ty = Math.max(y(sorted[i].pts[N]), last + 13); ly[sorted[i].name] = ty; last = ty; }
    series.slice().sort((a, b) => (a.name === hot) - (b.name === hot)).forEach(s => {
      const on = s.name === hot ? ' on' : '';
      const d = s.pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
      g += `<path class="ln${on}" data-p="${esc(s.name)}" d="${d}"/>`;
    });
    series.forEach(s => {
      const on = s.name === hot ? ' on' : '';
      g += `<text class="lab${on}" data-p="${esc(s.name)}" x="${W - R + 8}" y="${ly[s.name] + 4}">${esc(s.name)} ${f0(s.pts[N])}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Elo rating after each game night, one line per player">${g}</svg></div>`;
  }
  function wireHighlight(root) {
    const set = name => {
      root.querySelectorAll('.chart [data-p]').forEach(el => el.classList.toggle('on', el.dataset.p === name));
      root.querySelectorAll('.lrow').forEach(el => el.classList.toggle('hot', el.dataset.p === name));
    };
    root.querySelectorAll('.lrow, .chart .lab').forEach(el => {
      el.addEventListener('mouseenter', () => set(el.dataset.p));
      el.addEventListener('focusin', () => set(el.dataset.p));
    });
  }
  // A single popup node attached directly to <body>, reused for every
  // .tierbarwrap/.popwrap on the page. It has to live outside `main`: any
  // .popwrap nested inside .stats sits under an ancestor that gets
  // backdrop-filter in dark mode, and backdrop-filter (like transform/
  // filter) makes an element a new containing block for position:fixed
  // descendants — combined with .stats's overflow:hidden, a popup embedded
  // in place there would be clipped into invisibility instead of floating
  // over the page. Each wrap keeps its own hidden source node (built by
  // withPopup/tierPopup) purely as content to clone into this shared layer.
  let popLayer = null;
  function ensurePopLayer() {
    if (!popLayer) { popLayer = document.createElement('div'); popLayer.className = 'popbox'; document.body.appendChild(popLayer); }
    return popLayer;
  }
  function hidePopLayer() { if (popLayer) popLayer.style.display = 'none'; }
  function wireHoverPopups(root) {
    const layer = ensurePopLayer();
    root.querySelectorAll('.tierbarwrap, .popwrap').forEach(wrap => {
      const src = wrap.querySelector('.tierpopup, .popbox');
      if (!src) return;
      src.style.display = 'none';
      const place = e => {
        const pad = 16;
        layer.style.transform = 'none';
        let x = e.clientX + pad, y = e.clientY + pad;
        const pw = layer.offsetWidth, ph = layer.offsetHeight;
        if (x + pw > window.innerWidth - 8) x = e.clientX - pw - pad;
        if (y + ph > window.innerHeight - 8) y = e.clientY - ph - pad;
        layer.style.left = x + 'px';
        layer.style.top = y + 'px';
      };
      const show = e => { layer.innerHTML = src.innerHTML; layer.style.display = 'block'; place(e); };
      wrap.addEventListener('mouseenter', show);
      wrap.addEventListener('mousemove', place);
      wrap.addEventListener('mouseleave', hidePopLayer);
      wrap.addEventListener('focusin', () => {
        layer.innerHTML = src.innerHTML; layer.style.display = 'block';
        layer.style.transform = 'translate(-50%,-50%)'; layer.style.left = '50%'; layer.style.top = '50%';
      });
      wrap.addEventListener('focusout', hidePopLayer);
    });
  }
  function wireGameRows(root) {
    root.querySelectorAll('tr.grow').forEach(tr => {
      tr.addEventListener('click', () => {
        const det = root.querySelector(`tr.gdetail[data-g="${tr.dataset.g}"]`);
        if (!det) return;
        det.hidden = !det.hidden;
        tr.classList.toggle('open', !det.hidden);
      });
    });
    root.querySelectorAll('a[data-edit]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); openAddModal(+a.dataset.edit); });
    });
    const addBtn = root.querySelector('#gAddBtn');
    addBtn && addBtn.addEventListener('click', () => openAddModal(null));
  }

  /* ---------- pages ---------- */
  function pageHome(gid) {
    const rk = D.ranked.filter(p => !gid || D.groupOf(p.name) === gid);
    const gl = D.games.filter(g => g.n >= 2 && (!gid || g.names.every(n => D.groupOf(n) === gid)));
    const last = gl.length ? gl[gl.length - 1].date : null;
    const R = D.recordsFor(gid);
    let h = `<div class="head">${storyCards(R, rk)}
      <div class="chips" style="margin-left:auto">${seasonChip(gid)}${last ? `<span class="chip">Last night <b>${short(last)}</b></span>` : ''}<span class="chip"><b>${R.overview.nights}</b> night${R.overview.nights === 1 ? '' : 's'} played</span></div></div>${groupSwitcher('', gid)}${banner()}`;
    if (!rk.length) return h + '<p class="empty">No rated games yet. Once the admin adds one, the rankings show up here.</p>';
    const mx = Math.max(60, ...rk.map(p => Math.abs(p.elo - D.E.start))) * 1.08;
    h += `<div class="ladder" role="table" aria-label="Elo rankings"><div class="lhead" role="row"><span>Rank</span><span>Player</span><span>Rating vs ${D.E.start} start</span><span>Elo</span><span>Last</span><span>Recent form</span></div>`;
    rk.forEach(p => {
      const d = p.elo - D.E.start, wpx = Math.abs(d) / mx * 50;
      const lastR = p.results[p.results.length - 1];
      const dl = lastR ? lastR.after - lastR.before : 0;
      const form = p.results.slice(-5).map(r => `<i class="${r.pts >= 0.67 ? 'w' : r.pts <= 0.33 ? 'l' : 'm'}" title="${esc(r.game.date)}: ${ord(r.place)} of ${r.game.n}"></i>`).join('');
      const rm = p.rankDelta;
      const rmHtml = !rm ? '' : rm > 0 ? `<span class="rankmove up-t" title="Up ${rm} spot${rm === 1 ? '' : 's'} since last night">▲${rm}</span>` : `<span class="rankmove down-t" title="Down ${-rm} spot${-rm === 1 ? '' : 's'} since last night">▼${-rm}</span>`;
      h += `<div class="lrow" data-p="${esc(p.name)}" role="row"><span class="lrank">${p.rank}${rmHtml}</span>
        <a class="lname" href="${hashFor('players', gid, encodeURIComponent(p.name))}">${icon(p.tier.icon, 28, p.tier.name + ' tier')}${esc(p.name)}${p.titles ? `<span class="crown" title="${p.titles} season title${p.titles > 1 ? 's' : ''}">${icon('champion', 20, 'Season champion')}${p.titles > 1 ? '×' + p.titles : ''}</span>` : ''}${p.streak >= 3 ? `<span class="pill hot" title="${p.streak}-game win streak">🔥 ${p.streak}</span>` : ''}${p.status === 'Provisional' ? '<span class="tag">provisional</span>' : ''}</a>
        <span class="bar" aria-hidden="true"><i class="${d >= 0 ? 'up' : 'down'}" style="width:${wpx}%;${d >= 0 ? 'left:50%' : 'left:' + (50 - wpx) + '%'}"></i></span>
        <span class="lelo">${f0(p.elo)}</span><span class="ldelta ${dl > 0.5 ? 'up-t' : dl < -0.5 ? 'down-t' : ''}">${sgn(dl)}</span><span class="form" aria-label="Recent form">${form}</span></div>`;
    });
    h += '</div>' + lastNightPanel(gl) + '<h2>Rank tiers</h2>' + tierLegend() + '<p class="note">Your tier follows your current Elo, so it can go down as well as up. The trophy is for winning a season and never goes away.</p><p class="note">Everyone starts at ' + D.E.start + ' as a ' + D.startTier.name + ' and climbs from there. Elo carries across seasons; friendly games never count. New players move faster for their first ' + D.E.provisionalGames + ' games (provisional).</p>' + `<p class="note">This ladder is Elo — a lifetime skill rating that never resets. It's not what decides a season's winner; that's points, on the <a href="${hashFor('season', gid)}">Season page</a>.</p>`;
    h += '<h2>Rating history</h2>' + ratingChart(null, rk.map(p => p.name));
    return h;
  }

  function lastNightPanel(gl) {
    if (!gl.length) return '';
    const day = gl[gl.length - 1].day, date = gl[gl.length - 1].date;
    const todays = gl.filter(g => g.day === day);
    return `<h2>Last night, ${long(date)}</h2><div class="tablewrap"><table class="plain"><thead><tr><th class="l">Finish</th><th></th><th class="l">Elo change</th></tr></thead><tbody>${todays.map(g => {
      const names = g.names.slice().sort((x, y) => g.places[x] - g.places[y]);
      const ch = names.filter(n => g.elo[n]).map(n => { const d = g.elo[n].after - g.elo[n].before; return `<span class="chg">${esc(n)} <b class="${d > 0.5 ? 'up-t' : d < -0.5 ? 'down-t' : ''}">${sgn(d)}</b></span>`; }).join('');
      return `<tr><td class="wrap">${finishText(g)}</td><td>${typePill(g.type)}</td><td class="wrap chgs">${ch || '<span class="meta">No rating change</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function seasonTable(st, limit) {
    const s = st.season, rows = limit ? st.rows.slice(0, limit) : st.rows;
    return `<div class="tablewrap"><table><thead><tr><th>Rank</th><th class="l">Player</th><th>Games</th><th>Wins</th><th>Win %</th><th>Avg points</th><th>Season score</th><th>Qualified</th><th>Seed</th><th>Elo change</th><th>Nights</th><th>Attendance</th></tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.seed ? 'seed' : ''}"><td>${r.rank}</td><td class="name">${link(r.name)}</td><td>${r.games}</td><td>${r.wins}</td><td>${pc(r.winPct)}</td><td>${f2(r.avgPts)}</td><td><b>${f3(r.score)}</b></td>
        <td>${r.qualified ? '<span class="pill ok">Yes</span>' : `<span class="pill warn">${r.need} more</span>`}</td><td>${r.seed || ''}</td><td class="${r.eloChange > 0.5 ? 'up-t' : r.eloChange < -0.5 ? 'down-t' : ''}">${sgn(r.eloChange)}</td><td>${r.nights}</td><td>${pc(r.attendance)}</td></tr>`).join('') + '</tbody></table></div>';
  }

  function seasonRecap(st) {
    const s = st.season;
    if (s.status !== 'Complete' || !st.rows.length) return '';
    const riser = st.rows.reduce((b, r) => (!b || r.eloChange > b.eloChange) ? r : b, null);
    const best = st.rows.reduce((b, r) => (!b || r.winPct > b.winPct) ? r : b, null);
    const tables = st.games.filter(g => g.n >= 2).length;
    const ironman = st.rows.reduce((b, r) => (!b || (r.attendance ?? -1) > (b.attendance ?? -1)) ? r : b, null);
    // Same deficit-of-the-loser-who-won algorithm as the all-time
    // `biggestUpset` record in engine.js, just scoped to this season's games.
    let upset = null;
    st.games.forEach(g => {
      if (!g.elo || g.n < 2) return;
      g.names.forEach(w => {
        if (g.places[w] !== 1 || !g.elo[w]) return;
        g.names.forEach(o => {
          if (o === w || g.places[o] === g.places[w] || !g.elo[o]) return;
          const deficit = g.elo[o].before - g.elo[w].before;
          if (deficit > 0 && (!upset || deficit > upset.deficit)) upset = { winner: w, loser: o, deficit };
        });
      });
    });
    let topVP = null;
    st.games.forEach(g => { if (g.vp && (!topVP || g.vp > topVP.value)) topVP = { who: g.names.filter(n => g.places[n] === 1).join(' & '), value: g.vp }; });
    const setCounts = {};
    st.games.forEach(g => g.sets.forEach(nm => { setCounts[nm] = (setCounts[nm] || 0) + 1; }));
    const setEntries = Object.entries(setCounts);
    const topSet = setEntries.length ? setEntries.reduce((a, b) => b[1] > a[1] ? b : a) : null;
    return `<h2>Hall of Fame</h2><div class="recap"><div class="recapchamp">${icon('champion', 56, '')}<div><span class="slabel">Season champion</span><h3>${s.champion ? link(s.champion) : 'Not decided'}</h3></div></div>
      <div class="stats">
      ${riser ? `<div class="stat has-icon"><img class="staticon" src="icons/stats/elo.png" alt=""><div class="stat-body"><b class="${riser.eloChange > 0.5 ? 'up-t' : riser.eloChange < -0.5 ? 'down-t' : ''}">${sgn(riser.eloChange)}</b><span>biggest riser: ${esc(riser.name)}</span></div></div>` : ''}
      ${best ? `<div class="stat"><b>${pc(best.winPct)}</b><span>best record: ${esc(best.name)}</span></div>` : ''}
      <div class="stat"><b>${tables}</b><span>tables played</span></div>
      ${upset ? `<div class="stat"><b>${f0(upset.deficit)}</b><span>biggest upset: ${esc(upset.winner)} over ${esc(upset.loser)}</span></div>` : ''}
      ${topVP ? `<div class="stat"><b>${topVP.value} VP</b><span>highest score: ${esc(topVP.who)}</span></div>` : ''}
      ${topSet ? `<div class="stat seticon-stat">${setIcon(topSet[0], 24)}<span>most played: ${esc(topSet[0])}</span></div>` : ''}
      ${ironman && ironman.attendance != null ? `<div class="stat"><b>${pc(ironman.attendance)}</b><span>best attendance: ${esc(ironman.name)}</span></div>` : ''}
      </div></div>`;
  }
  function pageSeason(gid, arg) {
    const seasonsForGroup = D.seasons.filter(s => !gid || s.group === gid);
    if (!seasonsForGroup.length) return `<h1>Season</h1>${groupSwitcher('season', gid)}<p class="empty">No seasons are set up yet.${me && me.is_admin ? ' Add one from the <a href="#/admin">Admin page</a>.' : ''}</p>`;
    const num = +arg || D.currentSeasonFor(gid);
    const st = D.seasonStandings(num); const s = st.season;
    const wk = s.status === 'In progress' ? Math.floor((D.today - s.start) / 7) + 1 : null;
    const frac = !s.ok ? 0 : Math.max(0, Math.min(1, (D.today - s.start + 1) / (7 * s.weeks)));
    let h = `<div class="head"><div><h1>${esc(s.name)}</h1>${!s.ok ? `<p class="lede">Start date or length is missing.${me && me.is_admin ? ' Fix it from the <a href="#/admin">Admin page</a>.' : ''}</p>` : ''}</div>
      <div class="pills" aria-label="Choose a season">${seasonsForGroup.map(x => `<a href="${hashFor('season', gid, x.number)}" ${x.number === num ? 'aria-current="true"' : ''}>${esc(x.name)}</a>`).join('')}</div></div>${groupSwitcher('season', gid)}${banner()}${seasonRecap(st)}`;
    h += `<div class="stats">
      <div class="stat"><b>${wk ? 'Week ' + wk + ' of ' + s.weeks : s.status}</b><span>${wk ? s.weeksLeft + ' week' + (s.weeksLeft === 1 ? '' : 's') + ' left' : 'status'}</span></div>
      <div class="stat"><b>${s.regularGames}</b><span>regular games</span></div>
      <div class="stat"><b>${s.nightsHeld}</b><span>nights held</span></div>
      <div class="stat"><b>${s.minGames}</b><span>games to qualify (${s.target} target)</span></div>
      <div class="stat"><b>${s.spots}</b><span>playoff spots</span></div>
      <div class="stat"><b>${esc(s.champion) || '—'}</b><span>champion</span></div></div>`;
    if (s.ok) h += `<div class="tierbar">${dateAnchor(s.start, 'Start')}<div class="progress" role="img" aria-label="${Math.round(frac * 100)} percent of the season has passed"><i style="width:${frac * 100}%"></i></div>${dateAnchor(s.end, 'End')}</div>`;
    h += st.rows.length ? seasonTable(st) : '<p class="empty">No regular games in this season yet.</p>';
    h += `<p class="note">Season score = (points + ${D.S.prior} × 0.5) ÷ (games + ${D.S.prior}). Points run from 1 for a win down to 0 for last, so a 3-player table and a 6-player table are worth the same, and ties split. The ${D.S.prior} imaginary average games stop one lucky night from topping the table. Missing a night costs nothing. Qualified players rank first; green rows are playoff seeds. Playoff and friendly games don't count toward the table (playoffs still move Elo). This table — not Elo — decides the season champion; Elo is a separate, ongoing skill rating shown on <a href="${hashFor('', gid)}">Rankings</a> that never resets.</p>`;
    const sg = st.games.filter(g => g.n >= 2).slice().reverse();
    if (sg.length) h += '<h2>Games this season</h2>' + gamesTable(sg);
    return h;
  }

  function resultRow(r) {
    const d = r.after - r.before;
    return `<tr><td>${r.game.date}</td><td>${typePill(r.game.type)}</td><td class="wrap">${finishText(r.game)}</td><td class="wrap">${r.game.sets.map(s => setIcon(s, 20) || esc(s)).join(' ')}</td><td>${f2(r.pts)}</td><td>${f0(r.before)} → ${f0(r.after)}</td><td class="${d > 0.5 ? 'up-t' : d < -0.5 ? 'down-t' : ''}">${sgn(d)}</td></tr>`;
  }
  const typePill = t => t === 'Playoff' ? '<span class="pill play">Playoff</span>' : t === 'Friendly' ? '<span class="pill fr">Friendly</span>' : '';

  function pagePlayers(gid, arg) {
    const all = D.players.filter(p => p.allGames > 0 && (!gid || D.groupOf(p.name) === gid));
    if (!all.length) return `<h1>Players</h1>${groupSwitcher('players', gid)}<p class="empty">No games yet.</p>`;
    const rankedHere = D.ranked.filter(p => !gid || D.groupOf(p.name) === gid);
    const name = arg ? decodeURIComponent(arg) : (rankedHere[0] || all[0]).name;
    const p = D.players.find(x => x.name === name) || all[0];
    let h = `<div class="head"><div class="who">${p.tier ? icon(p.tier.icon, 72, p.tier.name + ' tier') : ''}<div><h1>${esc(p.name)}</h1>${p.tier ? `<p class="lede">${esc(p.tier.name)} tier${p.nextTier ? `, ${p.nextTier.need} Elo to ${esc(p.nextTier.tier.name)}` : ', top tier'}${p.peakTier && p.peakTier.id !== p.tier.id ? `. Best ever: ${esc(p.peakTier.name)}.` : ''}</p>` : ''}</div></div><div class="pills" aria-label="Choose a player">${all.map(x => `<a href="${hashFor('players', gid, encodeURIComponent(x.name))}" ${x.name === p.name ? 'aria-current="true"' : ''}>${nameIcon(x.name, 18)}${esc(x.name)}</a>`).join('')}</div></div>${groupSwitcher('players', gid)}${tierProgressBar(p)}${banner()}`;
    if (!p.rated) return h + '<p class="empty">No rated games yet.</p>';
    const hh = D.h2h(null, gid);
    const setCounts = {};
    D.games.forEach(g => { if (g.places[p.name] != null) g.sets.forEach(s => { setCounts[s] = (setCounts[s] || 0) + 1; }); });
    const setEntries = Object.entries(setCounts);
    const mostSet = setEntries.length ? setEntries.reduce((a, b) => b[1] > a[1] ? b : a) : null;
    const leastSet = setEntries.length > 1 ? setEntries.reduce((a, b) => b[1] < a[1] ? b : a) : null;
    const losses = p.rated - p.wins;
    const ratioTxt = p.wins ? (losses ? `${(p.wins / losses).toFixed(2)}:1` : 'no losses yet') : '—';
    const peakGap = p.peak - p.elo;
    const setsPop = setBreakdownPopup(setCounts);
    h += `<div class="stats">
      ${statTile('icons/stats/elo.png', f0(p.elo), 'Elo' + (p.rank ? ', rank ' + p.rank : ''), null, popText(`Your current skill rating. Everyone starts at ${D.E.start}; it moves after every rated game based on who you played and how surprising the result was.`))}
      ${statTile('icons/stats/peak-elo.png', f0(p.peak), 'peak Elo', null, popText('The highest Elo you\'ve ever reached — it never goes down.', peakGap > 0.5 ? `${f0(peakGap)} below your peak right now` : 'You\'re at your all-time peak right now'))}
      ${statTile('icons/stats/rated-games.png', p.rated, 'rated games' + (p.status === 'Provisional' ? ' (provisional)' : ''), null, popText(`Games that count toward Elo — everything except Friendly games. Your first ${D.E.provisionalGames} are Provisional, with bigger rating swings while the system is still learning your skill.`))}
      ${statTile('icons/stats/wins.png', p.wins, `wins (${pc(p.winPct)})`, null, popText(`Tables you've won outright — sole 1st place, no ties.`, `W/L ratio ${ratioTxt}`))}
      ${statTile('icons/stats/average-points.png', f2(p.avgPts), 'avg points, 0 to 1', null, popText('Your average share of the points on offer at your tables, from 0 (always last) to 1 (always first). 0.5 is what an evenly matched table averages.'))}
      ${statTile('icons/stats/win-streak.png', p.streak, `win streak (best ${p.bestStreak})`, null, popText('Wins in a row right now — resets the moment you don\'t finish 1st.', `Best ever: ${p.bestStreak}`))}
      ${statTile('icons/champion.png', p.titles, 'season title' + (p.titles === 1 ? '' : 's'), null, popText('Seasons you\'ve won outright. Decided by points, not Elo — see the Season page.'))}
      ${statTile('icons/stats/top-half-finishes.png', pc(p.topHalf), 'top half', null, popText('Share of tables where your points share was 0.5 or better — roughly, finishing in the top half of the table.'))}
      ${statTile('icons/stats/last-place-finishes.png', p.lasts, 'last places', null, popText('Tables where you finished alone in last place. A tie for last doesn\'t count against you.'))}
      ${statTile('icons/stats/longest-without-win.png', p.bestDry, 'longest dry spell', null, popText('Your longest-ever run of rated games without a win.', p.dry > 0 ? `${p.dry} games into one right now` : 'Not in one right now'))}
      ${setStatTile(mostSet && mostSet[0], 'most played', setsPop)}
      ${setStatTile(leastSet && leastSet[0], 'least played', setsPop)}
      </div>`;
    const dec = hh.players.filter(o => o !== p.name).map(o => ({ o, w: hh.ahead[p.name][o], l: hh.ahead[o][p.name] })).filter(x => x.w + x.l >= 3);
    const nem = dec.filter(x => x.l > x.w).sort((a, b) => b.l / (b.w + b.l) - a.l / (a.w + a.l) || b.l - a.l)[0];
    const vic = dec.filter(x => x.w > x.l).sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l) || b.w - a.w)[0];
    if (nem || vic) h += `<div class="rivals">${nem ? `<p><b>Nemesis</b> ${link(nem.o)}, who finished ahead ${nem.l} of ${nem.w + nem.l} times.</p>` : ''}${vic ? `<p><b>Favourite victim</b> ${link(vic.o)}, finished behind ${vic.w} of ${vic.w + vic.l} times.</p>` : ''}</div>`;
    h += '<h2>Rating history</h2>' + ratingChart(p.name, rankedHere.map(x => x.name));
    const opp = hh.players.filter(o => o !== p.name).map(o => ({ o, w: hh.ahead[p.name][o], l: hh.ahead[o][p.name] })).filter(x => x.w + x.l > 0).sort((a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)) || (b.w + b.l) - (a.w + a.l));
    if (opp.length) h += `<h2>Against each opponent</h2><div class="tablewrap"><table><thead><tr><th class="l">Opponent</th><th>Finished ahead</th><th>Finished behind</th><th>Share ahead</th></tr></thead><tbody>${opp.map(x => `<tr><td class="name">${link(x.o)}</td><td>${x.w}</td><td>${x.l}</td><td>${x.w + x.l ? pc(x.w / (x.w + x.l)) : ''}</td></tr>`).join('')}</tbody></table></div><p class="note">Counts tables where both of you played, rated games only. Tied finishes aren't counted either way.</p>`;
    h += `<h2>Results</h2><div class="tablewrap"><table><thead><tr><th class="l">Date</th><th></th><th class="l">Finish</th><th class="l">Sets</th><th>Points</th><th>Elo</th><th>Change</th></tr></thead><tbody>${p.results.slice().reverse().map(resultRow).join('')}</tbody></table></div>`;
    return h;
  }

  function pageH2H(gid, arg) {
    const sel = arg === 'all' || !arg ? null : +arg;
    const hh = D.h2h(sel, gid);
    let h = `<div class="head"><div><h1>Head to head</h1><p class="lede">Each cell shows how often the row player finished ahead of the column player.</p></div>
      <label class="f">Show <select id="h2hsel">${seasonOptions(sel == null ? 'all' : sel, true, gid)}</select></label></div>${groupSwitcher('h2h', gid)}${banner()}`;
    if (hh.players.length < 2) return h + '<p class="empty">Needs at least two players who shared a table.</p>';
    let mostPlayed = null, closest = null;
    for (let i = 0; i < hh.players.length; i++) {
      for (let j = i + 1; j < hh.players.length; j++) {
        const a = hh.players[i], b = hh.players[j], w = hh.ahead[a][b], l = hh.ahead[b][a], t = w + l;
        if (!t) continue;
        if (!mostPlayed || t > mostPlayed.t) mostPlayed = { a, b, t };
        if (t >= 3) { const gap = Math.abs(w - l); if (!closest || gap < closest.gap || (gap === closest.gap && t > closest.t)) closest = { a, b, w, l, t, gap }; }
      }
    }
    if (mostPlayed || closest) h += `<div class="storyrow">
      ${mostPlayed ? `<div class="story"><span class="slabel">Most played rivalry</span>${link(mostPlayed.a)} and ${link(mostPlayed.b)} have shared <b>${mostPlayed.t}</b> tables</div>` : ''}
      ${closest ? `<div class="story"><span class="slabel">Closest rivalry</span>${link(closest.a)} and ${link(closest.b)} are split <b>${closest.w}–${closest.l}</b></div>` : ''}
      </div>`;
    h += `<div class="tablewrap"><table class="matrix"><thead><tr><th>Row vs column</th>${hh.players.map(n => `<th>${nameIcon(n, 26)}<br>${esc(n)}</th>`).join('')}</tr></thead><tbody>`;
    hh.players.forEach(a => {
      h += `<tr><td>${link(a)}</td>` + hh.players.map(b => {
        if (a === b) return '<td class="self">–</td>';
        const w = hh.ahead[a][b], l = hh.ahead[b][a], t = w + l;
        if (!t) return '<td></td>';
        const r = w / t, col = r >= 0.5 ? 'var(--felt)' : 'var(--brick)', a8 = Math.round(Math.abs(r - 0.5) * 2 * 55);
        return `<td style="background:color-mix(in srgb, ${col} ${a8}%, transparent)" title="${esc(a)} finished ahead of ${esc(b)} ${w} of ${t} times"><b>${pc(r)}</b><br><span class="meta">${w}–${l}</span></td>`;
      }).join('') + '</tr>';
    });
    h += '</tbody></table></div><p class="note">Only rated games where both players sat at the same table. Ties are ignored. Small samples swing wildly, so give any cell under five games a pinch of salt.</p>';
    return h;
  }

  function pageRecords(gid) {
    const R = D.recordsFor(gid), O = R.overview;
    const rec = (label, x, fmt, iconSrc) => `<tr><td class="l">${iconSrc ? `<img class="staticon sm" src="${iconSrc}" alt=""> ` : ''}${label}</td><td class="name">${x ? link(x.name) : '—'}</td><td><b>${x ? fmt(x.value) : ''}</b></td></tr>`;
    let h = `<h1>Records</h1><p class="lede">Everything the league has produced so far.</p>${groupSwitcher('records', gid)}${banner()}`;
    h += `<div class="stats"><div class="stat"><b>${O.tables}</b><span>tables logged</span></div><div class="stat"><b>${O.nights}</b><span>game nights</span></div><div class="stat"><b>${O.playersRated}</b><span>rated players</span></div>
      <div class="stat"><b>${O.avgTable ? f1(O.avgTable) : '—'}</b><span>players per table</span></div><div class="stat"><b>${O.avgMinutes ? f0(O.avgMinutes) : '—'}</b><span>avg minutes</span></div><div class="stat"><b>${O.avgVP ? f1(O.avgVP) : '—'}</b><span>avg winning VP</span></div></div>`;
    h += `<div class="grid2"><div><h2>Player records</h2><div class="tablewrap"><table><thead><tr><th class="l">Record</th><th class="l">Holder</th><th>Value</th></tr></thead><tbody>
      ${rec('Current Elo leader', R.leader, f0, 'icons/stats/elo.png')}${rec('Highest Elo ever', R.peak, f0, 'icons/stats/peak-elo.png')}${rec('Most rated games', R.mostGames, f0, 'icons/stats/rated-games.png')}${rec('Most wins', R.mostWins, f0, 'icons/stats/wins.png')}
      ${rec('Best win % (min ' + D.S.minGamesForRecords + ' games)', R.bestWinPct, pc)}${rec('Best average points (min ' + D.S.minGamesForRecords + ' games)', R.bestAvgPts, f2, 'icons/stats/average-points.png')}${rec('Longest win streak', R.bestStreak, f0, 'icons/stats/win-streak.png')}${rec('Most season titles', R.mostTitles, f0, 'icons/champion.png')}
      </tbody></table></div></div>`;
    const cnt = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    h += `<div><h2>Table sizes</h2><div class="tablewrap"><table><thead><tr><th class="l">Players at the table</th><th>Tables</th></tr></thead><tbody>${Object.entries(R.tableSizes).map(([k, v]) => `<tr><td class="l">${k}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2" class="l">None yet</td></tr>'}</tbody></table></div></div></div>`;
    const winnerOf = g => g.names.filter(n => g.places[n] === 1).join(' & ');
    const grow = (label, who, when, val) => `<tr><td class="l">${label}</td><td class="l">${who}</td><td class="l">${when}</td><td><b>${val}</b></td></tr>`;
    const gr = [];
    if (R.gain) gr.push(grow('Biggest Elo gain in one game', link(R.gain.name), R.gain.date, sgn(R.gain.value)));
    if (R.loss) gr.push(grow('Biggest Elo drop in one game', link(R.loss.name), R.loss.date, sgn(R.loss.value)));
    if (R.bestDry && R.bestDry.value > 1) gr.push(grow('Longest run without a win', link(R.bestDry.name), '', R.bestDry.value + ' games'));
    if (R.topVP) gr.push(grow('Highest winning score', esc(winnerOf(R.topVP.game)), R.topVP.game.date, R.topVP.value + ' VP'));
    if (R.longest) gr.push(grow('Longest game', esc(winnerOf(R.longest.game)) + ' won', R.longest.game.date, R.longest.value + ' min'));
    if (R.shortest) gr.push(grow('Shortest game', esc(winnerOf(R.shortest.game)) + ' won', R.shortest.game.date, R.shortest.value + ' min'));
    if (gr.length) h += `<h2>Single-game records</h2><div class="tablewrap"><table class="plain"><thead><tr><th class="l">Record</th><th class="l">Who</th><th class="l">When</th><th>Value</th></tr></thead><tbody>${gr.join('')}</tbody></table></div>`;
    h += '<h2>Sets in play</h2>' + (R.setsLogged ? `<div class="tablewrap"><table><thead><tr><th class="l">Set</th><th>Games</th><th>Share</th><th>Avg winning VP</th><th>Avg minutes</th></tr></thead><tbody>${cnt(R.sets).map(([k, v]) => { const st = R.setStats[k]; return `<tr><td class="l">${setIcon(k, 20)} ${esc(k)}</td><td>${v}</td><td>${pc(v / R.setsLogged)}</td><td>${st && st.avgVP != null ? f1(st.avgVP) : '—'}</td><td>${st && st.avgMinutes != null ? f0(st.avgMinutes) : '—'}</td></tr>`; }).join('')}</tbody></table></div><p class="note">A game tagged with more than one set counts fully toward each one — the kingdom was mixed, not split.</p>` : '<p class="empty">Fill the sets field when adding a game (separate sets with semicolons).</p>');
    h += `<h2>Season champions</h2><div class="tablewrap"><table><thead><tr><th class="l">Season</th><th class="l">Champion</th><th class="l">Dates</th></tr></thead><tbody>${D.seasons.filter(s => !gid || s.group === gid).map(s => `<tr><td class="l"><a href="${hashFor('season', gid, s.number)}">${esc(s.name)}</a></td><td class="l">${s.champion ? icon('champion', 20, 'Champion') + ' ' + (D.byName[s.champion] ? link(s.champion) : esc(s.champion)) : '<span class="meta">not decided</span>'}</td><td class="l">${s.ok ? Eng.fmtDay(s.start) + ' to ' + Eng.fmtDay(s.end) : ''}</td></tr>`).join('')}</tbody></table></div>`;
    return h;
  }

  function finishText(g) {
    const names = g.names.slice().sort((a, b) => g.places[a] - g.places[b]);
    return names.map((n, i) => (i ? (g.places[n] === g.places[names[i - 1]] ? ' = ' : ' > ') : '') + nameIcon(n, 16) + (i === 0 || g.places[n] === 1 ? `<b>${esc(n)}</b>` : esc(n))).join('');
  }
  function gameDetail(g) {
    const sgn3 = x => (x > 0.0005 ? '+' : x < -0.0005 ? '−' : '') + f3(Math.abs(x));
    const rows = g.names.slice().sort((a, b) => g.places[a] - g.places[b]).map(n => {
      const elo = g.elo && g.elo[n];
      const score = g.score && g.score[n];
      const vp = g.playerVP && g.playerVP[n];
      const d = elo ? elo.after - elo.before : null;
      const sd = score ? score.after - score.before : null;
      return `<tr><td class="name">${link(n)}</td>
        <td>${elo ? f0(elo.before) + ' → ' + f0(elo.after) : '—'}</td>
        <td class="${d > 0.5 ? 'up-t' : d < -0.5 ? 'down-t' : ''}">${d != null ? sgn(d) : ''}</td>
        <td>${score ? f3(score.before) + ' → ' + f3(score.after) : '—'}</td>
        <td class="${sd > 0.0005 ? 'up-t' : sd < -0.0005 ? 'down-t' : ''}">${sd != null ? sgn3(sd) : ''}</td>
        <td>${vp != null ? vp : '—'}</td></tr>`;
    }).join('');
    return `<div class="tablewrap"><table class="plain"><thead><tr><th class="l">Player</th><th>Elo</th><th>Change</th><th>Season score</th><th>Change</th><th>VP</th></tr></thead><tbody>${rows}</tbody></table></div>${g.notes ? `<p class="note">${esc(g.notes)}</p>` : ''}`;
  }
  function gamesTable(list, canEdit) {
    const cols = canEdit ? 9 : 8;
    return `<div class="tablewrap"><table><thead><tr><th></th><th class="l">Date</th><th></th><th class="l">Finish</th><th class="l">Sets</th><th>VP</th><th>Min</th><th class="l">Notes</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${list.map(g => `<tr class="grow" data-g="${g.line}"><td class="chev">▸</td><td class="l">${g.date}</td><td>${typePill(g.type)}</td><td class="wrap">${finishText(g)}</td><td class="wrap">${g.sets.map(s => setIcon(s, 22) || esc(s)).join(' ')}</td><td>${g.vp ?? ''}</td><td>${g.minutes ?? ''}</td><td class="wrap">${esc(g.notes)}</td>${canEdit ? `<td><a href="#" data-edit="${g.line}" onclick="event.stopPropagation()">Edit</a></td>` : ''}</tr><tr class="gdetail" data-g="${g.line}" hidden><td colspan="${cols}">${gameDetail(g)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const gf = { season: 'all', type: 'all', player: 'all', set: 'all' };
  function pageGames(gid) {
    let list = D.games.filter(g => (!gid || g.names.every(n => D.groupOf(n) === gid)) &&
      (gf.season === 'all' || String(g.season) === gf.season) && (gf.type === 'all' || g.type === gf.type) && (gf.player === 'all' || g.places[gf.player] != null) && (gf.set === 'all' || g.sets.includes(gf.set))).slice().reverse();
    const canEdit = !!(me && me.is_admin);
    return `<div class="head"><div><h1>Games</h1><p class="lede">Every table we've logged, newest first. Winners in bold.</p></div>${canEdit ? '<button id="gAddBtn" class="iconbtn" type="button"><img src="icons/nav/add-a-game.png" alt="Add a game"></button>' : ''}</div>${groupSwitcher('games', gid)}${banner()}
      <div class="controls"><label class="f">Season <select id="gfs">${seasonOptions(gf.season, true, gid)}</select></label>
      <label class="f">Type <select id="gft">${['all', 'Regular', 'Playoff', 'Friendly'].map(t => `<option value="${t}"${gf.type === t ? ' selected' : ''}>${t === 'all' ? 'All types' : t}</option>`).join('')}</select></label>
      <label class="f">Player <select id="gfp"><option value="all">Everyone</option>${D.players.filter(p => !gid || D.groupOf(p.name) === gid).map(p => `<option${gf.player === p.name ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="f">Set <select id="gfset"><option value="all">All sets</option>${SET_NAMES.map(n => `<option${gf.set === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <span class="meta">${list.length} table${list.length === 1 ? '' : 's'}</span></div>` +
      (list.length ? gamesTable(list, canEdit) : '<p class="empty">Nothing matches those filters.</p>');
  }

  /* ---------- add / edit a game (admin only) ---------- */
  const blankBS = () => ({ date: '', type: '', picked: [], tie: {}, sets: [], vp: {}, minutes: '', notes: '', editId: null });
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
      sets: g.sets.slice(), vp: Object.assign({}, g.playerVP), minutes: g.minutes || '', notes: g.notes, editId,
    };
  }
  function addFormHTML() {
    const roster = D.roster.slice().sort((a, b) => a.localeCompare(b));
    return `<h2 style="margin-top:0">${bs.editId ? 'Edit game' : 'Add a game'}</h2><p class="lede">${bs.editId ? 'Change the details and save.' : 'Pick who played, in finishing order, and save.'}</p>
      <div class="controls"><label class="f">Date <input type="date" id="bd" value="${esc(bs.date)}"></label>
      <label class="f">Type <select id="bty">${['', 'Playoff', 'Friendly'].map(t => `<option value="${t}"${bs.type === t ? ' selected' : ''}>${t || 'Regular'}</option>`).join('')}</select></label></div>
      <p class="meta">1. Click the players in the order they finished, winner first.</p><div class="pills" id="bpick">${roster.map(n => `<a href="#" data-n="${esc(n)}" ${bs.picked.includes(n) ? 'aria-current="true"' : ''}>${nameIcon(n, 18)}${esc(n)}</a>`).join('')}</div>
      <p class="meta">2. Tick "tied" if a player finished level with the one above, and fill in VP if you tracked it.</p>
      <ol class="order" id="border">${bs.picked.map((n, i) => `<li><span class="nm">${i + 1}. ${esc(n)}</span><button class="ghost" data-up="${i}" type="button" aria-label="Move ${esc(n)} up"${i === 0 ? ' disabled' : ''}>↑</button><button class="ghost" data-dn="${i}" type="button" aria-label="Move ${esc(n)} down"${i === bs.picked.length - 1 ? ' disabled' : ''}>↓</button><label class="f">VP <input type="text" data-vp="${esc(n)}" size="3" value="${esc(bs.vp[n] ?? '')}"></label>${i ? `<label class="f"><input type="checkbox" data-tie="${esc(n)}"${bs.tie[n] ? ' checked' : ''}> tied with above</label>` : ''}</li>`).join('') || '<li class="meta">No players chosen yet.</li>'}</ol>
      ${previewBlock()}
      <p class="meta">3. Which expansions were in play?</p><div class="pills" id="bsets">${SET_NAMES.filter(n => enabledSets.has(n) || bs.sets.includes(n)).map(n => `<a href="#" data-n="${esc(n)}" ${bs.sets.includes(n) ? 'aria-current="true"' : ''}>${setIcon(n, 18)}${esc(n)}</a>`).join('')}</div>
      <p class="meta" style="margin-top:14px">4. Optional details.</p><div class="controls">
      <label class="f">Minutes <input type="text" id="bm" size="4" value="${esc(bs.minutes)}"></label></div>
      <label class="f">Notes <input type="text" id="bn" size="50" value="${esc(bs.notes)}"></label>
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
    root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" tabindex="-1">
      <button class="modal-close" id="modalClose" type="button" aria-label="Close">×</button>
      ${addFormHTML()}</div></div>`;
    document.body.style.overflow = 'hidden';
    wireAdd();
    $('#modalClose').addEventListener('click', closeAddModal);
    $('#modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeAddModal(); });
    document.addEventListener('keydown', modalEscHandler);
    const box = $('.modal-box'); if (box) box.focus();
  }
  function openAddModal(editId) {
    if (!me || !me.is_admin) return;
    if (editId == null) bs = blankBS(); else loadGameIntoBuilder(editId);
    renderAddModal();
  }
  function wireAdd() {
    const rer = () => renderAddModal();
    const bind = (id, k) => { const el = $(id); el && el.addEventListener('input', () => { bs[k] = el.value; }); };
    bind('#bd', 'date'); bind('#bty', 'type'); bind('#bm', 'minutes'); bind('#bn', 'notes');
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
    const order = $('#border');
    order && order.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const up = b.dataset.up, dn = b.dataset.dn, p = bs.picked;
      if (up != null) { const i = +up; [p[i - 1], p[i]] = [p[i], p[i - 1]]; }
      if (dn != null) { const i = +dn; [p[i + 1], p[i]] = [p[i], p[i + 1]]; }
      rer();
    });
    order && order.addEventListener('change', e => { const t = e.target.dataset.tie; if (t) bs.tie[t] = e.target.checked; });
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
        p_winner_vp: null, p_minutes: bs.minutes ? +bs.minutes : null, p_notes: bs.notes || null,
        p_results: results,
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
    const s = i >= 0 ? D.seasons[i] : null;
    if (!s) { sform = blankSeasonForm(); return; }
    sform = {
      editId, group_id: s.group || '', name: s.name, start_date: s.ok ? Eng.fmtDay(s.start) : '',
      weeks: s.weeks || '', target_games: s.target || '', qualify_pct: s.pct ?? '', playoff_spots: s.spots || '',
      champion_player_id: s.champion ? (playerIdByName.get(s.champion) || '') : '', notes: s.notes || '',
    };
  }
  const blankPlayerForm = () => ({ name: '', group_id: '' });
  let pform = blankPlayerForm();
  function pageAdmin(gid, arg) {
    if (!me || !me.is_admin) return '<h1>Admin</h1><p class="empty">Only the admin can manage groups and seasons.</p>';
    const m = /^season\/edit\/(\d+)$/.exec(arg || '');
    const editId = m ? +m[1] : null;
    if (editId !== sform.editId) { if (editId == null) sform = blankSeasonForm(); else loadSeasonIntoForm(editId); }
    if (!sform.editId && !sform.group_id && D.groups.length) sform.group_id = D.groups[0].id;
    if (!pform.group_id && D.groups.length) pform.group_id = D.groups[0].id;

    let h = '<h1>Admin</h1><p class="lede">Manage friend groups and seasons.</p>';

    h += '<h2>Players</h2>';
    h += D.groups.length
      ? `<div class="builder"><div class="controls">
        <label class="f">New player's name <input type="text" id="pfName" value="${esc(pform.name)}"></label>
        <label class="f">Group <select id="pfGroup">${D.groups.map(g => `<option value="${esc(g.id)}"${pform.group_id === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
        <button id="pfSave" type="button">Add player</button><span class="meta" id="pfMsg" role="status"></span></div>
        <p class="note">Creates their account with the preset password <code>dominion</code> — tell them their name and that password, and they'll set a real one on first sign-in.</p></div>`
      : '<p class="empty">Create a group below first.</p>';

    h += '<h2>Sets</h2><div class="builder"><p class="note" style="margin-top:0">Untick a set you don\'t currently own — it disappears from the Add A Game picker. Games already logged with it are unaffected.</p><div class="controls" id="setsToggle">' +
      SET_NAMES.map(n => `<label class="f"><input type="checkbox" data-set="${esc(n)}"${enabledSets.has(n) ? ' checked' : ''}> ${setIcon(n, 18)}${esc(n)}</label>`).join('') +
      '</div><span class="meta" id="setsMsg" role="status"></span></div>';

    h += '<h2>Groups</h2>';
    h += D.groups.length
      ? `<div class="tablewrap"><table class="plain"><thead><tr><th class="l">Name</th><th class="l">Id</th></tr></thead><tbody>${D.groups.map(g => `<tr><td class="l">${esc(g.name)}</td><td class="l"><code>${esc(g.id)}</code></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="empty">No groups yet.</p>';
    h += `<div class="builder" style="margin-top:12px"><div class="controls">
      <label class="f">New group name <input type="text" id="gfName" value="${esc(gform.name)}"></label>
      <button id="gfSave" type="button">Add group</button><span class="meta" id="gfMsg" role="status"></span></div>
      <p class="note">Id will be <code>${esc(slugify(gform.name) || '…')}</code> — that's what you'll type as a player's group_id in Supabase when adding them.</p></div>`;

    h += '<h2>Seasons</h2>';
    h += D.seasons.length
      ? `<div class="tablewrap"><table class="plain"><thead><tr><th class="l">Name</th><th class="l">Group</th><th class="l">Dates</th><th class="l">Champion</th><th></th></tr></thead><tbody>${D.seasons.map((s, i) => {
          const gname = (D.groups.find(g => g.id === s.group) || {}).name || s.group || '—';
          return `<tr><td class="l">${esc(s.name)}</td><td class="l">${esc(gname)}</td><td class="l">${s.ok ? Eng.fmtDay(s.start) + ' to ' + Eng.fmtDay(s.end) : '—'}</td><td class="l">${esc(s.champion) || '—'}</td><td><a href="#/admin/season/edit/${seasonDbIds[i]}">Edit</a></td></tr>`;
        }).join('')}</tbody></table></div>`
      : '<p class="empty">No seasons yet.</p>';

    if (!D.groups.length) return h + '<p class="empty">Create a group above before adding a season.</p>';

    const championRoster = sform.group_id ? D.roster.filter(n => D.groupOf(n) === sform.group_id) : [];
    h += `<div class="builder" style="margin-top:12px"><h3 style="margin-top:0">${sform.editId ? 'Edit season' : 'Add a season'}</h3>
      <div class="controls">
      <label class="f">Group <select id="sfGroup">${D.groups.map(g => `<option value="${esc(g.id)}"${sform.group_id === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
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
    const pGroup = $('#pfGroup');
    pGroup && pGroup.addEventListener('change', () => { pform.group_id = pGroup.value; });
    const pMsg = t => { const el = $('#pfMsg'); if (el) el.textContent = t; };
    const pSave = $('#pfSave');
    pSave && pSave.addEventListener('click', async () => {
      const name = (pform.name || '').trim();
      if (!name) { pMsg('Type a name first.'); return; }
      if (!pform.group_id) { pMsg('Pick a group first.'); return; }
      pSave.disabled = true; pMsg('Creating…');
      const { data, error } = await sb.functions.invoke('create-player', { body: { name, group_id: pform.group_id } });
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

    const gName = $('#gfName');
    gName && gName.addEventListener('input', () => { gform.name = gName.value; render(); });
    const gMsg = t => { const el = $('#gfMsg'); if (el) el.textContent = t; };
    const gSave = $('#gfSave');
    gSave && gSave.addEventListener('click', async () => {
      const name = (gform.name || '').trim(), id = slugify(name);
      if (!name || !id) { gMsg('Type a name first.'); return; }
      if (D.groups.some(g => g.id === id)) { gMsg('A group with that id already exists.'); return; }
      gSave.disabled = true; gMsg('Saving…');
      const { error } = await sb.from('groups').insert({ id, name });
      gSave.disabled = false;
      if (error) { gMsg(error.message); return; }
      gform = blankGroupForm();
      await boot();
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

  /* ---------- auth screens ---------- */
  function pageLogin(err) {
    return `<div class="builder" style="max-width:360px;margin:60px auto 0"><h1 style="font-size:28px">Sign in</h1>
      <p class="lede">${esc((cfg && cfg.title) || 'Dominion Night')}</p>
      ${err ? `<p class="note" style="color:var(--brick)">${esc(err)}</p>` : ''}
      <div class="controls" style="flex-direction:column;align-items:stretch">
        <label class="f">Name <input type="text" id="liName" autocomplete="username"></label>
        <label class="f">Password <input type="password" id="liPw" autocomplete="current-password"></label>
      </div>
      <button id="liGo" type="button">Sign in</button></div>`;
  }
  function wireLogin() {
    const go = async () => {
      const name = ($('#liName').value || '').trim(), pw = $('#liPw').value;
      if (!name || !pw) return;
      const email = slugify(name) + '@dominion.local';
      $('#liGo').disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) { main.innerHTML = pageLogin('Could not sign in. Check the name and password.'); wireLogin(); return; }
      boot();
    };
    $('#liGo').addEventListener('click', go);
    $('#liPw').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }
  function pagePwChange(err) {
    return `<div class="builder" style="max-width:360px;margin:60px auto 0"><h1 style="font-size:28px">Set a password</h1>
      <p class="lede">Signed in as ${esc(me.name)}. Pick a new password — the one you used to sign in just now was only a placeholder.</p>
      ${err ? `<p class="note" style="color:var(--brick)">${esc(err)}</p>` : ''}
      <div class="controls" style="flex-direction:column;align-items:stretch">
        <label class="f">New password <input type="password" id="pwNew" autocomplete="new-password"></label>
        <label class="f">Confirm <input type="password" id="pwConf" autocomplete="new-password"></label>
      </div>
      <button id="pwGo" type="button">Save and continue</button></div>`;
  }
  function wirePwChange() {
    $('#pwGo').addEventListener('click', async () => {
      const a = $('#pwNew').value, b = $('#pwConf').value;
      if (a.length < 8) { main.innerHTML = pagePwChange('Use at least 8 characters.'); wirePwChange(); return; }
      if (a !== b) { main.innerHTML = pagePwChange('Passwords do not match.'); wirePwChange(); return; }
      $('#pwGo').disabled = true;
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) { main.innerHTML = pagePwChange(error.message); wirePwChange(); return; }
      await sb.rpc('mark_password_changed');
      boot();
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
          // Expandable game rows (gamesTable) pair each .grow summary row with
          // a sibling .gdetail row sharing the same data-g — sort only the
          // summary rows, then re-attach each one's detail row right after it,
          // so an expanded game's detail stays with it instead of scattering
          // to wherever its near-empty colspan cell happens to sort.
          const rows = [...t.tBodies[0].rows].filter(r => !r.classList.contains('gdetail'));
          rows.sort((ra, rb) => {
            const x = val(ra, ci), y = val(rb, ci);
            const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
            return dir === 'asc' ? r : -r;
          });
          rows.forEach(r => {
            t.tBodies[0].appendChild(r);
            const det = r.dataset.g != null ? t.tBodies[0].querySelector(`tr.gdetail[data-g="${r.dataset.g}"]`) : null;
            if (det) t.tBodies[0].appendChild(det);
          });
        };
        th.addEventListener('click', go);
        th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    });
  }

  /* ---------- router ---------- */
  function render() {
    if (!D) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'home';
    const multi = D.groups.length > 1;
    const gid = multi ? (parts[1] || (D.groups[0] && D.groups[0].id)) : null;
    const arg = (multi ? parts.slice(2) : parts.slice(1)).join('/');
    curGid = gid;
    closeAddModal();
    hidePopLayer();
    closeNavMenu();
    const pages = { home: pageHome, season: pageSeason, players: pagePlayers, h2h: pageH2H, records: pageRecords, games: pageGames, admin: pageAdmin };
    const fn = pages[route] || pageHome;
    main.innerHTML = fn(gid, arg);
    makeSortable(main);
    wireGameRows(main);
    document.querySelectorAll('#nav a').forEach(a => { if (a.dataset.r === (pages[route] ? route : 'home')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = (route === 'home' ? '' : route.charAt(0).toUpperCase() + route.slice(1) + ' · ') + (cfg.title || 'Dominion Night');
    if (route === 'home' || route === 'players') wireHighlight(main);
    if (route === 'players') wireHoverPopups(main);
    if (route === 'admin') wireAdmin();
    const hs = $('#h2hsel'); if (hs) hs.addEventListener('change', () => { location.hash = hashFor('h2h', curGid, hs.value); });
    [['#gfs', 'season'], ['#gft', 'type'], ['#gfp', 'player'], ['#gfset', 'set']].forEach(([id, k]) => { const el = $(id); if (el) el.addEventListener('change', () => { gf[k] = el.value; render(); const again = $(id); if (again) again.focus(); }); });
  }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ---------- auth / data boot ---------- */
  // Mobile hamburger: #navToggle/#nav live in the static index.html shell,
  // never touched by render()'s main.innerHTML swap, so this is wired once
  // rather than per-render. closeNavMenu() runs on every route change so
  // tapping a link collapses the menu back instead of leaving it open.
  function closeNavMenu() {
    const nav = $('#nav'), btn = $('#navToggle');
    if (nav) nav.classList.remove('nav-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function wireNavToggle() {
    const btn = $('#navToggle'), nav = $('#nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  function setNavVisible(show) {
    $('#nav').style.display = show ? '' : 'none';
    const toggle = $('#navToggle'); if (toggle) toggle.style.display = show ? '' : 'none';
    const isAdmin = show && me && me.is_admin;
    const adminLink = document.querySelector('#nav a[data-r="admin"]');
    if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
    const nu = $('#navuser');
    if (nu) {
      nu.innerHTML = show && me ? `<span>${esc(me.name)}</span><a href="#" id="logoutLink">Log out</a>` : '';
      const lo = $('#logoutLink');
      if (lo) lo.addEventListener('click', async e => { e.preventDefault(); await sb.auth.signOut(); });
    }
  }

  async function loadData() {
    const [pr, gr, rr, grp, sr, stg] = await Promise.all([
      sb.from('players').select('*'),
      sb.from('games').select('*'),
      sb.from('game_results').select('*'),
      sb.from('groups').select('*'),
      sb.from('seasons').select('*'),
      sb.from('settings').select('*').maybeSingle(),
    ]);
    if (pr.error) throw pr.error;
    if (gr.error) throw gr.error;
    if (rr.error) throw rr.error;
    if (grp.error) throw grp.error;
    if (sr.error) throw sr.error;
    // Missing row/table (e.g. schema.sql not yet re-run) just means every
    // known set is treated as owned — never blocks the rest of the site.
    const enabled = stg.data && stg.data.enabled_sets ? stg.data.enabled_sets : SET_NAMES;
    const nameById = new Map(pr.data.map(p => [p.id, p.name]));
    const byGame = new Map();
    rr.data.forEach(r => { if (!byGame.has(r.game_id)) byGame.set(r.game_id, []); byGame.get(r.game_id).push(r); });
    const rows = gr.data.map(g => {
      const byPlace = new Map();
      const playerVP = {};
      (byGame.get(g.id) || []).forEach(r => {
        const nm = nameById.get(r.player_id); if (!nm) return;
        if (!byPlace.has(r.place)) byPlace.set(r.place, []);
        byPlace.get(r.place).push(nm);
        if (r.vp != null) playerVP[nm] = r.vp;
      });
      const finish = [...byPlace.keys()].sort((a, b) => a - b).map(p => byPlace.get(p).join(' = ')).join(' > ');
      return {
        _line: g.id, date: g.date, type: g.type, finish,
        sets: g.sets || '', playerVP,
        winner_vp: g.winner_vp ?? '', minutes: g.minutes ?? '', notes: g.notes || '',
      };
    });
    const byGroup = new Map();
    pr.data.forEach(p => { if (!byGroup.has(p.group_id)) byGroup.set(p.group_id, []); byGroup.get(p.group_id).push(p.name); });
    const seasonRows = sr.data.slice().sort((a, b) => a.id - b.id).map(s => ({
      _id: s.id, name: s.name, group: s.group_id, start: s.start_date, weeks: s.weeks,
      targetGames: s.target_games, qualifyPct: s.qualify_pct, playoffSpots: s.playoff_spots,
      champion: s.champion_player_id ? (nameById.get(s.champion_player_id) || '') : '', notes: s.notes || '',
    }));
    return { rows, players: pr.data, byGroup, groups: grp.data, seasons: seasonRows, enabledSets: enabled };
  }

  let authWired = false;
  async function boot() {
    try {
      if (!cfg) {
        const res = await fetch('data/config.json?v=' + Date.now());
        if (!res.ok) throw new Error('Could not load data/config.json (' + res.status + ').');
        cfg = await res.json();
      }
      if (!authWired) {
        authWired = true;
        sb.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT' && D) { D = null; me = null; location.hash = ''; boot(); } });
      }

      const { data: { session } } = await sb.auth.getSession();
      if (!session) { main.innerHTML = pageLogin(); wireLogin(); setNavVisible(false); return; }

      const { data: meRow, error: meErr } = await sb.from('players').select('*').eq('id', session.user.id).single();
      if (meErr || !meRow) {
        await sb.auth.signOut();
        main.innerHTML = pageLogin('That account isn’t set up yet. Ask the admin to add you.');
        wireLogin(); setNavVisible(false); return;
      }
      me = meRow;
      if (me.must_change_password) { main.innerHTML = pagePwChange(); wirePwChange(); setNavVisible(false); return; }

      const { rows, players, byGroup, groups, seasons, enabledSets: enabled } = await loadData();
      enabledSets = new Set(enabled);
      playerIdByName = new Map(players.map(p => [p.name, p.id]));
      seasonDbIds = seasons.map(s => s._id);
      const knownGroupIds = new Set(groups.map(g => g.id));
      const unknownGroupIds = [...byGroup.keys()].filter(id => !knownGroupIds.has(id));
      cfg.groups = groups.map(g => ({ id: g.id, name: g.name, players: byGroup.get(g.id) || [] }));
      cfg.seasons = seasons;
      cfg.players = players.map(p => p.name);
      D = Eng.compute(cfg, rows);
      D.byName = Object.fromEntries(D.players.map(p => [p.name, p]));
      unknownGroupIds.forEach(id => D.warnings.push(`${byGroup.get(id).length} player(s) have group_id "${id}", which isn't a group in the database. They won't appear on any group's pages until one is added on the Admin page.`));
      $('#foot').textContent = 'Ratings are recalculated in your browser each time the page loads.';
      setNavVisible(true);
      render();
    } catch (e) {
      main.innerHTML = `<h1>Can't load the data</h1><p class="lede">${esc(e.message || String(e))}</p>`;
    }
  }
  wireNavToggle();
  boot();
})();
