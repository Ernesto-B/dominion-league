export default function TypePill({ type }) {
  if (type === 'Playoff') return <span className="pill play">Playoff</span>;
  if (type === 'Friendly') return <span className="pill fr">Friendly</span>;
  return null;
}
