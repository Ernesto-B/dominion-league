import { useEffect, useRef, useState } from 'react';

/* A yes / no question in the site's own look, in place of the browser's alert box. The caller owns whether it is open (render it only then).
   Escape, a click on the dim background and Cancel all call onCancel; focus starts on Cancel, so a stray Enter never does the destructive thing.
   `danger` colours the confirm button red for something that deletes. */
export default function ConfirmDialog({ title, text, confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current && cancelRef.current.focus();
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [onCancel]);
  return (
    <div className="modal-overlay dn-confirm-back" onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box dn-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={text ? 'confirm-text' : undefined}>
        <h2 id="confirm-title">{title}</h2>
        {text && <p id="confirm-text" className="meta">{text}</p>}
        <div className="dn-confirm-btns">
          <button type="button" className="ghost" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={danger ? 'dn-confirm-danger' : undefined} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* The question as a call: `const [ask, dialog] = useConfirm();` then `if (!(await ask({ title, text, confirmLabel, danger }))) return;` where window.confirm used to be,
   and put {dialog} anywhere in what the component renders. Resolves true on the confirm button, false on anything else. */
export function useConfirm() {
  const [req, setReq] = useState(null);
  const ask = opts => new Promise(resolve => setReq({ opts, resolve }));
  const done = ok => { const r = req; setReq(null); if (r) r.resolve(ok); };
  const dialog = req ? <ConfirmDialog {...req.opts} onCancel={() => done(false)} onConfirm={() => done(true)} /> : null;
  return [ask, dialog];
}
