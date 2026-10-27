// Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, commas and newlines inside quotes).
// No dependencies, so the seed builder, the validator and the tests all share one reader.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);   // BOM
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter(r => r.length > 1 || r[0] !== '').map(r => Object.fromEntries(header.map((h, k) => [h, r[k] ?? ''])));
}
