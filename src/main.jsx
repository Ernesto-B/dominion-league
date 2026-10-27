import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// No <StrictMode>: its dev-only double-invoked effects would run the legacy
// page renderer (and the auth subscription) twice. Revisit once pages are ported.
createRoot(document.getElementById('root')).render(<App />);
