import { usePage } from '../../PageContext.js';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { kingdomItemsOf, playAgain } from '../playAgain.js';

/* "Play again →": for an admin, one button that sends a past game's kingdom to Game night. Nothing for anyone else, and nothing for a game with no kingdom logged. */
export default function PlayAgain({ game, className = 'ghost' }) {
  const { me, gid, hashFor, catalog } = usePage();
  const [ask, dialog] = useConfirm();
  if (!me || !me.is_admin || !catalog || !kingdomItemsOf(game, catalog).length) return null;
  const go = async e => {
    e.stopPropagation();
    const confirmFn = () => ask({ title: 'Replace the kingdom?', text: 'A game is already under way on Game night. Its kingdom will be replaced with this one.', confirmLabel: 'Replace it' });
    if (await playAgain({ game, catalog, gid, confirmFn })) window.location.hash = hashFor('night', gid);
  };
  return <><button type="button" className={className} onClick={go} title="Open Game night with this kingdom">Play again →</button>{dialog}</>;
}
