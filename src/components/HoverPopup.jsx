import { popup } from './popup.js';

// Wraps `children` so hovering shows `content` in the shared popup (keyboard focus shows it centered).
// With no `content` the children render exactly as if unwrapped.
export default function HoverPopup({ content, className = 'popwrap', children }) {
  if (!content) return children;
  return (
    <div className={className} tabIndex={0}
      onMouseEnter={e => popup.show(content, e)} onMouseMove={popup.move} onMouseLeave={popup.hide}
      onFocus={() => popup.showCentered(content)} onBlur={popup.hide}>
      {children}
    </div>
  );
}
