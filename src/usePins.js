import { useState } from 'react';
import { usePage } from './PageContext.js';
import { sb } from './lib/supabase.js';

/* A player's pinned badge ids (players.pinned_badges) and, on the viewer's own page, a way to change them. Saved through the
   set_my_pinned_badges RPC (the database refuses more than three), then the league is reloaded so every page agrees. */
export function usePins(name) {
  const { rawPlayers, me, reload } = usePage();
  const row = (rawPlayers || []).find(x => x.name === name);
  const ids = (row && row.pinned_badges) || [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async next => {
    setBusy(true); setError('');
    const { error: e } = await sb.rpc('set_my_pinned_badges', { p_ids: next });
    if (e) setError('Couldn’t save your pinned badges.'); else await reload();
    setBusy(false);
  };
  return { ids, mine: !!me && me.name === name, busy, error, toggle: id => save(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]) };
}
