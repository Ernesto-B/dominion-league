import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { sb } from './lib/supabase.js';
import { fetchConfig, loadData } from './lib/data.js';
import { buildLeague } from './lib/league.js';

/* The session/data state machine, ported from the old boot():
     loading -> login | pwchange | ready | error
   While 'ready', calling boot() again (after an admin write) refetches and
   recomputes without leaving 'ready', so the page and any open modal stay put. */
const LeagueContext = createContext(null);
export const useLeague = () => useContext(LeagueContext);

export function LeagueProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' });
  const cfgRef = useRef(null);
  const statusRef = useRef('loading');

  const set = next => { statusRef.current = next.status; setState(next); };

  const boot = useCallback(async () => {
    try {
      // Config and session lookup don't depend on each other, so start both at once.
      const cfgP = cfgRef.current ? null : fetchConfig();
      const { data: { session } } = await sb.auth.getSession();
      if (cfgP) cfgRef.current = await cfgP;
      const cfg = cfgRef.current;
      if (!session) { set({ status: 'login', cfg }); return; }

      // The data load doesn't depend on the profile row, so overlap the two round trips.
      const dataP = loadData();
      dataP.catch(() => {});
      const { data: me, error: meErr } = await sb.from('players').select('*').eq('id', session.user.id).single();
      if (meErr || !me) {
        await sb.auth.signOut();
        set({ status: 'login', cfg, error: 'That account isn’t set up yet. Ask the admin to add you.' });
        return;
      }
      if (me.must_change_password) { set({ status: 'pwchange', cfg, me }); return; }

      set({ status: 'ready', cfg, me, ...buildLeague(cfg, await dataP, me) });
    } catch (e) {
      set({ status: 'error', message: e.message || String(e) });
    }
  }, []);

  useEffect(() => {
    boot();
    const { data: { subscription } } = sb.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && statusRef.current === 'ready') { location.hash = ''; boot(); }
    });
    return () => subscription.unsubscribe();
  }, [boot]);

  return <LeagueContext.Provider value={{ state, boot }}>{children}</LeagueContext.Provider>;
}
