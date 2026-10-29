import { useMemo, useState } from 'react';
import { usePage } from '../PageContext.js';
import { badgesFor } from '../lib/xp.js';
import { isWelcomed, markWelcomed } from '../lib/welcome.js';

const store = () => { try { return window.localStorage; } catch { return null; } };

/* A short welcome the first time a player opens the site on a device: one line each for the Rankings and Season pages, XP and badges, the Collection and
   Records. Dismissed for good with either button. */
export default function Welcome() {
  const { me, D, gid, hashFor, catalog } = usePage();
  const [gone, setGone] = useState(() => (me ? isWelcomed(store(), me.name) : true));
  const mineP = me && D.players.find(x => x.name === me.name);
  const total = useMemo(() => (mineP && mineP.rated ? badgesFor(D, mineP, catalog).length : 0), [mineP, D, catalog]);
  if (!me || gone) return null;
  const done = () => { markWelcomed(store(), me.name); setGone(true); };
  return (
    <section className="welcome" aria-label="Welcome">
      <p className="welcome-kicker">Welcome, {me.name}</p>
      <p className="welcome-title">Every game night, kept score</p>
      <ul>
        <li><b>Rankings and Season:</b> Elo is your skill rating; season points decide each season’s champion title.</li>
        <li><b>XP and badges:</b> every game earns XP. {total ? `${total} badges` : 'Dozens of badges'} to unlock in many ways, a few secret. Pin three under your name to show off.</li>
        <li><b>Collection:</b> detailed info on every card, a kingdom randomizer, and what you’ve played.</li>
        <li><b>Records:</b> the league’s bests, from top Elo to biggest wins and stats.</li>
      </ul>
      <p className="welcome-go">
        <a className="btn" href={hashFor('players', gid, encodeURIComponent(me.name))} onClick={done}>See my badges</a>
        <button type="button" className="ghost" onClick={done}>Got it</button>
      </p>
    </section>
  );
}
