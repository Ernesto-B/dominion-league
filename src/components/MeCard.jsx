import { usePage } from '../PageContext.js';
import { meSummary } from '../lib/meSummary.js';
import { ord, short, sgn } from '../lib/format.js';
import TierIcon from './TierIcon.jsx';
import { uxOn } from '../ux.js';

/* EXPERIMENT (ux flag "home"): the Rankings page opens with the signed-in player, not the whole ladder — where they stand, how far
   to the next spot, and how the last few games went. */
export default function MeCard({ ranked }) {
  const { me, D, gid, hashFor } = usePage();
  if (!me) return null;
  const s = meSummary(ranked, me.name, D.E.start);
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
        <p className="mecard-rank"><b>#{s.rank}</b> of {s.of} <span className="mecard-elo">{s.elo} Elo</span>{s.provisional && <span className="tag">provisional</span>}</p>
        <p className="meta mecard-line">
          {s.gap && (s.gap.kind === 'behind' ? <>{s.gap.elo} Elo behind <a href={hashFor('players', gid, encodeURIComponent(s.gap.who))}>{s.gap.who}</a> (#{s.gap.rank})</> : <>Clear of <a href={hashFor('players', gid, encodeURIComponent(s.gap.who))}>{s.gap.who}</a> by {s.gap.elo} Elo</>)}
          {s.streak >= 3 && <> · {s.streak} wins in a row</>}
        </p>
        {s.last && (
          <p className="mecard-last">
            <span className="form" aria-label="Recent form">{s.form.map((f, i) => <i key={i} className={f.tone} title={`${short(f.date)}: ${ord(f.place)} of ${f.of}`}></i>)}</span>
            Last game {short(s.last.date)}: <b>{ord(s.last.place)}</b> of {s.last.of} <span className={s.last.delta > 0 ? 'up-t' : s.last.delta < 0 ? 'down-t' : ''}>({sgn(s.last.delta)})</span>
          </p>
        )}
        <p className="mecard-go"><a className="btn ghost" href={mine}>Your page</a>{uxOn('flow') && me.is_admin && <a className="btn" href={hashFor('night', gid)}>Game night</a>}</p>
      </div>
    </section>
  );
}
