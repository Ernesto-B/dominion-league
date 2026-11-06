import HoverPopup from './HoverPopup.jsx';
import TierIcon from './TierIcon.jsx';

/* What a player's rank is doing right now, as a picture instead of a paragraph: a promotion trial (pips for the games, a meter of the Elo against the line) or the
   demotion grace (pips for the games of grace left, the same meter). Rendered inside the shared popup, which has no PageContext, so everything arrives as props. */
export function rankState(p) {
  if (p.trial) return { kind: 'trial', label: `${p.trial.tier.name} trial ${p.trial.have} of ${p.trial.need}`, short: `${p.trial.tier.name} trial: ${p.trial.have} of ${p.trial.need}`,
    pop: <RankStatePop kind="trial" from={p.tier} to={p.trial.tier} elo={p.elo} line={p.trial.tier.min} have={p.trial.have} need={p.trial.need} /> };
  if (p.grace) return { kind: 'grace', label: `${p.tier.name} grace`, short: p.grace.left > 0 ? `${p.tier.name} grace: ${p.grace.left} more game${p.grace.left === 1 ? '' : 's'} under the line allowed` : `${p.tier.name} grace: the next game under the line drops the rank`,
    pop: <RankStatePop kind="grace" from={p.tier} elo={p.elo} line={p.grace.line} left={p.grace.left} total={p.grace.total} /> };
  return null;
}

// the Elo against the line, on a short track: the line is a tick, the player a dot (green over the line, red under it)
function Meter({ elo, line }) {
  const lo = Math.min(elo, line) - 45, hi = Math.max(elo, line) + 45, at = x => ((x - lo) / (hi - lo)) * 100;
  const gap = Math.round(elo - line), over = gap >= 0;
  return (
    <div className={'rsp-meter ' + (over ? 'over' : 'under')}>
      <div className="rsp-track">
        <i className="rsp-tick" style={{ left: at(line) + '%' }}><b>{line}</b></i>
        <i className="rsp-dot" style={{ left: at(elo) + '%' }}></i>
      </div>
      <p>{Math.round(elo)} Elo · {over ? `${gap} over` : `${-gap} under`} the line</p>
    </div>
  );
}

export function RankStatePop({ kind, from, to, elo, line, have, need, left, total }) {
  const trial = kind === 'trial';
  return (
    <div className={'rsp ' + kind}>
      <div className="rsp-head">
        <TierIcon id={from.icon} size={26} alt={from.name} />
        {trial ? <><span aria-hidden="true">›</span><TierIcon id={to.icon} size={26} alt={to.name} /></> : null}
        <b>{trial ? `${to.name} trial` : `${from.name} grace`}</b>
      </div>
      <div className="rsp-pips" role="img" aria-label={trial ? `${have} of ${need} games done` : `${left} of ${total} games under the line still allowed`}>
        {trial
          ? Array.from({ length: need }, (_, i) => <span key={i} className={'pip' + (i < have ? ' on' : '')}>{i < have ? '✓' : i + 1}</span>)
          : Array.from({ length: total }, (_, i) => <span key={i} className={'pip' + (i < left ? ' on' : ' used')}>{i < left ? '♥' : '✕'}</span>)}
        <small>{trial ? 'games at or over the line' : 'games under the line allowed'}</small>
      </div>
      <Meter elo={elo} line={line} />
      <p className="rsp-foot">{trial ? `Finish a game under ${line} and the count starts again.` : left > 0 ? `The game that took you under counted as the first. Get back to ${line} to be safe.` : `One more game under ${line} and the rank drops.`}</p>
    </div>
  );
}

// A tier icon that carries its state: a diamond, green for a trial and red for grace (not arrows: those mean a move in the standings), and the picture above in its popup. Nothing extra on the row.
export default function RankMark({ p, size = 28 }) {
  const icon = <TierIcon id={p.tier.icon} size={size} alt={p.tier.name + ' tier'} />, s = rankState(p);
  if (!s) return icon;
  return (
    <HoverPopup className={'tmark ' + s.kind + (size > 40 ? ' big' : '')} content={s.pop}>
      {icon}
      <span className={'tgem ' + s.kind} aria-label={s.label}></span>
    </HoverPopup>
  );
}
