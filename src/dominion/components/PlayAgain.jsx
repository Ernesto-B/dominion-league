import { usePage } from '../../PageContext.js';
import { kingdomItemsOf, playAgain } from '../playAgain.js';

/* "Play again →": for an admin, one button that sends a past game's kingdom to Game night. Nothing for anyone else, and nothing for a game with no kingdom logged. */
export default function PlayAgain({ game, className = 'ghost' }) {
  const { me, gid, hashFor, catalog } = usePage();
  if (!me || !me.is_admin || !catalog || !kingdomItemsOf(game, catalog).length) return null;
  const go = e => {
    e.stopPropagation();
    if (playAgain({ game, catalog, gid })) window.location.hash = hashFor('night', gid);
  };
  return <button type="button" className={className} onClick={go} title="Open Game night with this kingdom">Play again →</button>;
}
