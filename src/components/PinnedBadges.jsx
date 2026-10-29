import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '../PageContext.js';
import { usePins } from '../usePins.js';
import HoverPopup from './HoverPopup.jsx';
import { badgeIcon } from './badgeIcon.jsx';
import { badgesFor } from '../lib/xp.js';
import { pinnedBadges, viewHint, TIERS } from '../lib/achievements.js';
import { short } from '../lib/format.js';

const LABEL = { ...Object.fromEntries(TIERS.map(t => [t.id, t.label])), secret: 'Secret' };

/* The badges a player chose to show off (`max` of them), as chips beside their name (the tier colours the edge; epic and legendary glow). Hovering or focusing
   a chip says what it is and when it was earned. Nothing at all when they haven't pinned any. The popup is plain markup: it has no page context.
   `fit` (the Rankings card): on a phone, show only as many chips as fit whole in the row and "+N" for the rest. The chips that don't fit stay in the page,
   invisible and out of the flow, so their real widths can be measured again whenever the row changes size. */
const GAP = 6, MORE_W = 44;
export default function PinnedBadges({ p, max = 3, list: given, fit = false }) {
  const { D, catalog } = usePage();
  const { ids, mine } = usePins(p.name);
  const own = useMemo(() => (!given && ids.length && p.rated ? badgesFor(D, p, catalog) : []), [given, ids, p, D, catalog]);   // `list`: a badge list the caller already has
  const pins = pinnedBadges(ids, given || own).slice(0, max);
  const row = useRef(null);
  const [k, setK] = useState(pins.length);   // how many chips are shown
  const sig = pins.map(b => b.id).join();
  useLayoutEffect(() => {
    const el = row.current;
    if (!fit || !el) { setK(pins.length); return undefined; }
    const measure = () => {
      if (!window.matchMedia('(max-width:720px)').matches) { setK(pins.length); return; }
      const w = [...el.querySelectorAll('.pin-wrap')].map(c => c.offsetWidth), room = el.clientWidth;
      if (!w.length || !room) return;
      if (w.reduce((a, b) => a + b, 0) + GAP * (w.length - 1) <= room) { setK(w.length); return; }
      let used = 0, n = 0;
      for (let i = 0; i < w.length; i++) {
        const need = used + (i ? GAP : 0) + w[i];
        if (need + GAP + MORE_W <= room) { used = need; n = i + 1; } else break;   // leave room for the "+N" chip
      }
      setK(Math.max(1, n));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [fit, sig, pins.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!pins.length) return null;
  const hidden = fit ? pins.slice(k) : [];
  return (
    <div className={'pinned' + (fit ? ' fit' : '')} role="list" aria-label="Pinned badges" ref={row}>
      {pins.map((b, i) => (
        <HoverPopup key={b.id} className={'pin-wrap' + (fit && i >= k ? ' pin-off' : '')} content={
          <div className="popdesc"><b>{b.name}</b>{LABEL[b.tier] ? ` · ${LABEL[b.tier]}` : ''}<br />{viewHint(b, mine)}{b.earned && b.earned.date ? <><br />Earned {short(b.earned.date)}</> : null}</div>
        }>
          <span role="listitem" className={'pin-chip td-' + b.tier}><span className="pin-ico" aria-hidden="true">{badgeIcon(b, 18)}</span>{b.name}</span>
        </HoverPopup>
      ))}
      {hidden.length > 0 && <span role="listitem" className="pin-more" title={`Also pinned: ${hidden.map(b => b.name).join(', ')}`} aria-label={`${hidden.length} more pinned: ${hidden.map(b => b.name).join(', ')}`}>+{hidden.length}</span>}
    </div>
  );
}
