import { usePage } from '../PageContext.js';

export default function Banner() {
  const { D } = usePage();
  const w = D.warnings;
  if (!w.length) return null;
  return (
    <div className="banner" role="status">
      <b>{w.length} thing{w.length > 1 ? 's' : ''} to fix in the data</b>
      <ul>{w.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
