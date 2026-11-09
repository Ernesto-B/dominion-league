/* The pure parts of logging a game, shared by the Add/Edit Game dialog and the Game night flow. `bs` is the form state:
   { date, type, picked: [names in finishing order], tie: { name: true if tied with the name above }, sets, landscapes, kingdom,
     kingdomTouched, vp: { name: text }, notes, editId }. */
import { SET_NAMES, LANDSCAPES } from './sets.js';
import { toPayload } from '../dominion/kingdom.js';
import { cleanMinutes, playedMinutes } from './night.js';

export const toggle = (arr, n) => (arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n]);

// Re-sorts picked by VP descending (blank VP sinks to the bottom, keeping its prior relative order — Array#sort is stable) and
// recomputes ties from equal consecutive VP. A no-op until at least one VP is entered, since there's nothing yet to sort by.
export function resortByVP(b) {
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

// [{ player_id, place, vp }] — ties share the lower number, as the database stores them
export function buildResults(bs, playerIdByName) {
  let pos = 1; const results = [];
  bs.picked.forEach((n, i) => {
    if (i > 0 && !bs.tie[n]) pos = i + 1;
    const id = playerIdByName.get(n);
    const vp = bs.vp[n] !== undefined && bs.vp[n] !== '' ? +bs.vp[n] : null;
    if (id) results.push({ player_id: id, place: pos, vp });
  });
  return results;
}

// The minutes to save. The Save step's Match time (Game night) wins; then the Length box of the Add / Edit dialog (a number, or empty to record none: an edit overwrites the column, so
// an emptied box clears it); a new game with neither uses the Game night clock.
export function minutesFor(bs, now = Date.now()) {
  if (bs.minutesEdit != null) return cleanMinutes(bs.minutesEdit);
  if (bs.editId || (bs.minutes != null && bs.minutes !== '')) return cleanMinutes(bs.minutes);
  return playedMinutes(bs.startedAt, bs.endedAt ?? now);
}

// the arguments of the add_game / edit_game RPCs. A new game's minutes come from the Game night clock; an edit sends back the minutes it
// already has (edit_game overwrites the column, so leaving them out would erase them). The kingdom is sent only when there is something to say: an edit that never
// touched it leaves it alone on the server.
export function buildGameArgs(bs, gid, playerIdByName, now = Date.now()) {
  return {
    p_date: bs.date, p_type: bs.type || '', p_sets: bs.sets.length ? SET_NAMES.filter(n => bs.sets.includes(n)).join('; ') : null, p_strategy: null,
    p_landscapes: bs.landscapes.length ? LANDSCAPES.filter(n => bs.landscapes.includes(n)).join('; ') : null,
    p_winner_vp: null, p_minutes: minutesFor(bs, now), p_notes: bs.notes || null,
    p_group_id: gid, p_results: buildResults(bs, playerIdByName),
    ...(bs.kingdomTouched || (!bs.editId && bs.kingdom.length) ? { p_kingdom: toPayload(bs.kingdom) } : {}),
    // the match's own clock, only for a NEW game that ran on Game night's timer (an edit leaves the saved times as they are)
    ...(!bs.editId && bs.recommendedSet ? { p_recommended_set: bs.recommendedSet } : {}),   // the recommended kingdom used as it came (a new game only: an edit leaves it as it is)
    ...(!bs.editId && bs.startedAt != null && bs.endedAt != null ? { p_started_at: new Date(bs.startedAt).toISOString(), p_ended_at: new Date(bs.endedAt).toISOString() } : {}),
  };
}

/* add_game / edit_game / submit_pending_game, tolerating a database that predates the optional columns (the timing columns, the recommended set): if it does not know those arguments (PostgREST cannot find a function
   with them), the same call is made without them, so logging a game never fails for want of a migration. */
export async function callGameRpc(sb, name, args) {
  const res = await sb.rpc(name, args);
  const notFound = r => !!r.error && /PGRST202|could not find the function/i.test(`${r.error.code || ''} ${r.error.message || ''}`);
  // an older database: the same call without the optional arguments it does not know yet (first the recommended set, then the match's clock as well)
  if (notFound(res) && 'p_recommended_set' in args) {
    const { p_recommended_set, ...rest } = args;
    const again = await sb.rpc(name, rest);
    if (notFound(again) && ('p_started_at' in rest || 'p_ended_at' in rest)) { const { p_started_at, p_ended_at, ...bare } = rest; return sb.rpc(name, bare); }
    return again;
  }
  if (notFound(res) && ('p_started_at' in args || 'p_ended_at' in args)) { const { p_started_at, p_ended_at, ...rest } = args; return sb.rpc(name, rest); }
  return res;
}
