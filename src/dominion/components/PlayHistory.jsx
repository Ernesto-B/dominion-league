import { winners } from '../playStats.js';

/* "In our games": how often a card (or landscape) has been in a logged game, with the most recent few as links to those
   games on the Games page. `entry` is a playStats() entry, or undefined when it has never been played; `lg` is
   useLeagueGames(). */
export default function PlayHistory({ entry, lg }) {
  if (!entry) return <p style={{ margin: 0 }}>Not played yet in a logged game.</p>;
  const recent = entry.list.slice(-5).reverse(), older = entry.games - recent.length;
  const { wins, games } = entry.mine;
  return (
    <>
      <p style={{ margin: '0 0 8px' }}>In <b>{entry.games}</b> logged {entry.games === 1 ? 'game' : 'games'}{lg.groupName ? ` for ${lg.groupName}` : ''}.</p>
      <ul className="dn-plain-list">
        {recent.map(g => (
          <li key={g.line}><a href={lg.hashFor('games', lg.gid, g.line)}>{g.date}</a> <span className="meta">· won by {winners(g).join(' & ')}</span></li>
        ))}
      </ul>
      {older > 0 && <p className="meta" style={{ margin: '8px 0 0' }}>…and {older} earlier {older === 1 ? 'game' : 'games'}.</p>}
      {lg.me && games > 0 && <p style={{ margin: '10px 0 0' }}>You played it in <b>{games}</b> {games === 1 ? 'game' : 'games'} and won <b>{wins}</b>.</p>}
    </>
  );
}
