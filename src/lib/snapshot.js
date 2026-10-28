/* The last league the viewer loaded successfully, kept in localStorage so the site still opens with no connection (a game table in a
   basement, a train). It is the same data the viewer was already allowed to see, kept for that one person on that one device, and it is
   removed on sign-out. Stale by design: League.jsx only reads it when the network load fails. */
const KEY = 'dl.snapshot.v1';

export function saveSnapshot(snap, storage = store()) {
  try { storage && storage.setItem(KEY, JSON.stringify({ ...snap, at: Date.now() })); } catch { /* storage full or blocked: just no offline copy */ }
}

export function loadSnapshot(storage = store()) {
  try {
    const raw = storage && storage.getItem(KEY);
    const s = raw && JSON.parse(raw);
    return s && s.cfg && s.me && s.data && s.data.rows ? s : null;
  } catch { return null; }
}

export function clearSnapshot(storage = store()) {
  try { storage && storage.removeItem(KEY); } catch { /* ignore */ }
}

// "just now" / "5 min ago" / "3 h ago" / "2 days ago"
export function ago(at, now = Date.now()) {
  const m = Math.max(0, Math.round((now - at) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function store() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }
