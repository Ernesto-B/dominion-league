import { ago } from '../lib/snapshot.js';

// shown while the page is running on the copy saved on this device (League.jsx sets offlineAt); the pull-to-refresh and the "online" event retry
export default function OfflineBar({ at, onRetry }) {
  return (
    <p className="offlinebar" role="status">
      <span>Offline — showing what was saved {ago(at)}.</span>
      <button type="button" className="linkish" onClick={onRetry}>Try again</button>
    </p>
  );
}
