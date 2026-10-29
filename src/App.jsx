import { Suspense, useEffect, useMemo, useRef } from 'react';
import { LeagueProvider, useLeague } from './League.jsx';
import { useHash } from './useHash.js';
import { useLeagueCatalog } from './useLeagueCatalog.js';
import { parseHash, hashFor, ROUTES, ROUTE_TITLES } from './lib/route.js';
import { pickD } from './lib/league.js';
import { PageContext } from './PageContext.js';
import { PAGES } from './pages/index.js';
import Header from './components/Header.jsx';
import Login from './components/Login.jsx';
import PasswordChange from './components/PasswordChange.jsx';
import PageBoundary from './components/PageBoundary.jsx';
import { sb } from './lib/supabase.js';
import PlayerHud from './components/PlayerHud.jsx';
import ScrollTopButton from './components/ScrollTopButton.jsx';
import PopLayer from './components/PopLayer.jsx';
import { popup } from './components/popup.js';
import BottomNav from './components/BottomNav.jsx';
import OfflineBar from './components/OfflineBar.jsx';
import PullToRefresh from './components/PullToRefresh.jsx';

function Shell() {
  const { state, boot } = useLeague();
  const hash = useHash();
  const catalog = useLeagueCatalog();
  const ready = state.status === 'ready';
  const lastGid = useRef((() => { try { return localStorage.getItem('dl.group'); } catch { return null; } })());
  const route = useMemo(() => ready ? parseHash(hash, state.allGroups, lastGid.current) : null, [ready, hash, state.allGroups]);
  useEffect(() => {   // remember a group the viewer picked (named in the URL) so other pages keep it
    if (!route?.explicit) return;
    lastGid.current = route.gid;
    try { localStorage.setItem('dl.group', route.gid); } catch { /* storage blocked: stays per-session */ }
  }, [route]);

  const page = useMemo(() => ready ? {
    ...state, ...route, D: pickD(state, route.gid), reload: boot, catalog,
    hashFor: (r, g, rest) => hashFor(r, g, rest, state.allGroups),
  } : null, [state, ready, route, boot, catalog]);
  const routeName = ready && ROUTES.includes(route.route) ? route.route : 'home';   // unknown routes show Home
  const Ported = ready ? PAGES[routeName] : null;

  useEffect(() => { popup.hide(); }, [hash]);   // a hover popup must not outlive its page

  useEffect(() => {
    if (!ready) { document.title = state.cfg?.title || 'Dominion Night'; return; }
    const r = route.route;
    document.title = (r === 'home' || !ROUTES.includes(r) ? '' : (ROUTE_TITLES[r] || r.charAt(0).toUpperCase() + r.slice(1)) + ' · ') + (state.cfg.title || 'Dominion Night');
  }, [ready, route, state.cfg]);

  // The skip link would otherwise change the hash (and so the route); focus <main> directly instead.
  const skip = e => { e.preventDefault(); document.getElementById('main')?.focus(); };

  let body;
  if (Ported) body = <PageContext.Provider value={page}><main id="main" tabIndex={-1}><PageBoundary resetKey={hash}><Suspense fallback={<p className="loading">Loading…</p>}><Ported /></Suspense></PageBoundary></main></PageContext.Provider>;
  else {
    let inner;
    if (state.status === 'login') inner = <Login title={state.cfg?.title} error={state.error} />;
    else if (state.status === 'pwchange') inner = <PasswordChange me={state.me} />;
    else if (state.status === 'error') inner = <><h1>Can't load the data</h1><p className="lede">{state.message}</p></>;
    else inner = <p className="loading">Loading the standings…</p>;
    body = <main id="main" tabIndex={-1}>{inner}</main>;
  }

  return (
    <>
      <a className="skip" href="#main" onClick={skip}>Skip to content</a>
      <Header ready={ready ? { ...state, route } : null} hash={hash} hud={page ? <PageContext.Provider value={page}><PlayerHud /></PageContext.Provider> : null} />
      {ready && state.offlineAt && <OfflineBar at={state.offlineAt} onRetry={boot} />}
      {body}
      {ready && <PullToRefresh onRefresh={boot} />}
      {ready && <BottomNav ready={{ ...state, route }} hash={hash} />}
      {ready && (['games', 'players', 'dominion'].includes(route.route)) && <ScrollTopButton />}
      <PopLayer />
      <footer className="foot"><span id="foot">{ready ? 'Ratings are recalculated in your browser each time the page loads.' : ''}</span>
        {ready && <a className="logout" href="#" onClick={e => { e.preventDefault(); sb.auth.signOut(); }}>Log out</a>}</footer>
    </>
  );
}

export default function App() {
  return <LeagueProvider><Shell /></LeagueProvider>;
}
