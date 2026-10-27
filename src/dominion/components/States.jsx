import { describeError } from '../api.js';

export function LoadingState() {
  return (
    <div className="dn-skeleton" role="status" aria-live="polite" aria-busy="true">
      <p className="loading">Loading the collection…</p>
      <div className="dn-skel dn-skel-tiles">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} />)}</div>
      <div className="dn-skel dn-skel-rows">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</div>
    </div>
  );
}

// Only the fixed, safe message from describeError is shown — never the raw error (which can contain SQL or table names).
export function ErrorState({ error, onRetry }) {
  const d = describeError(error);
  return (
    <div className="banner" role="alert">
      <b>{d.title}</b>
      <p style={{ margin: '6px 0 10px' }}>{d.message}</p>
      {onRetry && d.kind !== 'not-installed' && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export const EmptyState = ({ children }) => <p className="empty" role="status">{children}</p>;
