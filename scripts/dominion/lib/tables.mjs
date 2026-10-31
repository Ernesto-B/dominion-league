import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const CSV_DIR = path.join(ROOT, 'supabase', 'dominion', 'seed_csv');

/* Load order respects foreign keys (parents first); delete order is the reverse. `ints` are the integer
   columns — every other column is text, and an empty CSV cell becomes NULL. */
export const TABLES = [
  { table: 'dominion_taxonomy',             csv: 'taxonomy.csv',              ints: [] },
  { table: 'dominion_kingdom_piles',        csv: 'kingdom_piles.csv',         ints: ['distinct_names', 'physical_copies'] },
  { table: 'dominion_kingdom_cards',        csv: 'kingdom_cards.csv',         ints: ['cost_coins', 'cost_debt', 'physical_copies'] },
  { table: 'dominion_kingdom_printed_types', csv: 'kingdom_printed_types.csv', ints: [] },
  { table: 'dominion_kingdom_mechanics',    csv: 'kingdom_mechanics.csv',     ints: [] },
  { table: 'dominion_landscapes',           csv: 'landscapes.csv',            ints: ['physical_copies'] },
  { table: 'dominion_landscape_mechanics',  csv: 'landscape_mechanics.csv',   ints: [] },
  { table: 'dominion_artifacts',            csv: 'artifacts.csv',             ints: ['physical_copies', 'cost_coins'] },
  { table: 'dominion_artifact_mechanics',   csv: 'artifact_mechanics.csv',    ints: [] },
  { table: 'dominion_card_text',            csv: 'card_text.csv',             ints: ['cost', 'debt_cost'] },
];

export function readTable(spec, dir = CSV_DIR) {
  return parseCsv(readFileSync(path.join(dir, spec.csv), 'utf8'));
}
export function readAll(dir = CSV_DIR) {
  return Object.fromEntries(TABLES.map(s => [s.table, readTable(s, dir)]));
}
