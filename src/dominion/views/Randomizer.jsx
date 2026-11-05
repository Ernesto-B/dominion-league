import { useEffect, useMemo, useState } from 'react';
import { clearResumeEditing, peekResumeEditing } from '../kingdomPick.js';
import { useCatalog } from '../CatalogContext.jsx';
import { usePage } from '../../PageContext.js';
import { writeQuery } from '../urlState.js';
import { loadNight, nightInProgress, saveNight, withRolledKingdom } from '../../lib/night.js';
import { impliedSets, resolveKingdom } from '../kingdom.js';
import { pilesPlayed } from '../playStats.js';
import { useLeagueGames } from '../useLeagueGames.js';
import { DEFAULT_OPTIONS, formatSeed, kingdomFromParams, stateFromItems, kingdomToParams, optionsFromParams, optionsToParams, toGameItems } from '../randomizer.js';
import RandomizerPanel from '../components/RandomizerPanel.jsx';
import { useConfirm } from '../../components/ConfirmDialog.jsx';
import FlashButton from '../../components/FlashButton.jsx';
import { PageShortcuts } from '../../components/Shortcuts.jsx';

/* The Kingdom randomizer page. Everything — the options AND the kingdom that was rolled — lives in the URL
   (#/dominion/randomizer?exp=Seaside&c=...), so a kingdom can be shared, reopened, and left for a card page and come back
   to with Back. The roll itself is src/dominion/randomizer.js and the working part is components/RandomizerPanel.jsx (which the
   Game night Kingdom step uses too). */
export default function Randomizer({ query = '' }) {
  const { catalog } = useCatalog();
  const page = usePage();   // null outside the league (tests); gives the logged games and whether this viewer can log one
  const params = useMemo(() => new URLSearchParams(query.replace(/^\?/, '')), [query]);
  const opts = useMemo(() => optionsFromParams(params), [params]);
  const state = useMemo(() => kingdomFromParams(catalog, params), [catalog, params]);
  const [ask, confirmDialog] = useConfirm();
  const [flash, setFlash] = useState({});   // which button just confirmed itself: { link | seed: 'ok' | 'fail' }
  const flashFor = (key, status) => { setFlash({ [key]: status }); setTimeout(() => setFlash(f => (f[key] === status ? {} : f)), status === 'ok' ? 1800 : 3500); };
  const [hand, setHand] = useState(peekResumeEditing);   // back from choosing a card in the full list: still editing   // hand-editing: the tiles get Replace / Remove and an Add tile (the same editing Game night's Random way has)

  useEffect(() => { clearResumeEditing(); }, []);
  const lg = useLeagueGames();
  const plays = useMemo(() => (lg && lg.stats ? pilesPlayed(lg.stats) : null), [lg]);
  const canLog = !!(page && page.me && page.me.is_admin);

  const write = (nextOpts, nextState) => {
    const p = optionsToParams(nextOpts); if (nextState) kingdomToParams(nextState, p);
    const s = p.toString(); writeQuery(s ? '?' + s : '');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); flashFor('link', 'ok'); } catch { flashFor('link', 'fail'); }
  };
  // for everyone who can't log a game: the roll's seed to the clipboard, to send to whoever will set the game up (they type it into Game night's seed box)
  const shareSeed = async () => {
    const seed = formatSeed(state.seed);
    try { await navigator.clipboard.writeText(seed); flashFor('seed', 'ok'); } catch { flashFor('seed', 'fail'); }   // no clipboard here: the button shows the seed to copy by hand
  };
  // "Use for a game": copy the roll's seed, put the kingdom (with its options and seed) into Game night's Random way and go there
  const logIt = async () => {
    const items = toGameItems(state), implied = impliedSets(resolveKingdom(catalog, items)), seed = state.seed != null ? formatSeed(state.seed) : null;
    if (seed) { try { await navigator.clipboard.writeText(seed); } catch { /* no clipboard here: the seed is still put in Game night's box */ } }
    let ls = null; try { ls = window.localStorage; } catch { /* storage blocked */ }
    if (!ls) { window.location.hash = page.hashFor('night', page.gid); return; }
    const cur = loadNight(ls, page.gid);
    if (nightInProgress(cur) && !(await ask({ title: 'Replace the kingdom?', text: 'A game is already under way on Game night. Its kingdom will be replaced with this one.', confirmLabel: 'Replace it' }))) return;
    saveNight(ls, page.gid, withRolledKingdom(cur, { options: opts, items, rolledQ: kingdomToParams(state).toString(), sets: implied.sets, landscapes: implied.landscapes, seed }));
    window.location.hash = page.hashFor('night', page.gid);
  };

  // an edit hands back the kingdom as a list of items; it is written to the link like any roll
  const edit = (items, _implied, baneId) => write(opts, stateFromItems(catalog, items, baneId));
  const actions = (
    <>
      <FlashButton flash={flash.link} okLabel="Copied" failLabel="Copy the address bar" onClick={copy}>Copy link</FlashButton>
      {!canLog && state && state.seed != null && <FlashButton flash={flash.seed} okLabel="Copied" failLabel={`Seed ${formatSeed(state.seed)}`} onClick={shareSeed} title="Copy this roll's seed">Share seed</FlashButton>}
      {canLog && <button type="button" className="ghost" onClick={logIt} title="Copy the seed and open Game night with this kingdom">Use for a game →</button>}
    </>
  );

  return (
    <>
      {confirmDialog}
      <div className="head"><div><h1>Kingdom randomizer</h1><p className="lede">Roll a Kingdom for your next game. Choose the expansions and any rules, roll, then lock the cards you like and re-roll the rest.</p></div></div>
      <PageShortcuts bindings={[{ key: 'r', label: 'Roll a kingdom', run: () => { const b = document.querySelector('.dn-rz-go button[type=submit]'); if (b) b.click(); } }]} />
      <RandomizerPanel catalog={catalog} opts={opts} setOpts={patch => write({ ...opts, ...patch }, state)} state={state}
        onState={next => write(opts, next)} onReset={() => write(DEFAULT_OPTIONS, state)} plays={plays} actions={actions}
        editing={hand} onEdit={edit}
        extraControls={<button type="button" className="ghost" aria-pressed={hand} onClick={() => setHand(h => !h)}>{hand ? 'Done editing' : 'Pick cards by hand'}</button>} />
    </>
  );
}
