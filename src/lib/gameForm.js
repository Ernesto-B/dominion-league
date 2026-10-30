/* The pure parts of logging a game, shared by the Add/Edit Game dialog and the Game night flow. `bs` is the form state:
   { date, type, picked: [names in finishing order], tie: { name: true if tied with the name above }, sets, landscapes, kingdom,
     kingdomTouched, vp: { name: text }, notes, editId }. */
import { SET_NAMES, LANDSCAPES } from './sets.js';
import { toPayload } from '../dominion/kingdom.js';
import { playedMinutes } from './night.js';

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

// the arguments of the add_game / edit_game RPCs. A new game's minutes come from the Game night clock; an edit sends back the minutes it
// already has (edit_game overwrites the column, so leaving them out would erase them). The kingdom is sent only when there is something to say: an edit that never
// touched it leaves it alone on the server.
export function buildGameArgs(bs, gid, playerIdByName, now = Date.now()) {
  return {
    p_date: bs.date, p_type: bs.type || '', p_sets: bs.sets.length ? SET_NAMES.filter(n => bs.sets.includes(n)).join('; ') : null, p_strategy: null,
    p_landscapes: bs.landscapes.length ? LANDSCAPES.filter(n => bs.landscapes.includes(n)).join('; ') : null,
    p_winner_vp: null, p_minutes: bs.editId ? bs.minutes ?? null : playedMinutes(bs.startedAt, bs.endedAt ?? now), p_notes: bs.notes || null,
    p_group_id: gid, p_results: buildResults(bs, playerIdByName),
    ...(bs.kingdomTouched || (!bs.editId && bs.kingdom.length) ? { p_kingdom: toPayload(bs.kingdom) } : {}),
  };
}
