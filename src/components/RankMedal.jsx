import { ord } from '../lib/format.js';

/* A place of 1st, 2nd or 3rd drawn as a medal (the same circles the player comparison uses, in gold, silver and bronze); any other place stays a plain number. */
export default function RankMedal({ rank, size = 32 }) {
  if (rank >= 1 && rank <= 3) return <span className={'rank-medal p' + rank} style={{ '--sz': size + 'px' }} title={ord(rank) + ' place'}><b>{ord(rank)}</b></span>;
  return <>{rank}</>;
}
