import { useEffect, useRef, useState } from 'react';
import { cardImageMode, localSrc, pictureSrc, useCardImages } from '../cardImages.js';

/* A card's (or landscape's) picture, or nothing at all when there is none, so the caller can show its text instead.
   The space is reserved from the picture's own size before it arrives (nothing jumps), and it is only fetched when it is near the screen
   (native lazy loading for the local folder; an IntersectionObserver for the private bucket, whose pictures are downloaded with the member's session).
   size: 'small' (default, the grids) or, with className "big", the enlarge view's larger copy. With `onOpen` it is a button that enlarges the card. */
export default function CardFace({ id, name, onOpen, className = '', size = 'small' }) {
  const { get } = useCardImages();
  const found = get(id);
  const kind = size === 'big' || /\bbig\b/.test(className) ? 'big' : size;   // the enlarge view asks for the larger copy
  const p = found ? (kind === 'big' && found.big ? found.big : kind === 'thumb' ? found.thumb : found.small) : null;
  const bucket = cardImageMode() === 'bucket';
  const ref = useRef(null);
  const [near, setNear] = useState(!bucket || kind === 'big');
  const [src, setSrc] = useState(() => (p && !bucket ? localSrc(p) : null));   // the local folder's URL needs no waiting (and renders on the server)
  useEffect(() => {
    if (!bucket || near || !ref.current || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [bucket, near]);
  const key = p ? p.key : null;
  useEffect(() => {
    let live = true;
    if (p && near) pictureSrc(p).then(u => { if (live) setSrc(u); });
    if (!p) setSrc(null);
    return () => { live = false; };
  }, [key, near]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!found) return null;
  const wide = found.width > found.height;
  const cls = 'dn-face' + (wide ? ' wide' : '') + (className ? ' ' + className : '');
  const inner = src
    ? <img className="dn-face-img" src={src} width={p.width} height={p.height} alt={onOpen ? '' : name} loading={bucket || kind === 'big' ? 'eager' : 'lazy'} decoding="async" draggable="false" />
    : <span className="dn-face-img dn-face-wait" style={{ aspectRatio: `${p.width} / ${p.height}` }} role={onOpen ? undefined : 'img'} aria-label={onOpen ? undefined : name} />;
  return onOpen
    ? <button type="button" ref={ref} className={cls} onClick={onOpen} aria-label={`${name}: show the card larger`}>{inner}</button>
    : <span ref={ref} className={cls}>{inner}</span>;
}
