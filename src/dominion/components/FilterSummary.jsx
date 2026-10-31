import { describeFilters } from '../filters.js';
import { humanize } from '../constants.js';

/* What is narrowing the list right now, as removable chips: the filters live in a fold on a phone, so without this a list that looks short gives no hint why.
   One chip per filter group; the ✕ switches that group off. Renders nothing when nothing is filtered. */
export default function FilterSummary({ f, update }) {
  const items = describeFilters(f, humanize);
  if (!items.length) return null;
  return (
    <ul className="dn-active" aria-label="Active filters">
      {items.map(i => (
        <li key={i.key}>
          <span>{i.text}</span>
          <button type="button" className="dn-active-x" aria-label={`Remove filter: ${i.text}`} onClick={() => update(i.clear)}>✕</button>
        </li>
      ))}
    </ul>
  );
}
