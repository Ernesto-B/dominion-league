import { createRoot } from 'react-dom/client';

// Migration step 1: prove the Vite + React pipeline end to end. The legacy
// app (public/js/app.js) still renders everything; React owns only this
// mount point until pages are ported over one at a time.
function MigrationMarker() {
  return <span>React ✓</span>;
}

createRoot(document.getElementById('react-root')).render(<MigrationMarker />);
