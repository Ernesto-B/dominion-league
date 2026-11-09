import { useEffect } from 'react';

/* The site's text can't be selected (a stray touch on a phone must not start a copy), except on a card's, landscape's or Artifact's own page, which calls this while it is on screen:
   it puts `selectable` on <body>, which style.css turns back to selectable text. */
export function useSelectable() {
  useEffect(() => { document.body.classList.add('selectable'); return () => document.body.classList.remove('selectable'); }, []);
}
