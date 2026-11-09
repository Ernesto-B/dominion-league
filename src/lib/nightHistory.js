/* Game night and the browser's Back / Forward arrows. Every screen of the flow (a step, a way of choosing the kingdom, a summary, the list of recommended sets, a draft under way) has its own address,
   `#/night/<group>?v=<view>`, and each move through the flow is a history entry, so the arrows step through the screens instead of leaving the page.

   The progress itself stays in the saved night (localStorage); the address only says which screen it is on. The arrows do not rewrite the state by looking at the address: Back runs the same code
   as the page's own Back button and Forward the same as its main button, so the clock, the draft and the kingdom behave exactly as they do with the buttons. Every entry carries { night: 1, n } (n counts
   the screens from where the page was opened) so a Back and a Forward can be told apart. */

// which screen a night is on (the string that goes in the address)
export function viewOf(st) {
  if (st.step !== 'kingdom') return st.step;
  const mode = st.kingdomMode;
  if (!mode) return 'kingdom';
  if (mode === 'draft') return st.draftSave && st.draftSave.finished ? 'kingdom-draft-done' : st.draftSave && st.draftSave.draft ? 'kingdom-draft-run' : 'kingdom-draft';
  if (mode === 'recommended') return st.recPicking || !st.kingdom.length ? 'kingdom-recommended' : st.randomDone ? 'kingdom-recommended-summary' : 'kingdom-recommended-set';
  return mode === 'random' && st.randomDone ? 'kingdom-random-summary' : `kingdom-${mode}`;
}

export const readView = hash => { const m = /[?&]v=([^&]*)/.exec(hash || ''); return m ? decodeURIComponent(m[1]) : null; };
export const withView = (hash, view) => `${(hash || '').split('?')[0]}?v=${encodeURIComponent(view)}`;

/* The history bookkeeping, with the window handed in (so it can be tested). Methods:
   start(view)            this screen is where the page opened (or came back to): its entry is made to carry the marker and the address
   changed(view, {back})  the screen changed in the state: a new entry (or, for the page's own Back with nothing earlier to return to, the same one rewritten)
   popped(state)          the browser moved: 'back', 'forward' or null (not one of ours)
   settle(view)           after the arrow was handled: if the screen did not end up where the address says (a Forward that was not allowed), the address is put right */
export function createNightHistory(win = window) {
  let n = 0, popping = false;
  const mark = k => ({ night: 1, n: k });
  const here = () => win.location.hash;
  return {
    start(view) {
      n = win.history.state && win.history.state.night ? win.history.state.n : 0;
      win.history.replaceState(mark(n), '', withView(here(), view));
    },
    changed(view, { back = false } = {}) {
      if (readView(here()) === view) { popping = false; return; }
      if (popping || (back && n === 0)) { popping = false; win.history.replaceState(mark(n), '', withView(here(), view)); return; }
      n += 1; win.history.pushState(mark(n), '', withView(here(), view));
    },
    popped(state) {
      if (!state || !state.night) return null;
      const dir = state.n < n ? 'back' : state.n > n ? 'forward' : null;
      if (dir) { n = state.n; popping = true; }
      return dir;
    },
    settle(view) { popping = false; if (readView(here()) !== view) win.history.replaceState(mark(n), '', withView(here(), view)); },
    index: () => n,
  };
}
