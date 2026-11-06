import { impliedSets, resolveKingdom } from './kingdom.js';
import { loadNight, nightInProgress, nightStarted, nightTabKey, saveNight, withGameKingdom, hasNight } from '../lib/night.js';

/* "Play this kingdom again": put a past game's kingdom into Game night and go there. Only cards and landscapes the Collection still knows are carried over.
   Which table it goes to: Table 1 when nothing is going on there; when Table 1 is under way, a new Table 2 on the Players step with the same players ticked (the kingdom is preset and can
   still be changed). `fromStart` (the Replay icon) opens at step 1 whichever table it is. Resolves false when there was nothing to play, or when the table it would use is under way and
   the viewer said no to replacing its kingdom; true once the night is set (and the tab Game night opens on is remembered). */
export function kingdomItemsOf(game, catalog) {
  return (game.kingdom || []).filter(k => (k.kind === 'card' ? catalog.cardsById.has(k.id) : catalog.landscapesById.has(k.id))).map(k => ({ kind: k.kind, id: k.id, ...(k.on_id || k.on ? { on: k.on_id || k.on } : {}) }));
}
export async function playAgain({ game, catalog, gid, fromStart = false, storage = (() => { try { return window.localStorage; } catch { return null; } })(), confirmFn = msg => window.confirm(msg) }) {   // confirmFn may be async (the site's own dialog)
  const items = kingdomItemsOf(game, catalog);
  if (!items.length || !storage) return false;
  const first = hasNight(storage, gid, 0) ? loadNight(storage, gid, undefined, undefined, 0) : null;
  const slot = first && nightStarted(first) ? 1 : 0;
  const cur = slot === 0 ? (first || loadNight(storage, gid, undefined, undefined, 0)) : (hasNight(storage, gid, 1) ? loadNight(storage, gid, undefined, undefined, 1) : null);
  if (cur && nightInProgress(cur) && !(await confirmFn('A game is already under way on Game night. Replace its kingdom with this one?'))) return false;
  const implied = impliedSets(resolveKingdom(catalog, items));
  const base = slot === 1 ? { ...(cur || loadNight(storage, gid, undefined, undefined, 1)), picked: (game.names || []).slice(), tie: {} } : (cur || loadNight(storage, gid));
  const night = withGameKingdom(base, { items, sets: implied.sets, landscapes: implied.landscapes });
  saveNight(storage, gid, fromStart || slot === 1 ? { ...night, step: 'players' } : night, undefined, slot);
  try { sessionStorage.setItem(nightTabKey(gid), String(slot)); } catch { /* not remembered */ }
  return true;
}
