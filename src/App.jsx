import { useEffect, useMemo } from 'react';
import { LeagueProvider, useLeague } from './League.jsx';
import { useHash } from './useHash.js';
import { parseHash, ROUTES } from './lib/route.js';
import Header from './components/Header.jsx';
import Login from './components/Login.jsx';
import PasswordChange from './components/PasswordChange.jsx';
import LegacyPage from './components/LegacyPage.jsx';

function Shell() {
  const { state, boot } = useLeague();
  const hash = useHash();
  const ready = state.status === 'ready';
  const route = useMemo(() => ready ? parseHash(hash, state.allGroups) : null, [ready, hash, state.allGroups]);

  useEffect(() => {
    if (!ready) { document.title = state.cfg?.title || 'Dominion Night'; return; }
    const r = route.route;
    document.title = (r === 'home' || !ROUTES.includes(r) ? '' : r.charAt(0).toUpperCase() + r.slice(1) + ' · ') + (state.cfg.title || 'Dominion Night');
  }, [ready, route, state.cfg]);

  // The skip link would otherwise change the hash (and so the route); focus <main> directly instead.
  const skip = e => { e.preventDefault(); document.getElementById('main')?.focus(); };

  let body;
  if (ready) body = <LegacyPage league={state} boot={boot} route={route} />;
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
      <Header ready={ready ? { ...state, route } : null} hash={hash} />
      {body}
      <footer className="foot"><span id="foot">{ready ? 'Ratings are recalculated in your browser each time the page loads.' : ''}</span></footer>
    </>
  );
}

export default function App() {
  return <LeagueProvider><Shell /></LeagueProvider>;
}
