import { useEffect } from 'react';

/* The Analyze panel's "Fix", on the page itself: the viewer points at the card to replace (FixBar over the kingdom, the cards that cannot go dimmed with their reason, the suggested one
   ringed) and a random card that closes the gap and keeps the options' rules takes its place at once. UndoBar then offers to put it back for a few seconds. */
export function FixBar({ plan, note, onCancel }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const sug = plan.cards.find(c => c.key === plan.suggested);
  return (
    <div className="dn-fixbar" role="status">
      <div><b>Pick the card to replace</b><span className="meta"> {note || `Suggested: ${sug ? sug.name : 'none'}. Dimmed cards can’t be swapped.`}</span></div>
      <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function UndoBar({ text, onUndo, onClose }) {
  return (
    <div className="dn-fixbar dn-undobar" role="status">
      <div><b>{text}</b></div>
      <div className="dn-undo-btns"><button type="button" onClick={onUndo}>Undo</button><button type="button" className="ghost" onClick={onClose} aria-label="Dismiss">OK</button></div>
    </div>
  );
}
