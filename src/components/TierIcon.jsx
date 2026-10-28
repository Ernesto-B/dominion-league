// A tier icon is icons/<id>.png (the owner's own artwork); 'champion' falls back to a bundled
// SVG. A value containing a slash is used exactly as written.
export default function TierIcon({ id, size, alt }) {
  const explicit = /\//.test(id);
  return (
    <img className="tier" src={explicit ? id : `icons/${id}.png`} width={size} height={size} loading="lazy" decoding="async" alt={alt == null ? id : alt}
      onError={explicit ? undefined : e => { if (!e.currentTarget.src.endsWith('.svg')) e.currentTarget.src = `icons/${id}.svg`; }} />
  );
}
