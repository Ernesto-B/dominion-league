import { usePage } from '../PageContext.js';
import DominionPage from '../dominion/DominionPage.jsx';

// #/dominion[/cards[/<id>] | /landscapes[/<id>]] — a site-wide section, not scoped to a friend group.
export default function Dominion() {
  const { arg } = usePage();
  return <DominionPage arg={arg} />;
}
