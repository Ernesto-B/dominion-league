import { usePage } from '../PageContext.js';
import { compare } from '../lib/compare.js';
import TierIcon from './TierIcon.jsx';
import RatingChart from './RatingChart.jsx';
import SetIcon from './SetIcon.jsx';
import HoverPopup from './HoverPopup.jsx';
import { badgeIcon } from './badgeIcon.jsx';
import { viewHint, TIERS } from '../lib/achievements.js';
import { ord, short } from '../lib/format.js';

const LABEL = { ...Object.fromEntries(TIERS.map(t => [t.id, t.label])), secret: 'Secret' };

/* Two players side by side (#/players/<group>/<A>?vs=<B>). Built as a rivalry: what they have played together first, then the same numbers for both with no winner marked and no gap drawn, their
   rating on one chart, the badges they share, and the expansions they play most. The numbers come from lib/compare.js. */
export default function Compare({ a, b, names = [] }) {
  const { D, gid, hashFor, catalog, me } = usePage();
  const c = compare(D, a, b, catalog);
  if (!c) return <p className="empty">Pick two different players to compare.</p>;
  const { together: t, rows, sets, badges } = c;
  const side = (p, hue) => (
    <div className={'cmp-who ' + hue}>
      {p.tier && <TierIcon id={p.tier.icon} size={64} alt={p.tier.name + ' tier'} />}
      <p className="cmp-name"><a href={hashFor('players', gid, encodeURIComponent(p.name))}>{p.name}</a></p>
      {p.tier && <p className="meta">{p.tier.name}{p.rated ? ` · ${Math.round(p.elo)} Elo` : ''}</p>}
    </div>
  );
  const chip = (x, owner) => {
    const mine = !!me && (owner ? me.name === owner : me.name === a || me.name === b);
    const hint = viewHint(x, mine);
    return (
      <li key={x.id}>
        <HoverPopup className="pin-wrap" content={<div className="popdesc"><b>{x.name}</b>{LABEL[x.tier] ? ` · ${LABEL[x.tier]}` : ''}<br />{hint}{x.earned && x.earned.date ? <><br />Earned {short(x.earned.date)}</> : null}</div>}>
          <span className={'pin-chip cmp-chip td-' + x.tier}>
            <span className="pin-ico" aria-hidden="true">{badgeIcon(x, 18)}</span><span className="pin-name">{x.name}</span>
          </span>
        </HoverPopup>
      </li>
    );
  };
  return (
    <div className="cmp">
      <div className="cmp-top">
        <a href={hashFor('players', gid, encodeURIComponent(a))}>← {a}’s page</a>
        <label className="cmp-launch">Compare with
          <select value={b} onChange={e => { window.location.hash = hashFor('players', gid, encodeURIComponent(a)) + `?vs=${encodeURIComponent(e.target.value)}`; }}>
            {names.filter(n => n !== a).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="cmp-hero">{side(c.a, 'a')}<span className="cmp-vs" aria-hidden="true">vs</span>{side(c.b, 'b')}</div>

      <div className="cmp-split">
        <div>
          <h3 className="cmp-h">Side by side</h3>
          <div className="cmp-stats" role="table" aria-label={`${a} and ${b}, stat by stat`}>
            <div className="cmp-sh" role="row"><b className="a" role="columnheader"><i></i>{a}</b><b className="b" role="columnheader"><i></i>{b}</b></div>
            {rows.map(r => {
              // percentages run 0-100%; Elo runs from 300 under the starting rating; a count is measured against the larger of the two
              const lo = r.lo || 0, hi = r.hi != null ? r.hi : Math.max(+r.na || 0, +r.nb || 0, r.lo != null ? lo + 600 : 0);
              const w = v => (hi > lo && v != null && v > lo ? Math.max(0.04, Math.min(1, (v - lo) / (hi - lo))) : 0);
              const bars = r.na != null && r.nb != null && hi > 0;
              return (
                <div className={'cmp-sr' + (bars ? '' : ' nobars')} role="row" key={r.key}>
                  <span className="cmp-sl" role="rowheader">{r.icon ? <img src={r.icon} alt="" width="24" height="24" /> : <i className="cmp-noico" aria-hidden="true"></i>}{r.label}</span>
                  <span className="cmp-track" aria-hidden="true">{bars && <>
                    <span className="lane"><i className="a" style={{ '--w': w(r.na) }}></i></span>
                    <span className="lane"><i className="b" style={{ '--w': w(r.nb) }}></i></span>
                  </>}</span>
                  <span className="cmp-vals" role="cell"><b className="va">{r.a}</b><b className="vb">{r.b}</b></span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="cmp-h">Together</h3>
          {t.games ? (
            <>
              <div className="cmp-h2h">
                <div><b>{t.aheadA}</b><span className="a">{a} ahead</span></div>
                <div className="mid"><b>{t.games}</b><span>game{t.games === 1 ? '' : 's'}</span></div>
                <div><b>{t.aheadB}</b><span className="b">{b} ahead</span></div>
              </div>
              <ul className="cmp-recent">{t.recent.map(r => (
                <li key={r.line}>
                  <a className="cmp-when" href={hashFor('games', gid) + '?game=' + r.line}><b>{r.date}</b><small>{r.time ? r.time + ' · ' : ''}{r.n} players</small></a>
                  <span className={'cmp-medal p' + Math.min(r.placeA, 4)} title={a}><b>{ord(r.placeA)}</b><i className="a"></i></span>
                  <span className={'cmp-medal p' + Math.min(r.placeB, 4)} title={b}><b>{ord(r.placeB)}</b><i className="b"></i></span>
                </li>
              ))}</ul>
            </>
          ) : <p className="meta">They haven’t sat at the same rated table yet.</p>}
          <h3 className="cmp-h">Most played expansions</h3>
          <div className="cmp-sets">{[[a, sets.a], [b, sets.b]].map(([n, list]) => (
            <div key={n}><b>{n}</b>{list.length ? <ul>{list.map(([s, k]) => <li key={s}><SetIcon name={s} size={18} />{s}<small className="meta"> {k}</small></li>)}</ul> : <p className="meta">No games yet.</p>}</div>
          ))}</div>
        </div>
      </div>

      <h3 className="cmp-h">Rating over time</h3>
      <RatingChart names={[a, b]} />

      <h3 className="cmp-h">Badges</h3>
      {catalog ? (
        <>
          <p className="meta">{badges.shared.length} in common · {a} {badges.onlyA.length} more · {b} {badges.onlyB.length} more</p>
          {badges.shared.length > 0 && <ul className="cmp-badges">{badges.shared.map(x => chip(x))}</ul>}
          {[[a, badges.onlyA], [b, badges.onlyB]].map(([n, list]) => list.length > 0 && (
            <details key={n} className="cmp-more"><summary>Only {n} ({list.length})</summary><ul className="cmp-badges">{list.map(x => chip(x, n))}</ul></details>
          ))}
        </>
      ) : <p className="meta">Loading the badges…</p>}

    </div>
  );
}
