/* When a match began, as a time of day. A game logged through Game night's timer carries its real start (`startedAt`, from the games.started_at column). One logged
   before that column was installed, but with its length, has the time it was saved and how long it ran, so its start is that time minus the length: close, but not exact
   (the scores and the last check took a few minutes), so it is marked as approximate. A game with only a save time (logged before the timer, no length) shows when it was
   LOGGED, as a plain time, but only when that is within a day and a half of the game's own date: a game imported in bulk was "saved" on the day of the import, and
   that says nothing about when it was played. A game with none of these has no time to show. */
export const clock = iso => { const d = new Date(iso); return Number.isNaN(+d) ? null : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

export function matchStart(g) {
  if (g.startedAt && clock(g.startedAt)) return { iso: g.startedAt, approx: false };
  if (g.savedAt && g.minutes > 0 && clock(g.savedAt)) return { iso: new Date(+new Date(g.savedAt) - g.minutes * 60000).toISOString(), approx: true };
  return null;
}

// when it was logged, if that is a believable stand-in for the day it was played
export function loggedLabel(g) {
  if (!g.savedAt || !g.date) return null;
  const saved = new Date(g.savedAt), day = new Date(`${g.date}T12:00:00`);
  return Number.isNaN(+saved) || Number.isNaN(+day) || Math.abs(+saved - +day) > 36 * 3600 * 1000 ? null : clock(g.savedAt);
}

// "7:04 PM", "~7:04 PM" when it is worked out from the save time and the length, and the plain save time ("9:40 PM") when that is all there is; null when none is
export function startLabel(g) {
  const s = matchStart(g), t = s && clock(s.iso);
  return t ? (s.approx ? '~' : '') + t : loggedLabel(g);
}
