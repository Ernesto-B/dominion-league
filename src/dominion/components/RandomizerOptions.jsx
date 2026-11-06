import { createContext, useContext } from 'react';
import { CARD_COUNTS, COST_SPREADS, REQUIRE_RULES, THEMES, THEME_KEYS, ruleIsExact } from '../randomizer.js';
import { toggle } from '../filters.js';
import { PLURAL } from '../constants.js';
import { resolveKingdom } from '../kingdom.js';
import { Chip, ExpansionBadge } from './bits.jsx';
import { CoinIcon } from './Cost.jsx';
import ItemSearch from './ItemSearch.jsx';
import ScopePicker from './ScopePicker.jsx';
import { KingdomChip } from './KingdomChips.jsx';

/* Whose games "Prioritize" can count. Game night provides `true` (the seated players are known: count only the games THIS table has sat at);
   the Collection's Randomizer provides { players } (count one player's games, chosen from them). Nothing provided: always the whole group's. */
export const PlaysScopeContext = createContext(false);

const itemsOf = ids => ids.map(id => ({ kind: 'card', id }));

/* Everything that shapes a roll: expansions, how many cards and landscapes, the rules, always/never include. Shared by the Randomizer
   page (options live in the URL) and the Game night kingdom step (options live in the step), so both offer exactly the same rules.
   `cardCount` replaces the Kingdom cards select (the snake draft has its own idea of how many cards there are).
   `opts` is a full options object (see DEFAULT_OPTIONS) and `setOpts(patch)` merges a change into it. */

/* Small controls the panel is built from. A segmented control is one choice out of a few (a radio group that takes one line); a stepper is a number with − and +. */
function Seg({ label, value, options, onChange, cls = '' }) {
  return (
    <div className={'dn-seg' + (cls ? ' ' + cls : '')} role="radiogroup" aria-label={label}>
      {options.map(o => <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} aria-pressed={o.value === value} disabled={o.disabled} title={o.title} aria-label={o.aria}
        onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}
function Stepper({ label, value, min = 0, max = 12, onChange }) {
  return (
    <span className="dn-step" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}
// one setting: its name (and a line saying what it does) on the left, its control on the right; every row shares the same two columns, so everything lines up
const Row = ({ label, note, children }) => <div className="rzo-row"><div className="rzo-name"><span className="rzo-l">{label}</span>{note && <small>{note}</small>}</div><div className="rzo-ctl">{children}</div></div>;

const ATTACK_STEPS = [0, 1, 2, 3];

/* Everything that shapes a roll, as small labelled groups: the expansions as one row of set icons, how many cards and landscapes as steppers, then the rules (what the kingdom must have, the
   Attacks, the cost mix, what to favour), and the rarely used ones folded away. Shared by the Randomizer page (options live in the URL) and the Game night Kingdom step (options live in the step).
   `cardCount` replaces the Kingdom cards stepper (the snake draft has its own idea of how many cards there are).
   `opts` is a full options object (see DEFAULT_OPTIONS) and `setOpts(patch)` merges a change into it. */
export default function RandomizerOptions({ catalog, opts, setOpts, canFavor = false, foldExpansions = false, cardCount = null }) {
  const playsScope = useContext(PlaysScopeContext);
  const attacksOn = opts.maxAttacks !== 0;
  const themes = opts.themes || [];   // a night saved before themes existed has none
  const caps = Object.keys(opts.maxOf || {}).length;
  const listsOn = opts.include.length + opts.exclude.length;
  const tagRules = Object.entries(REQUIRE_RULES).filter(([k]) => !ruleIsExact(k)), costRules = Object.entries(REQUIRE_RULES).filter(([k]) => ruleIsExact(k));
  const ruleChip = ([k, r]) => <Chip key={k} cls={r.coins != null || r.atLeast != null ? 'rzo-coin' : ''} pressed={opts.require.includes(k)} label={r.coins != null ? `A card costing ${r.coins} coins` : r.atLeast != null ? `A card costing ${r.atLeast} coins or more` : undefined} onClick={() => setOpts({ require: toggle(opts.require, k) })}>{r.coins != null ? <CoinIcon coins={r.coins} size={24} /> : r.atLeast != null ? <><CoinIcon coins={r.atLeast} size={24} /><b className="rzo-plus">+</b></> : r.chip || r.box || r.label}</Chip>;
  const owned = catalog.ownedExpansions, chosen = opts.expansions.length;
  const expansionChips = owned.map(e => (
    <Chip key={e.name} label={e.name} pressed={opts.expansions.includes(e.name)} onClick={() => setOpts({ expansions: toggle(opts.expansions, e.name) })}><ExpansionBadge name={e.name} iconOnly size={26} /></Chip>
  ));
  const expSummary = chosen ? `${chosen} of ${owned.length}` : `all ${owned.length}`;
  const attackChoices = [...new Set([...ATTACK_STEPS, ...(opts.maxAttacks != null ? [opts.maxAttacks] : [])])].sort((x, y) => x - y);
  const setMaxAttacks = n => setOpts({ maxAttacks: n, ...(n != null && (opts.minAttacks || 0) > n ? { minAttacks: n } : {}) });
  const setCap = (r, n) => { const next = { ...(opts.maxOf || {}) }; if (n == null) delete next[r]; else next[r] = n; setOpts({ maxOf: next }); };
  return (
    <div className="rzo">
      <div className="rzo-rows">
        {foldExpansions ? (
          <details className="dn-mech night-exp rzo-fold"><summary>Expansions: <span className="meta">{expSummary}</span></summary>
            <div className="dn-chips rzo-exp" style={{ marginTop: 8 }}>{expansionChips}</div>
          </details>
        ) : (
          <Row label="Expansions" note={<>{expSummary}{chosen > 0 && <button type="button" className="linkish rzo-clear" onClick={() => setOpts({ expansions: [] })}>Use all</button>}</>}>
            <div className="dn-chips rzo-exp">{expansionChips}</div>
          </Row>
        )}

        {cardCount ? <Row label="Kingdom cards">{cardCount}</Row> : <Row label="Kingdom cards"><Stepper label="Kingdom cards" value={opts.cards} min={5} max={12} onChange={n => setOpts({ cards: n })} /></Row>}
        <Row label="Landscapes">
          <Stepper label="Landscapes" value={opts.landscapes} min={0} max={4} onChange={n => setOpts({ landscapes: n })} />
          {opts.landscapes > 0 && (
            <div className="dn-chips rzo-in" role="group" aria-label={`Landscape types: ${opts.landscapeTypes.length ? opts.landscapeTypes.length + ' chosen' : 'all of them'}`}>{catalog.landscapeTypes.map(t => (
              <Chip key={t} tone={t.toLowerCase()} pressed={opts.landscapeTypes.includes(t)} onClick={() => setOpts({ landscapeTypes: toggle(opts.landscapeTypes, t) })}>{PLURAL[t] || t}</Chip>
            ))}</div>
          )}
        </Row>

        <Row label="Must have" note="Uses the recorded mechanics: a card that does this but isn’t tagged won’t count.">
          <div className="dn-chips">{tagRules.map(ruleChip)}</div>
        </Row>

        <Row label="Attacks" note="The most Attacks in the kingdom">
          <Seg label="Most Attacks" value={opts.maxAttacks ?? 'any'} onChange={v => setMaxAttacks(v === 'any' ? null : v)}
            options={[...attackChoices.map(n => ({ value: n, label: n === 0 ? 'None' : String(n), aria: n === 0 ? 'No Attacks' : `At most ${n} Attack${n === 1 ? '' : 's'}`, title: n === 0 ? 'No Attacks' : `At most ${n}` })), { value: 'any', label: 'Any' }]} />
          {attacksOn && (
            <div className="dn-chips rzo-in" role="group" aria-label="When an Attack is rolled">
              <Chip pressed={opts.reaction} onClick={() => setOpts({ reaction: !opts.reaction })}>Add a Reaction</Chip>
              <Chip pressed={opts.junkTrash} onClick={() => setOpts({ junkTrash: !opts.junkTrash })}>Add a trasher if Attacks give junk</Chip>
            </div>
          )}
        </Row>

        <Row label="Cost mix" note="How the kingdom spreads over $2 to $6+">
          <Seg label="Cost spread" value={opts.costSpread || 'off'} onChange={v => setOpts({ costSpread: v === 'off' ? null : v })}
            options={[{ value: 'off', label: 'Off' }, ...Object.entries(COST_SPREADS).map(([k, c]) => ({ value: k, label: c.label }))]} />
        </Row>

        <Row label="Prioritize" note={canFavor ? 'Favour cards by how often the group has played them' : 'Available once games with a kingdom are logged'}>
          <Seg label="Prioritize" value={!canFavor ? 'none' : opts.favorPlayed ? 'played' : opts.favor ? 'new' : 'none'} onChange={v => setOpts({ favorPlayed: v === 'played', favor: v === 'new' })}
            options={[{ value: 'none', label: 'Neither' }, { value: 'played', label: 'Played cards', disabled: !canFavor }, { value: 'new', label: 'New cards', disabled: !canFavor }]} />
          {playsScope && (opts.favor || opts.favorPlayed) && (
            <span className="rzo-in rzo-count" role="group" aria-label="Count games">
              <span className="rzo-l">Count games</span>
              {playsScope === true ? (
                <Seg label="Whose games count" value={!!opts.favorTable} onChange={v => setOpts({ favorTable: v })} options={[{ value: false, label: 'The whole group’s' }, { value: true, label: 'Only this table’s' }]} />
              ) : <ScopePicker label={null} who={opts.favorBy} players={playsScope.players} onPick={n => setOpts({ favorBy: n })} />}
            </span>
          )}
        </Row>
      </div>

      <details className="dn-mech dn-rz-details">
        <summary>Advanced{themes.length + caps + (opts.minAttacks > 0 ? 1 : 0) + (opts.maxCost != null ? 1 : 0) + opts.require.filter(ruleIsExact).length ? <span className="meta"> · {themes.length + caps + (opts.minAttacks > 0 ? 1 : 0) + (opts.maxCost != null ? 1 : 0) + opts.require.filter(ruleIsExact).length} on</span> : null}</summary>
        <p className="meta dn-rz-listh" style={{ marginTop: 8 }}>Build the kingdom around (pick any)</p>
        <ul className="dn-themes">
          {THEME_KEYS.map(k => (
            <li key={k}>
              <Chip pressed={themes.includes(k)} onClick={() => setOpts({ themes: toggle(themes, k) })}>{THEMES[k].chip}</Chip>
              <span className="meta">{THEMES[k].hint}</span>
            </li>
          ))}
        </ul>
        <p className="meta dn-rz-listh" style={{ marginTop: 14 }} title="Counted from the recorded mechanics, so a card that does this but isn’t tagged won’t be counted.">Keep to at most</p>
        <div className="rzo-caps">
          {[['draw', 'Drawers'], ['trash', 'Trashers'], ['village', '+Actions'], ['buy', '+Buy']].map(([r, label]) => (
            <span key={r} className="rzo-cap"><span className="rzo-l">{label}</span>
              <Seg label={`Most ${label} cards`} value={opts.maxOf?.[r] ?? 'any'} onChange={v => setCap(r, v === 'any' ? null : v)} options={[...[0, 1, 2, 3].map(n => ({ value: n, label: String(n) })), { value: 'any', label: 'Any' }]} /></span>
          ))}
        </div>
        {attacksOn && <><p className="meta dn-rz-listh" style={{ marginTop: 14 }}>Fewest Attacks (at least this many Attacks in the kingdom)</p>
        <Stepper label="Fewest Attacks" value={opts.minAttacks || 0} min={0} max={opts.maxAttacks ?? 12} onChange={n => setOpts({ minAttacks: n })} /></>}
        <p className="meta dn-rz-listh" style={{ marginTop: 14 }}>Include a card costing</p>
        <div className="dn-chips">{costRules.map(ruleChip)}</div>
        <p className="meta dn-rz-listh" style={{ marginTop: 14 }}>No card above</p>
        <Seg cls="coins" label="Highest card cost" value={opts.maxCost ?? 'any'} onChange={v => setOpts({ maxCost: v === 'any' ? null : v })}
          options={[{ value: 'any', label: 'Any' }, ...[3, 4, 5, 6].map(c => ({ value: c, label: <CoinIcon coins={c} size={24} />, aria: `${c} coins` }))]} />
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

    </div>
  );
}
