import { useEffect, useState } from 'react';
import { isNewer, runningEntry } from '../lib/version.js';

// A small, dismissible notice when a newer version of the site has been published. It never interrupts: the page keeps working, and
// reloading is the person's choice (a Game night in progress is kept in localStorage, so a reload loses nothing).
// Checked when the tab comes back into view and at most every 10 minutes; production only (nothing is hashed in dev).
const EVERY = 10 * 60 * 1000;

export default function UpdateBar() {
  const [fresh, setFresh] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const running = runningEntry();
    if (!import.meta.env.PROD || !running) return undefined;
    let last = Date.now(), stop = false;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < EVERY) return;
      last = Date.now();
      try {
        // `_v` makes the address unique and tells the service worker to leave it alone (public/sw.js), so this really asks the network
        const res = await fetch(`./?_v=${Date.now()}`, { cache: 'no-store' });
        if (!stop && res.ok && isNewer(running, await res.text())) setFresh(true);
      } catch { /* offline: try again later */ }
    };
    const first = setTimeout(() => { last = 0; check(); }, 30000);
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, EVERY);
    return () => { stop = true; clearTimeout(first); clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, []);
  if (!fresh || hidden) return null;
  return (
    <div className="updatebar" role="status">
      <span>A new version is available.</span>
      <button type="button" className="updatebar-go" onClick={() => window.location.reload()}>Reload</button>
      <button type="button" className="updatebar-x" aria-label="Dismiss" onClick={() => setHidden(true)}>✕</button>
    </div>
  );
}
