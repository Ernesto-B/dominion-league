/* A way for Game night to ask the Randomizer's Analyze panel to open itself ("Fix it" in the kingdom check). The request is kept for a few seconds so it still reaches an Analyze
   that mounts just after it is made (the roll screen coming back), and is dropped after that so a stale one never opens the panel later. */
let at = 0;
const subs = new Set();
export const requestAnalyze = () => { at = Date.now(); subs.forEach(f => f()); };
export const takeAnalyzeRequest = () => { const live = Date.now() - at < 3000; at = 0; return live; };
export const onAnalyzeRequest = f => { subs.add(f); return () => subs.delete(f); };
