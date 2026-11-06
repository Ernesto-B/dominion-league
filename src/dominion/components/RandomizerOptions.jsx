import { createContext, useContext } from 'react';
import { CAP_DEFAULT, CAP_RULES, GIVES, GIVES_KEYS, GIVES_MIN, CARD_COUNTS, COST_SPREADS, REQUIRE_RULES, THEMES, THEME_KEYS, ruleIsExact } from '../randomizer.js';
import { toggle } from '../filters.js';
import { PLURAL } from '../constants.js';
import { resolveKingdom } from '../kingdom.js';
import { Chip, ExpansionBadge } from './bits.jsx';
import { CoinIcon } from './Cost.jsx';
import ItemSearch from './ItemSearch.jsx';
import ScopePicker from './ScopePicker.jsx';
import { KingdomChip } from './KingdomChips.jsx';
import Fold from './Fold.jsx';

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
const CAP_MAX = 5;   // the stepper's last number; one more step is "no cap" (∞)
function Stepper({ label, value, min = 0, max = 12, onChange, show = v => v }) {
  return (
    <span className="dn-step" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{show(value)}</output>
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
  const themes = opts.themes || [];
  const gives = opts.gives || [];   // a night saved before themes existed has none
  const capsChanged = CAP_RULES.filter(r => (opts.maxOf || {})[r] !== CAP_DEFAULT).length;   // caps are on by default: only a change counts
  const listsOn = opts.include.length + opts.exclude.length;
  const tagRules = Object.entries(REQUIRE_RULES).filter(([k]) => !ruleIsExact(k)), costRules = Object.entries(REQUIRE_RULES).filter(([k]) => ruleIsExact(k));
  const ruleChip = ([k, r]) => <Chip key={k} cls={r.coins != null || r.atLeast != null ? 'rzo-coin' : ''} pressed={opts.require.includes(k)} label={r.coins != null ? `A card costing ${r.coins} coins` : r.atLeast != null ? `A card costing ${r.atLeast} coins or more` : undefined} onClick={() => setOpts({ require: toggle(opts.require, k) })}>{r.coins != null ? <CoinIcon coins={r.coins} size={24} /> : r.atLeast != null ? <><CoinIcon coins={r.atLeast} size={24} /><b className="rzo-plus">+</b></> : r.chip || r.box || r.label}</Chip>;
  const advOn = themes.length + gives.length + capsChanged + (opts.minAttacks > 0 ? 1 : 0) + (opts.maxCost != null ? 1 : 0) + opts.require.filter(ruleIsExact).length;
  const owned = catalog.ownedExpansions, chosen = opts.expansions.length;
  const expansionChips = owned.map(e => (
    <Chip key={e.name} label={e.name} pressed={opts.expansions.includes(e.name)} onClick={() => setOpts({ expansions: toggle(opts.expansions, e.name) })}><ExpansionBadge name={e.name} iconOnly size={26} /></Chip>
  ));
  const expSummary = chosen ? `${chosen} of ${owned.length}` : `all ${owned.length}`;
  const attackChoices = [...new Set([...ATTACK_STEPS, ...(opts.maxAttacks != null ? [opts.maxAttacks] : [])])].sort((x, y) => x - y);
  // choosing Attacks after "None" asks for at least one (the fewest-Attacks stepper in Advanced starts at 1, and can be lowered); "None" means no minimum
  const setMaxAttacks = n => setOpts({ maxAttacks: n, ...(n === 0 ? { minAttacks: 0 } : opts.maxAttacks === 0 ? { minAttacks: 1 } : n != null && (opts.minAttacks || 0) > n ? { minAttacks: n } : {}) });
  const setCap = (r, n) => setOpts({ maxOf: Object.fromEntries(CAP_RULES.flatMap(k => { const v = k === r ? n : (opts.maxOf || {})[k]; return v == null ? [] : [[k, v]]; })) });   // in rule order, so "unchanged" compares equal
  return (
    <div className="rzo">
      <div className="rzo-rows">
        {foldExpansions ? (
          <Fold className="night-exp rzo-fold" summary={<>Expansions: <span className="meta">{expSummary}</span></>}>
            <div className="dn-chips rzo-exp" style={{ marginTop: 8 }}>{expansionChips}</div>
          </Fold>
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

        <Row label="Must have">
          <div className="dn-chips"><Chip hint="No two cards doing the same single job, like two plain drawers or two plain trashers. A card that does something else as well doesn’t count against it." pressed={!!opts.balance} onClick={() => setOpts({ balance: !opts.balance })}>No overlap</Chip>{tagRules.map(ruleChip)}</div>
        </Row>

        <Row label="Attacks" note="The most Attacks in the kingdom">
          <Seg label="Most Attacks" value={opts.maxAttacks ?? 'any'} onChange={v => setMaxAttacks(v === 'any' ? null : v)}
            options={[...attackChoices.map(n => ({ value: n, label: n === 0 ? 'None' : String(n), aria: n === 0 ? 'No Attacks' : `At most ${n} Attack${n === 1 ? '' : 's'}`, title: n === 0 ? 'No Attacks' : `At most ${n}` })), { value: 'any', label: 'Any' }]} />
          {attacksOn && (
            <div className="dn-chips rzo-in" role="group" aria-label="When an Attack is rolled">
              <Chip hint="At least one Reaction in the kingdom (not one per Attack)" pressed={opts.reaction} onClick={() => setOpts({ reaction: !opts.reaction })}>Add a Reaction</Chip>
              <Chip pressed={opts.junkTrash} onClick={() => setOpts({ junkTrash: !opts.junkTrash })}>Add a trasher if Attacks give junk</Chip>
            </div>
          )}
        </Row>

        <Row label="Cost mix" note="How the kingdom spreads over $2 to $6+">
          <Seg label="Cost spread" value={opts.costSpread || 'standard'} onChange={v => setOpts({ costSpread: v })}
            options={Object.entries(COST_SPREADS).map(([k, c]) => ({ value: k, label: c.label, title: c.avg ? `Aims for an average card cost of about $${c.avg.toFixed(1)}` : 'Cheap and pricey cards, little in between' }))} />
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

      <Fold summary={<>Advanced{advOn ? <span className="meta"> · {advOn} on</span> : null}</>}>
        <div className="rzo-rows">
          <Row label="Build around" note="Lean the kingdom towards one style (pick any)">
            <div className="dn-chips">{THEME_KEYS.map(k => <Chip key={k} hint={THEMES[k].hint} pressed={themes.includes(k)} onClick={() => setOpts({ themes: toggle(themes, k) })}>{THEMES[k].chip}</Chip>)}</div>
          </Row>
          <Row label="Include cards that give" note={`At least ${GIVES_MIN} of each kind you pick`}>
            <div className="dn-chips">{GIVES_KEYS.map(k => <Chip key={k} pressed={gives.includes(k)} onClick={() => setOpts({ gives: toggle(gives, k) })}>{GIVES[k].chip}</Chip>)}</div>
          </Row>
          <Row label="Keep to at most" note="How many of each kind a roll may hold">
            <div className="rzo-caps">
              {[['draw', 'Drawers'], ['trash', 'Trashers'], ['village', '+Actions'], ['buy', '+Buy']].map(([r, label]) => (
                <span key={r} className="rzo-cap"><span className="rzo-l">{label}</span>
                  <Stepper label={`Most ${label}`} value={opts.maxOf?.[r] ?? CAP_MAX + 1} min={0} max={CAP_MAX + 1} show={v => (v > CAP_MAX ? '∞' : v)} onChange={n => setCap(r, n > CAP_MAX ? null : n)} /></span>
              ))}
            </div>
          </Row>
          {attacksOn && <Row label="Fewest Attacks" note="At least this many Attacks in the kingdom"><Stepper label="Fewest Attacks" value={opts.minAttacks || 0} min={0} max={opts.maxAttacks ?? 12} onChange={n => setOpts({ minAttacks: n })} /></Row>}
          <Row label="Include a card costing" note="At least one card at each cost you pick"><div className="dn-chips">{costRules.map(ruleChip)}</div></Row>
          <Row label="No card above" note="The most any card may cost (none picked: any)">
            <div className="dn-chips">{[3, 4, 5, 6].map(c => <Chip key={c} cls="rzo-coin" label={`No card above ${c} coins`} pressed={opts.maxCost === c} onClick={() => setOpts({ maxCost: opts.maxCost === c ? null : c })}><CoinIcon coins={c} size={24} /></Chip>)}</div>
          </Row>
        </div>
      </Fold>
      <Fold summary={<>Always include / never include{listsOn ? <span className="meta"> · {listsOn} chosen</span> : null}</>}>
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
      </Fold>

    </div>
  );
}
