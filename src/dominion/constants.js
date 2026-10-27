// Display metadata for the Dominion collection. Ownership itself is NOT hardcoded here: the owned
// expansions are whatever the imported catalog contains (see model.js). This only says how to label
// and order the ones we know about, and falls back gracefully for any that appear later.

/* `icon` is the key into src/lib/sets.js SET_ICONS (the owner's own expansion artwork in public/icons/sets). */
export const EXPANSIONS = {
  'Dominion Base Game':  { label: 'Base Game',           icon: 'Base',                order: 0 },
  Intrigue:              { label: 'Intrigue',            icon: 'Intrigue',            order: 1 },
  Seaside:               { label: 'Seaside',             icon: 'Seaside',             order: 2 },
  Prosperity:            { label: 'Prosperity',          icon: 'Prosperity',          order: 3 },
  Hinterlands:           { label: 'Hinterlands',         icon: 'Hinterlands',         order: 4 },
  'Dark Ages':           { label: 'Dark Ages',           icon: 'Dark Ages',           order: 5 },
  'Cornucopia & Guilds': { label: 'Cornucopia & Guilds', icon: 'Cornucopia & Guilds', order: 6 },
  Empires:               { label: 'Empires',             icon: 'Empires',             order: 7 },
  Renaissance:           { label: 'Renaissance',         icon: 'Renaissance',         order: 8 },
  Menagerie:             { label: 'Menagerie',           icon: 'Menagerie',           order: 9 },
  Plunder:               { label: 'Plunder',             icon: 'Plunder',             order: 10 },
};
export const expansionMeta = name => EXPANSIONS[name] || { label: name, icon: null, order: 99 };

// "Knight" and "Castle" are only the printed type of two special piles (Knights, Castles), so the card-types-by-expansion
// table leaves them out. They remain in the printed-types chart and the card filters.
export const MATRIX_SKIPPED_TYPES = ['Knight', 'Castle'];

export const LANDSCAPE_TYPES = ['Event', 'Landmark', 'Project', 'Way', 'Trait'];   // display order
export const PLURAL = { Event: 'Events', Landmark: 'Landmarks', Project: 'Projects', Way: 'Ways', Trait: 'Traits' };

// Shown wherever mechanics are filtered or counted. The dataset only records POSITIVE tags.
export const MECHANICS_NOTE = 'Mechanic tags are recorded positive classifications, not an exhaustive list. A card without a tag may still have that effect — a missing tag is not a confirmed "no".';
export const MECHANICS_PROVISIONAL = 'Provisional: tags are still being reviewed, so counts are lower bounds, not totals.';

export const humanize = id => { const s = String(id ?? '').replace(/_/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
export const list = s => (s ? String(s).split('|').map(x => x.trim()).filter(Boolean) : []);
