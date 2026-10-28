import { useMemo, useState } from 'react';
import { usePage } from '../PageContext.js';
import { f0, sgn } from '../lib/format.js';
import { DEFAULT_STEADY, classicPayout, classicRecords, computeSteady, ladderStats, steadyPayout } from '../lib/steadyElo.js';
import TierIcon from './TierIcon.jsx';

const K_CHOICES = [40, 60, 80, 100, 150, 200];
const DRIFT_CHOICES = [[0.5, 'none — a closed ladder'], [0.52, 'a little'], [0.54, 'gentle'], [0.56, 'more']];
const pct = x => `${Math.round(x * 100)}%`;
const payout = list => list.map(v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v))).join('  ·  ');

/* EXPERIMENT (ux flag "elo"): your real games replayed under a steadier rating system, next to the ladder as it is. Change the two dials
   and everything recalculates at once. Nothing here touches the real ladder (see src/lib/steadyElo.js for what the system is). */
export default function RatingLab() {
  const { D } = usePage();
  const [k, setK] = useState(DEFAULT_STEADY.k);
  const [target, setTarget] = useState(DEFAULT_STEADY.target);
  const params = { k, provisionalK: k * 2, target };
  const lab = useMemo(() => {
    const steady = computeSteady(D.games, D.roster, params);
    const avg = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
    const nowRated = D.ranked, steadyRated = steady.ranked;
    const aboveStart = elo => D.tiers.indexOf(D.tierFor(elo)) >= 1;   // past the first tier (Knight or higher)
    return {
      steady, now: ladderStats(classicRecords(D.games)), then: ladderStats(steady.records),
      avgNow: avg(nowRated.map(p => p.elo)), avgSteady: avg(steadyRated.map(p => p.rating)),
      knightsNow: nowRated.filter(p => aboveStart(p.elo)).length, knightsSteady: steadyRated.filter(p => aboveStart(p.rating)).length,
      byName: new Map(steadyRated.map(p => [p.name, p])),
    };
  }, [D, k, target]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!D.ranked.length) return null;
  const rows = D.ranked.map(p => ({ p, s: lab.byName.get(p.name) })).sort((a, b) => (a.s ? a.s.rank : 99) - (b.s ? b.s.rank : 99) || a.p.rank - b.p.rank);
  const reset = () => { setK(DEFAULT_STEADY.k); setTarget(DEFAULT_STEADY.target); };
  const changed = k !== DEFAULT_STEADY.k || target !== DEFAULT_STEADY.target;

  return (
    <section className="ratelab" aria-labelledby="lab-h">
      <h2 id="lab-h">Rating system preview</h2>
      <p className="lede">The same games, replayed under a steadier system. <b>Nothing here changes the real ladder.</b></p>

      <div className="controls ratelab-dials">
        <label className="f">Size of a swing (K) <select value={k} onChange={e => setK(Number(e.target.value))}>{K_CHOICES.map(v => <option key={v} value={v}>{v}{v === DEFAULT_STEADY.k ? ' (suggested)' : v === 200 ? ' (the ladder now)' : ''}</option>)}</select></label>
        <label className="f">Upward drift <select value={target} onChange={e => setTarget(Number(e.target.value))}>{DRIFT_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}{v === DEFAULT_STEADY.target ? ' (suggested)' : ''}</option>)}</select></label>
        <button type="button" className="ghost" onClick={reset} disabled={!changed}>Back to suggested</button>
      </div>

      <div className="stats ratelab-stats" role="group" aria-label="How the two systems compare">
        <div className="stat"><b>{f0(lab.now.swing)} → {f0(lab.then.swing)}</b><span>typical points moved by one game</span></div>
        <div className="stat"><b>{pct(lab.now.erasesWin)} → {pct(lab.then.erasesWin)}</b><span>of losses that undo the player’s last win</span></div>
        <div className="stat"><b>{f0(lab.avgNow)} → {f0(lab.avgSteady)}</b><span>average rating on the ladder</span></div>
        <div className="stat"><b>{lab.knightsNow} → {lab.knightsSteady}</b><span>players at {D.tiers[1] ? D.tiers[1].name : 'the next tier'} or above</span></div>
      </div>

      <div className="tablewrap"><table className="plain dn-table ratelab-table">
        <caption className="dn-sr">Each player under the current ladder and under the preview</caption>
        <thead><tr><th className="l" scope="col">Player</th><th scope="col">Now</th><th className="dn-hide-sm" scope="col">Rank now</th><th scope="col">Preview</th><th scope="col">Rank in preview</th><th className="dn-hide-sm" scope="col">vs average</th></tr></thead>
        <tbody>{rows.map(({ p, s }) => {
          const move = s ? p.rank - s.rank : 0, vs = s ? s.rating - lab.avgSteady : 0;
          return (
            <tr key={p.name}>
              <td className="l name"><TierIcon id={(s ? D.tierFor(s.rating) : p.tier).icon} size={22} alt="" /> {p.name}</td>
              <td>{f0(p.elo)}</td><td className="dn-hide-sm">{p.rank}</td>
              <td><b>{s ? f0(s.rating) : '—'}</b></td>
              <td>{s ? s.rank : '—'}{move !== 0 && <span className={move > 0 ? 'up-t' : 'down-t'} title={move > 0 ? `up ${move} from now` : `down ${-move} from now`}> {move > 0 ? '▲' : '▼'}{Math.abs(move)}</span>}</td>
              <td className={`dn-hide-sm ${vs > 0.5 ? 'up-t' : vs < -0.5 ? 'down-t' : ''}`}>{s ? sgn(vs) : ''}</td>
            </tr>
          );
        })}</tbody>
      </table></div>

      <h3>What one game pays</h3>
      <div className="tablewrap"><table className="plain dn-table">
        <caption className="dn-sr">Points for each finishing place at an even table, now and in the preview</caption>
        <thead><tr><th className="l" scope="col">At an even table of…</th><th className="l" scope="col">Now (1st to last)</th><th className="l" scope="col">Preview (1st to last)</th></tr></thead>
        <tbody>{[3, 4, 5].map(n => <tr key={n}><td className="l">{n} players</td><td className="l">{payout(classicPayout(n))}</td><td className="l"><b>{payout(steadyPayout(n, params))}</b></td></tr>)}</tbody>
      </table></div>

      <details className="help">
        <summary>How the preview works</summary>
        <p className="note">The ladder now compares you with every other player at the table, so a win is worth about three times a second place and a last place cancels a win. The preview keeps the “beat a stronger player, earn more” part and changes the rest:</p>
        <ul className="note">
          <li><b>Smaller swings.</b> After your first {DEFAULT_STEADY.provisionalGames} games a game moves you by tens of points, not a hundred (that’s K).</li>
          <li><b>A points-per-finish table.</b> Finishing in the top half is worth the most, winning is the next bonus, and plain position counts a little. A loss costs less than a win earns.</li>
          <li><b>Upward drift.</b> The table pays out slightly more than an even split on average, so the group’s numbers rise slowly. Your <i>rank</i> is still relative: someone passing you is still someone passing you. “vs average” shows where you stand whatever the drift. Set it to “none” for a closed ladder where the average stays put.</li>
        </ul>
      </details>
    </section>
  );
}
