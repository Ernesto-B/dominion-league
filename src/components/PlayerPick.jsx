import { useMemo, useState } from 'react';
import NameIcon from './NameIcon.jsx';

/* Game night's "Who's playing?": big tiles in a grid instead of a ragged row of small pills, the people who played lately first (they are almost always tonight's table),
   a one-tap "same table as last game" for each recent table, and a search box that only shows once the roster is long enough to need one.
   `picked` is the seated names; `busy` are the ones already at the other table (greyed); `onToggle(name)` seats or unseats; `onSet(names)` seats a whole table at once. */
const RECENT_GAMES = 8, RECENT_MAX = 10, TABLES_MAX = 3, SEARCH_FROM = 9;

export function recentPlayers(games, roster) {
  const seen = [];
  for (let i = games.length - 1; i >= 0 && i >= games.length - RECENT_GAMES; i--) for (const n of games[i].names || []) if (roster.includes(n) && !seen.includes(n)) seen.push(n);
  return seen.slice(0, RECENT_MAX);
}

// the last few distinct tables (same people), newest first
export function recentTables(games, roster) {
  const out = [], keys = new Set();
  for (let i = games.length - 1; i >= 0 && out.length < TABLES_MAX; i--) {
    const names = (games[i].names || []).filter(n => roster.includes(n));
    if (names.length < 2) continue;
    const key = names.slice().sort().join('|');
    if (!keys.has(key)) { keys.add(key); out.push(names.slice().sort((a, b) => a.localeCompare(b))); }
  }
  return out;
}

export default function PlayerPick({ roster, games, picked, busy = [], onToggle, onSet, max }) {
  const [q, setQ] = useState('');
  const recent = useMemo(() => recentPlayers(games, roster), [games, roster]);
  const tables = useMemo(() => recentTables(games, roster), [games, roster]);
  const needle = q.trim().toLowerCase();
  const match = n => !needle || n.toLowerCase().includes(needle);
  const rest = roster.filter(n => !recent.includes(n));
  const showRecent = recent.length > 0 && recent.length < roster.length;
  const tile = n => {
    const on = picked.includes(n), away = busy.includes(n) && !on;
    return (
      <button key={n} type="button" className={'ptile' + (on ? ' on' : '')} aria-pressed={on} aria-disabled={away ? 'true' : undefined} title={away ? 'At the other table' : undefined}
        onClick={() => { if (!away) onToggle(n); }}>
        <NameIcon name={n} size={26} /><span className="ptile-n">{n}</span>{on && <i className="ptile-ck" aria-hidden="true">✓</i>}
      </button>
    );
  };
  const section = (title, names) => { const list = names.filter(match); return list.length ? <><h3 className="ppick-h">{title}</h3><div className="ppick-grid">{list.map(tile)}</div></> : null; };
  const free = t => t.filter(n => !busy.includes(n)).slice(0, max);
  return (
    <div className="ppick">
      {tables.length > 0 && !needle && (
        <div className="ppick-again">
          <span className="meta">Same table as a recent game</span>
          <div className="ppick-tables">{tables.map(t => {
            const names = free(t), same = names.length === picked.length && names.every(n => picked.includes(n));
            return <button key={t.join('|')} type="button" className={'ppick-t' + (same ? ' on' : '')} aria-pressed={same} disabled={!names.length} onClick={() => onSet(names)}>{t.join(' · ')}</button>;
          })}</div>
        </div>
      )}
      {roster.length >= SEARCH_FROM && <input type="search" className="ppick-q" placeholder="Find a player…" aria-label="Find a player" value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { const first = roster.filter(match).find(n => !busy.includes(n) || picked.includes(n)); if (first) { onToggle(first); setQ(''); } } }} />}
      {showRecent ? <>{section('Played lately', recent)}{section('Everyone else', rest)}</> : section(null, roster)}
      {needle && !roster.some(match) && <p className="meta">No one called “{q}”.</p>}
    </div>
  );
}
