// Minimal Chrome DevTools Protocol driver (no dependencies): emulate a phone, run page scripts, take screenshots.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function launch({ width = 390, height = 844, dpr = 2, mobile = true, url, port = 9300 + Math.floor(Math.random() * 500) }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cdp-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.some(t => t.type === 'page')) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 150)); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const events = [];
  ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, d => (d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) { await send('Emulation.setTouchEmulationEnabled', { enabled: true }); await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); }
  await send('Page.navigate', { url });
  const evalJs = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const shot = async (file, { full = true } = {}) => {
    let clip; if (full) { const m = await send('Page.getLayoutMetrics'); clip = { x: 0, y: 0, width, height: Math.min(Math.ceil(m.cssContentSize.height), 6000), scale: 1 }; }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(clip ? { clip } : {}) }); writeFileSync(file, Buffer.from(r.data, 'base64'));
  };
  const close = () => { try { ws.close(); } catch { /* ignore */ } chrome.kill(); };
  return { evalJs, shot, send, close, events };
}
