/* The filter state of the Cards and Landscapes browsers lives in the URL hash's query ("#/dominion/cards?type=Attack"),
   so a link shares it, Back restores it, and a card's page can carry it along.

   Writing it uses replaceState — a filter click must not add a history entry (Back should leave the page, not undo the
   last click) — and replaceState fires no event of its own, so a hashchange is dispatched to re-render. useHash
   knows not to scroll to the top for a query-only change. */
export function writeQuery(query) {
  const base = location.hash.split('?')[0];
  try {
    history.replaceState(history.state, '', base + query);
  } catch {
    location.replace(base + query);   // browsers cap replaceState (Safari: 100 per 30 s); a plain replace still works
    return;
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
