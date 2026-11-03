import { EXPANSIONS } from '../dominion/constants.js';

// Set key -> icon slug (public/icons/sets/<slug>.png), in display order. Built from the one expansion registry (dominion/constants.js), so a new
// expansion appears in the Admin Sets list, the game forms and the filters without touching this file.
export const kebab = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const SET_ICONS = Object.fromEntries(Object.values(EXPANSIONS).slice().sort((a, b) => a.order - b.order).map(e => [e.icon, kebab(e.icon)]));
export const SET_NAMES = Object.keys(SET_ICONS);

export const LANDSCAPES = ['Events', 'Projects', 'Traits', 'Landmarks', 'Ways'];
export const setIconPath = name => { const slug = SET_ICONS[name]; return slug ? `icons/sets/${slug}.png` : null; };
