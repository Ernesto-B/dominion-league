import { f0, short } from '../lib/format.js';
import PlayerLink from './PlayerLink.jsx';

export default function StoryCards({ R, ranked }) {
  const cards = [];
  if (R.closestRace) cards.push(<div className="story" key="race"><span className="slabel">Closest race</span><PlayerLink name={R.closestRace.a} /> leads <PlayerLink name={R.closestRace.b} /> by just <b>{f0(R.closestRace.gap)}</b> Elo</div>);
  if (R.biggestUpset) cards.push(<div className="story" key="upset"><span className="slabel">Biggest upset</span><PlayerLink name={R.biggestUpset.winner} /> beat <PlayerLink name={R.biggestUpset.loser} /> despite trailing by <b>{f0(R.biggestUpset.deficit)}</b> Elo <span className="meta">({short(R.biggestUpset.date)})</span></div>);
  const streaker = (ranked || []).filter(p => p.streak >= 3).sort((a, b) => b.streak - a.streak)[0];
  if (streaker) cards.push(<div className="story" key="streak"><span className="slabel">Hot streak</span><PlayerLink name={streaker.name} /> has won <b>{streaker.streak}</b> in a row 🔥</div>);
  return cards.length ? <div className="storyrow">{cards}</div> : null;
}
