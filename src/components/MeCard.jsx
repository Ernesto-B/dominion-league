import { usePage } from '../PageContext.js';
import { meSummary } from '../lib/meSummary.js';
import { ord, short, sgn } from '../lib/format.js';
import TierIcon from './TierIcon.jsx';
import { BadgeReward, LevelReward } from './RewardCard.jsx';
import PinnedBadges from './PinnedBadges.jsx';
import CountUp from './CountUp.jsx';
import HoverPopup from './HoverPopup.jsx';
import { tierRange } from './TierLegend.jsx';
import { steadyPayout } from '../lib/steadyElo.js';
import { useEffect, useMemo, useState } from 'react';
import { badgesFor, xpOf } from '../lib/xp.js';
import { earnedIds, loadBadgesSeen, newBadges, rivalries, saveBadgesSeen } from '../lib/achievements.js';

/* The Rankings page opens with the signed-in player, not the whole ladder — where they stand, how far to the next spot, and how the
   last few games went. The Elo counts up from the start rating when the card appears. */
export default function MeCard({ ranked }) {
  const { me, D, gid, hashFor, catalog } = usePage();
  const store = () => { try { return window.localStorage; } catch { return null; } };
  // badges the viewer hasn't been told about: a first look records what is already earned and says nothing; "Nice" marks the rest as seen
  const mineP = me && D.players.find(x => x.name === me.name);
  const list = useMemo(() => (mineP && mineP.rated ? badgesFor(D, mineP, catalog) : []), [mineP, D, catalog]);
  const nem = useMemo(() => (mineP && mineP.rated ? rivalries(D.h2h(null), me.name).nem : null), [mineP, D, me]);
  // what was already earned the last time this device looked. Nothing is announced until the catalog is in (its badges would all look new), and a first look only records.
  const [seen, setSeen] = useState(() => { const s = store(); return s ? loadBadgesSeen(s, gid) : null; });
  useEffect(() => {
    if (!catalog || seen || !list.length) return;
    const s = store(); if (s) saveBadgesSeen(s, gid, earnedIds(list));
    setSeen(earnedIds(list));
  }, [catalog, seen, list, gid]);
  const fresh = seen && catalog ? newBadges(list, seen) : [];
  const xp = me ? xpOf(D, me.name, catalog) : null;
  // the level this device last saw: a first look only records it; a higher level afterwards is announced
  const lvKey = 'dl.level.' + (gid ?? 'all');
  const [lvSeen, setLvSeen] = useState(() => { try { const v = store() && store().getItem(lvKey); return v == null ? null : Number(v); } catch { return null; } });
  const level = xp && xp.perGame.length ? xp.level : null;
  useEffect(() => {
    if (!catalog || lvSeen != null || level == null) return;
    try { const s = store(); if (s) s.setItem(lvKey, String(level)); } catch { /* not remembered */ }
    setLvSeen(level);
  }, [catalog, lvSeen, level, lvKey]);
  const lvlUp = level != null && lvSeen != null && catalog && level > lvSeen ? level : null;
  if (!me) return null;
  const gotIt = () => {
    const s = store(); if (s) { saveBadgesSeen(s, gid, earnedIds(list)); try { if (level != null) s.setItem(lvKey, String(level)); } catch { /* not remembered */ } }
    setSeen(earnedIds(list)); if (level != null) setLvSeen(level);
  };
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
          <div className="mc-tierrow">
            <p className="mc-tier">{s.tier.name}{s.provisional && <span className="tag">provisional</span>}{s.tierHeld && <span className="tag" title="Your Elo is under this tier's line. Get back over it soon or you drop.">on thin ice</span>}</p>
            {mineP && <PinnedBadges p={mineP} list={list} fit />}
          </div>
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
        {xp && xp.perGame.length > 0 && <div className="mc-tile"><span className="mc-label">Level</span><b className="mc-big">{xp.level}<small> · {xp.total.toLocaleString()} XP</small></b><span className="mc-sub">{xp.need.toLocaleString()} XP to level {xp.level + 1}</span></div>}
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
      {list.length > 0 && <p className="mc-badges"><a href={mine}>Badges <b>{list.filter(b => b.earned).length}</b> of {list.length}</a><span className="meta"> — see what’s next</span></p>}
      {(fresh.length > 0 || lvlUp) && (
        <div role="status">
          <ul className="rewards">
            {lvlUp && <LevelReward level={lvlUp} from={lvSeen} />}
            {[...fresh].sort((a, b) => !!b.secret - !!a.secret).slice(0, 3).map((b, i) => <BadgeReward key={b.id} b={b} i={i + (lvlUp ? 1 : 0)} mine />)}
          </ul>
          <p className="badge-new"><span>{fresh.length > 3 ? `and ${fresh.length - 3} more new badges` : ''}</span><button type="button" className="ghost" onClick={gotIt}>Nice</button></p>
        </div>
      )}
    </section>
  );
}
