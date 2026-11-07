/* Pending games (supabase/schema.sql `pending_games`): a player who hosts a table on Game night submits the result for the admin to approve instead of saving it. Pure helpers. */
import { playedMinutes } from './night.js';

const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

// what a game usually takes in this group (the median of the games that have a time), or null with too few to say
export function usualMinutes(games, minSample = 4) {
  const m = (games || []).map(g => +g.minutes).filter(n => Number.isFinite(n) && n >= 1);
  return m.length >= minSample ? Math.round(median(m)) : null;
}

/* The length to trust. Nobody but the admin can be relied on to stop the clock, so a game whose clock ran much longer than the group's usual game (or past three hours with nothing
   to compare with) is a forgotten clock, not a long game: it gets no time, which counts for nothing, rather than a wrong one. `clock` is what the clock said, `minutes` what to save. */
export function trustedMinutes(startedAt, now, usual) {
  const clock = playedMinutes(startedAt, now);
  if (clock == null) return { clock: null, minutes: null };
  const limit = usual != null ? Math.max(75, Math.round(usual * 2.5)) : 180;
  return { clock, minutes: clock <= limit ? clock : null };
}

// a pending row's results as the Add Game dialog's form state: players in finishing order, ties marked, VP as text
export function pendingToForm(row, nameById) {
  const res = (row.results || []).slice().sort((a, b) => a.place - b.place), picked = [], tie = {}, vp = {};
  res.forEach((r, i) => {
    const n = nameById.get(r.player_id); if (!n) return;
    if (i > 0 && res[i - 1].place === r.place) tie[n] = true;
    picked.push(n); if (r.vp != null) vp[n] = String(r.vp);
  });
  const kingdom = (row.kingdom || []).map(k => ({ kind: k.kind, id: k.id, ...(k.on ? { on: k.on } : {}) }));
  return { date: row.date, type: row.type === 'Regular' ? '' : row.type || '', picked, tie, sets: row.sets ? row.sets.split('; ') : [], landscapes: row.landscapes ? row.landscapes.split('; ') : [], kingdom, kingdomTouched: kingdom.length > 0, startedAt: row.started_at ? Date.parse(row.started_at) : null, endedAt: row.ended_at ? Date.parse(row.ended_at) : null, vp, notes: row.notes || '', minutes: row.minutes ?? '', editId: null, pendingId: row.id };
}

/* A pending game as the league would record it, run through the engine with the group's real games before it: the result is the game with Elo before and after, season points and tiers, exactly as it will be
   once accepted (or null when the group's input isn't to hand). The engine gets the pending game last in line; it is found again by its high line number. */
export const PREVIEW_LINE = 1e9;
export function previewPending(Eng, D, row, nameById) {
  if (!D || !D.input) return null;
  try {
    const f = pendingToForm(row, nameById), place = n => { const i = f.picked.indexOf(n); let p = 1; for (let k = 1; k <= i; k++) if (!f.tie[f.picked[k]]) p = k + 1; return p; };
    const byPlace = new Map(); f.picked.forEach(n => { const p = place(n); if (!byPlace.has(p)) byPlace.set(p, []); byPlace.get(p).push(n); });
    const finish = [...byPlace.keys()].sort((a, b) => a - b).map(p => byPlace.get(p).join(' = ')).join(' > ');
    const playerVP = {}; f.picked.forEach(n => { if (f.vp[n] != null) playerVP[n] = +f.vp[n]; });
    const next = { _line: PREVIEW_LINE + row.id, date: row.date, type: row.type || '', finish, sets: row.sets || '', landscapes: row.landscapes || '', playerVP, group_id: row.group_id, kingdom: f.kingdom,
      winner_vp: '', minutes: row.minutes ?? '', notes: row.notes || '', savedAt: row.created_at || null, startedAt: row.started_at || null, endedAt: row.ended_at || null };
    const D2 = Eng.compute(D.input.config, [...D.input.rows, next]);
    return D2.games.find(g => g.line === next._line) || null;
  } catch { return null; }
}
