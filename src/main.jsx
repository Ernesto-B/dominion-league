import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyUxClasses } from './ux.js';
import { prefetchCollection } from './pages/index.js';

applyUxClasses();   // the UX experiment switches (src/ux.js) become classes on <html> before anything draws

// Not wrapped in <StrictMode> yet. It only changes development builds (double-invoked effects), so it
// is worth trying: the auth subscription in League.jsx and the modal/popup effects all clean up, and
// boot() just fetches twice in dev. Re-run the browser suites against a dev server if you turn it on.
createRoot(document.getElementById('root')).render(<App />);

window.addEventListener('load', prefetchCollection, { once: true });
