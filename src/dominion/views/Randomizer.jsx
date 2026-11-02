import { useMemo, useState } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { usePage } from '../../PageContext.js';
import { writeQuery } from '../urlState.js';
import { loadNight, nightInProgress, saveNight, withRolledKingdom } from '../../lib/night.js';
import { impliedSets, resolveKingdom } from '../kingdom.js';
import { pilesPlayed } from '../playStats.js';
import { useLeagueGames } from '../useLeagueGames.js';
import { DEFAULT_OPTIONS, formatSeed, kingdomFromParams, kingdomToParams, optionsFromParams, optionsToParams, toGameItems } from '../randomizer.js';
import { expansionMeta } from '../constants.js';
import RandomizerPanel from '../components/RandomizerPanel.jsx';
import { kingdomCode, renderKingdomImage, shareKingdomImage } from '../kingdomImage.js';

const expansionName = e => expansionMeta(e).label;

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
  const [copied, setCopied] = useState('');

  const lg = useLeagueGames();
  const plays = useMemo(() => (lg && lg.stats ? pilesPlayed(lg.stats) : null), [lg]);
  const canLog = !!(page && page.me && page.me.is_admin);

  const write = (nextOpts, nextState) => {
    const p = optionsToParams(nextOpts); if (nextState) kingdomToParams(nextState, p);
    const s = p.toString(); writeQuery(s ? '?' + s : '');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied('Link copied'); } catch { setCopied('Couldn’t copy — copy the address from your browser’s address bar.'); }
    setTimeout(() => setCopied(''), 3500);
  };
  // for everyone who can't log a game: the roll's seed to the clipboard, to send to whoever will set the game up (they type it into Game night's seed box)
  const shareSeed = async () => {
    const seed = formatSeed(state.seed);
    try { await navigator.clipboard.writeText(seed); setCopied(`Seed ${seed} copied`); } catch { setCopied(`Seed: ${seed}`); }   // no clipboard here: show it to copy by hand
    setTimeout(() => setCopied(''), 3500);
  };
  const shareImage = async () => {
    setCopied('Making the picture…');
    try {
      const code = state.seed != null ? formatSeed(state.seed) : kingdomCode(state);   // the roll's seed when it has one, else a fingerprint of the kingdom
      const blob = await renderKingdomImage(state, { title: 'Kingdom', code, subtitle: `${[...new Set(state.slots.map(s => s.expansion))].map(e => expansionName(e)).join(' · ')}` });
      const how = await shareKingdomImage(blob, { name: `kingdom-${code}.png`, title: 'Dominion kingdom' });
      setCopied(how === 'shared' ? '' : how === 'downloaded' ? 'Picture saved to your downloads' : '');
    } catch { setCopied('The picture couldn’t be made on this device.'); }
    setTimeout(() => setCopied(''), 3500);
  };
  // "Use for a game": copy the roll's seed, put the kingdom (with its options and seed) into Game night's Random way and go there
  const logIt = async () => {
    const items = toGameItems(state), implied = impliedSets(resolveKingdom(catalog, items)), seed = state.seed != null ? formatSeed(state.seed) : null;
    if (seed) { try { await navigator.clipboard.writeText(seed); } catch { /* no clipboard here: the seed is still put in Game night's box */ } }
    let ls = null; try { ls = window.localStorage; } catch { /* storage blocked */ }
    if (!ls) { window.location.hash = page.hashFor('night', page.gid); return; }
    const cur = loadNight(ls, page.gid);
    if (nightInProgress(cur) && !window.confirm('A game is already under way on Game night. Replace its kingdom with this one?')) return;
    saveNight(ls, page.gid, withRolledKingdom(cur, { options: opts, items, rolledQ: kingdomToParams(state).toString(), sets: implied.sets, landscapes: implied.landscapes, seed }));
    window.location.hash = page.hashFor('night', page.gid);
  };

  const actions = (
    <>
      <button type="button" className="ghost" onClick={copy}>Copy link</button>
      <button type="button" className="ghost" onClick={shareImage}>Share image</button>
      {!canLog && state && state.seed != null && <button type="button" className="ghost" onClick={shareSeed} title="Copy this roll's seed">Share seed</button>}
      {canLog && <button type="button" className="ghost" onClick={logIt} title="Copy the seed and open Game night with this kingdom">Use for a game →</button>}
      <span className="meta" role="status" aria-live="polite">{copied}</span>
    </>
  );

  return (
    <>
      <div className="head"><div><h1>Kingdom randomizer</h1><p className="lede">Roll a Kingdom for your next game. Choose the expansions and any rules, roll, then lock the cards you like and re-roll the rest.</p></div></div>
      <RandomizerPanel catalog={catalog} opts={opts} setOpts={patch => write({ ...opts, ...patch }, state)} state={state}
        onState={next => write(opts, next)} onReset={() => write(DEFAULT_OPTIONS, state)} plays={plays} actions={actions} />
    </>
  );
}
