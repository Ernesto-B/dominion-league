/* A button that confirms itself: after it works its label turns into okLabel (with a green tint) for a moment, in the SAME space, so nothing else on the row moves.
   Both labels sit in one grid cell, so the button is as wide as the longer of the two all the time. `flash` is 'ok', 'fail' (shows failLabel) or null; the caller times it. */
export default function FlashButton({ children, flash = null, okLabel, failLabel = null, className = 'ghost', ...rest }) {
  const on = flash === 'ok', bad = flash === 'fail' && failLabel;
  return (
    <button type="button" className={`${className} dn-flash${on ? ' ok' : ''}${bad ? ' fail' : ''}`} {...rest}>
      <span className="dn-flash-grid">
        <span style={{ visibility: on || bad ? 'hidden' : 'visible' }}>{children}</span>
        <span className="dn-flash-on" style={{ visibility: on ? 'visible' : 'hidden' }} aria-hidden="true">✓ {okLabel}</span>
        {bad && <span className="dn-flash-on" style={{ visibility: 'visible' }}>{failLabel}</span>}
      </span>
      <span className="dn-sr" role="status" aria-live="polite">{on ? okLabel : bad ? failLabel : ''}</span>
    </button>
  );
}
