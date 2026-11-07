import { useEffect, useState } from 'react';
import { sb } from '../lib/supabase.js';

// A small notice when games have been logged (or removed) since this page's data was loaded, e.g. by the admin at another table. Like UpdateBar it never interrupts or
// refreshes by itself: "Refresh" reloads the league in place (no page reload, so a Game night in progress is untouched). One light query (a count and the newest id, which
// the database already limits to the groups the viewer is in) when the tab comes back into view and every 2 minutes; `mark` is what the loaded data held.
const EVERY = 2 * 60 * 1000;

export default function NewGamesBar({ gid, marks, onRefresh }) {
  const groupKey = gid ?? '', mark = marks ? marks[groupKey] || { count: 0, latest: 0 } : null;   // this group's games only: a game logged in another group is not news here
  const [now, setNow] = useState(null);   // { count, latest } as last seen on the server, for the group in view
  const [hidden, setHidden] = useState(null);
  useEffect(() => {
    setNow(null);   // another group: look again
    if (!mark) return undefined;   // an offline copy, or data from before the mark existed: nothing to compare
    let last = 0, stop = false;
    const check = async () => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false || Date.now() - last < 20000) return;
      last = Date.now();
      try {
        let q = sb.from('games').select('id', { count: 'exact' });
        q = groupKey === '' ? q.is('group_id', null) : q.eq('group_id', groupKey);
        const { data, count, error } = await q.order('id', { ascending: false }).limit(1);
        if (!stop && !error && count != null) setNow({ count, latest: data && data[0] ? data[0].id : 0 });
      } catch { /* offline: try again later */ }
    };
    check();
    const timer = setInterval(() => { last = 0; check(); }, EVERY);
    document.addEventListener('visibilitychange', check);
    return () => { stop = true; clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [mark, groupKey]);
  if (!mark || !now || (now.count === mark.count && now.latest === mark.latest)) return null;
  const key = now.count + ':' + now.latest;
  if (hidden === key) return null;
  const added = now.count - mark.count;
  return (
    <div className="updatebar gamesbar" role="status">
      <span>{added > 0 ? `${added} new game${added === 1 ? ' has' : 's have'} been logged.` : 'The games have changed.'}</span>
      <button type="button" className="updatebar-go" onClick={() => { setNow(null); onRefresh(); }}>Refresh</button>
      <button type="button" className="updatebar-x" aria-label="Dismiss" onClick={() => setHidden(key)}>✕</button>
    </div>
  );
}
