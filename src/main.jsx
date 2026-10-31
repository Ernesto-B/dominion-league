import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { prefetchCollection } from './pages/index.js';

// Not wrapped in <StrictMode> yet. It only changes development builds (double-invoked effects), so it
// is worth trying: the auth subscription in League.jsx and the modal/popup effects all clean up, and
// boot() just fetches twice in dev. Re-run the browser suites against a dev server if you turn it on.
createRoot(document.getElementById('root')).render(<App />);

window.addEventListener('load', prefetchCollection, { once: true });

// the service worker keeps the site's own files so it opens offline (public/sw.js); not in dev, where it would cache stale modules
if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* no offline shell: the site still works online */ }); });

// iOS Safari can still zoom on a double tap over elements `touch-action` doesn't reach (and ignores user-scalable=no): swallow the second tap's default. Pinch zoom is untouched.
let lastTap = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTap < 350 && e.touches.length === 0 && e.cancelable && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) e.preventDefault();
  lastTap = now;
}, { passive: false });
