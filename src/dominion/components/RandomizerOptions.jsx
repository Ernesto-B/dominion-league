import { CARD_COUNTS, COST_SPREADS, REQUIRE_RULES, ruleIsExact } from '../randomizer.js';
import { toggle } from '../filters.js';
import { PLURAL } from '../constants.js';
import { resolveKingdom } from '../kingdom.js';
import { Chip, ExpansionBadge } from './bits.jsx';
import { CoinIcon } from './Cost.jsx';
import ItemSearch from './ItemSearch.jsx';
import { KingdomChip } from './KingdomChips.jsx';

const DEFAULT_MAX_ATTACKS = 2;   // what ticking "Allow Attacks" again goes back to
const itemsOf = ids => ids.map(id => ({ kind: 'card', id }));

/* Everything that shapes a roll: expansions, how many cards and landscapes, the rules, always/never include. Shared by the Randomizer
   page (options live in the URL) and the Game night kingdom step (options live in the step), so both offer exactly the same rules.
   `cardCount` replaces the Kingdom cards select (the snake draft has its own idea of how many cards there are).
   `opts` is a full options object (see DEFAULT_OPTIONS) and `setOpts(patch)` merges a change into it. */
export default function RandomizerOptions({ catalog, opts, setOpts, canFavor = false, foldExpansions = false, cardCount = null }) {
  const attacksOn = opts.maxAttacks !== 0;
  const listsOn = opts.include.length + opts.exclude.length;
  const tagRules = Object.entries(REQUIRE_RULES).filter(([k]) => !ruleIsExact(k)), costRules = Object.entries(REQUIRE_RULES).filter(([k]) => ruleIsExact(k));
  const ruleChip = ([k, r]) => <Chip key={k} pressed={opts.require.includes(k)} label={r.coins != null ? `A card costing ${r.coins} coins` : r.atLeast != null ? `A card costing ${r.atLeast} coins or more` : undefined} onClick={() => setOpts({ require: toggle(opts.require, k) })}>{r.coins != null ? <CoinIcon coins={r.coins} size={24} /> : r.atLeast != null ? <><CoinIcon coins={r.atLeast} size={24} />+</> : r.chip || r.box || r.label}</Chip>;
  const expansionChips = catalog.ownedExpansions.map(e => (
    <Chip key={e.name} pressed={opts.expansions.includes(e.name)} onClick={() => setOpts({ expansions: toggle(opts.expansions, e.name) })}><ExpansionBadge name={e.name} /></Chip>
  ));
  return (
    <>
      {foldExpansions ? (
        <details className="dn-mech night-exp"><summary>Expansions: <span className="meta">{opts.expansions.length ? `${opts.expansions.length} chosen` : 'all of them'}</span></summary>
          <div className="dn-chips" style={{ marginTop: 8 }}>{expansionChips}</div>
        </details>
      ) : (
        <fieldset className="dn-fieldset"><legend>Expansions: <span className="meta">{opts.expansions.length ? `${opts.expansions.length} chosen` : 'all of them'}</span></legend>
          <div className="dn-chips">{expansionChips}</div>
        </fieldset>
      )}

      <div className="controls">
        {cardCount || <label className="f">Kingdom cards <select value={opts.cards} onChange={e => setOpts({ cards: Number(e.target.value) })}>{[...CARD_COUNTS].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
        <label className="f">Landscapes <select value={opts.landscapes} onChange={e => setOpts({ landscapes: Number(e.target.value) })}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      </div>

      {opts.landscapes > 0 && (
        <fieldset className="dn-fieldset"><legend>Landscape types: <span className="meta">{opts.landscapeTypes.length ? `${opts.landscapeTypes.length} chosen` : 'all of them'}</span></legend>
          <div className="dn-chips">{catalog.landscapeTypes.map(t => (
            <Chip key={t} tone={t.toLowerCase()} pressed={opts.landscapeTypes.includes(t)} onClick={() => setOpts({ landscapeTypes: toggle(opts.landscapeTypes, t) })}>{PLURAL[t] || t}</Chip>
          ))}</div>
        </fieldset>
      )}

      <div className="dn-rz-grid" aria-label="Rules">
        <p className="dn-rz-lab">Must have</p>
        <div className="dn-chips" title="These use the recorded mechanics, so a card that does this but isn’t tagged won’t count towards it.">{tagRules.map(ruleChip)}</div>

        <p className="dn-rz-lab">Include a card at</p>
        <div className="dn-chips">{costRules.map(ruleChip)}</div>

        <p className="dn-rz-lab">Attacks</p>
        <div className="dn-chips">
          <Chip pressed={attacksOn} onClick={() => setOpts({ maxAttacks: attacksOn ? 0 : DEFAULT_MAX_ATTACKS })}>{attacksOn ? 'Allowed' : 'None'}</Chip>
          {attacksOn && <>
            <label className="dn-atk">at most <input type="number" min="1" max="12" inputMode="numeric" className="dn-num" placeholder="any" aria-label="Most Attacks" value={opts.maxAttacks ?? ''}
              onChange={e => setOpts({ maxAttacks: e.target.value === '' ? null : Math.max(1, Math.min(12, Math.round(Number(e.target.value)) || 1)) })} /></label>
            <Chip pressed={opts.reaction} onClick={() => setOpts({ reaction: !opts.reaction })}>Reaction</Chip>
            <Chip pressed={opts.junkTrash} onClick={() => setOpts({ junkTrash: !opts.junkTrash })}>Trasher if junk</Chip>
          </>}
        </div>

        <p className="dn-rz-lab">Cost spread</p>
        <div className="dn-chips" role="radiogroup" aria-label="Cost spread">
          <Chip pressed={!opts.costSpread} onClick={() => setOpts({ costSpread: null })}>Off</Chip>
          {Object.entries(COST_SPREADS).map(([k, c]) => <Chip key={k} pressed={opts.costSpread === k} onClick={() => setOpts({ costSpread: k })}>{c.label}</Chip>)}
        </div>

        <p className="dn-rz-lab">Prioritize</p>
        <div className="dn-chips" role="radiogroup" aria-label="Prioritize" title={canFavor ? undefined : 'Available once games with a kingdom are logged'}>
          <Chip pressed={!(opts.favor || opts.favorPlayed) || !canFavor} onClick={() => setOpts({ favor: false, favorPlayed: false })}>Neither</Chip>
          <button type="button" className="dn-chip" disabled={!canFavor} aria-pressed={opts.favorPlayed && canFavor} onClick={() => setOpts({ favorPlayed: true, favor: false })}>Played cards</button>
          <button type="button" className="dn-chip" disabled={!canFavor} aria-pressed={opts.favor && canFavor} onClick={() => setOpts({ favor: true, favorPlayed: false })}>New cards</button>
        </div>
      </div>

      <details className="dn-mech dn-rz-details">
        <summary>Always include / never include{listsOn ? <span className="meta"> · {listsOn} chosen</span> : null}</summary>
        <div className="dn-rz-lists">
          <div>
            <p className="meta dn-rz-listh">Always include</p>
            <div className="dn-kchips">{resolveKingdom(catalog, itemsOf(opts.include)).map(r => <KingdomChip key={r.id} r={r} onRemove={() => setOpts({ include: opts.include.filter(id => id !== r.id) })} />)}</div>
            <ItemSearch catalog={catalog} kind="card" taken={[...itemsOf(opts.include), ...itemsOf(opts.exclude)]} label="Add a card" onAdd={x => { if (opts.include.length >= opts.cards) return `That’s already ${opts.cards} cards.`; setOpts({ include: [...opts.include, x.obj.id] }); }} />
          </div>
          <div>
            <p className="meta dn-rz-listh">Never include</p>
            <div className="dn-kchips">{resolveKingdom(catalog, itemsOf(opts.exclude)).map(r => <KingdomChip key={r.id} r={r} onRemove={() => setOpts({ exclude: opts.exclude.filter(id => id !== r.id) })} />)}</div>
            <ItemSearch catalog={catalog} kind="card" taken={[...itemsOf(opts.include), ...itemsOf(opts.exclude)]} label="Add a card" onAdd={x => setOpts({ exclude: [...opts.exclude, x.obj.id] })} />
          </div>
        </div>
      </details>
    </>
  );
}
