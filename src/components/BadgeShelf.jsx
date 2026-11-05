import { useMemo } from 'react';
import { usePage } from '../PageContext.js';
import PinnedBadges from './PinnedBadges.jsx';
import { badgeIcon } from './badgeIcon.jsx';
import { nextUp } from '../lib/hub.js';
import { tabQuery } from '../lib/profileTabs.js';
import { usePins } from '../usePins.js';
import { pinKey, pinnedBadges } from '../lib/achievements.js';

/* The badges on a player's Overview, kept short: how many are earned, the three pinned ones, the few closest to being earned and the latest earned. Everything else
   is on the Badges tab, one press away ("View all"). `list` is the player's badge list (badgesFor). */
export default function BadgeShelf({ p, list }) {
  const { gid, hashFor } = usePage();
  const { mine, ids: saved } = usePins(p.name);
  const ids = useMemo(() => pinnedBadges(saved, list).map(pinKey), [saved, list]);   // only the pins that show
  const base = hashFor('players', gid, encodeURIComponent(p.name));
  const to = (tab, extra) => base + tabQuery(tab, extra);
  const got = list.filter(b => b.earned), total = list.length;
  const next = useMemo(() => nextUp(list, 3), [list]);
  const recent = useMemo(() => got.slice().sort((a, b) => (b.earned.line ?? -1) - (a.earned.line ?? -1)).slice(0, 6), [list]);   // eslint-disable-line react-hooks/exhaustive-deps
  const pct = total ? Math.round(got.length / total * 100) : 0;
  return (
    <section className="shelf" aria-labelledby="shelf-h">
      <div className="shelf-head">
        <h2 id="shelf-h">Badges <span className="meta">{got.length} of {total}</span></h2>
        <a className="shelf-all" href={to('badges')}>View all →</a>
      </div>
      <div className="shelf-bar" role="img" aria-label={`${got.length} of ${total} badges earned`}><i style={{ width: pct + '%' }} /></div>

      <div className="shelf-cols">
        <div>
          <h3>Pinned {mine && <a className="shelf-edit" href={to('badges', { show: 'owned' })}>{ids.length ? '✎ Edit pins' : '★ Pin badges'}</a>}</h3>
          {ids.length ? <PinnedBadges p={p} list={list} /> : <p className="meta">{mine ? 'Pin up to three badges to show them beside your name.' : 'Nothing pinned.'}</p>}
          {recent.length > 0 && <>
            <h3>Latest earned</h3>
            <ul className="shelf-recent">{recent.map(b => (
              <li key={b.id}><a className={'pin-chip td-' + b.tier} href={to('badges', { badge: b.id })}><span className="pin-ico" aria-hidden="true">{badgeIcon(b, 18)}</span><span className="pin-name">{b.name}</span></a></li>
            ))}</ul>
          </>}
        </div>
        <div>
          <h3>Next up</h3>
          {next.length ? (
            <ul className="shelf-next">{next.map(x => (
              <li key={x.id}>
                <a href={to('badges', { badge: x.id })}>
                  <b><i className={'tier-dot td-' + x.tier} aria-hidden="true" />{x.name}</b>
                  {x.pct != null ? <span className="shelf-prog"><i style={{ width: Math.round(x.pct * 100) + '%' }} /></span> : <small className="meta">{x.hint}</small>}
                </a>
              </li>
            ))}</ul>
          ) : <p className="meta">Every badge is earned.</p>}
        </div>
      </div>
    </section>
  );
}
