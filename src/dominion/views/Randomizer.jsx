import { useMemo, useState } from 'react';
import { useCatalog } from '../CatalogContext.jsx';
import { usePage } from '../../PageContext.js';
import { writeQuery } from '../urlState.js';
import { setKingdomDraft } from '../kingdomDraft.js';
import { impliedSets, resolveKingdom } from '../kingdom.js';
import { pilesPlayed } from '../playStats.js';
import { useLeagueGames } from '../useLeagueGames.js';
import { DEFAULT_OPTIONS, formatSeed, kingdomFromParams, kingdomToParams, optionsFromParams, optionsToParams, toGameItems } from '../randomizer.js';
import { expansionMeta } from '../constants.js';
import RandomizerPanel from '../components/RandomizerPanel.jsx';
import { uxOn } from '../../ux.js';
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
  const logIt = () => {
    const items = toGameItems(state), implied = impliedSets(resolveKingdom(catalog, items));
    setKingdomDraft({ items, sets: implied.sets, landscapes: implied.landscapes });
    window.location.hash = page.hashFor('games', page.gid);
  };

  const actions = (
    <>
      <button type="button" className="ghost" onClick={copy}>Copy link</button>
      {uxOn('share') && <button type="button" className="ghost" onClick={shareImage}>Share image</button>}
      {canLog && <button type="button" className="ghost" onClick={logIt} title="Open Add a game with this kingdom filled in">Use for a game →</button>}
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
