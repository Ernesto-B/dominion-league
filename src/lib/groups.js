/* Each group gets its own colour, so "which group am I in?" is answered at a glance wherever the group is named (the top-bar pill, Game night's header and its button): a hue by the group's place in the list.
   Stable as long as the list is, and only ever shown next to the name, never alone. */
const HUES = [212, 28, 152, 330, 52, 262];
export const groupHue = (allGroups, id) => { const i = Math.max(0, (allGroups || []).findIndex(g => g.id === id)); return HUES[i % HUES.length]; };
export const groupName = (allGroups, id) => ((allGroups || []).find(g => g.id === id) || {}).name || '';

// The group Game night opens in: the one a game was last logged for on this device (a Game night is almost always for the same group), else the group being viewed.
const KEY = 'dl.nightgroup';
export function nightGroup(allGroups, viewing, storage = (() => { try { return window.localStorage; } catch { return null; } })()) {
  try { const g = storage && storage.getItem(KEY); if (g && (allGroups || []).some(x => x.id === g)) return g; } catch { /* no storage */ }
  return viewing;
}
export function rememberNightGroup(gid, storage = (() => { try { return window.localStorage; } catch { return null; } })()) { try { if (storage && gid) storage.setItem(KEY, gid); } catch { /* not remembered */ } }
