import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { writeQuery } from './urlState.js';
import { restoreListScroll } from './scrollMemory.js';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;   // no layout effects on the server

/* Puts a list back where the viewer left it when they return to it from one of its detail pages (see scrollMemory.js). */
export function useListScroll() {
  useIsoLayoutEffect(() => { restoreListScroll(); }, []);
}

/* Filter state for a browser page, kept in the URL (see urlState.js). `query` is the hash's "?..." part.
   - f       the current filters, parsed from the query
   - update  merge a patch into them (writes the URL at once)
   - qText / onQ   the search box: it types into local state and writes the URL after a pause, because browsers cap
                   how often the URL may be rewritten and every keystroke would otherwise be one write
   - clear   back to the defaults */
export function useUrlFilters(query, { fromQuery, toQuery, defaults }) {
  const f = useMemo(() => fromQuery(query), [query]);
  const latest = useRef(f); latest.current = f;
  const pendingQ = useRef(null), timer = useRef(null);
  const [qText, setQText] = useState(f.q);
  useEffect(() => { setQText(f.q); }, [f.q]);   // the URL changed under us (clear, a pasted link, Back)
  useEffect(() => () => clearTimeout(timer.current), []);

  const update = patch => {
    clearTimeout(timer.current);
    const q = pendingQ.current; pendingQ.current = null;   // a search typed a moment ago is not lost by a chip click
    writeQuery(toQuery({ ...latest.current, ...(q === null ? {} : { q }), ...patch }));
  };
  const onQ = value => {
    setQText(value); pendingQ.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { pendingQ.current = null; writeQuery(toQuery({ ...latest.current, q: value })); }, 250);
  };
  const clear = () => { clearTimeout(timer.current); pendingQ.current = null; setQText(''); writeQuery(toQuery(defaults)); };
  return { f, update, qText, onQ, clear };
}
