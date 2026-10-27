import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readAll, TABLES, CSV_DIR, ROOT } from '../../scripts/dominion/lib/tables.mjs';

const t = readAll();
const expected = JSON.parse(readFileSync(path.join(ROOT, 'supabase/dominion/expected_counts.json'), 'utf8'));

describe('the committed dataset matches the data package', () => {
  it('has the headline counts from the brief', () => {
    expect(t.dominion_kingdom_cards).toHaveLength(331);
    expect(t.dominion_kingdom_piles).toHaveLength(310);
    expect(t.dominion_landscapes).toHaveLength(124);
    expect(t.dominion_artifacts).toHaveLength(5);
    expect(t.dominion_kingdom_mechanics).toHaveLength(1634);
    expect(t.dominion_taxonomy).toHaveLength(98);
  });
  it('every table matches expected_counts.json (the package reference — never edited to fit)', () => {
    for (const { table } of TABLES) expect(t[table], table).toHaveLength(expected[table]);
  });
  it('has 3,132 physical Kingdom copies, summed the same way over cards and over piles', () => {
    const sum = (rows, k) => rows.reduce((s, r) => s + Number(r[k]), 0);
    expect(sum(t.dominion_kingdom_cards, 'physical_copies')).toBe(3132);
    expect(sum(t.dominion_kingdom_piles, 'physical_copies')).toBe(3132);
  });
  it('names exceed piles only by the extra names inside multi-name piles', () => {
    const extra = t.dominion_kingdom_piles.reduce((s, p) => s + Number(p.distinct_names) - 1, 0);
    expect(t.dominion_kingdom_cards.length - t.dominion_kingdom_piles.length).toBe(extra);
    expect(extra).toBe(21);
  });
  it('contains only owned editions: Second Edition or the expansion\'s only edition — never First Edition', () => {
    const eds = new Set(t.dominion_kingdom_cards.map(c => c.edition));
    expect([...eds].sort()).toEqual(['Original (only edition)', 'Second Edition']);
    expect(t.dominion_kingdom_cards.some(c => /first/i.test(c.edition))).toBe(false);
  });
  it('is owned across exactly the 11 boxes', () => {
    expect([...new Set(t.dominion_kingdom_cards.map(c => c.expansion))].sort()).toEqual(
      ['Cornucopia & Guilds', 'Dark Ages', 'Dominion Base Game', 'Empires', 'Hinterlands', 'Intrigue', 'Menagerie', 'Plunder', 'Prosperity', 'Renaissance', 'Seaside']);
  });
  it('keeps Artifacts and landscapes out of the Kingdom card list', () => {
    const cardIds = new Set(t.dominion_kingdom_cards.map(c => c.card_id));
    t.dominion_landscapes.forEach(l => expect(cardIds.has(l.object_id)).toBe(false));
    t.dominion_artifacts.forEach(a => expect(cardIds.has(a.object_id)).toBe(false));
    expect(new Set(t.dominion_landscapes.map(l => l.object_type))).toEqual(new Set(['Event', 'Landmark', 'Project', 'Way', 'Trait']));
    expect(t.dominion_artifacts.every(a => a.object_kind === 'Artifact')).toBe(true);
  });
});

describe('referential integrity', () => {
  const cardIds = new Set(t.dominion_kingdom_cards.map(c => c.card_id));
  it('every card has a unique id and points at a real (expansion, pile)', () => {
    expect(cardIds.size).toBe(331);
    const piles = new Set(t.dominion_kingdom_piles.map(p => `${p.expansion}::${p.pile_id}`));
    expect(piles.size).toBe(310);
    t.dominion_kingdom_cards.forEach(c => expect(piles.has(`${c.expansion}::${c.pile_id}`), c.card_id).toBe(true));
  });
  it('every pile lists real cards, as many as it says', () => {
    t.dominion_kingdom_piles.forEach(p => {
      const ids = p.card_ids.split('|');
      expect(ids.length, p.pile_id).toBe(Number(p.distinct_names));
      ids.forEach(id => expect(cardIds.has(id), id).toBe(true));
    });
  });
  it('printed types, mechanics and taxonomy all line up with real cards', () => {
    const tax = new Set(t.dominion_taxonomy.map(x => x.mechanic_id));
    t.dominion_kingdom_printed_types.forEach(r => expect(cardIds.has(r.card_id)).toBe(true));
    t.dominion_kingdom_mechanics.forEach(r => { expect(cardIds.has(r.card_id)).toBe(true); expect(tax.has(r.mechanic_id), r.mechanic_id).toBe(true); });
    const pairs = t.dominion_kingdom_mechanics.map(r => r.card_id + '/' + r.mechanic_id);
    expect(new Set(pairs).size).toBe(pairs.length);
  });
  it('landscape and artifact tags belong to real objects (their vocabulary differs from the Kingdom taxonomy)', () => {
    const l = new Set(t.dominion_landscapes.map(x => x.object_id)), a = new Set(t.dominion_artifacts.map(x => x.object_id));
    t.dominion_landscape_mechanics.forEach(r => expect(l.has(r.object_id)).toBe(true));
    t.dominion_artifact_mechanics.forEach(r => expect(a.has(r.object_id)).toBe(true));
    const tax = new Set(t.dominion_taxonomy.map(x => x.mechanic_id));
    expect(t.dominion_landscape_mechanics.some(r => !tax.has(r.mechanic_id))).toBe(true);   // documents WHY there is no FK
  });
});

describe('generated SQL and source files', () => {
  it('02_seed_data.sql is up to date with the CSVs', () => {
    const r = spawnSync('node', ['scripts/dominion/build-seed.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
  });
  it('the CSVs still match their recorded SHA-256 checksums', () => {
    const lines = readFileSync(path.join(ROOT, 'supabase/dominion/seed_csv.sha256'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(10);
    for (const line of lines) {
      const [sum, file] = line.trim().split(/\s+/);
      expect(createHash('sha256').update(readFileSync(path.join(CSV_DIR, file))).digest('hex'), file).toBe(sum);
    }
  });
});
