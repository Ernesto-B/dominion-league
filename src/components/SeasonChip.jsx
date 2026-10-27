import { usePage } from '../PageContext.js';

export default function SeasonChip() {
  const { D } = usePage();
  const s = D.seasons[D.currentSeasonFor() - 1];
  if (!s) return null;
  const live = s.status === 'In progress';
  return (
    <span className={`chip ${live ? 'live' : ''}`}>
      <b>{s.name}</b> {live ? 'in progress' : s.status.toLowerCase()}{live && s.weeksLeft ? `, ${s.weeksLeft} week${s.weeksLeft > 1 ? 's' : ''} left` : ''}
    </span>
  );
}
