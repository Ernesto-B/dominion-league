import { impliedSets, resolveKingdom } from './kingdom.js';
import { loadNight, nightInProgress, saveNight, withGameKingdom } from '../lib/night.js';

/* "Play this kingdom again": put a past game's kingdom into Game night (the viewer's saved night for this group) and go there. Only cards and landscapes the Collection still knows are carried over.
   Returns false when there was nothing to play, or when a game is under way on Game night and the viewer said no to replacing its kingdom; true once the night is set. */
export function kingdomItemsOf(game, catalog) {
  return (game.kingdom || []).filter(k => (k.kind === 'card' ? catalog.cardsById.has(k.id) : catalog.landscapesById.has(k.id))).map(k => ({ kind: k.kind, id: k.id, ...(k.on_id || k.on ? { on: k.on_id || k.on } : {}) }));
}
export function playAgain({ game, catalog, gid, storage = (() => { try { return window.localStorage; } catch { return null; } })(), confirmFn = msg => window.confirm(msg) }) {
  const items = kingdomItemsOf(game, catalog);
  if (!items.length || !storage) return false;
  const cur = loadNight(storage, gid);
  if (nightInProgress(cur) && !confirmFn('A game is already under way on Game night. Replace its kingdom with this one?')) return false;
  const implied = impliedSets(resolveKingdom(catalog, items));
  saveNight(storage, gid, withGameKingdom(cur, { items, sets: implied.sets, landscapes: implied.landscapes }));
  return true;
}
