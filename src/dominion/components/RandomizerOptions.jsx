import { CARD_COUNTS, REQUIRE_RULES, ruleIsExact } from '../randomizer.js';
import { toggle } from '../filters.js';
import { PLURAL } from '../constants.js';
import { resolveKingdom } from '../kingdom.js';
import { Chip, ExpansionBadge } from './bits.jsx';
import ItemSearch from './ItemSearch.jsx';
import { KingdomChip } from './KingdomChips.jsx';

const ATTACK_CHOICES = [['', 'Any number of Attacks'], ['0', 'No Attacks'], ['1', 'At most 1 Attack'], ['2', 'At most 2 Attacks'], ['3', 'At most 3 Attacks']];
const itemsOf = ids => ids.map(id => ({ kind: 'card', id }));

/* Everything that shapes a roll: expansions, how many cards and landscapes, the rules, always/never include. Shared by the Randomizer
   page (options live in the URL) and the Game night kingdom step (options live in the step), so both offer exactly the same rules.
   `opts` is a full options object (see DEFAULT_OPTIONS) and `setOpts(patch)` merges a change into it. */
export default function RandomizerOptions({ catalog, opts, setOpts, canFavor = false, rulesOpen = false, foldExpansions = false }) {
  const rulesOn = (opts.maxAttacks != null ? 1 : 0) + (opts.reaction ? 1 : 0) + opts.require.length + (opts.favor ? 1 : 0);
  const listsOn = opts.include.length + opts.exclude.length;
  const tagRules = Object.entries(REQUIRE_RULES).filter(([k]) => !ruleIsExact(k)), costRules = Object.entries(REQUIRE_RULES).filter(([k]) => ruleIsExact(k));
  const ruleBox = ([k, r]) => <label key={k} className="dn-check"><input type="checkbox" checked={opts.require.includes(k)} onChange={() => setOpts({ require: toggle(opts.require, k) })} /> {r.label}</label>;
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
        <label className="f">Kingdom cards <select value={opts.cards} onChange={e => setOpts({ cards: Number(e.target.value) })}>{[...CARD_COUNTS].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="f">Landscapes <select value={opts.landscapes} onChange={e => setOpts({ landscapes: Number(e.target.value) })}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      </div>

      {opts.landscapes > 0 && (
        <fieldset className="dn-fieldset"><legend>Landscape types: <span className="meta">{opts.landscapeTypes.length ? `${opts.landscapeTypes.length} chosen` : 'all of them'}</span></legend>
          <p className="meta dn-rz-hint">Landscapes can come from any expansion, whichever ones are chosen above.</p>
          <div className="dn-chips">{catalog.landscapeTypes.map(t => (
            <Chip key={t} tone={t.toLowerCase()} pressed={opts.landscapeTypes.includes(t)} onClick={() => setOpts({ landscapeTypes: toggle(opts.landscapeTypes, t) })}>{PLURAL[t] || t}</Chip>
          ))}</div>
        </fieldset>
      )}

      <details className="dn-mech dn-rz-details" open={rulesOpen || undefined}>
        <summary>Rules{rulesOn ? <span className="meta"> · {rulesOn} on</span> : null}</summary>
        <div className="dn-rz-rules">
          <label className="f">Attacks <select value={opts.maxAttacks ?? ''} onChange={e => setOpts({ maxAttacks: e.target.value === '' ? null : Number(e.target.value) })}>{ATTACK_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="dn-check"><input type="checkbox" checked={opts.reaction} onChange={e => setOpts({ reaction: e.target.checked })} /> Include a Reaction whenever there is an Attack</label>
          <fieldset className="dn-fieldset dn-rz-require"><legend>Make sure the kingdom has</legend>
            {tagRules.map(ruleBox)}
            <p className="note" style={{ margin: '4px 0 8px' }}>These use the recorded mechanics, so a card that does this but isn’t tagged won’t count towards it.</p>
            {costRules.map(ruleBox)}
          </fieldset>
          <label className={'dn-check' + (canFavor ? '' : ' dn-off')}><input type="checkbox" disabled={!canFavor} checked={opts.favor && canFavor} onChange={e => setOpts({ favor: e.target.checked })} /> Favor cards we’ve played less{canFavor ? '' : ' (once games with a kingdom are logged)'}</label>
        </div>
      </details>

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
