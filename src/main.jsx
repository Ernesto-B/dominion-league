import { createRoot } from 'react-dom/client';
import * as Engine from './lib/engine.js';
import * as format from './lib/format.js';
import { sb } from './lib/supabase.js';

// Migration bridge: the legacy classic script (public/js/app.js) can't import
// modules, so it reads the shared lib off window.DN. Deleted once app.js is gone.
window.DN = { Engine, format, sb };

// Load the legacy app only after the bridge exists, so ordering never depends
// on how the browser interleaves module and deferred classic scripts.
const legacy = document.createElement('script');
legacy.src = import.meta.env.BASE_URL + 'js/app.js';
document.body.appendChild(legacy);

function MigrationMarker() {
  return <span>React ✓</span>;
}

createRoot(document.getElementById('react-root')).render(<MigrationMarker />);
