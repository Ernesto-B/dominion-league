#!/usr/bin/env node
/* Runs the same phone tasks on the CURRENT layout (A: ?ux=none) and the NEW one (B: ?ux=all) in an emulated 390x844 phone and prints
   what each costs: taps, and how far the page had to be scrolled. Every path is performed for real and only counted if it arrives.
     npm run dev:fake                      (in another terminal)
     node dev/ab-tasks.mjs [url]           (default http://localhost:5199)
   It measures effort, not taste: it can say "2 taps vs 1", not "which feels nicer" — that part is for you and a couple of friends. */
import { launch } from './cdp.mjs';

const base = process.argv[2] || 'http://localhost:5199';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function run(ux) {
  const b = await launch({ width: 390, height: 844, mobile: true, dpr: 2, url: `${base}/?ux=${ux}` });
  await b.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const ev = x => b.evalJs(x);
  await wait(4000);
  const res = {};
  // a counted tap: an element is found by text, clicked, and counted; null if it isn't there
  let taps = 0;
  const tap = async (sel, text) => {
    const ok = await ev(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.getBoundingClientRect().width > 0 && (!${JSON.stringify(text)} || e.textContent.trim().startsWith(${JSON.stringify(text)}))); if (!els.length) return false; els[0].click(); return true; })()`);
    if (ok) taps++; await wait(500); return ok;
  };
  const reset = async hash => { taps = 0; await ev(`location.hash = ${JSON.stringify(hash)}`); await wait(1200); await ev('window.scrollTo(0, 0)'); await wait(200); };
  const on = cond => ev(cond);

  // 1. See where you stand on the ladder: how far down the page is your own row?
  await reset('#/');
  res.ownRankScroll = await ev(`(() => { const row = document.querySelector('.lrow[data-p="Ann"]'); const mine = document.querySelector('.mecard'); const el = mine || row; return Math.round(el.getBoundingClientRect().top + scrollY - innerHeight + el.getBoundingClientRect().height); })()`);
  res.ownRankScroll = Math.max(0, res.ownRankScroll);
  res.ladderPlayersOnFirstScreen = await ev(`[...document.querySelectorAll('.lrow')].filter(r => r.getBoundingClientRect().bottom <= innerHeight - ${ux === 'none' ? 0 : 62}).length`);

  // 2. Open your own player page from anywhere
  await reset('#/records');
  if (ux === 'none') { await tap('.nav-toggle'); await tap('#nav a', 'Players'); } else { await tap('.bottomnav a', 'Players'); }
  res.toOwnPlayerPage = (await on(`/^#\\/players\\/Ann/.test(location.hash)`)) ? taps : null;

  // 3. Open Records from the home page
  await reset('#/');
  if (ux === 'none') { await tap('.nav-toggle'); await tap('#nav a', 'Records'); } else { await tap('.bottomnav button', 'More'); await tap('.moresheet a', 'Records'); }
  res.toRecords = (await on(`location.hash === '#/records'`)) ? taps : null;

  // 4. Open Head to head and then get back to Rankings
  await reset('#/');
  if (ux === 'none') { await tap('.nav-toggle'); await tap('#nav a', 'Head to head'); await tap('.nav-toggle'); await tap('#nav a', 'Rankings'); }
  else { await tap('.bottomnav button', 'More'); await tap('.moresheet a', 'Head to head'); await tap('.bottomnav a', 'Rankings'); }
  res.toH2HAndBack = (await on(`location.hash === '#/' || location.hash === ''`)) ? taps : null;

  // 5. Log a three-player game with scores and save it (no kingdom: the same facts both ways)
  await reset('#/games');
  const pick = async n => ev(`[...document.querySelectorAll('#bpick a')].find(a => a.textContent.trim() === ${JSON.stringify(n)}).click()`);
  const vp = async (n, v) => { await ev(`(() => { const el = document.querySelector('input[data-vp="${n}"]'); el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${v}'); el.dispatchEvent(new Event('input', { bubbles: true })); el.blur(); })()`); taps += 1; };
  await ev(`window.__rpc.length = 0`);
  if (ux === 'none') {
    await tap('#gAddBtn'); for (const n of ['Ann', 'Bob', 'Cy']) { await pick(n); taps++; }
    await vp('Ann', '30'); await vp('Bob', '45'); await vp('Cy', '25'); await tap('#bsave');
  } else {
    await tap('a.btn', 'Game night'); for (const n of ['Ann', 'Bob', 'Cy']) { await pick(n); taps++; }
    await tap('.night-actions button', 'Next'); await tap('.night-actions button', 'Skip');   // no kingdom: straight to the scores
    await vp('Ann', '30'); await vp('Bob', '45'); await vp('Cy', '25'); await tap('.night-actions button', 'Next'); await tap('.night-actions button', 'Save game');
  }
  await wait(900);
  res.logAGame = (await ev(`window.__rpc.some(r => r.name === 'add_game' && r.args.p_results.length === 3)`)) ? taps : null;
  b.close();
  return res;
}

const A = await run('none'), B = await run('all');
const rows = [
  ['Pixels to scroll before you see your own rank', A.ownRankScroll, B.ownRankScroll],
  ['Players visible on the first screen of the ladder', A.ladderPlayersOnFirstScreen, B.ladderPlayersOnFirstScreen],
  ['Taps: open your own player page', A.toOwnPlayerPage, B.toOwnPlayerPage],
  ['Taps: open Records from home', A.toRecords, B.toRecords],
  ['Taps: Head to head, then back to Rankings', A.toH2HAndBack, B.toH2HAndBack],
  ['Taps: log a 3-player game with scores (no kingdom)', A.logAGame, B.logAGame],
];
const w = Math.max(...rows.map(r => r[0].length));
console.log(`\n${'Task'.padEnd(w)}   A (current)   B (new)`);
rows.forEach(([t, a, b]) => console.log(`${t.padEnd(w)}   ${String(a ?? 'FAILED').padStart(11)}   ${String(b ?? 'FAILED').padStart(7)}`));
console.log('\nLower is better, except "Players visible", where higher is better. A FAILED means that path could not be completed.');
process.exit(0);
