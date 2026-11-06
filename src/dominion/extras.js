/* Cards that are NOT Kingdom cards, landscapes or Artifacts (so they are not in the catalog) but that a catalog card's text hands out: the Horse, Spoils, Madman and Mercenary piles. They have no page of
   their own, only a picture (id `extra:<name>`, built by scripts/dominion/build-card-images.mjs from the owner's folders), shown on the card that gives them. */
export const EXTRA_CARDS = [
  { id: 'extra:horse', name: 'Horse', expansion: 'Menagerie', pattern: /\bHorses?\b/ },
  { id: 'extra:spoils', name: 'Spoils', expansion: 'Dark Ages', pattern: /\bSpoils\b/ },
  { id: 'extra:madman', name: 'Madman', expansion: 'Dark Ages', pattern: /\bMadman\b/ },
  { id: 'extra:mercenary', name: 'Mercenary', expansion: 'Dark Ages', pattern: /\bMercenary\b/ },
];

/* Piles of DIFFERENT cards that a text hands out ("gain a Loot"): Plunder's Loot (15), Dark Ages' Ruins (5) and Cornucopia & Guilds' Rewards (6, what Joust gives); plus the Shelters (3) and Platinum and Colony (2), which only the setup notes show. Each card is pictured as `extra:<pile>:<name>`.
   The patterns only match a card that GIVES the pile, so Vagrant, which merely looks for Ruins, does not get it. */
const pile = (key, name, expansion, pattern, names) => ({ key, name, expansion, pattern, cards: names.map(n => ({ id: `extra:${key}:${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: n })) });
export const EXTRA_PILES = [
  pile('loot', 'Loot', 'Plunder', /\bgain (?:a|an|any) Loot\b/i, ['Amphora', 'Doubloons', 'Endless Chalice', 'Figurehead', 'Hammer', 'Insignia', 'Jewels', 'Orb', 'Prize Goat', 'Puzzle Box', 'Sextant', 'Shield', 'Spell Scroll', 'Staff', 'Sword']),
  pile('ruins', 'Ruins', 'Dark Ages', /\bgains? (?:an? |\d+ )?Ruins\b/i, ['Abandoned Mine', 'Ruined Library', 'Ruined Market', 'Ruined Village', 'Survivors']),
  pile('rewards', 'Rewards', 'Cornucopia & Guilds', /\bgain any Reward\b/i, ['Coronet', 'Courser', 'Demesne', 'Housecarl', 'Huge Turnip', 'Renown']),
  // not handed out by any card's text, so no pattern: these are shown by the randomizer's setup notes (Shelters, Platinum and Colony)
  pile('shelters', 'Shelters', 'Dark Ages', null, ['Hovel', 'Necropolis', 'Overgrown Estate']),
  pile('platinum-colony', 'Platinum and Colony', 'Prosperity', null, ['Platinum', 'Colony']),
];
export const pileByKey = key => EXTRA_PILES.find(p => p.key === key);
/* every extra picture the build looks for: the single cards and the cards of each pile */
export const EXTRA_PICTURES = [...EXTRA_CARDS.map(x => ({ id: x.id, name: x.name, expansion: x.expansion })), ...EXTRA_PILES.flatMap(p => p.cards.map(c => ({ id: c.id, name: c.name, expansion: p.expansion })))];

/* What an item's own printed text names: the extra cards and piles above and any Artifact (Flag, Horn, Key, Lantern, Treasure Chest), read from the text, never guessed, so it is exactly "cards this one
   mentions". `item` is a card or a landscape (anything with `id` and `text`). */
export function relatedOf(catalog, item) {
  const text = String((item && item.text) || '');
  if (!text) return [];
  const extras = EXTRA_CARDS.filter(x => x.pattern.test(text)).map(x => ({ kind: 'extra', id: x.id, name: x.name, expansion: x.expansion }));
  const artifacts = (catalog.artifacts || []).filter(a => a.id !== item.id && new RegExp(`\\b${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)).map(a => ({ kind: 'artifact', id: a.id, name: a.name, expansion: a.expansion }));
  const piles = EXTRA_PILES.filter(x => x.pattern && x.pattern.test(text)).map(x => ({ kind: 'pile', id: `extra:${x.key}`, name: x.name, expansion: x.expansion, cards: x.cards }));
  return [...extras, ...piles, ...artifacts];
}
