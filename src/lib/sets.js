// Expansion name -> icon slug (public/icons/sets/<slug>.png).
export const SET_ICONS = {
  Base: 'base', Intrigue: 'intrigue', Seaside: 'seaside', Prosperity: 'prosperity',
  Hinterlands: 'hinterlands', 'Dark Ages': 'dark-ages', 'Cornucopia & Guilds': 'cornucopia-guilds',
  Adventures: 'adventures', Empires: 'empires', Renaissance: 'renaissance', Menagerie: 'menagerie', Plunder: 'plunder', 'Rising Sun': 'rising-sun',
};
export const SET_NAMES = Object.keys(SET_ICONS);

export const LANDSCAPES = ['Events', 'Projects', 'Traits', 'Landmarks', 'Ways'];
export const setIconPath = name => { const slug = SET_ICONS[name]; return slug ? `icons/sets/${slug}.png` : null; };
