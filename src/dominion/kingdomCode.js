/* A kingdom code: the exact cards and landscapes of a kingdom as a short string you can send to someone, for kingdoms that no seed can describe (picked by hand, or a roll with a locked card).
   A seed only works because the generator rebuilds the roll from it; a hand-picked kingdom did not come from the generator, so the code lists the kingdom itself.
   "K-" + groups of four letters and digits (Crockford base 32: no I, L, O or U, case ignored). What is packed, in bits:
     checksum (10)  of the catalog's sorted card and landscape ids: a code made against a different card list is refused instead of giving the wrong cards
     cards    (5 for how many, then each card's place in the sorted ids)   the Kingdom cards in order, a Young Witch's Bane last
     bane     (1)   whether the last of them is a Bane
     landscapes (3 for how many, then each one's place)   and for each Trait, which card it is on (4: 0 = none, else that card's position + 1)
   Pure: no DOM, no randomness. Needs the catalog (its cards and landscapes are the alphabet of the codes). */
import { slotCardId, stateFromItems, toGameItems } from './randomizer.js';

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const bitsFor = n => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));

function tables(catalog) {
  const cards = catalog.cards.map(c => c.id).sort(), lands = catalog.landscapes.map(l => l.id).sort();
  let h = 7; for (const ch of cards.join('|') + '#' + lands.join('|')) h = (h * 31 + ch.charCodeAt(0)) % 1024;
  return { cards, lands, cardIx: new Map(cards.map((id, i) => [id, i])), landIx: new Map(lands.map((id, i) => [id, i])), check: h, cb: bitsFor(cards.length), lb: bitsFor(lands.length) };
}

export const looksLikeCode = text => /^\s*k[-\s]?[0-9a-z-\s]+$/i.test(String(text || '')) && /[a-z]/i.test(String(text).replace(/^\s*k/i, ''));

export function encodeKingdom(catalog, state) {
  const t = tables(catalog), items = toGameItems(state);
  const cards = items.filter(i => i.kind === 'card'), lands = items.filter(i => i.kind === 'landscape');
  if (!cards.length) return null;
  const bits = [], put = (v, n) => { for (let k = n - 1; k >= 0; k--) bits.push((v >> k) & 1); };
  put(t.check, 10);
  put(cards.length, 5); cards.forEach(c => put(t.cardIx.get(c.id) ?? 0, t.cb));
  put(state.setup && state.setup.bane ? 1 : 0, 1);
  put(lands.length, 3); lands.forEach(l => put(t.landIx.get(l.id) ?? 0, t.lb));
  lands.forEach(l => { if (catalog.landscapesById.get(l.id)?.type === 'Trait') put(l.on ? cards.findIndex(c => c.id === l.on) + 1 : 0, 4); });
  while (bits.length % 5) bits.push(0);
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += ALPHA[bits.slice(i, i + 5).reduce((a, b) => a * 2 + b, 0)];
  return 'K-' + out.match(/.{1,4}/g).join('-');
}

// a kingdom state from a code, or { error } saying why not
export function decodeKingdom(catalog, text) {
  const raw = String(text || '').toUpperCase().replace(/^\s*K/, '').replace(/[^0-9A-Z]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  const bits = [];
  for (const ch of raw) { const v = ALPHA.indexOf(ch); if (v < 0) return { error: 'That isn’t a kingdom code.' }; for (let k = 4; k >= 0; k--) bits.push((v >> k) & 1); }
  const t = tables(catalog); let at = 0;
  const get = n => { let v = 0; for (let k = 0; k < n; k++) { if (at >= bits.length) throw new Error('short'); v = v * 2 + bits[at++]; } return v; };
  try {
    if (get(10) !== t.check) return { error: 'That code was made with a different card list, so it can’t be read here.' };
    const n = get(5), cards = Array.from({ length: n }, () => t.cards[get(t.cb)]);
    const hasBane = get(1) === 1, nl = get(3), lands = Array.from({ length: nl }, () => t.lands[get(t.lb)]);
    if (!n || cards.some(c => !c) || lands.some(l => !l)) return { error: 'That isn’t a kingdom code.' };
    const items = [...cards.map(id => ({ kind: 'card', id })), ...lands.map(id => {
      if (catalog.landscapesById.get(id)?.type !== 'Trait') return { kind: 'landscape', id };
      const on = get(4); return { kind: 'landscape', id, ...(on ? { on: cards[on - 1] } : {}) };
    })];
    const state = stateFromItems(catalog, items, hasBane ? cards[cards.length - 1] : null);
    return state ? { state } : { error: 'That isn’t a kingdom code.' };
  } catch { return { error: 'That isn’t a kingdom code.' }; }
}
