import { useRef } from 'react';

/* The finishing-order list: each player with ↑/↓, a VP box (a committed score re-sorts the whole table) and a "tied with above" box.
   `bs` is the form state (see gameForm.js); `setBs` updates it; `resort` is resortByVP. With `vpOnly` (Game night) the arrows and the tie box are
   left out: typing each player's VP is the whole job, the order and the ties follow from it. */
export default function FinishOrder({ bs, setBs, resort, vpOnly = false }) {
  const vpAtFocus = useRef('');
  const move = (i, j) => setBs(b => { const p = b.picked.slice(); [p[j], p[i]] = [p[i], p[j]]; return { ...b, picked: p }; });
  // VP drives the finishing order: once a score is committed (blur or Enter — not every keystroke, so typing a multi-digit score
  // doesn't yank focus away) the whole table re-sorts by VP.
  const commitVP = e => { if (e.target.value !== vpAtFocus.current) { vpAtFocus.current = e.target.value; setBs(resort); } };
  return (
    <ol className="order" id="border">
      {bs.picked.map((n, i) => (
        <li key={n}>
          <span className="nm">{`${i + 1}. ${n}`}</span>
          {!vpOnly && <button className="ghost" data-up={i} type="button" aria-label={`Move ${n} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>}
          {!vpOnly && <button className="ghost" data-dn={i} type="button" aria-label={`Move ${n} down`} disabled={i === bs.picked.length - 1} onClick={() => move(i, i + 1)}>↓</button>}
          <label className="f vp">VP <input type="text" inputMode="numeric" data-vp={n} size={3} value={bs.vp[n] ?? ''}
            onFocus={e => { vpAtFocus.current = e.target.value; }} onChange={e => { const v = e.target.value; setBs(b => ({ ...b, vp: { ...b.vp, [n]: v } })); }}
            onBlur={commitVP} onKeyDown={e => { if (e.key === 'Enter') commitVP(e); }} /></label>
          {vpOnly && bs.tie[n] && <span className="meta tie-note">tied with above</span>}
          {!vpOnly && i > 0 && <label className="f tie"><input type="checkbox" data-tie={n} checked={!!bs.tie[n]} onChange={e => { const on = e.target.checked; setBs(b => ({ ...b, tie: { ...b.tie, [n]: on } })); }} /> tied with above</label>}
        </li>
      ))}
      {!bs.picked.length && <li className="meta">No players chosen yet.</li>}
    </ol>
  );
}
