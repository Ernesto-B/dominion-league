// Which build is running, and has a newer one been published? Vite names the entry script by its content hash (assets/index-XXXX.js),
// so a different name in the live index.html means a new deploy. Pure helpers; components/UpdateBar.jsx does the checking.
const ENTRY = /assets\/index-[\w-]+\.js/;

export const entryOf = text => { const m = ENTRY.exec(text || ''); return m ? m[0] : null; };

// the entry script this page was loaded with (null in dev, where nothing is hashed)
export const runningEntry = (doc = document) => {
  const s = [...doc.querySelectorAll('script[src]')].map(x => x.getAttribute('src')).find(src => ENTRY.test(src));
  return s ? entryOf(s) : null;
};

// a newer deploy exists only when both names are known and differ (an unreadable page never nags)
export const isNewer = (running, liveHtml) => { const live = entryOf(liveHtml); return !!(running && live && live !== running); };
