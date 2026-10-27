import { usePage } from '../PageContext.js';

export default function GroupSwitcher({ route, rest }) {
  const { allGroups, gid, hashFor } = usePage();
  if (allGroups.length <= 1) return null;
  return (
    <div className="pills" aria-label="Choose a group">
      {allGroups.map(g => <a key={g.id} href={hashFor(route, g.id, rest)} aria-current={g.id === gid ? 'true' : undefined}>{g.name}</a>)}
    </div>
  );
}
