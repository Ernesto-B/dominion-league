import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { navHref } from './Header.jsx';
import { GO, GO_WINDOW, activeBindings, canUseKeys, dialogOpen, isTyping, matches, normKey, usePageShortcuts } from '../lib/shortcuts.js';

/* Registers a page's shortcuts for as long as it is on screen. Renders nothing. */
export function PageShortcuts({ bindings }) { usePageShortcuts(bindings); return null; }

/* The site-wide keyboard layer and its help card. `ready` is the same object the nav is built from (so a shortcut goes exactly where the nav link would). */
export default function Shortcuts({ ready }) {
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (!ready || !canUseKeys()) return undefined;
    let armed = 0;   // time `g` was pressed
    const goes = GO.filter(([, , r]) => (r !== 'admin' && r !== 'night') || ready.me.is_admin);
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key === 'Escape') { setHelp(false); return; }
      if (isTyping(e.target)) return;
      const k = normKey(e.key);
      if (k === '?') { e.preventDefault(); setHelp(h => !h); return; }
      if (help) return;
      if (dialogOpen()) return;
      if (armed && Date.now() - armed < GO_WINDOW) {   // the letter after `g`
        armed = 0;
        const hit = goes.find(([l]) => l === k);
        if (hit) { e.preventDefault(); window.location.hash = navHref(hit[2], ready); }
        return;
      }
      armed = 0;
      if (k === 'g') { armed = Date.now(); return; }
      if (k === '/') {   // the page's own search box
        const box = [...document.querySelectorAll('main input[type=search], main input[type=text]')].find(i => i.offsetParent !== null);
        if (box) { e.preventDefault(); box.focus(); box.select && box.select(); }
        return;
      }
      const b = activeBindings().find(x => matches(x, e));
      if (b) { e.preventDefault(); b.run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready, help]);
  if (!help) return null;
  const here = activeBindings();
  const goes = GO.filter(([, , r]) => (r !== 'admin' && r !== 'night') || ready.me.is_admin);
  return createPortal(
    <div className="overlay kbd-help" role="presentation" onClick={() => setHelp(false)}>
      <div className="kbd-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={e => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
        <div className="kbd-cols">
          <div>
            <h4>Go to</h4>
            <ul>{goes.map(([l, label]) => <li key={l}><span><kbd>g</kbd> <kbd>{l}</kbd></span>{label}</li>)}</ul>
            <h4>Anywhere</h4>
            <ul><li><span><kbd>/</kbd></span>Search this page</li><li><span><kbd>?</kbd></span>This list</li><li><span><kbd>Esc</kbd></span>Close</li></ul>
          </div>
          <div>
            <h4>On this page</h4>
            {here.length ? <ul>{here.map(b => <li key={(b.shift ? 'shift+' : '') + b.key}><span><kbd>{(b.shift ? 'Shift ' : '') + (b.key.length === 1 ? b.key.toUpperCase() : ({ ArrowLeft: '←', ArrowRight: '→' }[b.key] || b.key))}</kbd></span>{b.label}</li>)}</ul> : <p className="meta">Nothing here yet.</p>}
          </div>
        </div>
        <p className="meta"><button type="button" className="ghost" onClick={() => setHelp(false)}>Close</button></p>
      </div>
    </div>,
    document.body,
  );
}
