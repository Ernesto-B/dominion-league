// A real-browser startup check: boots the whole site on the in-memory fake data (npm run dev:fake must be running on :5199 — or this starts it) and fails on any uncaught error,
// a blank page, or a page that shows "Something went wrong". Build and unit tests cannot see a crash in App.jsx itself (it once shipped a blank site).
//     node dev/smoke.mjs
import { spawn } from 'node:child_process';
import { launch } from './cdp.mjs';

const wait = ms => new Promise(r => setTimeout(r, ms));
let server = null;
const up = async () => { try { return (await fetch('http://localhost:5199/')).ok; } catch { return false; } };
if (!(await up())) { server = spawn('npx', ['vite', '--config', 'vite.fake.config.js'], { stdio: 'ignore' }); for (let i = 0; i < 40 && !(await up()); i++) await wait(250); }

const routes = ['', 'season', 'players', 'games', 'games/1', 'records', 'night', 'dominion', 'dominion/cards', 'dominion/randomizer', 'dominion/insights'];
let bad = 0;
for (const r of routes) {
  const c = await launch({ width: 1100, height: 800, mobile: false, url: 'http://localhost:5199/#/' + r });
  await wait(3500);
  const errors = c.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
  const state = await c.evalJs(`JSON.stringify({ text: (document.querySelector('main')||{textContent:''}).textContent.trim().length, broke: /Something went wrong/.test(document.body.textContent) })`);
  const { text, broke } = JSON.parse(state);
  const ok = !errors.length && text > 40 && !broke;
  if (!ok) { bad++; console.log(`FAIL #/${r}`, errors[0]?.split('\n')[0] || (broke ? 'error screen' : 'blank page')); } else console.log(`ok   #/${r}`);
  c.close();
}
if (server) server.kill();
console.log(bad ? `\n${bad} page(s) failed` : '\nAll pages start cleanly');
process.exit(bad ? 1 : 0);
