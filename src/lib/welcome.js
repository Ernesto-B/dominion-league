/* The first-visit welcome card: shown once per player per device, then remembered (localStorage `dl.welcome.<name>`). A blocked or unreadable storage means
   the card shows again next visit, never that it breaks. */
const key = name => `dl.welcome.${name}`;
export function isWelcomed(storage, name) { try { return !!(storage && storage.getItem(key(name))); } catch { return false; } }
export function markWelcomed(storage, name) { try { if (storage) storage.setItem(key(name), '1'); } catch { /* not remembered */ } }
