import { usePage } from '../../PageContext.js';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import { kingdomItemsOf, playAgain } from '../playAgain.js';

/* "Play again →": for an admin, one button that sends a past game's kingdom to Game night. Nothing for anyone else, and nothing for a game with no kingdom logged. */
export default function PlayAgain({ game, className = 'ghost', icon = false }) {
  const { me, gid, hashFor, catalog } = usePage();
  const [ask, dialog] = useConfirm();
  if (!me || !catalog || !kingdomItemsOf(game, catalog).length) return null;
  const go = async e => {
    e.stopPropagation();
    const confirmFn = () => ask({ title: 'Replace the kingdom?', text: 'A game is already under way on Game night. Its kingdom will be replaced with this one.', confirmLabel: 'Replace it' });
    if (await playAgain({ game, catalog, gid, confirmFn, fromStart: icon })) window.location.hash = hashFor('night', gid);
  };
  if (icon) return <><button type="button" className={className + ' gr-replay'} onClick={go} title="Replay: Game night from step 1 with this kingdom" aria-label="Replay this game's kingdom on Game night"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg></button>{dialog}</>;
  return <><button type="button" className={className} onClick={go} title="Open Game night with this kingdom">Play again →</button>{dialog}</>;
}
