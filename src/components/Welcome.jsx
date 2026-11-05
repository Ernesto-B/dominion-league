import { useMemo, useState } from 'react';
import { usePage } from '../PageContext.js';
import { badgesFor } from '../lib/xp.js';
import { isWelcomed, markWelcomed } from '../lib/welcome.js';
import TierIcon from './TierIcon.jsx';

const store = () => { try { return window.localStorage; } catch { return null; } };

/* The first time a player opens the site on a device: a short walkthrough in four steps on the Rankings page (not a pop-up, so nothing blocks the page), each one sentence and a little of the
   player's own data. Next / Back, a dot for each step, and "Skip" at any time; finishing or skipping remembers it for good on this device (lib/welcome.js). */
export default function Welcome() {
  const { me, D, gid, hashFor, catalog } = usePage();
  const [gone, setGone] = useState(() => (me ? isWelcomed(store(), me.name) : true));
  const [i, setI] = useState(0);
  const mineP = me && D.players.find(x => x.name === me.name);
  const total = useMemo(() => (mineP && mineP.rated ? badgesFor(D, mineP, catalog).length : 0), [mineP, D, catalog]);
  if (!me || gone) return null;
  const done = () => { markWelcomed(store(), me.name); setGone(true); };
  const E = D.E || {}, start = D.startTier;
  const steps = [
    { title: 'Every game night, kept score', body: <>
      <p>Dominion Night tracks each game your group plays: who finished where, how your rating moves, and what was on the table.</p>
      <p className="welcome-fact">{start && <TierIcon id={start.icon} size={28} alt="" />}<span>You start at <b>{E.start} Elo</b> as a <b>{start ? start.name : 'beginner'}</b>.{mineP && !mineP.rated ? ' Your first rated game puts you on the ladder.' : ''}</span></p></> },
    { title: 'How you climb', body: <>
      <p><b>Finish in the top half and your Elo goes up;</b> win and it goes up a little more. Behind the middle of the table, it goes down. Friendly games never count.</p>
      <p className="welcome-tiers" aria-label="Rank tiers">{(D.tiers || []).map(t => <span key={t.id}><TierIcon id={t.icon} size={22} alt="" />{t.name}</span>)}</p></> },
    { title: 'XP, levels and badges', body: <>
      <p>Every game earns <b>XP</b>, even friendly ones, and XP builds your level. {total ? `There are ${total} badges` : 'There are dozens of badges'} to unlock, and a few are secret.</p>
      <p className="meta">Pin your favourite three under your name on your page.</p></> },
    { title: 'Around the site', body: <>
      <ul className="welcome-list">
        <li><b>Collection:</b> every card with its picture, the Kingdom randomizer, and the kingdoms you’ve played.</li>
        <li><b>Season and Records:</b> who is leading this season, and the league’s bests.</li>
        <li><b>Game night:</b> your admin logs each game; it appears here as soon as it’s saved.</li>
      </ul>
      <p className="meta welcome-keys">On a computer, press <kbd>?</kbd> for keyboard shortcuts.</p></> },
  ];
  const last = i === steps.length - 1, s = steps[i];
  return (
    <section className="welcome" aria-label="Welcome" aria-live="polite">
      <p className="welcome-kicker">Welcome, {me.name} <span className="welcome-step">{i + 1} of {steps.length}</span></p>
      <p className="welcome-title">{s.title}</p>
      <div className="welcome-body">{s.body}</div>
      <div className="welcome-nav">
        <span className="welcome-dots" aria-hidden="true">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'seen' : ''} />)}</span>
        <span className="welcome-go">
          {i > 0 && <button type="button" className="ghost" onClick={() => setI(i - 1)}>Back</button>}
          {last ? <a className="btn" href={hashFor('players', gid, encodeURIComponent(me.name)) + '?tab=badges'} onClick={done}>See my badges</a> : <button type="button" onClick={() => setI(i + 1)}>Next</button>}
          {last ? <button type="button" className="ghost" onClick={done}>Done</button> : <button type="button" className="linkish" onClick={done}>Skip</button>}
        </span>
      </div>
    </section>
  );
}
