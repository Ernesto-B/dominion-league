/* A picture of a rolled kingdom, to send to the group chat (hash URLs can't carry a link preview, so the picture is the preview).

   kingdomImageLayout() is pure — it decides what goes where from the kingdom, and is tested. drawKingdomImage() paints that onto a
   canvas, renderKingdomImage() produces the PNG, and shareKingdomImage() hands it to the phone's share sheet (or downloads it). */
import { expansionMeta } from './constants.js';
import { coinIconSrc, debtIconSrc } from './components/Cost.jsx';
import { setIconPath } from '../lib/sets.js';
import { primaryType } from './kingdom.js';

export const W = 1080, PAD = 48, GAP = 14, ROW_H = 92, HEAD_H = 168, SECTION_H = 64;
const COL_W = (W - 2 * PAD - GAP) / 2;

// the same colours as the type pills and chart (the --t-* variables in style.css; a test keeps them in step)
export const TONE_RGB = {
  action: [150, 150, 150], treasure: [235, 195, 30], duration: [248, 112, 8], attack: [228, 25, 40], reaction: [60, 130, 235], victory: [60, 170, 90],
  command: [118, 134, 160], gathering: [150, 160, 172], looter: [96, 108, 128],
  project: [240, 110, 170], trait: [150, 90, 225], event: [170, 165, 158], way: [110, 190, 245], landmark: [40, 125, 70],
};
const toneOf = t => (t && TONE_RGB[String(t).toLowerCase()] ? String(t).toLowerCase() : null);

export function kingdomImageLayout(state, { title = 'Kingdom', subtitle = '' } = {}) {
  const items = [];
  const cardRows = state.slots.map(s => {
    const cards = s.cards, main = cards.find(c => primaryType(c) === 'Attack') || cards[0];
    return { kind: 'card', name: s.name, sub: [...new Set(cards.flatMap(c => c.types))].join(' · '), tone: toneOf(primaryType(main)), cost: { coins: cards[0].coins, debt: cards[0].debt }, set: expansionMeta(s.expansion).icon };
  });
  if (state.setup.bane) { const b = state.setup.bane; cardRows.push({ kind: 'card', name: b.name, sub: 'Bane for Young Witch', tone: toneOf(primaryType(b.cards[0])), cost: { coins: b.cards[0].coins, debt: b.cards[0].debt }, set: expansionMeta(b.expansion).icon, tag: 'BANE' }); }
  const hostName = id => { const s = state.slots.find(x => x.cards.some(c => c.id === id)); return s ? s.name : null; };
  const landRows = state.landscapes.map(l => ({ kind: 'landscape', name: l.landscape.name, sub: l.on && hostName(l.on) ? `${l.landscape.type} · on ${hostName(l.on)}` : l.landscape.type, tone: toneOf(l.landscape.type), cost: null, set: expansionMeta(l.landscape.expansion).icon }));

  let y = HEAD_H;
  const place = (rows, startY) => rows.map((r, i) => ({ ...r, x: PAD + (i % 2) * (COL_W + GAP), y: startY + Math.floor(i / 2) * (ROW_H + GAP), w: COL_W, h: ROW_H }));
  const cards = place(cardRows, y);
  y += Math.ceil(cardRows.length / 2) * (ROW_H + GAP);
  let lands = [], landHeading = null;
  if (landRows.length) { landHeading = { text: 'Landscapes', x: PAD, y: y + 18 }; y += SECTION_H; lands = place(landRows, y); y += Math.ceil(landRows.length / 2) * (ROW_H + GAP); }
  const notes = [];
  const { setup } = state;
  if (setup.platinumColony != null) notes.push(setup.platinumColony ? 'Use Platinum and Colony' : 'No Platinum or Colony');
  if (setup.shelters != null) notes.push(setup.shelters ? 'Use Shelters' : 'Use Estates (no Shelters)');
  if (setup.ruins) notes.push('Add the Ruins pile');
  let notesBlock = null;
  if (notes.length) { notesBlock = { heading: { text: 'Setup', x: PAD, y: y + 18 }, lines: notes.map((t, i) => ({ text: t, x: PAD, y: y + SECTION_H + 8 + i * 44 })) }; y += SECTION_H + 8 + notes.length * 44; }
  const height = Math.ceil(y + 36 + 40);
  items.push(...cards, ...lands);
  return { width: W, height, title: { text: title, x: PAD, y: 82 }, subtitle: { text: subtitle, x: PAD, y: 126 }, cards, lands, landHeading, notes: notesBlock, footer: { text: 'Dominion Night', x: W - PAD, y: height - 28 } };
}

// ---- painting (browser only) ----
const loadImage = src => new Promise(res => { if (!src) return res(null); const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = src; });
// the set icons are dark line art: paint them white by keeping only their shape (canvas filters aren't everywhere, compositing is)
function whiteIcon(img, size, doc) {
  const c = doc.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, size, size); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  return c;
}
const rgb = (t, a = 1) => { const [r, g, b] = TONE_RGB[t] || [120, 130, 145]; return `rgba(${r},${g},${b},${a})`; };
function fit(ctx, text, maxW) { if (ctx.measureText(text).width <= maxW) return text; let s = text; while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; }

export async function drawKingdomImage(canvas, layout, { doc = document } = {}) {
  canvas.width = layout.width; canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  const rows = [...layout.cards, ...layout.lands];
  const srcs = new Set(); rows.forEach(r => { if (r.cost) srcs.add(r.cost.coins > 0 || !r.cost.debt ? coinIconSrc(r.cost.coins) : debtIconSrc(r.cost.debt)); if (r.set) srcs.add(setIconPath(r.set)); });
  const imgs = new Map(await Promise.all([...srcs].filter(Boolean).map(async s => [s, await loadImage(s)])));

  ctx.fillStyle = '#0A0E12'; ctx.fillRect(0, 0, layout.width, layout.height);
  const grad = ctx.createLinearGradient(0, 0, 0, 200); grad.addColorStop(0, 'rgba(255,255,255,.07)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, layout.width, 200);
  ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#F2F5F8'; ctx.font = '800 58px "Bricolage Grotesque", system-ui, sans-serif'; ctx.fillText(layout.title.text, layout.title.x, layout.title.y);
  ctx.fillStyle = '#94A3B3'; ctx.font = '500 28px "Instrument Sans", system-ui, sans-serif'; ctx.fillText(layout.subtitle.text, layout.subtitle.x, layout.subtitle.y);

  for (const r of rows) {
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.fillStyle = rgb(r.tone, .95); ctx.beginPath(); ctx.roundRect(r.x, r.y, 10, r.h, [16, 0, 0, 16]); ctx.fill();
    let tx = r.x + 30;
    if (r.cost) { const src = r.cost.coins > 0 || !r.cost.debt ? coinIconSrc(r.cost.coins) : debtIconSrc(r.cost.debt), img = imgs.get(src); if (img) ctx.drawImage(img, r.x + 26, r.y + (r.h - 56) / 2, 56, 56); tx = r.x + 98; }
    const right = r.x + r.w - (r.set && imgs.get(setIconPath(r.set)) ? 70 : 20);
    ctx.fillStyle = '#F2F5F8'; ctx.font = '700 33px "Instrument Sans", system-ui, sans-serif'; ctx.fillText(fit(ctx, r.name, right - tx - (r.tag ? 80 : 0)), tx, r.y + 40);
    if (r.tag) { ctx.fillStyle = rgb(r.tone, .9); ctx.font = '700 18px system-ui, sans-serif'; ctx.fillText(r.tag, right - 66, r.y + 36); }
    ctx.fillStyle = '#94A3B3'; ctx.font = '500 23px "Instrument Sans", system-ui, sans-serif'; ctx.fillText(fit(ctx, r.sub, right - tx), tx, r.y + 72);
    const icon = r.set && imgs.get(setIconPath(r.set)); if (icon) ctx.drawImage(whiteIcon(icon, 40, doc), r.x + r.w - 58, r.y + (r.h - 40) / 2, 40, 40);
  }
  ctx.fillStyle = '#F2F5F8'; ctx.font = '800 34px "Bricolage Grotesque", system-ui, sans-serif';
  if (layout.landHeading) ctx.fillText(layout.landHeading.text, layout.landHeading.x, layout.landHeading.y + 30);
  if (layout.notes) {
    ctx.fillText(layout.notes.heading.text, layout.notes.heading.x, layout.notes.heading.y + 30);
    ctx.fillStyle = '#C8D2DC'; ctx.font = '500 30px "Instrument Sans", system-ui, sans-serif'; layout.notes.lines.forEach(l => ctx.fillText('•  ' + l.text, l.x, l.y + 30));
  }
  ctx.fillStyle = '#5E6C7B'; ctx.font = '600 24px "Instrument Sans", system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(layout.footer.text, layout.footer.x, layout.footer.y); ctx.textAlign = 'left';
  return canvas;
}

export async function renderKingdomImage(state, opts = {}) {
  const layout = kingdomImageLayout(state, opts), canvas = document.createElement('canvas');
  await drawKingdomImage(canvas, layout);
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('The image could not be made.'))), 'image/png'));
}

/* Offers the picture to the phone's share sheet; where files can't be shared (most desktops) it is downloaded instead.
   Resolves 'shared', 'downloaded', or 'cancelled' (the viewer closed the sheet — not an error). */
export async function shareKingdomImage(blob, { name = 'kingdom.png', title = 'Kingdom', nav = typeof navigator !== 'undefined' ? navigator : null, doc = typeof document !== 'undefined' ? document : null } = {}) {
  const file = new File([blob], name, { type: 'image/png' });
  if (nav && nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* otherwise fall through to a download */ }
  }
  const url = URL.createObjectURL(blob), a = doc.createElement('a');
  a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
