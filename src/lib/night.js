/* The state of a Game night (the guided way to log a game, see pages/Night.jsx), kept per group in sessionStorage so a reload, or
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
  step: 'players', picked: [], tie: {}, vp: {}, kingdom: [], kingdomTouched: false, rolled: null, sets: [], landscapes: [],
  date: today, type: '', notes: '', startedAt: null, editId: null,
});

// Can the viewer leave this step? Only the first has a rule: a game needs at least two players.
export const canAdvance = (step, st) => (step === 'players' ? st.picked.length >= 2 : true);
export const nextStep = step => ids[Math.min(ids.length - 1, ids.indexOf(step) + 1)];
export const prevStep = step => ids[Math.max(0, ids.indexOf(step) - 1)];
export const stepNumber = step => ids.indexOf(step) + 1;

/* Leaving the Kingdom step for Play starts the clock the first time. With no kingdom there is nothing to keep on screen at the
   table, so the Play step is skipped (and skipped again going back), straight to the scores. */
export function advance(st, now = Date.now()) {
  if (!canAdvance(st.step, st)) return st;
  const step = st.step === 'kingdom' && st.kingdom.length === 0 ? 'scores' : nextStep(st.step);
  return { ...st, step, startedAt: st.startedAt ?? (step === 'play' ? now : null) };
}
export const back = st => ({ ...st, step: st.step === 'scores' && st.kingdom.length === 0 ? 'kingdom' : prevStep(st.step) });

// "1 h 05 min" / "23 min" / "just started"
export function elapsed(startedAt, now = Date.now()) {
  if (startedAt == null) return '';
  const min = Math.max(0, Math.floor((now - startedAt) / 60000));
  if (min < 1) return 'just started';
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

const key = gid => `dl.night.${gid ?? 'none'}`;
// what is worth keeping: everything except `rolled`'s heavy catalog rows, which are rebuilt from the kingdom ids on return
const slim = st => ({ ...st, rolled: null });
export function loadNight(storage, gid, today = todayISO()) {
  try {
    const saved = JSON.parse(storage.getItem(key(gid)));
    if (saved && typeof saved === 'object' && ids.includes(saved.step) && Array.isArray(saved.picked)) return { ...blankNight(today), ...saved, rolled: null };
  } catch { /* nothing saved, blocked, or corrupt: start fresh */ }
  return blankNight(today);
}
export function saveNight(storage, gid, st) { try { storage.setItem(key(gid), JSON.stringify(slim(st))); return true; } catch { return false; } }
export function clearNight(storage, gid) { try { storage.removeItem(key(gid)); } catch { /* ignore */ } }

/* What a saved game did, for the "Game saved" screen. `before` is { ranks: {name: rank}, tiers: {name: tierId} } taken from the ladder just
   before saving; `g` is the game as the engine now has it (g.elo, g.places, g.snapshot); `ranked` is the ladder now. Players come in finish
   order. A rank of null means the player wasn't on the ladder before. Returns null for a game that didn't move any rating. */
export function gameSummary(g, before, ranked, tierFor) {
  if (!g || !g.elo || !Object.keys(g.elo).length) return null;
  const now = new Map(ranked.map(p => [p.name, p]));
  return g.names.slice().sort((a, b) => g.places[a] - g.places[b]).filter(n => g.elo[n]).map(name => {
    const e = g.elo[name], p = now.get(name), tierAfter = tierFor(e.after), tierBefore = tierFor(e.before);
    const rankBefore = before.ranks[name] ?? null;
    return {
      name, place: g.places[name], before: Math.round(e.before), after: Math.round(e.after), delta: Math.round(e.after - e.before),
      rankBefore, rankAfter: p ? p.rank : null, rankMove: rankBefore != null && p ? rankBefore - p.rank : 0,
      tierUp: tierAfter.id !== tierBefore.id && e.after > e.before ? tierAfter : null,
      tierDown: tierAfter.id !== tierBefore.id && e.after < e.before ? tierAfter : null,
    };
  });
}
