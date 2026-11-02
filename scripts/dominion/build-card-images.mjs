/* Card pictures: turns a folder of the owner's card images into small WebP files the site can show, and writes the manifest that says which cards have one.
     npm run cards:build -- ~/Downloads/dominion_card_images [--out public/cards]
   Files are matched to the catalog by NAME (the folder an image sits in does not matter): `200px-Crew~English~2022.jpg`, `320px-Avoid~English~2022.jpg`, `Crew.png` and so on.
   Output: <out>/<catalog id with ":" as "/">.webp (plunder/crew.webp, plunder/event/foray.webp), a plunder/crew@big.webp when the source is large enough to have more detail, and
   <out>/manifest.json ({ v: 2, items: { id: { w, h, bw?, bh?, k } } }, k a short hash of the card's pictures), plus a plunder/crew@t.webp thumbnail for lists.
   The pictures are never committed (public/cards is in .gitignore); they are uploaded to the private Supabase bucket once that is set up (docs/card-images.md).
   The script reports what is missing, so a gap is known and not a blank tile: catalog entries with no image (for the expansions that have at least one), and images that match nothing
   (Plunder's Loot cards, for example, are not Kingdom cards and are not in the catalog). */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { readTable, TABLES, ROOT } from './lib/tables.mjs';
import { nameOfFile, normName, slugOf } from './lib/cardImageNames.mjs';

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const src = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const out = path.resolve(flag('--out') || path.join(ROOT, 'public', 'cards'));
if (!src) { console.error('usage: npm run cards:build -- <folder of card images> [--out public/cards]'); process.exit(1); }

const cardRows = readTable(TABLES.find(t => t.table === 'dominion_kingdom_cards'));
const cards = cardRows.map(r => ({ id: r.card_id, name: r.name, exp: r.expansion }));
const lands = readTable(TABLES.find(t => t.table === 'dominion_landscapes')).map(r => ({ id: r.object_id, name: r.name, exp: r.expansion }));
// Artifacts (Renaissance's Flag, Horn, Key, Lantern, Treasure Chest) are neither Kingdom cards nor landscapes, but they are in the catalog and have a picture
const artifacts = readTable(TABLES.find(t => t.table === 'dominion_artifacts')).map(r => ({ id: r.object_id, name: r.name, exp: r.expansion }));
const byName = new Map();
// a pile with several names (Knights, Castles, the split piles) can have a picture of its own, the pile card: it is stored as <expansion id>:pile:<pile name slugged>
const pileRows = readTable(TABLES.find(t => t.table === 'dominion_kingdom_piles')).filter(r => Number(r.distinct_names) > 1);
const piles = pileRows.map(r => ({ id: `${r.card_ids.split(/[|;,]/)[0].split(':')[0]}:pile:${slugOf(r.pile_id)}`, name: r.pile_id, exp: r.expansion }));
[...cards, ...lands, ...artifacts, ...piles].forEach(e => { const k = normName(e.name); byName.set(k, [...(byName.get(k) || []), e]); });
// a card renamed in a later printing (Harem -> Farm) is often still pictured under its old name: that is the same card, so the old name is a fallback, never a rival to a current name
cardRows.filter(r => r.previous_name).forEach(r => { const k = normName(r.previous_name); if (!byName.has(k)) byName.set(k, [cards.find(c => c.id === r.card_id)]); });

const files = [];
const walk = d => readdirSync(d).forEach(n => { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else if (nameOfFile(n)) files.push(p); });
walk(path.resolve(src.replace(/^~/, process.env.HOME || '~')));

rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const items = {}, unmatched = [], clashes = [], best = new Map();   // best: catalog id -> the largest picture found for it (the same card in two folders or two sizes is converted once, from the sharper one)
for (const f of files) {
  const base = normName(nameOfFile(path.basename(f)));
  const hit = byName.get(base) || byName.get(base.replace(/old$/, '').trim());   // `Village_GreenOld`: the wiki's name for an older printing of the same card
  if (!hit) { unmatched.push(path.relative(path.resolve(src), f)); continue; }
  // two catalog entries with one name (a card and a landscape): the folder name decides, else it is reported, never guessed
  const folder = normName(path.basename(path.dirname(f))), e = hit.length === 1 ? hit[0] : hit.find(x => normName(x.exp) === folder);
  if (!e) { clashes.push(f); continue; }
  const m = await sharp(f).metadata(), area = m.width * m.height;
  if (!best.has(e.id) || area > best.get(e.id).area) best.set(e.id, { f, e, m, area });
}
for (const { f, e, m: meta } of best.values()) {
  const dest = path.join(out, e.id.replace(/:/g, '/') + '.webp');
  mkdirSync(path.dirname(dest), { recursive: true });
  // three sizes from one source, never enlarged: a thumbnail for lists (96 px wide, 160 for a landscape), a small one for the grids (300 / 400) and a big one for the
  // enlarge view (800 px on the long side, only when the source really has more detail than the small one)
  const wide = meta.width > meta.height;
  const tile = await sharp(f).resize({ width: wide ? 400 : 300, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(dest);
  await sharp(f).resize({ width: wide ? 160 : 96, withoutEnlargement: true }).webp({ quality: 70, effort: 6 }).toFile(dest.replace(/\.webp$/, '@t.webp'));
  const item = { w: tile.width, h: tile.height };
  const parts = [dest, dest.replace(/\.webp$/, '@t.webp')];
  if (Math.max(meta.width, meta.height) > Math.max(tile.width, tile.height) * 1.25) {
    const bigFile = dest.replace(/\.webp$/, '@big.webp');
    const big = await sharp(f).resize({ [wide ? 'width' : 'height']: 800, withoutEnlargement: true }).webp({ quality: 78, effort: 6 }).toFile(bigFile);
    item.bw = big.width; item.bh = big.height; parts.push(bigFile);
  }
  item.k = createHash('sha1').update(Buffer.concat(parts.map(p => readFileSync(p)))).digest('hex').slice(0, 8);   // changes only when a picture of this card changes: it is what keeps a device's saved copy fresh
  items[e.id] = item;
}
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ v: 2, items }));

const have = new Set(Object.keys(items)), exps = new Set([...cards, ...lands, ...artifacts].filter(e => have.has(e.id)).map(e => e.exp));
const missing = [...cards, ...lands, ...artifacts].filter(e => exps.has(e.exp) && !have.has(e.id));
const sizeOf = f => { try { return statSync(f).size; } catch { return 0; } };
const bytes = Object.keys(items).reduce((n, id) => n + sizeOf(path.join(out, id.replace(/:/g, '/') + '.webp')), 0), bigBytes = Object.keys(items).reduce((n, id) => n + sizeOf(path.join(out, id.replace(/:/g, '/') + '@big.webp')), 0);
console.log(`${Object.keys(items).length} images written to ${path.relative(ROOT, out)} (${(bytes / 1024).toFixed(0)} KB of small versions; ${Object.values(items).filter(i => i.bw).length} have a big version for the enlarge view, ${(bigBytes / 1024).toFixed(0)} KB)`);
console.log(`catalog entries: ${cards.length} cards, ${lands.length} landscapes, ${artifacts.length} artifacts; with an image: ${[...cards, ...lands, ...artifacts].filter(e => have.has(e.id)).length}`);
if (missing.length) console.log(`\nNo image yet for ${missing.length} (in expansions that have images):\n  ` + missing.map(e => `${e.exp}: ${e.name}`).join('\n  '));
if (unmatched.length) console.log(`\n${unmatched.length} image(s) match nothing in the catalog (not Kingdom cards or landscapes):\n  ` + unmatched.join('\n  '));
if (clashes.length) console.log(`\n${clashes.length} image(s) match more than one catalog entry and the folder did not decide:\n  ` + clashes.join('\n  '));
