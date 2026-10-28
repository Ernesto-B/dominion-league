import { usePage } from '../PageContext.js';
import { meSummary } from '../lib/meSummary.js';
import { ord, short, sgn } from '../lib/format.js';
import TierIcon from './TierIcon.jsx';
import CountUp from './CountUp.jsx';
import HoverPopup from './HoverPopup.jsx';
import { tierRange } from './TierLegend.jsx';
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
  const who = n => <a href={hashFor('players', gid, encodeURIComponent(n))}>{n}</a>;
  // hovering the progress bar lists every tier and its Elo range, as on the Players page (built here because popup content has no PageContext)
  const tierRows = D.tiers.map((t, i) => (
    <div className="tierpoprow" key={t.name}><TierIcon id={t.icon} size={22} alt={t.name} /><b>{t.name}</b><span>{tierRange(D.tiers, i)}</span></div>
  ));
  const pct = s.next ? Math.round(s.next.pct * 100) : 0;
  return (
    <section className="mecard" aria-label="You">
      <div className="mc-top">
        <TierIcon id={s.tier.icon} size={72} alt={s.tier.name + ' tier'} />
        <div className="mc-who">
          <p className="mecard-hi">Hi {me.name}{s.titles ? ' · season champion' : ''}</p>
          <p className="mc-tier">{s.tier.name}{s.provisional && <span className="tag">provisional</span>}</p>
        </div>
        <p className="mecard-go"><a className="btn ghost" href={mine}>Your page</a>{me.is_admin && <a className="btn" href={hashFor('night', gid)}>Game night</a>}</p>
      </div>

      <div className="mc-tiles">
        <div className="mc-tile"><span className="mc-label">Rank</span><b className="mc-big">#{s.rank}<small> of {s.of}</small></b>
          <span className="mc-sub">{s.gap ? (s.gap.kind === 'behind' ? <>{s.gap.elo} Elo behind {who(s.gap.who)}</> : <>{s.gap.elo} Elo clear of {who(s.gap.who)}</>) : ' '}</span></div>
        <div className="mc-tile"><span className="mc-label">Elo</span><b className="mc-big"><CountUp value={s.elo} from={D.E.start} /></b>
          <span className="mc-sub"><span className={s.fromStart > 0 ? 'up-t' : s.fromStart < 0 ? 'down-t' : ''}>{sgn(s.fromStart)}</span> vs {D.E.start} start</span></div>
        {s.last && (
          <div className="mc-tile"><span className="mc-label">Last game · {short(s.last.date)}</span>
            <b className="mc-big">{ord(s.last.place)}<small> of {s.last.of}</small> <span className={'mc-delta ' + (s.last.delta > 0 ? 'up-t' : s.last.delta < 0 ? 'down-t' : '')}>{sgn(s.last.delta)}</span></b>
            <span className="mc-sub"><span className="form" aria-label="Recent form">{s.form.map((f, i) => <i key={i} className={f.tone} title={`${short(f.date)}: ${ord(f.place)} of ${f.of}`}></i>)}</span></span></div>
        )}
        {s.streak >= 3 && <div className="mc-tile"><span className="mc-label">Win streak</span><b className="mc-big">{s.streak}</b><span className="mc-sub">wins in a row</span></div>}
        {nem && <div className="mc-tile"><span className="mc-label">Nemesis</span><b className="mc-big mc-name">{who(nem.o)}</b><span className="mc-sub">finished ahead {nem.l} of {nem.w + nem.l} times</span></div>}
      </div>

      {s.next && (
        <HoverPopup content={tierRows} className="tierbarwrap"><div className="mc-next">
          <TierIcon id={s.tier.icon} size={24} alt="" />
          <span className="mecard-bar" role="img" aria-label={`${pct}% of the way to ${s.next.tier.name}`}><i style={{ width: pct + '%' }}></i></span>
          <TierIcon id={s.next.tier.icon} size={24} alt="" />
          <span className="mc-next-txt"><b>{s.next.need} Elo</b> to {s.next.tier.name}{s.next.wins ? <> — about {s.next.wins === 1 ? 'one win' : `${s.next.wins} wins`} at a table of four</> : null}</span>
        </div></HoverPopup>
      )}
      {fresh.length > 0 && <p className="badge-new" role="status"><span>New badge{fresh.length === 1 ? '' : 's'}: <b>{fresh.map(b => b.name).join(', ')}</b></span><button type="button" className="ghost" onClick={gotIt}>Nice</button></p>}
    </section>
  );
}
