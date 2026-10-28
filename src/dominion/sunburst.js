/* Geometry and data for the sunburst view of "Card types by expansion". Pure: no DOM, no React.

   Two rings built from the same matrix as the table:
     by 'expansion'  inner = expansions, sized by their card NAMES; outer = how each expansion's printed types split.
     by 'type'       inner = printed types, sized by how many names have the type; outer = which expansions they come from.
   A card with several printed types counts once under each, so the type counts of an expansion add up to MORE than its
   names. In 'expansion' mode the outer arcs therefore share the expansion's arc in proportion to those counts (the real
   count is what is printed on them); in 'type' mode every arc is exactly its count.

   Angles are radians, clockwise from 12 o'clock. */
export const TAU = Math.PI * 2;

export function sunburstData(matrix, by = 'expansion') {
  let groups;
  if (by === 'type') {
    groups = matrix.types.map(t => ({
      key: t, type: t, label: t, value: matrix.totals[t], count: matrix.totals[t],
      children: matrix.rows.filter(r => r.counts[t] > 0).map(r => ({ key: `${t}|${r.name}`, type: t, expansion: r.name, label: r.label, icon: r.icon, value: r.counts[t], count: r.counts[t], of: r.names })),
    })).filter(g => g.value > 0);
  } else {
    groups = matrix.rows.map(r => {
      const kids = matrix.types.filter(t => r.counts[t] > 0), sum = kids.reduce((a, t) => a + r.counts[t], 0);
      return {
        key: r.name, expansion: r.name, label: r.label, icon: r.icon, value: r.names, count: r.names,
        children: kids.map(t => ({ key: `${r.name}|${t}`, type: t, expansion: r.name, label: r.label, icon: r.icon, value: sum ? (r.names * r.counts[t]) / sum : 0, count: r.counts[t], of: r.names })),
      };
    }).filter(g => g.value > 0);
  }
  return { by, groups, total: groups.reduce((a, g) => a + g.value, 0) };
}

/* Gives every group and child its start/end angle. Children fill their group's arc in proportion to their value. */
export function layoutSunburst(data) {
  let a = 0;
  return data.groups.map(g => {
    const span = (g.value / data.total) * TAU, a0 = a, a1 = a + span;
    let c = a0;
    const children = g.children.map(k => { const w = g.children.length ? (k.value / g.children.reduce((s, x) => s + x.value, 0)) * span : 0; const kid = { ...k, a0: c, a1: c + w }; c += w; return kid; });
    a = a1;
    return { ...g, a0, a1, children };
  });
}

// the path of one ring segment; `pad` (radians) trims a hair off each side so neighbours don't touch
export function arcPath(cx, cy, r0, r1, a0, a1, pad = 0) {
  const p = Math.min(pad, (a1 - a0) / 4);
  a0 += p / 2; a1 -= p / 2;
  const pt = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map(n => +n.toFixed(2));
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

// the middle of a segment, for its label
export function centroid(cx, cy, r0, r1, a0, a1) { const a = (a0 + a1) / 2, r = (r0 + r1) / 2; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; }

// how many pixels of arc a segment has at radius r, to decide whether a label fits
export const arcLength = (r, a0, a1) => r * (a1 - a0);

export const typeVar = type => `--t-${String(type).toLowerCase()}`;

/* The zoomed-in chart for one group of the overview: one expansion (by 'expansion') or one printed type (by 'type').
   Inner ring: for an expansion, its printed types; for a type, the expansions that have it. Outer ring: the CARDS themselves,
   cheapest first. A card with several printed types is under each of its types, as in the table. Arcs here are exactly their
   counts (a card is 1), so unlike the overview nothing is rescaled. `cards` is catalog.cards. Null for an unknown key. */
export function zoomData(matrix, cards, by, key) {
  const cheapestFirst = (a, b) => a.coins - b.coins || a.debt - b.debt || a.name.localeCompare(b.name);
  const leaf = (c, type) => ({ key: `card:${c.id}:${type}`, id: c.id, name: c.name, type, expansion: c.expansion, coins: c.coins, debt: c.debt, value: 1, count: 1 });
  const cardsOf = (exp, type) => cards.filter(c => c.expansion === exp && c.types.includes(type)).sort(cheapestFirst);
  let groups, head;
  if (by === 'expansion') {
    const row = matrix.rows.find(r => r.name === key);
    if (!row) return null;
    head = { title: row.label, icon: row.icon, big: row.names, expansion: row.name, type: null };
    groups = matrix.types.filter(t => row.counts[t] > 0).map(t => {
      const list = cardsOf(row.name, t);
      return { key: `${row.name}|${t}`, type: t, expansion: row.name, label: t, icon: null, value: list.length, count: list.length, of: row.names, children: list.map(c => leaf(c, t)) };
    });
  } else {
    if (!matrix.types.includes(key)) return null;
    head = { title: key, icon: null, big: matrix.totals[key], expansion: null, type: key };
    groups = matrix.rows.filter(r => r.counts[key] > 0).map(r => {
      const list = cardsOf(r.name, key);
      return { key: `${key}|${r.name}`, type: key, expansion: r.name, label: r.label, icon: r.icon, value: list.length, count: list.length, of: r.names, children: list.map(c => leaf(c, key)) };
    });
  }
  return { by, zoom: key, ...head, groups, total: groups.reduce((a, g) => a + g.value, 0) };
}

// a card's name shortened for a narrow radial label
export const shortName = (name, max = 15) => (name.length > max ? name.slice(0, max - 1).trimEnd() + '…' : name);

/* The chart's state lives in the Overview's URL (#/dominion?chart=sunburst&ring=type&zoom=Attack), so Back from a card page
   returns to exactly where you were. Only what differs from the default (the table) is written; junk is ignored. */
export const DEFAULT_CHART = Object.freeze({ view: 'table', by: 'expansion', zoom: null });
export function chartToQuery({ view, by, zoom }) {
  if (view !== 'sunburst') return '';
  const p = new URLSearchParams({ chart: 'sunburst' });
  if (by === 'type') p.set('ring', 'type');
  if (zoom) p.set('zoom', zoom);
  return '?' + p.toString();
}
export function chartFromQuery(qs) {
  const p = new URLSearchParams(String(qs || '').replace(/^\?/, ''));
  if (p.get('chart') !== 'sunburst') return { ...DEFAULT_CHART };
  return { view: 'sunburst', by: p.get('ring') === 'type' ? 'type' : 'expansion', zoom: p.get('zoom') || null };
}
