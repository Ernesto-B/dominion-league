/* Dominion Night engine: pure computation, no DOM. ES module: works in the browser (via Vite) and in Node.
   Scoped to a single league: app.js calls compute() once per friend group
   (each time with only that group's players/games/seasons), so a player who
   belongs to two groups gets two completely independent results — separate
   Elo, separate everything — not one blended number filtered two ways. */
import { finishScores } from './steadyElo.js';

const DAY = 86400000;

function parseISO(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return isNaN(t) ? null : Math.round(t / DAY);
}
function fmtDay(d) { return new Date(d * DAY).toISOString().slice(0, 10); }
function todayDay() { const n = new Date(); return Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY); }

/* ---------- CSV ---------- */
function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const out = rows.filter(r => r.some(x => x.trim() !== '') && !String(r[0]).trim().startsWith('#'));
  if (!out.length) return [];
  const head = out[0].map(h => h.trim().toLowerCase());
  return out.slice(1).map((r, i) => {
    const o = { _line: i + 2 };
    head.forEach((h, j) => { o[h] = (r[j] || '').trim(); });
    return o;
  });
}

/* "Jose > Ernesto = Bassim" -> groups [[Jose],[Ernesto,Bassim]] */
function parseFinish(s) {
  const groups = String(s || '').split('>').map(g => g.split('=').map(x => x.trim()).filter(Boolean)).filter(g => g.length);
  return groups;
}

const DEFAULT_TIERS = [
  { id: 'peasant', name: 'Peasant', min: null },
  { id: 'knight', name: 'Knight', min: 1250 },
  { id: 'lord', name: 'Lord', min: 1550 },
  { id: 'duke', name: 'Duke', min: 1950 },
  { id: 'emperor', name: 'Emperor', min: 2400 },
];
function roundUp9(x) { return Math.ceil(+x.toFixed(9)); }

/* ---------- main ---------- */
function compute(config, csvRows, today) {
  config = config || {};
  today = today == null ? todayDay() : today;
  // model 'classic' = the original pairwise Elo (what the spreadsheet verified); 'steady' = the points-per-finish system of steadyElo.js,
  // whose weights (linear, topHalf, middle, win, target) may also be set here.
  const E = Object.assign({ k: 200, provisionalK: 300, provisionalGames: 10, start: 1000, scale: 400, model: 'classic' }, config.elo || {});
  const steady = E.model === 'steady';
  // streakBonus / vpWeight shape a Regular game's season points (both 0 = the plain finishing points); see g.sp below
  const S = Object.assign({ prior: 3, minGamesForRecords: 5, streakBonus: 0, streakCap: 3, vpWeight: 0 }, config.season || {});
  const warnings = [];
  const tiers = (Array.isArray(config.tiers) && config.tiers.length ? config.tiers : DEFAULT_TIERS)
    .map(t => ({ id: t.id, name: t.name || t.id, icon: t.icon || t.id, min: t.min == null ? -Infinity : +t.min }))
    .sort((a, b) => a.min - b.min);
  const tierIndex = elo => { let k = 0; tiers.forEach((t, i) => { if (Math.round(elo) >= t.min) k = i; }); return k; };
  // Exposed so a game row can show the tier a player actually had at that
  // point in time (from that game's own Elo snapshot) instead of their
  // tier right now — otherwise every past game would silently show
  // today's tier and a rank-up would be invisible in the history.
  const tierFor = elo => tiers[tierIndex(elo)];
  // Demotion grace: a player's SHOWN tier is not purely a function of their Elo. Dropping under the threshold of the tier they hold keeps the tier for
  // `demotionGrace` rated games (default 0 = off); if their Elo is back at or over the line after any of them, the grace is forgotten, otherwise they
  // fall to the tier their Elo gives. The Elo itself is never touched. See `held` / `below` in the game loop.
  const grace = Math.max(0, Math.floor(+E.demotionGrace || 0));
  // Saving Grace: a player in that grace who then finishes in the top half gets this share of what they lost in their previous rated game, on top (0 = off)
  const saving = Math.max(0, +E.savingGrace || 0);
  const rosterKey = new Map();   // lowercase -> display name
  const roster = [];
  function canon(name) {
    const k = name.toLowerCase();
    if (!rosterKey.has(k)) { rosterKey.set(k, name); roster.push(name); }
    return rosterKey.get(k);
  }
  (config.players || []).forEach(n => canon(String(n)));

  /* seasons */
  const seasons = (config.seasons || []).map((s, i) => {
    const start = parseISO(s.start);
    const weeks = +s.weeks || 0;
    const target = +s.targetGames || 0;
    const pct = s.qualifyPct == null ? 0.6 : +s.qualifyPct;
    const ok = start != null && weeks > 0;
    const end = ok ? start + 7 * weeks - 1 : null;
    return {
      number: i + 1, name: s.name || ('Season ' + (i + 1)), start, end, weeks, target, pct, ok,
      minGames: Math.max(1, roundUp9(target * pct)), spots: +s.playoffSpots || 0,
      champion: s.champion || '', notes: s.notes || '', group: s.group || null,
      status: !ok ? 'Not set up' : today < start ? 'Upcoming' : today > end ? 'Complete' : 'In progress',
      weeksLeft: ok && today >= start && today <= end ? Math.ceil((end - today + 1) / 7) : null,
    };
  });
  seasons.forEach((s, i) => {
    const prev = seasons.slice(0, i).reverse().find(x => x.group === s.group);
    if (prev && s.ok && prev.ok && s.start <= prev.end)
      warnings.push(`${s.name} starts before ${prev.name} ends. Seasons should not overlap.`);
  });
  const seasonOf = d => { for (const s of seasons) if (s.ok && s.start <= d && d <= s.end) return s.number; return null; };

  /* games */
  let games = [];
  (csvRows || []).forEach(r => {
    const line = r._line;
    const day = parseISO(r.date);
    if (day == null) { warnings.push(`games.csv line ${line}: date "${r.date || ''}" should look like 2026-10-08. Row skipped.`); return; }
    const groups = parseFinish(r.finish);
    const seen = new Set(); const places = {}; let pos = 1, dup = false;
    groups.forEach(g => {
      g.forEach(nm => {
        const c = canon(nm);
        if (seen.has(c)) dup = true;
        seen.add(c); places[c] = pos;
      });
      pos += g.length;
    });
    if (dup) { warnings.push(`games.csv line ${line}: a player is listed twice. Row skipped.`); return; }
    const names = Object.keys(places);
    if (names.length < 2) warnings.push(`games.csv line ${line}: needs at least 2 players, so it won't affect any rating.`);
    let type = (r.type || '').trim().toLowerCase();
    type = type === 'playoff' ? 'Playoff' : type === 'friendly' ? 'Friendly' : 'Regular';
    if (r.type && !['regular', 'playoff', 'friendly'].includes(r.type.trim().toLowerCase()))
      warnings.push(`games.csv line ${line}: type "${r.type}" is not Regular, Playoff or Friendly. Treated as Regular.`);
    // Per-player VP, keyed by canon name so case differences can't split one
    // player into two entries. Falls back to the legacy single winner_vp
    // field (pre-per-player-VP games) when no player-level value is given.
    const playerVP = {};
    Object.entries(r.playerVP || {}).forEach(([nm, v]) => { if (v != null && v !== '') playerVP[canon(nm)] = +v; });
    const winnerName = names.find(nm => places[nm] === 1);
    const vp = winnerName && playerVP[winnerName] != null ? playerVP[winnerName] : (r.winner_vp ? +r.winner_vp : null);
    games.push({
      line, day, date: fmtDay(day), type, places, names, n: names.length,
      sets: (r.sets || '').split(/[;|]/).map(x => x.trim()).filter(Boolean),
      landscapes: (r.landscapes || '').split(/[;|]/).map(x => x.trim()).filter(Boolean),
      vp, playerVP, minutes: r.minutes ? +r.minutes : null,
      notes: r.notes || '', season: seasonOf(day),
      savedAt: r.savedAt || null, startedAt: r.startedAt || null, endedAt: r.endedAt || null,   // when it was logged / the match began and ended (display only, never read by the maths)
      kingdom: r.kingdom || [],   // [{kind: 'card'|'landscape', id, on?}] — catalog ids, display only (the Elo maths never reads it)
    });
  });
  games = games.map((g, i) => ({ g, i })).sort((a, b) => a.g.day - b.g.day || a.i - b.i).map(x => x.g);
  games.forEach((g, i) => { g.idx = i; });

  /* per-player containers */
  const P = {};
  const ensure = n => P[n] || (P[n] = {
    name: n, elo: E.start, peak: E.start, rated: 0, wins: 0, ptsSum: 0, streak: 0, bestStreak: 0, dry: 0, bestDry: 0, allGames: 0,
    history: [], results: [],
  });
  roster.forEach(ensure);

  const rated = g => g.n >= 2 && g.type !== 'Friendly';
  const avgPts = (g, name) => {
    const p = g.places[name], ties = g.names.filter(x => g.places[x] === p).length;
    return (g.n - (p + (ties - 1) / 2)) / (g.n - 1);
  };

  /* Elo, game by game */
  const cur = {};
  roster.forEach(n => cur[n] = E.start);
  const lastLoss = {};   // what each player lost in their latest rated game (0 if they gained)
  const held = {}, below = {};   // the tier index each player is shown at, and how many games in a row they have sat under it
  roster.forEach(n => { held[n] = tierIndex(E.start); below[n] = 0; });
  const settle = (n, elo) => {
    const raw = tierIndex(elo);
    if (raw >= (held[n] ?? 0)) { held[n] = raw; below[n] = 0; } else if (++below[n] > grace) { held[n] = raw; below[n] = 0; }
  };
  games.forEach(g => {
    g.pts = {}; g.elo = {};
    if (g.n >= 2) g.names.forEach(nm => { g.pts[nm] = avgPts(g, nm); });
    if (rated(g)) {
      const next = {}, bonus = {};
      const scores = steady ? finishScores(g.names.map(nm => g.places[nm]), E) : null;
      g.names.forEach((a, ai) => {
        const pa = ensure(a);
        let tot = 0, sumE = 0;
        g.names.forEach(b => {
          if (a === b) return;
          const act = g.places[b] > g.places[a] ? 1 : g.places[b] === g.places[a] ? 0.5 : 0;
          const e = 1 / (1 + Math.pow(10, ((cur[b] ?? E.start) - (cur[a] ?? E.start)) / E.scale));
          tot += act - e; sumE += e;
        });
        const k = pa.rated < E.provisionalGames ? E.provisionalK : E.k;
        next[a] = (cur[a] ?? E.start) + (steady ? k * (scores[ai] - sumE / (g.n - 1)) : k / (g.n - 1) * tot);
        bonus[a] = (below[a] || 0) > 0 && g.pts[a] >= 0.5 ? saving * (lastLoss[a] || 0) : 0;
        next[a] += bonus[a];
      });
      g.names.forEach(a => {
        const pa = ensure(a);
        if (!(a in held)) { held[a] = tierIndex(E.start); below[a] = 0; }
        const tierBefore = tiers[held[a]];
        g.elo[a] = { before: cur[a] ?? E.start, after: next[a] };
        cur[a] = next[a];
        lastLoss[a] = Math.max(0, g.elo[a].before - next[a]);
        if (bonus[a] > 0) g.elo[a].saving = bonus[a];
        settle(a, next[a]);
        g.elo[a].tierBefore = tierBefore; g.elo[a].tierAfter = tiers[held[a]]; g.elo[a].held = below[a] > 0;
        pa.rated++; pa.ptsSum += g.pts[a];
        const won = g.places[a] === 1;
        if (won) { pa.wins++; pa.streak++; pa.bestStreak = Math.max(pa.bestStreak, pa.streak); pa.dry = 0; } else { pa.streak = 0; pa.dry++; pa.bestDry = Math.max(pa.bestDry, pa.dry); }
        pa.peak = Math.max(pa.peak, next[a]);
        pa.results.push({ game: g, place: g.places[a], pts: g.pts[a], before: g.elo[a].before, after: next[a] });
      });
    }
    g.names.forEach(a => { const p = ensure(a); if (g.n >= 2) p.allGames++; });
    g.snapshot = Object.assign({}, cur);
    g.tierSnap = {}; Object.keys(cur).forEach(n => { g.tierSnap[n] = tiers[held[n] ?? tierIndex(cur[n])]; });   // each player's shown tier right after this game
  });
  Object.keys(cur).forEach(n => { P[n].elo = cur[n]; });

  /* running season score before/after each Regular game, per player, per
     season — mirrors g.elo[name] = {before, after} exactly, same formula
     seasonStandings() uses, so a player's last g.score[name].after for a
     season always equals their final seasonStandings() score by construction. */
  /* A Regular game's SEASON points per player (g.sp):
       - finish points (1 for a win down to 0 for last), blended with each player's share of the winner's VP when vpWeight > 0:
           sp = (1 - vpWeight) x finish points + vpWeight x (your VP / the winner's VP)
         so with 0.3 a win is still worth 1, and a loss by 38 to 41 keeps most of that 30% instead of getting nothing. It is a RATIO to the
         winner, so a Prosperity game won 80-60 counts the same as a Base game won 40-30. It needs everyone's VP and is skipped (plain
         finish points) for a game missing any; negative VP counts as zero;
       - plus, when streakBonus > 0, a win-streak bonus: streakBonus x the wins in a row beyond the first, counted within the season and
         capped at streakCap (0.04 and 3: 2nd straight win +0.04, 3rd +0.08, 4th and on +0.12); any non-win resets it.
     With both settings at 0, g.sp[name] === g.pts[name] exactly. g.pts itself (average finish, used all over the site) is never changed. */
  const winRun = {};   // `${name}|${seasonNum}` -> consecutive wins so far
  games.forEach(g => {
    g.sp = {};
    if (g.type !== 'Regular' || g.n < 2 || g.season == null) return;
    const top = Math.max(...g.names.map(n => g.playerVP[n] ?? -Infinity));
    const useVP = S.vpWeight > 0 && top > 0 && g.names.every(n => g.playerVP[n] != null);
    g.names.forEach(a => {
      const key = a + '|' + g.season;
      winRun[key] = g.places[a] === 1 ? (winRun[key] || 0) + 1 : 0;
      const share = useVP ? Math.min(1, Math.max(0, g.playerVP[a] / top)) : 0;
      const base = useVP ? (1 - S.vpWeight) * g.pts[a] + S.vpWeight * share : g.pts[a];
      g.sp[a] = base + S.streakBonus * Math.min(Math.max(winRun[key] - 1, 0), S.streakCap);
    });
  });
  const seasonRunning = {}; // `${name}|${seasonNum}` -> { pts, games }
  games.forEach(g => {
    if (g.type !== 'Regular' || g.n < 2 || g.season == null) return;
    g.score = {};
    g.names.forEach(a => {
      const key = a + '|' + g.season;
      const run = seasonRunning[key] || (seasonRunning[key] = { pts: 0, games: 0 });
      const before = (run.pts + S.prior * 0.5) / (run.games + S.prior);
      run.pts += g.sp[a]; run.games += 1;
      const after = (run.pts + S.prior * 0.5) / (run.games + S.prior);
      g.score[a] = { before, after };
    });
  });

  /* titles */
  const titles = {};
  seasons.forEach(s => { if (s.champion) { const k = rosterKey.get(s.champion.toLowerCase()); if (k) titles[k] = (titles[k] || 0) + 1; } });
  seasons.forEach(s => { if (s.champion && !rosterKey.has(s.champion.toLowerCase())) warnings.push(`${s.name}: champion "${s.champion}" is not a known player.`); });

  /* player table */
  const players = roster.map((n, ri) => {
    const p = P[n];
    return {
      name: n, order: ri, elo: p.elo, peak: p.peak, rated: p.rated, wins: p.wins,
      winPct: p.rated ? p.wins / p.rated : null, avgPts: p.rated ? p.ptsSum / p.rated : null,
      streak: p.streak, bestStreak: p.bestStreak, dry: p.dry, bestDry: p.bestDry,
      topHalf: p.rated ? p.results.filter(r => r.pts >= 0.5).length / p.rated : null, lasts: p.results.filter(r => r.pts === 0).length, titles: titles[n] || 0, allGames: p.allGames,
      status: p.rated === 0 ? '' : p.rated < E.provisionalGames ? 'Provisional' : 'Established',
      results: p.results,
      // Per landscape type: rated games played with it in the kingdom, and wins among them.
      landscapeStats: (() => {
        const m = {};
        p.results.forEach(r => r.game.landscapes.forEach(l => {
          const e = m[l] || (m[l] = { games: 0, wins: 0 });
          e.games++; if (r.place === 1) e.wins++;
        }));
        Object.values(m).forEach(e => { e.winPct = e.wins / e.games; });
        return m;
      })(),
      tier: p.rated ? tiers[held[n] ?? tierIndex(p.elo)] : null,
      tierHeld: p.rated > 0 && (below[n] || 0) > 0,   // under their tier's line but still shown at it (the demotion grace)
      peakTier: p.rated ? tiers[tierIndex(p.peak)] : null,
      nextTier: p.rated && (held[n] ?? tierIndex(p.elo)) < tiers.length - 1 ? { tier: tiers[(held[n] ?? tierIndex(p.elo)) + 1], need: Math.max(1, tiers[(held[n] ?? tierIndex(p.elo)) + 1].min - Math.round(p.elo)) } : null,
    };
  });
  const ranked = players.filter(p => p.rated > 0)
    .sort((a, b) => (b.elo + b.rated * 1e-6 - b.order * 1e-9) - (a.elo + a.rated * 1e-6 - a.order * 1e-9));
  ranked.forEach(p => {
    p.rank = 1 + ranked.filter(q => Math.round(q.elo * 10) > Math.round(p.elo * 10)).length;
  });

  /* nights */
  const nightsAll = [...new Set(games.map(g => g.day))];

  /* Rank movement since the night before last — people can't eyeball a raw
     Elo delta against everyone else's, but "passed Bob" reads instantly.
     Needs at least 2 distinct game nights to have a "before" to compare
     against; a player with no result before that cutoff (brand new as of
     last night) just gets no arrow, not a fabricated one. */
  if (nightsAll.length >= 2) {
    const cutoff = nightsAll[nightsAll.length - 2];
    const eloMap = (snapshotAtOrBefore(g => g.day <= cutoff) || { snapshot: {} }).snapshot;
    const prevCandidates = players
      .filter(p => p.results.some(r => r.game.day <= cutoff))
      .map(p => ({ name: p.name, elo: eloMap[p.name] ?? E.start }));
    prevCandidates.forEach(p => {
      p.prevRank = 1 + prevCandidates.filter(q => Math.round(q.elo * 10) > Math.round(p.elo * 10)).length;
    });
    const prevRankByName = new Map(prevCandidates.map(p => [p.name, p.prevRank]));
    ranked.forEach(p => {
      const pr = prevRankByName.get(p.name);
      p.rankDelta = pr != null ? pr - p.rank : null; // positive = moved up
    });
  } else {
    ranked.forEach(p => { p.rankDelta = null; });
  }

  /* season info */
  seasons.forEach(s => {
    const sg = games.filter(g => g.season === s.number);
    s.regularGames = sg.filter(g => g.type === 'Regular' && g.n >= 2).length;
    s.nightsHeld = new Set(sg.map(g => g.day)).size;
  });
  function currentSeasonFor() {
    const inProg = seasons.find(s => s.status === 'In progress');
    return inProg ? inProg.number
      : Math.max(0, ...seasons.filter(s => s.ok && s.start <= today).map(s => s.number)) || (seasons.length ? seasons[0].number : 0);
  }
  let currentSeason = currentSeasonFor();

  function snapshotAtOrBefore(pred) { // last game satisfying pred (games sorted by day)
    let last = null; for (const g of games) { if (pred(g)) last = g; else break; } return last;
  }

  function seasonStandings(num) {
    const s = seasons[num - 1];
    if (!s) return null;
    const sg = games.filter(g => g.season === num);
    const reg = sg.filter(g => g.type === 'Regular' && g.n >= 2);
    const nightsHeld = new Set(sg.map(g => g.day)).size;
    const before = s.ok ? snapshotAtOrBefore(g => g.day < s.start) : null;
    const after = s.ok ? snapshotAtOrBefore(g => g.day <= s.end) : null;
    const rows = [];
    roster.forEach((n, ri) => {
      let gp = 0, w = 0, pts = 0, spts = 0;
      reg.forEach(g => { if (g.places[n] != null) { gp++; if (g.places[n] === 1) w++; pts += g.pts[n]; spts += g.sp[n]; } });
      if (!gp) return;
      const nights = new Set(sg.filter(g => g.places[n] != null).map(g => g.day)).size;
      const score = (spts + S.prior * 0.5) / (gp + S.prior);
      const q = s.ok && gp >= s.minGames;
      const eloB = before ? (before.snapshot[n] ?? E.start) : E.start;
      const eloA = after ? (after.snapshot[n] ?? E.start) : E.start;
      rows.push({
        name: n, order: ri, games: gp, wins: w, winPct: w / gp, avgPts: pts / gp, bonusPts: spts - pts, score, qualified: q,
        need: q ? 0 : Math.max(0, s.minGames - gp), eloChange: eloA - eloB, nights, attendance: nightsHeld ? nights / nightsHeld : null, seed: null,
      });
    });
    rows.sort((a, b) => (b.score + (b.qualified ? 10 : 0) + b.games * 1e-9 - b.order * 1e-12) - (a.score + (a.qualified ? 10 : 0) + a.games * 1e-9 - a.order * 1e-12));
    rows.forEach((r, i) => { r.rank = i + 1; if (r.qualified && r.rank <= s.spots) r.seed = r.rank; });
    return { season: s, rows, nightsHeld, games: sg };
  }

  function h2h(seasonNum) {
    const active = roster.filter(n => games.some(g => g.n >= 2 && g.places[n] != null));
    const ahead = {}; active.forEach(a => { ahead[a] = {}; active.forEach(b => { ahead[a][b] = 0; }); });
    games.forEach(g => {
      if (g.type === 'Friendly' || g.n < 2) return;
      if (seasonNum != null && g.season !== seasonNum) return;
      g.names.forEach(a => g.names.forEach(b => { if (a !== b && g.places[a] < g.places[b]) ahead[a][b]++; }));
    });
    return { players: active, ahead };
  }

  /* records */
  const countBy = (arr) => { const m = {}; arr.forEach(x => { m[x] = (m[x] || 0) + 1; }); return m; };
  const num = a => a.filter(x => x != null && !isNaN(x));
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const minRec = S.minGamesForRecords;
  function buildRecords(playerList, gameList, leaderList) {
    const holder = (key, filter) => {
      let best = null;
      playerList.forEach(p => { const v = p[key]; if (v == null || (filter && !filter(p))) return; if (best == null || v > best.value) best = { name: p.name, value: v }; });
      return best;
    };
    const withInfo = gameList.filter(g => g.n >= 2);
    return {
      overview: {
        tables: withInfo.length, friendly: withInfo.filter(g => g.type === 'Friendly').length, nights: new Set(gameList.map(g => g.day)).size,
        playersRated: playerList.filter(p => p.rated > 0).length, last: gameList.length ? gameList[gameList.length - 1].date : null,
        avgTable: avg(withInfo.map(g => g.n)), avgMinutes: avg(num(gameList.map(g => g.minutes))), avgVP: avg(num(gameList.map(g => g.vp))),
      },
      leader: leaderList[0] ? { name: leaderList[0].name, value: leaderList[0].elo } : null,
      peak: holder('peak', p => p.rated > 0),
      mostGames: holder('rated'), mostWins: holder('wins'),
      bestWinPct: holder('winPct', p => p.rated >= minRec), bestAvgPts: holder('avgPts', p => p.rated >= minRec),
      bestStreak: holder('bestStreak'), mostTitles: holder('titles'),
      bestDry: holder('bestDry'),
      tableSizes: countBy(withInfo.map(g => g.n)),
      gain: (() => { let b = null; playerList.forEach(p => p.results.forEach(r => { const d = r.after - r.before; if (!b || d > b.value) b = { name: p.name, value: d, date: r.game.date, line: r.game.line }; })); return b; })(),
      loss: (() => { let b = null; playerList.forEach(p => p.results.forEach(r => { const d = r.after - r.before; if (!b || d < b.value) b = { name: p.name, value: d, date: r.game.date, line: r.game.line }; })); return b; })(),
      longest: (() => { let b = null; gameList.forEach(g => { if (g.minutes && (!b || g.minutes > b.value)) b = { game: g, value: g.minutes }; }); return b; })(),
      shortest: (() => { let b = null; gameList.forEach(g => { if (g.minutes && g.n >= 2 && (!b || g.minutes < b.value)) b = { game: g, value: g.minutes }; }); return b; })(),
      topVP: (() => { let b = null; gameList.forEach(g => { if (g.vp && (!b || g.vp > b.value)) b = { game: g, value: g.vp }; }); return b; })(),
      closestRace: (() => {
        let best = null;
        for (let i = 0; i < leaderList.length - 1; i++) {
          const gap = leaderList[i].elo - leaderList[i + 1].elo;
          if (!best || gap < best.gap) best = { a: leaderList[i].name, b: leaderList[i + 1].name, gap, rank: i + 1 };
        }
        return best;
      })(),
      biggestUpset: (() => {
        let best = null;
        gameList.forEach(g => {
          if (!g.elo || g.n < 2) return;
          g.names.forEach(w => {
            if (g.places[w] !== 1 || !g.elo[w]) return;
            g.names.forEach(o => {
              if (o === w || g.places[o] === g.places[w] || !g.elo[o]) return;
              const deficit = g.elo[o].before - g.elo[w].before;
              if (deficit > 0 && (!best || deficit > best.deficit)) best = { winner: w, loser: o, deficit, date: g.date, game: g };
            });
          });
        });
        return best;
      })(),
      // Landscape cards (Events, Projects, ...). Same attribution rule as
      // sets: a game with several types counts fully toward each.
      landscapes: countBy([].concat(...withInfo.map(g => g.landscapes))),
      landscapeTables: withInfo.length,
      landscapeStats: (() => {
        const m = {};
        withInfo.forEach(g => g.landscapes.forEach(l => {
          const e = m[l] || (m[l] = { games: 0, vpSum: 0, vpN: 0 });
          e.games++;
          if (g.vp != null) { e.vpSum += g.vp; e.vpN++; }
        }));
        Object.values(m).forEach(e => { e.avgVP = e.vpN ? e.vpSum / e.vpN : null; });
        return m;
      })(),
      // Games with any landscape card vs. none: how do the tables differ?
      landscapeSplit: (() => {
        const part = list => ({ games: list.length, avgVP: avg(num(list.map(g => g.vp))), avgTable: avg(list.map(g => g.n)) });
        return { with: part(withInfo.filter(g => g.landscapes.length)), without: part(withInfo.filter(g => !g.landscapes.length)) };
      })(),
      landscapeTypesDist: countBy(withInfo.map(g => g.landscapes.length)),
      mostLandscapes: (() => { let b = null; withInfo.forEach(g => { if (g.landscapes.length && (!b || g.landscapes.length > b.value)) b = { game: g, value: g.landscapes.length }; }); return b; })(),
      // Best win % per landscape type among players with enough games using it.
      bestByLandscape: (() => {
        const m = {};
        playerList.forEach(p => Object.entries(p.landscapeStats).forEach(([l, e]) => {
          if (e.games >= minRec && (!m[l] || e.winPct > m[l].value)) m[l] = { name: p.name, value: e.winPct, games: e.games };
        }));
        return m;
      })(),
      sets: countBy([].concat(...gameList.map(g => g.sets))),
      setsLogged: gameList.filter(g => g.sets.length).length,
      setStats: (() => {
        // A game can log more than one expansion at once (the kingdom was
        // mixed), so — same attribution rule as the `sets` count above —
        // each stat is credited to every set tagged on that game, not split
        // between them.
        const m = {};
        gameList.forEach(g => {
          g.sets.forEach(s => {
            const e = m[s] || (m[s] = { games: 0, vpSum: 0, vpN: 0, minSum: 0, minN: 0 });
            e.games++;
            if (g.vp != null) { e.vpSum += g.vp; e.vpN++; }
            if (g.minutes != null) { e.minSum += g.minutes; e.minN++; }
          });
        });
        Object.values(m).forEach(e => { e.avgVP = e.vpN ? e.vpSum / e.vpN : null; e.avgMinutes = e.minN ? e.minSum / e.minN : null; });
        return m;
      })(),
    };
  }
  const records = buildRecords(players, games, ranked);

  /* rating history by night, for charts */
  const nights = nightsAll.map(day => {
    const last = snapshotAtOrBefore(g => g.day <= day);
    return { day, date: fmtDay(day), snapshot: last ? last.snapshot : {} };
  });

  const lastDay = games.length ? games[games.length - 1].day : null;
  const lastNight = lastDay == null ? null : { date: fmtDay(lastDay), games: games.filter(g => g.day === lastDay && g.n >= 2) };

  /* Expected result for a prospective table: for each player, Elo gained if they win and lost if they finish last. */
  function preview(names) {
    const list = names.map(n => ({ name: n, elo: (P[n] ? P[n].elo : E.start), rated: (P[n] ? P[n].rated : 0) }));
    const n = list.length;
    if (n < 2) return [];
    const byPlace = steady ? finishScores(list.map((_, i) => i + 1), E) : null;   // what 1st .. last would score at a table this size
    return list.map(a => {
      let sumE = 0;
      list.forEach(b => { if (b !== a) sumE += 1 / (1 + Math.pow(10, (b.elo - a.elo) / E.scale)); });
      const k = a.rated < E.provisionalGames ? E.provisionalK : E.k;
      return steady
        ? { name: a.name, elo: a.elo, k, expected: sumE / (n - 1), ifWin: k * (byPlace[0] - sumE / (n - 1)), ifLast: k * (byPlace[n - 1] - sumE / (n - 1)) }
        : { name: a.name, elo: a.elo, k, expected: sumE / (n - 1), ifWin: k / (n - 1) * (n - 1 - sumE), ifLast: -k / (n - 1) * sumE };
    });
  }

  if (!seasons.length) warnings.push('No seasons are set up yet. Games will still count for Elo.');

  return { preview, lastNight, config, E, S, roster, players, ranked, games, seasons, currentSeason, currentSeasonFor, nights, tiers, tierFor, tierAt: (g, name) => (g.tierSnap && g.tierSnap[name]) || tierFor(g.snapshot[name]), startTier: tiers[tierIndex(E.start)], warnings, seasonStandings, h2h, records, today };
}

export { DEFAULT_TIERS, compute, parseCSV, parseFinish, parseISO, fmtDay, todayDay };
