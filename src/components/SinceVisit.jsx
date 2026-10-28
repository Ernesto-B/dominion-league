import { useState } from 'react';
import { usePage } from '../PageContext.js';
import { loadSeen, saveSeen, sinceLastVisit, snapshotOf } from '../lib/lastVisit.js';

const storage = () => { try { return window.localStorage; } catch { return null; } };

/* ux flag "redesign": a short, factual note about what changed since the viewer last looked at this group's ladder. The first visit just
   records where things stand. The note stays until it is dismissed ("Got it"), so a reload doesn't lose it. */
export default function SinceVisit({ ranked }) {
  const { D, gid, me } = usePage();
  const [prev, setPrev] = useState(() => { const s = storage(); if (!s) return null; const p = loadSeen(s, gid); if (!p) saveSeen(s, gid, snapshotOf(ranked, D.games)); return p; });
  const note = prev ? sinceLastVisit(prev, ranked, D.games, me ? me.name : null) : null;
  if (!note) return null;
  const dismiss = () => { const s = storage(); if (s) saveSeen(s, gid, snapshotOf(ranked, D.games)); setPrev(null); };
  return (
    <section className="since" aria-label="Since you last looked">
      <div className="since-head"><b>Since you last looked</b><span className="meta"> · {note.games} new game{note.games === 1 ? '' : 's'}{note.nights > 1 ? ` over ${note.nights} nights` : ''}</span></div>
      <ul>{note.lines.map(l => <li key={l.text} className={'since-' + l.kind}>{l.text}</li>)}</ul>
      <button type="button" className="ghost" onClick={dismiss}>Got it</button>
    </section>
  );
}
