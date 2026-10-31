/* The state of a Game night (the guided way to log a game, see pages/Night.jsx), kept per group in localStorage (so a phone that puts the tab to sleep, or a browser that restarts it, still finds the night; one older than
   NIGHT_TTL is forgotten) so a reload, or
   a look at a card's page in the middle of the game, doesn't lose it. Pure apart from the storage it is handed, so it is tested. */
export const STEPS = [
  { id: 'players', label: 'Players', title: 'Who’s playing?' },
  { id: 'kingdom', label: 'Kingdom', title: 'The Kingdom' },
  { id: 'play', label: 'Play', title: 'Game on' },
  { id: 'scores', label: 'Scores', title: 'Final scores' },
  { id: 'review', label: 'Save', title: 'Check and save' },
];
const ids = STEPS.map(s => s.id);

export const todayISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const blankNight = (today = todayISO()) => ({
  step: 'players', picked: [], tie: {}, vp: {}, kingdomMode: null, randomDone: false, randomOriginal: null, handEdited: false, handBane: null, rollOpts: null, kept: null, handOpen: false, draftSave: null, kingdom: [], kingdomTouched: false, rolled: null, rolledQ: null, sets: [], landscapes: [],
  date: today, type: '', notes: '', startedAt: null, endedAt: null, editId: null,
});

// Can the viewer leave this step? Only the first has a rule: a game needs at least two players.
export const canAdvance = (step, st) => (step === 'players' ? st.picked.length >= 2 : true);
export const nextStep = step => ids[Math.min(ids.length - 1, ids.indexOf(step) + 1)];
export const prevStep = step => ids[Math.max(0, ids.indexOf(step) - 1)];
export const stepNumber = step => ids.indexOf(step) + 1;

/* Leaving the Kingdom step for Play starts the clock the first time, and leaving Play for the scores stops it (`endedAt`), so the minutes saved are the
   game's own and not the time spent typing in scores afterwards. Coming back to Play puts the clock back on. With no kingdom there is nothing to keep
   on screen at the table, so the Play step is skipped (and skipped again going back), straight to the scores (and the game has no length). */
export function advance(st, now = Date.now()) {
  if (!canAdvance(st.step, st)) return st;
  const step = st.step === 'kingdom' && st.kingdom.length === 0 ? 'scores' : nextStep(st.step);
  return { ...st, step, startedAt: st.startedAt ?? (step === 'play' ? now : null), endedAt: st.step === 'play' ? st.endedAt ?? now : st.endedAt ?? null };
}
export function back(st) {
  const step = st.step === 'scores' && st.kingdom.length === 0 ? 'kingdom' : prevStep(st.step);
  return { ...st, step, endedAt: step === 'play' ? null : st.endedAt ?? null };
}

/* The minutes to save with a game: the whole minutes since the clock started. A game with no clock (the Play step was skipped) has no
   length, and neither does a clock left running overnight (more than 12 hours is a forgotten night, not a game). */
export function playedMinutes(startedAt, now = Date.now()) {
  if (startedAt == null) return null;
  const min = Math.round((now - startedAt) / 60000);
  return min >= 1 && min <= 720 ? min : null;
}

// "1 h 05 min" / "23 min" / "just started"
export function elapsed(startedAt, now = Date.now()) {
  if (startedAt == null) return '';
  const min = Math.max(0, Math.floor((now - startedAt) / 60000));
  if (min < 1) return 'just started';
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

// A second table running at the same time is its own saved night in its own slot. Slot 0 keeps the key it always had (so a night in progress survives the
// update); slot 1 is `.t2`. Both are read, saved and cleared separately.
export const MAX_TABLES = 2;
const key = (gid, slot = 0) => `dl.night.${gid ?? 'none'}${slot ? '.t' + (slot + 1) : ''}`;
// what is worth keeping: everything except `rolled`'s heavy catalog rows. `rolledQ` is the roll in the Randomizer's compact link form
// (kingdomToParams), which the Kingdom step rebuilds the tiles and setup notes from on return
const slim = st => ({ ...st, rolled: null });
export const NIGHT_TTL = 12 * 3600 * 1000;   // a night left alone for half a day is over: yesterday's players and date are not worth resuming

/* The saved night is read back by code that may be newer than the code that wrote it. Two guards, so what was saved can never crash the page:
   - NIGHT_VERSION: stamped on every save. Bump it whenever the SHAPE of a night changes in a way an old save could not survive; a save with another
     version (or none) is not resumed, the night starts fresh.
   - cleanNight: even a save of the right version is taken field by field. A field whose type is not what the page expects goes back to its blank value
     (and a draft that doesn't hold together is dropped), so one odd value costs that field, not the night. A field the page does not know is ignored. */
export const NIGHT_VERSION = 3;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStrs = v => Array.isArray(v) && v.every(x => typeof x === 'string');
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isItems = v => Array.isArray(v) && v.every(i => isObj(i) && typeof i.id === 'string' && (i.kind === 'card' || i.kind === 'landscape') && (i.on == null || typeof i.on === 'string'));
const orNull = ok => v => v === null || ok(v);
const isDraft = v => isObj(v) && isStrs(v.seats) && isStrs(v.picks) && (v.banned === undefined || (Array.isArray(v.banned) && v.banned.every(k => k === null || typeof k === 'string')))
  && (v.draft === null || (isObj(v.draft) && isNum(v.draft.seed) && isObj(v.draft.options) && (v.draft.n == null || isNum(v.draft.n)) && (v.draft.size == null || isNum(v.draft.size))));
const FIELDS = {
  step: v => ids.includes(v), picked: isStrs, tie: isObj, vp: isObj, kingdomMode: orNull(v => ['random', 'manual', 'draft'].includes(v)), randomDone: v => typeof v === 'boolean',
  randomOriginal: orNull(isStrs), handEdited: v => typeof v === 'boolean', handBane: orNull(v => typeof v === 'string'), rollOpts: orNull(isObj), kept: orNull(isObj),
  handOpen: v => typeof v === 'boolean', draftSave: orNull(isDraft), kingdom: isItems, kingdomTouched: v => typeof v === 'boolean', rolledQ: orNull(v => typeof v === 'string'),
  sets: isStrs, landscapes: isStrs, date: v => typeof v === 'string', type: v => typeof v === 'string', notes: v => typeof v === 'string',
  startedAt: orNull(isNum), endedAt: orNull(isNum), editId: orNull(isNum),
};
export function cleanNight(saved, today = todayISO()) {
  const blank = blankNight(today), out = { ...blank };
  for (const k of Object.keys(blank)) if (k in FIELDS && saved[k] !== undefined && FIELDS[k](saved[k])) out[k] = saved[k];
  // everyone in a saved draft must still be at the table
  if (out.draftSave && !out.draftSave.seats.every(n => out.picked.includes(n))) out.draftSave = null;
  return out;
}
export function loadNight(storage, gid, today = todayISO(), now = Date.now(), slot = 0) {
  try {
    const saved = JSON.parse(storage.getItem(key(gid, slot)));
    if (!isObj(saved) || saved.v !== NIGHT_VERSION) return blankNight(today);        // nothing saved, or from another shape of night: start fresh
    if (saved.savedAt && now - saved.savedAt > NIGHT_TTL) return blankNight(today);
    if (!ids.includes(saved.step) || !isStrs(saved.picked)) return blankNight(today);
    return { ...cleanNight(saved, today), rolled: null };
  } catch { /* blocked or corrupt: start fresh */ }
  return blankNight(today);
}
export function saveNight(storage, gid, st, now = Date.now(), slot = 0) { try { storage.setItem(key(gid, slot), JSON.stringify({ ...slim(st), v: NIGHT_VERSION, savedAt: now })); return true; } catch { return false; } }
export function clearNight(storage, gid, slot = 0) { try { storage.removeItem(key(gid, slot)); } catch { /* ignore */ } }

/* What a saved game did, for the "Game saved" screen. `before` is { ranks: {name: rank}, tiers: {name: tierId} } taken from the ladder just
   before saving; `g` is the game as the engine now has it (g.elo, g.places, g.snapshot); `ranked` is the ladder now. Players come in finish
   order. A rank of null means the player wasn't on the ladder before. Returns null for a game that didn't move any rating. */
export function gameSummary(g, before, ranked, tierFor) {
  if (!g || !g.elo || !Object.keys(g.elo).length) return null;
  const now = new Map(ranked.map(p => [p.name, p]));
  return g.names.slice().sort((a, b) => g.places[a] - g.places[b]).filter(n => g.elo[n]).map(name => {
    const e = g.elo[name], p = now.get(name), tierAfter = e.tierAfter || tierFor(e.after), tierBefore = e.tierBefore || tierFor(e.before);
    const rankBefore = before.ranks[name] ?? null;
    return {
      name, place: g.places[name], before: Math.round(e.before), after: Math.round(e.after), delta: Math.round(e.after - e.before),
      saving: e.saving ? Math.round(e.saving) : 0,
      rankBefore, rankAfter: p ? p.rank : null, rankMove: rankBefore != null && p ? rankBefore - p.rank : 0,
      tierUp: tierAfter.id !== tierBefore.id && e.after > e.before ? tierAfter : null,
      tierDown: tierAfter.id !== tierBefore.id && e.after < e.before ? tierAfter : null,
    };
  });
}

/* Is there a fresh, saved night in this slot? That is how a second table is found again after a reload (it exists while it has a save). */
export function hasNight(storage, gid, slot, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(key(gid, slot)));
    return isObj(saved) && saved.v === NIGHT_VERSION && !!saved.savedAt && now - saved.savedAt <= NIGHT_TTL;
  } catch { return false; }
}

/* What a table's tab says: "Table 2", and where it is: players picked, or the step it is on (the clock while it is being played). */
export function tableLabel(info, now = Date.now()) {
  if (!info) return '';
  if (info.done) return 'saved';
  if (info.step === 'play' && info.startedAt != null) return `Play · ${elapsed(info.startedAt, now)}`;
  const s = STEPS.find(x => x.id === info.step);
  return info.step === 'players' && !info.picked.length ? 'new' : s ? s.label : '';
}
