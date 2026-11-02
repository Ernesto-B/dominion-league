// A real-browser startup check: boots the whole site on the in-memory fake data (npm run dev:fake must be running on :5199 — or this starts it) and fails on any uncaught error,
// a blank page, or a page that shows "Something went wrong". Build and unit tests cannot see a crash in App.jsx itself (it once shipped a blank site).
//     node dev/smoke.mjs
import { spawn } from 'node:child_process';
import { launch } from './cdp.mjs';

const wait = ms => new Promise(r => setTimeout(r, ms));
let server = null;
const up = async () => { try { return (await fetch('http://localhost:5199/')).ok; } catch { return false; } };
if (!(await up())) { server = spawn('npx', ['vite', '--config', 'vite.fake.config.js'], { stdio: 'ignore' }); for (let i = 0; i < 40 && !(await up()); i++) await wait(250); }

const routes = ['', 'season', 'players', 'games', 'games/1', 'records', 'night', 'dominion', 'dominion/cards', 'dominion/randomizer', 'dominion/insights', 'games?view=kingdoms', 'games/1?tab=kingdom'];
let bad = 0;
const check = async r => {
  const c = await launch({ width: 1100, height: 800, mobile: false, url: 'http://localhost:5199/#/' + r });
  // a page counts as started once its <main> has text; a cold dev server can take a few seconds, so wait for it (up to 12 s) instead of a fixed pause
  for (let t = 0; t < 48; t++) { await wait(250); if (await c.evalJs(`((document.querySelector('main')||{textContent:''}).textContent.trim().length > 40)`)) break; }
  await wait(400);
  const errors = c.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
  const { text, broke } = JSON.parse(await c.evalJs(`JSON.stringify({ text: (document.querySelector('main')||{textContent:''}).textContent.trim().length, broke: /Something went wrong/.test(document.body.textContent) })`));
  c.close();
  return { errors, text, broke, ok: !errors.length && text > 40 && !broke };
};
for (const r of routes) {
  let res = await check(r);
  // a real crash shows up every time; starting many browser windows in a row now and then yields one blank window, so a failure is tried once more with a fresh browser
  if (!res.ok && !res.errors.length && !res.broke) res = await check(r);
  if (!res.ok) { bad++; console.log(`FAIL #/${r}`, res.errors[0]?.split('\n')[0] || (res.broke ? 'error screen' : 'blank page')); } else console.log(`ok   #/${r}`);
}
if (server) server.kill();
console.log(bad ? `\n${bad} page(s) failed` : '\nAll pages start cleanly');
process.exit(bad ? 1 : 0);
