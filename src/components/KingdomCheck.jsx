import { useEffect, useRef } from 'react';

/* Game night's last look before a kingdom is used: when the Analyze panel would flag something (a job with no card on record, too many of one kind), say so in plain words and let the
   table choose: look at the kingdom (opens the Analyze panel where it can, with its Fix buttons), or go ahead as it is. Nothing is blocked. */
export default function KingdomCheck({ concerns, canReview, onReview, onGo, onClose }) {
  const first = useRef(null);
  useEffect(() => {
    first.current && first.current.focus();
    const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', esc, true);
    return () => document.removeEventListener('keydown', esc, true);
  }, [onClose]);
  return (
    <div className="modal-overlay dn-confirm-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box dn-confirm dn-kcheck" role="alertdialog" aria-modal="true" aria-labelledby="kc-title">
        <h2 id="kc-title"><span className="dn-kcheck-mark" aria-hidden="true">!</span>Worth a look before you start</h2>
        <ul className="dn-kcheck-list">{concerns.map(c => <li key={c}>{c}</li>)}</ul>
        <p className="meta">Counted from the cards’ recorded mechanics, so a card might do it without being recorded. Your call.</p>
        <div className="dn-confirm-btns">
          <button type="button" className="ghost" onClick={onGo}>Start anyway</button>
          <button type="button" ref={first} onClick={onReview}>{canReview ? 'Review & fix' : 'Change the cards'}</button>
        </div>
      </div>
    </div>
  );
}
