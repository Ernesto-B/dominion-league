import { useEffect, useMemo, useState } from 'react';
import { usePage } from '../PageContext.js';
import { f0, long, ord, sgn } from '../lib/format.js';
import { gameReport } from '../lib/gameReport.js';
import { TIERS } from '../lib/achievements.js';
import { PART_ORDER, XP, partLabel } from '../lib/xp.js';
import PlayerLink from './PlayerLink.jsx';
import SetIcon from './SetIcon.jsx';
import LandscapePills from './LandscapePills.jsx';
import { BadgeReward, LevelReward } from './RewardCard.jsx';
import { setIconPath } from '../lib/sets.js';
import { expansionMeta } from '../dominion/constants.js';
import { KingdomChip, ShelfGroups } from '../dominion/components/KingdomChips.jsx';
import { REQUIRE_RULES } from '../dominion/randomizer.js';

/* One game, in depth: the Games page's view of a single game (#/games/<group>/<id>). The numbers come from lib/gameReport.js; this file only lays them out.
   A header with the game in its night and season, a few highlights, then four tabs: Players (each one's result and how it compares with their usual), Kingdom
   (what was in it and how it compares with the group's usual), Time (how long it took) and Rewards (XP, levels, badges, new cards). */
const TABS = [['players', 'Players'], ['kingdom', 'Kingdom'], ['time', 'Time'], ['rewards', 'Rewards']];
/* A report always opens on Players. Stepping to the Older / Newer game keeps the tab you are on (the new game mounts in the same moment the old one goes), but leaving the
   report forgets it: the tab is reset one tick after a report unmounts, unless another report has mounted by then. */
let current = 'players', forget = 0;
const tone = (d, eps = 0.5) => (d > eps ? 'up-t' : d < -eps ? 'down-t' : '');
const clock = iso => { const d = new Date(iso); return Number.isNaN(+d) ? null : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const one = x => (Math.round(x * 10) / 10).toString();

export default function GameReport({ game }) {
  const { D, gid, hashFor, me, catalog } = usePage();
  const rep = useMemo(() => gameReport(D, game, { catalog }), [D, game, catalog]);
  const [tab, setTabState] = useState(() => current);
  const setTab = t => { current = t; setTabState(t); };
  useEffect(() => { clearTimeout(forget); return () => { forget = setTimeout(() => { current = 'players'; }, 0); }; }, []);
  const season = D.seasons.find(s => s.number === game.season);
  const older = D.games[game.idx - 1], newer = D.games[game.idx + 1];
  const rewards = rep.players.reduce((n, p) => n + p.badges.length + (p.xp && p.xp.levelUp ? 1 : 0), 0);
  const w = rep.when;
  return (
    <div className="gr">
      <div className="gr-top">
        <a className="gr-back" href={hashFor('games', gid)}>← All games</a>
        <span className="gr-nav">
          {older ? <a href={hashFor('games', gid, older.line)}>← Older</a> : <span className="off">← Older</span>}
          {newer ? <a href={hashFor('games', gid, newer.line)}>Newer →</a> : <span className="off">Newer →</span>}
        </span>
      </div>
      <h1>{long(rep.when.date)}</h1>
      <p className="lede">{w.nightOf > 1 ? `Game ${w.nightNo} of ${w.nightOf} that night` : 'The only game that night'}{season ? ` · ${season.name}` : ''}</p>
      <ul className="gr-chips" aria-label="About this game">
        <li>{rep.type}</li>
        <li>{rep.n} players</li>
        {rep.time && <li>{rep.time.minutes} min</li>}
        {w.startedAt && w.endedAt && clock(w.startedAt) && <li>{clock(w.startedAt)} – {clock(w.endedAt)}</li>}
        {rep.sets.length > 0 && <li className="gr-sets">{rep.sets.map(s => (setIconPath(s) ? <SetIcon key={s} name={s} size={20} /> : <span key={s} className="meta">{s}</span>))}</li>}
      </ul>

      {rep.highlights.length > 0 && (
        <ul className="gr-hl" aria-label="Highlights">
          {rep.highlights.map(h => <li key={h.title + h.text} className={'gr-hl-' + h.tone}><b>{h.title}</b><span>{h.text}</span></li>)}
        </ul>
      )}

      <div className="gr-tabs" role="tablist" aria-label="Sections of the report">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={'grt-' + id} aria-selected={tab === id} aria-controls="gr-panel" onClick={() => setTab(id)}>
            {label}{id === 'rewards' && rewards > 0 ? <span className="gr-count">{rewards}</span> : null}
          </button>
        ))}
      </div>
      <div id="gr-panel" role="tabpanel" aria-labelledby={'grt-' + tab} className="gr-panel">
        {tab === 'players' && <Players rep={rep} game={game} me={me} />}
        {tab === 'kingdom' && <Kingdom rep={rep} game={game} loaded={!!catalog} />}
        {tab === 'time' && <Time rep={rep} />}
        {tab === 'rewards' && <Rewards rep={rep} me={me} loaded={!!catalog} />}
      </div>
      {rep.notes && <p className="note">{rep.notes}</p>}
    </div>
  );
}

/* ---- Players ---- */
export function Players({ rep, game, me }) {
  return (
    <ol className="gr-players">
      {rep.players.map((p, i) => <PlayerCard key={p.name} p={p} game={game} mine={!!me && me.name === p.name} open={me ? me.name === p.name : i === 0} />)}
    </ol>
  );
}

function GraceNote({ g }) {
  if (g.kind === 'up') return <>Rose to <b>{g.tier}</b></>;
  if (g.kind === 'down') return <>Dropped from <b>{g.from}</b> to <b>{g.tier}</b></>;
  return <>On thin ice: still <b>{g.tier}</b> under the line, {g.left > 0 ? `${g.left} more game${g.left === 1 ? '' : 's'} of grace` : 'out of grace, the next game under the line drops them'}</>;
}

function PlayerCard({ p, game, mine, open }) {
  const { D } = usePage();
  const t = p.table;
  return (
    <li className={'gr-player' + (p.won ? ' won' : '') + (mine ? ' me' : '')}>
      <details open={open}>
        <summary>
          <span className="gr-place">{ord(p.place)}</span>
          <span className="gr-name" onClick={e => e.stopPropagation()}><PlayerLink name={p.name} tier={D.tierAt(game, p.name)} /></span>
          <span className="gr-stat"><b>{p.vp != null ? p.vp : '—'}</b><small>VP</small></span>
          <span className={'gr-stat ' + (p.elo ? tone(p.elo.delta) : '')}><b>{p.elo ? sgn(p.elo.delta) : '—'}</b><small>Elo</small></span>
          <span className="gr-stat"><b>{p.xp ? '+' + p.xp.total : '—'}</b><small>XP</small></span>
          <span className="gr-chev" aria-hidden="true">▾</span>
        </summary>
        <div className="gr-body">
          <ul className="gr-facts">
            {p.elo && <li>Elo <b>{f0(p.elo.before)} → {f0(p.elo.after)}</b>{p.rank && p.rank.after != null ? <> · ladder <b>{p.rank.before != null ? `#${p.rank.before} → #${p.rank.after}` : `new at #${p.rank.after}`}</b></> : null}</li>}
            {p.elo && p.elo.saving > 0 && <li>Saving Grace <b className="up-t">+{f0(p.elo.saving)} Elo</b> <small>a top-half finish while under the line returns part of the last loss</small></li>}
            {p.elo && p.elo.grace && <li><GraceNote g={p.elo.grace} /></li>}
            {p.score && <li>Season score <b>{f0(p.score.before * 1000)} → {f0(p.score.after * 1000)}</b> <span className={tone(p.score.delta, 0.0005)}>({sgn(p.score.delta * 1000)})</span></li>}
            {p.vpShare != null && <li>{Math.round(p.vpShare * 100)}% of the winner’s VP</li>}
            {t && <li>The table averaged <b>{f0(t.oppAvg)}</b> Elo, {Math.abs(t.diff) < 1 ? 'level with their rating' : `${Math.round(Math.abs(t.diff))} ${t.diff > 0 ? 'above' : 'below'} their own rating`}. Expected to beat <b>{Math.round(t.expected * 100)}%</b> of it, beat <b>{Math.round(t.actual * 100)}%</b>.</li>}
          </ul>
          {p.compare.length > 0 && (
            <>
              <h4 className="gr-h">Against their usual</h4>
              <ul className="gr-cmps">{p.compare.map(c => <Compare key={c.id} c={c} />)}</ul>
            </>
          )}
          {p.fit.length > 0 && (
            <>
              <h4 className="gr-h">How they do with this kingdom</h4>
              <ul className="gr-fit">{p.fit.slice(0, 3).map(f => (
                <li key={f.label}><span>{f.label}</span><span>beats <b>{Math.round(f.avg * 100)}%</b> <small>usually {Math.round(f.overall * 100)}% · {f.games} games</small></span><span className={tone(f.delta, 0.005)}>{f.delta > 0 ? '+' : f.delta < 0 ? '−' : ''}{Math.abs(Math.round(f.delta * 100))}</span></li>
              ))}</ul>
            </>
          )}
          {p.compare.length === 0 && p.fit.length === 0 && <p className="meta">More games with {p.name} will fill in how this one compares with their usual.</p>}
        </div>
      </details>
    </li>
  );
}

const SHOW = { VP: v => one(v), '%': v => Math.round(v) + '%', Elo: v => sgn(v), XP: v => f0(v), 'VP/min': v => one(v) };
function Compare({ c }) {
  const show = SHOW[c.unit] || one;
  const d = c.delta, whole = c.unit === '%' || c.unit === 'Elo' || c.unit === 'XP', dText = `${d > 0 ? '+' : d < 0 ? '−' : ''}${whole ? Math.abs(Math.round(d)) : one(Math.abs(d))}`;
  // a figure that can fall below zero (an Elo change) is drawn from a zero line in the middle: a loss runs left, a gain right, and a loss never looks like a full bar.
  // A figure that cannot (VP, finish, XP) starts at the left edge. `--l` / `--w` are where the bar starts and how wide it is, `--u` where their usual sits, all as fractions.
  const signed = c.unit === 'Elo' || c.value < 0 || c.usual < 0, lim = Math.max(Math.abs(c.value), Math.abs(c.usual), 1e-9);
  const at = x => (signed ? (x / lim + 1) / 2 : x / lim);
  const l = signed ? Math.min(0.5, at(c.value)) : 0, w = signed ? Math.abs(at(c.value) - 0.5) : at(c.value);
  return (
    <li className="gr-cmp">
      <span className="gr-cmp-l">{c.label}</span>
      <span className={'gr-cmp-bar ' + (signed ? 'signed ' : '') + (c.good === true ? 'good' : c.good === false ? 'bad' : '')} aria-hidden="true" style={{ '--l': l, '--w': w, '--u': at(c.usual) }}><i /><em /></span>
      <span className="gr-cmp-n"><b>{show(c.value)}</b> <small>usual {show(c.usual)}</small></span>
      <span className={'gr-cmp-d ' + (c.good === true ? 'up-t' : c.good === false ? 'down-t' : '')}>{dText}</span>
    </li>
  );
}

/* ---- Kingdom ---- */
export function Kingdom({ rep, game, loaded }) {
  const k = rep.kingdom;
  const [focus, setFocus] = useState(null);   // { kind: 'type' | 'tool', key, label } or null
  if (!game.kingdom || !game.kingdom.length) return <p className="empty">No kingdom was logged for this game. Games started from Game night record one.</p>;
  if (!loaded) return <p className="meta">Loading the card list…</p>;
  if (!k) return <p className="empty">The logged cards could not be found in the Collection.</p>;
  const vs = k.vs, maxB = Math.max(1, ...k.costBuckets);
  // tapping a card type or a tool picks it out: every card below that is not one of those greys out (tap it again to see them all)
  const level = c => Math.min(6, Math.max(2, c.coins)) - 2;   // the same cost levels as the bars above ($2 or less, $3, $4, $5, $6+); a Debt card has none
  const hit = c => (!focus ? true : focus.kind === 'type' ? c.types.includes(focus.key) : focus.kind === 'cost' ? c.debt === 0 && level(c) === focus.key : (c.mechanicIds || []).some(t => REQUIRE_RULES[focus.key].tags.includes(t)));
  const pickCost = i => setFocus(focus && focus.kind === 'cost' && focus.key === i ? null : { kind: 'cost', key: i });
  const cards = k.cards.map(c => ({ r: { kind: 'card', id: c.id, obj: c }, c })), lands = k.landscapes.map(l => ({ r: { kind: 'landscape', id: l.id, obj: l } }));
  // a percentile of a handful of kingdoms says nothing, so it needs a few to compare with
  const pctile = vs.costPercentile != null && vs.sample >= 4 ? Math.round(vs.costPercentile * 100) : null;
  const priceNote = pctile == null ? '' : pctile >= 100 ? ' · the priciest so far' : pctile <= 0 ? ' · the cheapest so far' : ` · pricier than ${pctile}% of kingdoms`;
  return (
    <>
      <ul className="gr-tiles">
        <li><b>{k.avgCost != null ? one(k.avgCost) : '—'}</b><span>average cost</span><small>{vs.avgCost != null ? `group usual ${one(vs.avgCost)}${priceNote}` : 'Debt cards are not counted'}</small></li>
        <li><b>{k.attacks}</b><span>Attack{k.attacks === 1 ? '' : 's'}</span><small>{vs.avgAttacks != null ? `usual ${one(vs.avgAttacks)}` : ' '}</small></li>
        <li><b>{k.landscapes.length}</b><span>landscape{k.landscapes.length === 1 ? '' : 's'}</span><small>{vs.landscapeShare != null ? `${Math.round(vs.landscapeShare * 100)}% of kingdoms have any` : ' '}</small></li>
        <li><b>{k.expansions.length}</b><span>expansion{k.expansions.length === 1 ? '' : 's'}</span><small>{k.expansions.slice(0, 3).map(e => `${e.n} ${expansionMeta(e.name).label}`).join(' · ')}</small></li>
      </ul>
      <h4 className="gr-h">Cost of the cards</h4>
      <ol className="gr-hist" aria-label="Cards by cost">{['$2 or less', '$3', '$4', '$5', '$6+'].map((l, i) => (
        <li key={l}>
          <button type="button" aria-pressed={!!focus && focus.kind === 'cost' && focus.key === i} disabled={!k.costBuckets[i]} onClick={() => pickCost(i)}
            aria-label={`${k.costBuckets[i]} card${k.costBuckets[i] === 1 ? '' : 's'} costing ${l}`}>
            <i style={{ '--h': k.costBuckets[i] / maxB }} /><b>{k.costBuckets[i]}</b><span>{l}</span>
          </button>
        </li>
      ))}</ol>
      {k.debtCards > 0 && <p className="meta">{k.debtCards} Debt card{k.debtCards === 1 ? '' : 's'} not counted in the average.</p>}
      <KingdomFacts k={k} focus={focus} setFocus={setFocus} />
      <h4 className="gr-h">The cards, by expansion</h4>
      <ShelfGroups entries={cards.map(({ r, c }) => ({ r, node: <KingdomChip key={r.id} r={r} expansion dim={!hit(c)} /> }))} />
      {lands.length > 0 && <><h4 className="gr-h">Landscapes</h4><ShelfGroups entries={lands.map(({ r }) => ({ r, node: <KingdomChip key={r.id} r={r} expansion dim={!!focus} /> }))} /></>}
      {(game.landscapes || []).length > 0 && !lands.length && <p className="note">Landscapes in play: <LandscapePills game={game} /></p>}
    </>
  );
}

// what the cards are and how they sit in the group's history: types, tools, price range, and which cards were new to the group
function KingdomFacts({ k, focus, setFocus }) {
  const h = k.history, names = list => list.map(c => c.name).join(', ');
  const same = (kind, key) => !!focus && focus.kind === kind && focus.key === key;
  const pick = (kind, key, label) => setFocus(same(kind, key) ? null : { kind, key, label });
  // the chips are the Collection's own (type-coloured edge, count at the right); pressing one filters the cards listed below
  const rows = [
    ['Card types', k.types.length ? <span className="gr-pills">{k.types.map(t => <button key={t.name} type="button" className={'dn-chip t-' + t.name.toLowerCase()} aria-pressed={same('type', t.name)} onClick={() => pick('type', t.name, t.name)}>{t.name}<span className="n">{t.n}</span></button>)}</span> : null],
    ['Tools', k.tools.length ? <><span className="gr-pills">{k.tools.map(t => <button key={t.key} type="button" className="dn-chip" aria-pressed={same('tool', t.key)} onClick={() => pick('tool', t.key, t.label)}>{t.label}<span className="n">{t.n}</span></button>)}</span><small className="gr-fine">From the recorded card mechanics; a card can do more than is listed.</small></> : null],
    ['In this group', h ? <span>{h.firstInGroup.length ? <>First time played here: <b>{names(h.firstInGroup)}</b>.</> : <>Every card has been played here before.</>}{h.mostPlayed ? <><br />Most played: <b>{h.mostPlayed.card.name}</b>, {h.mostPlayed.before} time{h.mostPlayed.before === 1 ? '' : 's'} before this.</> : null}</span> : null],
  ].filter(([, v]) => v);
  return (
    <>
      <h4 className="gr-h">About these cards</h4>
      <dl className="gr-facts2">{rows.map(([label, v]) => <div key={label}><dt>{label}</dt><dd>{v}</dd></div>)}</dl>
    </>
  );
}

/* ---- Time ---- */
export function Time({ rep }) {
  const t = rep.time, w = rep.when;
  const at = [w.startedAt && clock(w.startedAt) ? `Started ${clock(w.startedAt)}` : null, w.endedAt && clock(w.endedAt) ? `ended ${clock(w.endedAt)}` : null].filter(Boolean).join(' · ');
  const saved = !at && w.savedAt && clock(w.savedAt) ? `Logged at ${clock(w.savedAt)}` : null;
  if (!t) return <><p className="empty">No match time was saved for this game. Games logged through Game night’s timer have one.</p>{saved && <p className="meta">{saved}.</p>}</>;
  const vsAvg = (label, avg, n) => avg != null && (
    <li><span>{label}</span><b>{one(avg)} min</b><small>{n ? `${n} timed game${n === 1 ? '' : 's'}` : ''}</small><span className={tone(avg - t.minutes, 0.5)}>{t.minutes < avg ? `${one(avg - t.minutes)} min faster` : t.minutes > avg ? `${one(t.minutes - avg)} min slower` : 'on the average'}</span></li>
  );
  return (
    <>
      <p className="gr-big"><b>{t.minutes}</b><span>minutes</span></p>
      {(at || saved) && <p className="meta gr-at">{at || saved}</p>}
      <ul className="gr-times">
        {vsAvg('Every game', t.avgAll, t.of)}
        {rep.n != null && vsAvg(`${rep.n}-player games`, t.avgSize, t.sizeSample)}
        <li><span>Pace rank</span><b>#{t.rankFastest}</b><small>fastest of {t.of} timed</small><span /></li>
        {t.perMinute != null && <li><span>Winner’s pace</span><b>{one(t.perMinute)} VP / min</b><small>winning VP over the length</small><span /></li>}
      </ul>
    </>
  );
}

/* ---- Rewards ---- */
// a badge's rarity word, tinted like the difficulty dots on the Player page (a secret one has its own ember colour)
const RARITY = { ...Object.fromEntries(TIERS.map(t => [t.id, t.label])), secret: 'Secret' };
// one player's XP by part: each row opens to show exactly how that number was worked out (only one open at a time)
function XpParts({ p }) {
  const [open, setOpen] = useState(null);
  const parts = PART_ORDER.filter(k => p.xp.parts[k]), max = Math.max(1, ...parts.map(k => p.xp.parts[k]));
  return (
    <ul className="gr-parts">
      {parts.map(k => {
        const isOpen = open === k, id = `gr-xpd-${p.name}-${k}`, lines = p.xp.explain && p.xp.explain[k];
        return (
          <li key={k} className={isOpen ? 'open' : ''}>
            <button type="button" className="gr-xp-row" aria-expanded={isOpen} aria-controls={id} disabled={!lines} onClick={() => setOpen(isOpen ? null : k)}>
              <span>{partLabel(k)}</span><i style={{ '--w': p.xp.parts[k] / max }} /><b>{p.xp.parts[k]}</b><em aria-hidden="true">▾</em>
            </button>
            {isOpen && lines && (
              <div id={id} className="gr-xp-more" role="region" aria-label={`How ${partLabel(k)} was worked out`}>
                <ol className="gr-ledger">
                  {lines.map((l, i) => (l.item ? <li key={i} className="item">{l.item}</li> : <li key={i}><span>{l.text}{l.tier ? <em className="gr-rar" style={{ color: `var(--td-${l.tier})` }}>{RARITY[l.tier] || l.tier}</em> : null}</span>{l.amount != null ? <b>+{l.amount}</b> : null}</li>))}
                </ol>
                <p className="gr-ledger-total"><span>{partLabel(k)}</span><b>{p.xp.parts[k]} XP</b></p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Rewards({ rep, me, loaded }) {
  const { gid, hashFor } = usePage();
  const withXp = rep.players.filter(p => p.xp);
  const levels = withXp.filter(p => p.xp.levelUp), many = new Set([...levels.map(p => p.name), ...rep.players.filter(p => p.badges.length).map(p => p.name)]).size > 1;
  const anyNew = rep.players.some(p => p.newCards.length || p.newLandscapes.length);
  return (
    <>
      <ul className="gr-xps">
        {withXp.map(p => (
          <li key={p.name} className="gr-xp">
            <div className="gr-xp-h"><b><a className="pl" href={hashFor('players', gid, encodeURIComponent(p.name))}>{p.name}</a></b><span>+{p.xp.total} XP</span><small>Lv {p.xp.levelBefore}{p.xp.levelUp ? ` → ${p.xp.levelAfter}` : ''}</small></div>
            <XpParts p={p} />
          </li>
        ))}
        {!withXp.length && <li className="meta">No XP for a game with fewer than two players.</li>}
      </ul>
      {(levels.length > 0 || rep.players.some(p => p.badges.length)) && (
        <>
          <h4 className="gr-h">Unlocked in this game</h4>
          <ul className="rewards">
            {levels.map((p, i) => <LevelReward key={'l' + p.name} level={p.xp.levelAfter} from={p.xp.levelBefore} who={many ? p.name : null} i={i} />)}
            {rep.players.flatMap((p, pi) => p.badges.map((b, i) => <BadgeReward key={p.name + b.id} b={b} who={many ? p.name : null} i={levels.length + pi + i} mine={!!me && me.name === p.name} />))}
          </ul>
        </>
      )}
      {anyNew && (
        <>
          <h4 className="gr-h">New to them</h4>
          <p className="meta">Each new card is worth {XP.newCard} XP, each new landscape {XP.newLandscape}.</p>
          <ul className="gr-new">
            {rep.players.filter(p => p.newCards.length || p.newLandscapes.length).map(p => (
              <li key={p.name}>
                <b>{p.name}</b> <span className="meta">{p.newCards.length} card{p.newCards.length === 1 ? '' : 's'}{p.newLandscapes.length ? `, ${p.newLandscapes.length} landscape${p.newLandscapes.length === 1 ? '' : 's'}` : ''}</span>
                <div className="dn-kchips">{[...p.newCards.map(c => ({ kind: 'card', id: c.id, obj: c })), ...p.newLandscapes.map(l => ({ kind: 'landscape', id: l.id, obj: l }))].map(r => <KingdomChip key={r.kind + r.id} r={r} expansion plain />)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {!anyNew && loaded && <p className="meta">Nobody saw a card or landscape for the first time here.</p>}
    </>
  );
}
