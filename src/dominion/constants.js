// Display metadata for the Dominion collection. Ownership itself is NOT hardcoded here: the owned
// expansions are whatever the imported catalog contains (see model.js). This only says how to label
// and order the ones we know about, and falls back gracefully for any that appear later.

/* THE expansion registry: the one place a Dominion expansion is described. Adding a new expansion is one entry here (plus its catalog rows and its icon, see
   docs/adding-an-expansion.md); the Admin Sets list, the set icons, the badge tracks and the Randomizer's chips are all built from it.
     key       the catalog's expansion name (what dominion_* rows say), e.g. 'Dominion Base Game'
     label     what the site shows
     icon      the SET KEY the league uses everywhere (settings.enabled_sets, a game's set tags, Admin ticks). Its artwork is public/icons/sets/<icon in kebab-case>.png
     order     where it sorts
     badges    optional [half, full] names of its two catalog badges; left out, "<label> Explorer" / "<label> Master" stand in until you pick names
   A set with no cards in the catalog yet (Adventures, Rising Sun) is listed so it can be ticked, and does nothing until its rows are loaded. */
export const EXPANSIONS = {
  'Dominion Base Game':  { label: 'Base Game',           icon: 'Base',                order: 0,   badges: ['Village Elder', 'Lord of Dominion'] },
  Intrigue:              { label: 'Intrigue',            icon: 'Intrigue',            order: 1,   badges: ['Court Intriguer', 'Master of Whispers'] },
  Seaside:               { label: 'Seaside',             icon: 'Seaside',             order: 2,   badges: ['Wanted Pirate', 'Seafaring Legend'] },
  Prosperity:            { label: 'Prosperity',          icon: 'Prosperity',          order: 3,   badges: ['Vault Keeper', 'Grand Treasurer'] },
  Hinterlands:           { label: 'Hinterlands',         icon: 'Hinterlands',         order: 4,   badges: ['Border Wanderer', 'Warden of the Marches'] },
  'Dark Ages':           { label: 'Dark Ages',           icon: 'Dark Ages',           order: 5,   badges: ['Grave Robber', 'Plaguebringer'] },
  'Cornucopia & Guilds': { label: 'Cornucopia & Guilds', icon: 'Cornucopia & Guilds', order: 6,   badges: ['Guild Apprentice', 'Guildmaster'] },
  Adventures:            { label: 'Adventures',          icon: 'Adventures',          order: 6.5 },
  Empires:               { label: 'Empires',             icon: 'Empires',             order: 7,   badges: ['Imperial Envoy', 'Grand Consul'] },
  Renaissance:           { label: 'Renaissance',         icon: 'Renaissance',         order: 8,   badges: ['Patron of the Arts', 'Enlightened'] },
  Menagerie:             { label: 'Menagerie',           icon: 'Menagerie',           order: 9,   badges: ['Horse Whisperer', 'Master of the Menagerie'] },
  Plunder:               { label: 'Plunder',             icon: 'Plunder',             order: 10,  badges: ['Treasure Hunter', 'Pirate King'] },
  'Rising Sun':          { label: 'Rising Sun',          icon: 'Rising Sun',          order: 11 },
};
export const expansionMeta = name => EXPANSIONS[name] || { label: name, icon: null, order: 99 };

// "Knight" and "Castle" are only the printed type of two special piles (Knights, Castles), so the card-types-by-expansion
// table leaves them out. They remain in the printed-types chart and the card filters.
export const MATRIX_SKIPPED_TYPES = ['Knight', 'Castle'];

export const LANDSCAPE_TYPES = ['Event', 'Landmark', 'Project', 'Way', 'Trait'];   // display order
export const PLURAL = { Event: 'Events', Landmark: 'Landmarks', Project: 'Projects', Way: 'Ways', Trait: 'Traits' };

export const humanize = id => { const s = String(id ?? '').replace(/_/g, ' ').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
export const list = s => (s ? String(s).split('|').map(x => x.trim()).filter(Boolean) : []);
