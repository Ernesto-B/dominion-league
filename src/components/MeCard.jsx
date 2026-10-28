import { usePage } from '../PageContext.js';
import { meSummary } from '../lib/meSummary.js';
import { ord, short, sgn } from '../lib/format.js';
import TierIcon from './TierIcon.jsx';
import CountUp from './CountUp.jsx';
import { steadyPayout } from '../lib/steadyElo.js';
import { useState } from 'react';
import { achievements, earnedIds, loadBadgesSeen, newBadges, rivalries, saveBadgesSeen } from '../lib/achievements.js';

/* The Rankings page opens with the signed-in player, not the whole ladder — where they stand, how far to the next spot, and how the
   last few games went. The Elo counts up from the start rating when the card appears. */
export default function MeCard({ ranked }) {
  const { me, D, gid, hashFor } = usePage();
  const store = () => { try { return window.localStorage; } catch { return null; } };
  // badges the viewer hasn't been told about: a first look records what is already earned and says nothing; "Nice" marks the rest as seen
  const mineP = me && D.players.find(x => x.name === me.name);
  const list = mineP && mineP.rated ? achievements(mineP, D.tiers, ranked.map(x => x.name)) : [];
  const [fresh, setFresh] = useState(() => {
    const s = store(); if (!s || !list.length) return [];
    const seen = loadBadgesSeen(s, gid);
    if (!seen) { saveBadgesSeen(s, gid, earnedIds(list)); return []; }
    return newBadges(list, seen);
  });
  if (!me) return null;
  const nem = mineP && mineP.rated ? rivalries(D.h2h(null), me.name).nem : null;
  const gotIt = () => { const s = store(); if (s) saveBadgesSeen(s, gid, earnedIds(list)); setFresh([]); };
  const s = meSummary(ranked, me.name, D.E.start, steadyPayout(4, D.E)[0]);
  const mine = hashFor('players', gid, encodeURIComponent(me.name));
  if (!s) return (
    <section className="mecard" aria-label="You">
      <div className="mecard-main"><p className="mecard-hi">Hi {me.name}</p><p className="meta" style={{ margin: 0 }}>You’re not on the ladder yet — it appears after your first rated game.</p></div>
    </section>
  );
  return (
    <section className="mecard" aria-label="You">
      <TierIcon id={s.tier.icon} size={56} alt={s.tier.name + ' tier'} />
      <div className="mecard-main">
        <p className="mecard-hi">Hi {me.name}{s.titles ? ' · season champion' : ''}</p>
        <p className="mecard-rank"><b>#{s.rank}</b> of {s.of} <span className="mecard-elo"><CountUp value={s.elo} from={D.E.start} /> Elo</span>{s.provisional && <span className="tag">provisional</span>}</p>
        <p className="meta mecard-line">
          {s.gap && (s.gap.kind === 'behind' ? <>{s.gap.elo} Elo behind <a href={hashFor('players', gid, encodeURIComponent(s.gap.who))}>{s.gap.who}</a> (#{s.gap.rank})</> : <>Clear of <a href={hashFor('players', gid, encodeURIComponent(s.gap.who))}>{s.gap.who}</a> by {s.gap.elo} Elo</>)}
          {s.streak >= 3 && <> · {s.streak} wins in a row</>}
        </p>
        {s.next && (
          <p className="mecard-next">
            <span className="mecard-bar" role="img" aria-label={`${Math.round(s.next.pct * 100)}% of the way to ${s.next.tier.name}`}><i style={{ width: Math.round(s.next.pct * 100) + '%' }}></i></span>
            <span><b>{s.next.need} Elo</b> to <TierIcon id={s.next.tier.icon} size={18} alt="" /> {s.next.tier.name}{s.next.wins ? <> — about {s.next.wins === 1 ? 'one win' : `${s.next.wins} wins`} at a table of four</> : null}</span>
          </p>
        )}
        {nem && <p className="meta mecard-line">Nemesis: <a href={hashFor('players', gid, encodeURIComponent(nem.o))}>{nem.o}</a> finished ahead {nem.l} of {nem.w + nem.l} times</p>}
        {fresh.length > 0 && <p className="badge-new" role="status"><span>New badge{fresh.length === 1 ? '' : 's'}: <b>{fresh.map(b => b.name).join(', ')}</b></span><button type="button" className="ghost" onClick={gotIt}>Nice</button></p>}
        {s.last && (
          <p className="mecard-last">
            <span className="form" aria-label="Recent form">{s.form.map((f, i) => <i key={i} className={f.tone} title={`${short(f.date)}: ${ord(f.place)} of ${f.of}`}></i>)}</span>
            Last game {short(s.last.date)}: <b>{ord(s.last.place)}</b> of {s.last.of} <span className={s.last.delta > 0 ? 'up-t' : s.last.delta < 0 ? 'down-t' : ''}>({sgn(s.last.delta)})</span>
          </p>
        )}
        <p className="mecard-go"><a className="btn ghost" href={mine}>Your page</a>{me.is_admin && <a className="btn" href={hashFor('night', gid)}>Game night</a>}</p>
      </div>
    </section>
  );
}
