/* A one-shot hand-off from the Randomizer to the Add Game dialog: "Use this kingdom" stores the kingdom here and sends
   the viewer to the Games page, which opens the dialog pre-filled and takes (clears) it. Kept in sessionStorage too, so a
   reload in between doesn't lose it. Never trusted blindly: the dialog re-validates every id against the catalog. */
const KEY = 'dl.kingdomDraft';
let draft = null;

export function setKingdomDraft(d) {
  draft = d;
  try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage blocked: the in-memory copy still works */ }
}
export function peekKingdomDraft() {
  if (draft) return draft;
  try { const raw = sessionStorage.getItem(KEY); if (raw) draft = JSON.parse(raw); } catch { draft = null; }
  return draft && Array.isArray(draft.items) ? draft : null;
}
export function takeKingdomDraft() {
  const d = peekKingdomDraft(); draft = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return d;
}
