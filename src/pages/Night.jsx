import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import { SET_NAMES, LANDSCAPES } from '../lib/sets.js';
import { buildGameArgs, callGameRpc, resortByVP, toggle } from '../lib/gameForm.js';
import { badgesFor, gameXp, leagueXp } from '../lib/xp.js';
import { BadgeReward, LevelReward } from '../components/RewardCard.jsx';
import { STEPS, advance, back, blankNight, clearNight, elapsed, gameSummary, loadNight, saveNight, stepNumber } from '../lib/night.js';
import NameIcon from '../components/NameIcon.jsx';
import SetIcon from '../components/SetIcon.jsx';
import EloPreview from '../components/EloPreview.jsx';
import FinishOrder from '../components/FinishOrder.jsx';
import KingdomStep from '../components/KingdomStep.jsx';
import { DRAFT_PICKS, draftState, poolSizeFor, rollPool } from '../dominion/draft.js';
import { useCatalogLoad } from '../dominion/CatalogContext.jsx';
import { KingdomChip } from '../dominion/components/KingdomChips.jsx';
import { CardText, ShowTextButton } from '../dominion/components/bits.jsx';
import { DEFAULT_OPTIONS, kingdomFromParams, kingdomToParams, newSeed, setupForHand } from '../dominion/randomizer.js';
import CountUp from '../components/CountUp.jsx';
import { pilesPlayed, playStats } from '../dominion/playStats.js';
import { impliedSets, primaryType, resolveKingdom, shelfOrder } from '../dominion/kingdom.js';

// the options a Game night roll starts from, and Reset goes back to: Attacks allowed, at most two
const NIGHT_ROLL = { ...DEFAULT_OPTIONS, maxAttacks: 2 };

const storage = () => { try { return window.localStorage; } catch { return null; } };

/* EXPERIMENT (ux flag "flow"): logging a game as a guided evening instead of one long dialog — who's playing, the kingdom (roll
   one, pick by hand, or skip), a Play screen to keep open at the table, the final scores, then one last check before saving.
   Admin only (the server re-checks). Progress is kept in localStorage (per group, for up to half a day), so a reload, a look at a card, or another tab for a while loses nothing. */
// Keyed by the group: a Game night belongs to ONE group (its players, its saved progress, where the game is saved), so changing the group in the address bar or
// with the browser's back button starts that group's own night instead of carrying the other group's players and progress over.
export default function Night() {
  const { gid } = usePage();
  return <NightBoundary key={gid ?? 'none'} onReset={() => { if (storage()) clearNight(storage(), gid); }}><NightFlow /></NightBoundary>;
}

// If Game night ever fails to draw (whatever the cause, a saved night from an older version included), the way out is one button: forget the saved night and start a new one.
// Without it a bad save would be read back on every visit and the page would stay broken.
class NightBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('Game night failed to render:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <>
        <h1>Game night</h1>
        <section className="night-card">
          <p style={{ marginTop: 0 }}>Game night ran into a problem, possibly with the progress it had saved. Starting a fresh one clears that saved progress.</p>
          <button type="button" onClick={() => { this.props.onReset(); this.setState({ error: null }); }}>Start a fresh Game night</button>
        </section>
      </>
    );
  }
}

function NightFlow() {
  const { me, gid, D, allGroups, enabledSets, playerIdByName, hashFor, reload } = usePage();
  const cat = useCatalogLoad();
  const [st, setSt] = useState(() => (storage() ? loadNight(storage(), gid) : blankNight()));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const savedSt = useRef(null);                          // the form as it was when saved, for Undo
  const [undoing, setUndoing] = useState(false);
  const [done, setDone] = useState(null);                 // { id } after a successful save
  // every option of the Randomizer, the locked cards, the typed seed, the hand-pick panel and a snake draft in progress live in the saved night: a look at a card's page in the middle of setting up loses nothing
  const roll = st.rollOpts || NIGHT_ROLL;
  const setRollOpts = patch => setSt(s => ({ ...s, rollOpts: { ...(s.rollOpts || NIGHT_ROLL), ...patch } }));
  // how often each pile has been played, for the "favor cards we've played less" rule (null until the catalog is in, or with no kingdoms logged)
  const plays = useMemo(() => {
    if (cat.status !== 'ready') return null;
    const stats = playStats(cat.catalog, D.games, me ? me.name : null);
    return stats.withKingdom ? pilesPlayed(stats) : null;
  }, [cat.status, cat.catalog, D.games, me]);
  // the rolled kingdom: held in memory after a roll, rebuilt from its saved compact form after a reload
  const rolled = useMemo(() => st.rolled || (cat.status === 'ready' && st.rolledQ ? kingdomFromParams(cat.catalog, new URLSearchParams(st.rolledQ)) : null), [st.rolled, st.rolledQ, cat.status, cat.catalog]);
  const [showText, setShowText] = useState(false);
  const [now, setNow] = useState(Date.now());
  const before = useRef({ ranks: {}, tiers: {} });          // the ladder just before saving, to say what the game changed

  useEffect(() => { if (storage() && !done) saveNight(storage(), gid, st); }, [st, gid, done]);
  useEffect(() => {
    if (st.step !== 'play') return undefined;
    const tick = () => setNow(Date.now()), t = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);   // a tab left in the background catches the clock up the moment it is back
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [st.step]);
  useEffect(() => { window.scrollTo(0, 0); }, [st.step, done]);

  const groupName = (allGroups.find(g => g.id === gid) || {}).name;
  const roster = D.roster.slice().sort((a, b) => a.localeCompare(b));
  const patch = p => setSt(s => ({ ...s, ...p }));
  if (!me || !me.is_admin) return <><h1>Game night</h1><p className="empty">Only the admin can log a game.</p></>;
  const catalog = cat.status === 'ready' ? cat.catalog : null;
  const items = st.kingdom;
  const resolved = catalog ? resolveKingdom(catalog, items) : [];
  // the setup notes now: worked out from the cards once they were changed by hand, else the roll's own
  const setupNow = catalog && st.handEdited ? setupForHand(catalog, items.filter(i => i.kind === 'card').map(i => i.id), st.handBane) : rolled ? rolled.setup : null;

  // ---- the kingdom
  const applyKingdom = (kingdom, rolled = null) => {
    const implied = catalog ? impliedSets(resolveKingdom(catalog, kingdom)) : { sets: [], landscapes: [] };
    setSt(s => ({ ...s, kingdom, randomDone: false, randomOriginal: null, handEdited: false, handBane: null, kingdomTouched: true, rolled, rolledQ: rolled ? kingdomToParams(rolled).toString() : null, sets: [...new Set([...(rolled ? [] : s.sets), ...implied.sets])], landscapes: [...new Set([...(rolled ? [] : s.landscapes), ...implied.landscapes])] }));
  };

  // a change by hand re-works the setup notes from the cards now in the kingdom (the Bane a roll had is remembered while it still applies)
  const pickByHand = (kingdom, implied) => setSt(s => ({ ...s, kingdom, handEdited: true, handBane: s.handEdited ? s.handBane : rolled?.setup?.bane?.cards[0]?.id ?? null, rolled: null, rolledQ: null, kingdomTouched: true, sets: [...new Set([...s.sets, ...implied.sets])], landscapes: [...new Set([...s.landscapes, ...implied.landscapes])] }));
  // the snake draft: Start rolls the pool (the options page's button is the bar at the bottom), Restart goes back to the options page and drops the kingdom
  const startDraft = () => {
    const v = draftState(st.draftSave, st.picked), res = rollPool(catalog, roll, newSeed(), { plays, n: DRAFT_PICKS, size: v.poolSize ?? poolSizeFor(v.seats.length) });
    setSt(s => ({ ...s, ...(res.ok ? { kingdom: [], rolled: null, rolledQ: null, handOpen: false, handEdited: false, handBane: null } : {}), draftSave: res.ok ? { ...v, draft: { seed: res.seed, options: res.options, n: res.n, size: res.size }, picks: [], banned: [], finished: false, error: '' } : { ...v, error: res.message } }));
  };
  const restartDraft = () => setSt(s => ({ ...s, kingdom: [], rolled: null, rolledQ: null, handOpen: false, handEdited: false, handBane: null, draftSave: { ...draftState(s.draftSave, s.picked), draft: null, picks: [], banned: [], finished: false, error: '' } }));
  // "Restart Drafting": the same pool, every pick and ban taken back, the first seat to go again (and no kingdom, if the draft had finished)
  const redoDraft = () => setSt(s => ({ ...s, kingdom: [], rolled: null, rolledQ: null, handOpen: false, handEdited: false, handBane: null, draftSave: { ...draftState(s.draftSave, s.picked), picks: [], banned: [], finished: false, error: '' } }));
  const setMode = kingdomMode => setSt(s => ({ ...s, kingdomMode }));
  const next = () => { setMsg(''); setSt(s => advance(s)); };

  // ---- saving
  const save = async () => {
    if (st.picked.length < 2) { setMsg('Pick at least 2 players.'); return; }
    if (!st.date) { setMsg('Pick a date.'); return; }
    savedSt.current = st;
    before.current = { ranks: Object.fromEntries(D.ranked.map(p => [p.name, p.rank])), tiers: Object.fromEntries(D.ranked.map(p => [p.name, p.tier.id])) };
    setSaving(true); setMsg('Saving…');
    const { data, error } = await callGameRpc(sb, 'add_game', buildGameArgs({ ...st, editId: null }, gid, playerIdByName));
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    if (storage()) clearNight(storage(), gid);
    setMsg(''); setDone({ id: data });
    await reload();
  };
  // on the first step Back leaves the flow: to the page the viewer came from, or the rankings when there is none (a fresh tab)
  const goBack = () => {
    if (st.step === 'kingdom' && st.kingdomMode === 'draft' && st.draftSave?.draft) { restartDraft(); return; }   // a draft under way: back to its options page
    if (st.step === 'kingdom' && st.kingdomMode === 'random' && st.randomDone) { setSt(s => ({ ...s, randomDone: false, randomOriginal: null })); return; }   // the summary: back to the roll
    if (st.step === 'kingdom' && st.kingdomMode) { setMode(null); return; }   // inside a way of choosing, Back returns to the question
    if (st.step !== 'players') { setSt(s => back(s)); return; }
    if (window.history.length > 1) window.history.back(); else window.location.hash = hashFor('', gid);
  };
  // Undo: delete the game just saved and put the form back exactly as it was, so a wrong finish order or VP is one tap to fix
  const undo = async () => {
    if (done.id == null) return;
    setUndoing(true); setMsg('');
    const { error } = await sb.rpc('delete_game', { p_game_id: done.id });
    setUndoing(false);
    if (error) { setMsg(error.message); return; }
    setSt(savedSt.current || blankNight()); setDone(null);
    await reload();
  };
  const startOver = () => { if (storage()) clearNight(storage(), gid); setSt(blankNight()); setDone(null); setMsg(''); };

  if (done) return (
    <>
      <div className="head"><div><h1>Game saved</h1><p className="lede">{groupName ? `${groupName} — ` : ''}the standings are updated.</p></div></div>
      <div className="night-card night-done">
        <GameResult game={done.id != null ? D.games.find(x => x.line === done.id) : null} before={before.current} ranked={D.ranked} tierFor={D.tierFor} xp={leagueXp(D, catalog)} D={D} catalog={catalog} />
        <p className="night-go">
          <a className="btn" href={hashFor('', gid)}>See the rankings</a>
          <a className="btn ghost" href={done.id != null ? hashFor('games', gid, done.id) : hashFor('games', gid)}>See the game</a>
          <button type="button" className="ghost" onClick={startOver}>Log another</button>
          {done.id != null && <button type="button" className="ghost" disabled={undoing} onClick={undo}>{undoing ? 'Undoing…' : 'Undo and fix'}</button>}
        </p>
        {msg && <p className="meta" role="status">{msg}</p>}
      </div>
    </>
  );

  const step = STEPS.find(s => s.id === st.step);
  const drafting = st.kingdomMode === 'draft' && !!st.draftSave?.draft && !st.draftSave.finished;   // a draft under way: no starting the game until it is done
  const atRandomRoll = st.step === 'kingdom' && !!catalog && st.kingdomMode === 'random' && !st.randomDone;   // the Random screen: its button turns the roll into the summary
  // why the main button is greyed out (nothing when it can be pressed): fewer than 2 players, or no kingdom yet (skip it with its link) or a draft still on
  const holdOn = st.step === 'players' && st.picked.length < 2 ? 'Pick at least 2 players first'
    : st.step === 'scores' && st.picked.some(n => !/^\s*-?\d+\s*$/.test(st.vp[n] ?? '')) ? 'Enter every player’s VP first'
    : atRandomRoll && !items.length ? 'Roll a kingdom first' : st.step === 'kingdom' && drafting ? 'Finish the draft first' : st.step === 'kingdom' && !items.length ? 'Set up a kingdom first, or skip it' : '';
  const atDraftOptions = st.step === 'kingdom' && !!catalog && st.kingdomMode === 'draft' && !st.draftSave?.draft;   // the draft's options page: its button replaces Start Game & Timer
  // shown at the table and on the last check in shelf order (expansion, then A to Z) with each expansion's icon, so a card is found in its box at a glance
  const shelved = list => list.slice().sort((a, b) => (a.missing ? 1 : 0) - (b.missing ? 1 : 0) || (a.missing || b.missing ? 0 : shelfOrder(a, b)));
  const kingdomCards = shelved(resolved.filter(r => r.kind === 'card')), kingdomLands = shelved(resolved.filter(r => r.kind === 'landscape'));

  return (
    <>
      <div className="head"><div><h1>Game night</h1><p className="lede">{groupName ? `${groupName} — ` : ''}a step-by-step way to log a game.</p></div></div>
      <ol className="night-steps" aria-label="Steps">
        {STEPS.map(s => <li key={s.id} className={s.id === st.step ? 'now' : stepNumber(s.id) < stepNumber(st.step) ? 'done' : ''} aria-current={s.id === st.step ? 'step' : undefined}><span>{stepNumber(s.id)}</span><em>{s.label}</em></li>)}
      </ol>

      <section className="night-card" aria-labelledby="night-h">
        <h2 id="night-h" style={{ marginTop: 0 }}>{step.title}</h2>

        {st.step === 'players' && (
          <>
            <p className="meta">Tap everyone at the table.</p>
            <div className="pills" id="bpick">
              {roster.map(n => <a key={n} href="#" aria-current={st.picked.includes(n) ? 'true' : undefined}
                onClick={e => { e.preventDefault(); setSt(s => ({ ...s, picked: toggle(s.picked, n), tie: {}, vp: s.vp })); }}><NameIcon name={n} size={18} />{n}</a>)}
            </div>
            <p className="meta" role="status">{st.picked.length ? `${st.picked.length} player${st.picked.length === 1 ? '' : 's'}${st.picked.length < 2 ? ' — pick at least 2' : ''}` : 'No one picked yet.'}</p>
            <EloPreview picked={st.picked} />
          </>
        )}

        {st.step === 'kingdom' && (
          !catalog ? (cat.status === 'error' ? <p className="meta">The card list isn’t available right now. You can skip the kingdom and still save the game. <button type="button" className="ghost" onClick={cat.retry}>Try again</button> <button type="button" className="linkish" onClick={() => setSt(s => advance({ ...s, kingdom: [] }))}>Skip the kingdom</button></p> : <p className="meta">Loading the card list…</p>) : (
            <KingdomStep catalog={catalog} mode={st.kingdomMode} setMode={setMode} players={st.picked} roll={roll} setRollOpts={setRollOpts} resetRoll={() => setSt(s => ({ ...s, rollOpts: null, kept: null }))} kept={st.kept} onKeep={kept => setSt(s => ({ ...s, kept }))}
              hand={st.handOpen} setHand={handOpen => setSt(s => ({ ...s, handOpen }))} draftSave={st.draftSave} onDraft={draftSave => setSt(s => ({ ...s, draftSave }))} onRestartDraft={redoDraft}
              plays={plays} items={items} rolled={rolled} setupNow={setupNow} handEdited={st.handEdited} resolved={resolved} randomDone={st.randomDone} randomOriginal={st.randomOriginal} setRandomDone={randomDone => setSt(s => ({ ...s, randomDone, handOpen: randomDone ? false : s.handOpen, randomOriginal: randomDone ? s.kingdom.filter(i => i.kind === 'card').map(i => i.id) : null }))} applyKingdom={applyKingdom} onPick={pickByHand} onSkip={() => setSt(s => advance({ ...s, kingdom: [], kingdomMode: null }))}
              text={<KingdomText resolved={resolved} catalog={catalog} show={showText} setShow={setShowText} />} />
          )
        )}

        {st.step === 'play' && (
          <>
            <p className="night-timer" role="timer" aria-live="off">{elapsed(st.startedAt, now)}</p>
            {items.length ? (
              <>
                <p className="meta" style={{ margin: '0 0 6px' }}>Tonight’s kingdom</p>
                <div className="dn-kchips">{kingdomCards.map(r => <KingdomChip key={r.id} r={r} plain expansion />)}</div>
                {kingdomLands.length > 0 && <div className="dn-kchips">{kingdomLands.map(r => <KingdomChip key={r.id} r={r} plain expansion />)}</div>}
                {setupNow && <RolledNotes setup={setupNow} />}
                <KingdomText resolved={resolved} catalog={catalog} show={showText} setShow={setShowText} />
              </>
            ) : <p className="meta">No kingdom was picked. Have a great game — come back here when it ends.</p>}
            <p className="night-players meta">{st.picked.join(' · ')}</p>
          </>
        )}

        {st.step === 'scores' && (
          <>
            <p className="meta">Enter each player’s VP and the order sorts itself, ties included.</p>
            <FinishOrder bs={st} setBs={setSt} resort={resortByVP} vpOnly />
          </>
        )}

        {st.step === 'review' && (
          <>
            <div className="controls">
              <label className="f">Date <input type="date" value={st.date} onChange={e => patch({ date: e.target.value })} /></label>
              <label className="f">Type <select value={st.type} onChange={e => patch({ type: e.target.value })}>{['', 'Playoff', 'Friendly'].map(t => <option key={t} value={t}>{t || 'Regular'}</option>)}</select></label>
            </div>
            <ol className="night-result">{st.picked.map((n, i) => <li key={n}><b>{st.tie[n] ? '=' : i + 1}</b> {n}{st.vp[n] !== undefined && st.vp[n] !== '' && <span className="meta"> — {st.vp[n]} VP</span>}</li>)}</ol>
            <p className="meta" style={{ marginBottom: 4 }}>Expansions in play (from the kingdom cards — change if needed)</p>
            <div className="pills" id="bsets">{SET_NAMES.filter(n => enabledSets.has(n) || st.sets.includes(n)).map(n => <a key={n} href="#" aria-current={st.sets.includes(n) ? 'true' : undefined} onClick={e => { e.preventDefault(); patch({ sets: toggle(st.sets, n) }); }}><SetIcon name={n} size={18} />{n}</a>)}</div>
            <p className="meta" style={{ margin: '12px 0 4px' }}>Landscape cards in play</p>
            <div className="pills" id="bland">{LANDSCAPES.map(n => <a key={n} href="#" aria-current={st.landscapes.includes(n) ? 'true' : undefined} onClick={e => { e.preventDefault(); patch({ landscapes: toggle(st.landscapes, n) }); }}>{n}</a>)}</div>
            {items.length > 0 && <><p className="meta" style={{ margin: '12px 0 4px' }}>Kingdom ({kingdomCards.length} card{kingdomCards.length === 1 ? '' : 's'}{kingdomLands.length ? `, ${kingdomLands.length} landscape${kingdomLands.length === 1 ? '' : 's'}` : ''})</p><div className="dn-kchips">{[...kingdomCards, ...kingdomLands].map(r => <KingdomChip key={`${r.kind}:${r.id}`} r={r} plain expansion />)}</div></>}
            <label className="f" style={{ marginTop: 12 }}>Notes <input type="text" size={40} value={st.notes} onChange={e => patch({ notes: e.target.value })} /></label>
            {msg && <p className="dn-rz-msg" role="alert">{msg}</p>}
          </>
        )}
      </section>

      <div className="night-actions">
        <button type="button" className="ghost" onClick={goBack}>← Back</button>
        {st.step === 'review'
          ? <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save game'}</button>
          : atDraftOptions ? <button type="button" onClick={startDraft}>Start the draft →</button>
          : atRandomRoll ? <button type="button" onClick={() => setSt(s => ({ ...s, randomDone: true, handOpen: false, randomOriginal: s.kingdom.filter(i => i.kind === 'card').map(i => i.id) }))} disabled={!!holdOn} title={holdOn || undefined}>Use this kingdom →</button>
          : <button type="button" onClick={next} disabled={!!holdOn} title={holdOn || undefined}>{st.step === 'kingdom' ? 'Start Game & Timer →' : st.step === 'play' ? 'Game over — scores →' : 'Next →'}</button>}
      </div>
      <p className="night-reset"><button type="button" className="ghost" onClick={startOver}>Restart Game Night</button></p>
    </>
  );
}

// what the saved game did: each player's Elo, their move on the ladder, any tier crossed, and the XP it paid (friendly games pay XP but move no rating)
function GameResult({ game, before, ranked, tierFor, xp, D, catalog }) {
  const rows = gameSummary(game, before, ranked, tierFor);
  if (!game) return <p className="meta" style={{ marginTop: 0 }}>Updating the standings…</p>;
  const paid = gameXp(xp, game), byName = Object.fromEntries((rows || []).map(r => [r.name, r]));
  if (!rows && !paid.length) return <p style={{ marginTop: 0 }}>Nice game. This one doesn’t change anyone’s rating.</p>;
  return (
    <>
      <p style={{ marginTop: 0 }}>{rows ? 'Nice game. Here’s what it did:' : 'Nice game. This one doesn’t change anyone’s rating, but it still earns XP:'}</p>
      <ol className="night-result night-did">{(paid.length ? paid : rows).map((row, i) => {
        const r = byName[row.name], x = paid.length ? row : null;
        return (
          <li key={row.name} style={{ '--i': i }}>
            <b>{row.name}</b>
            {r && <> <span className={r.delta > 0 ? 'up-t' : r.delta < 0 ? 'down-t' : ''}>{r.delta > 0 ? '+' : r.delta < 0 ? '−' : ''}<CountUp value={Math.abs(r.delta)} ms={800} /></span>
              <span className="meta"> · {r.before} → {r.after}{r.rankAfter != null && <> · #{r.rankAfter}</>}</span>
              {r.rankMove !== 0 && <span className={r.rankMove > 0 ? 'up-t' : 'down-t'}> {r.rankMove > 0 ? '▲' : '▼'}{Math.abs(r.rankMove)}</span>}
              {r.tierUp && <span className="pill ok"> now a {r.tierUp.name}</span>}
              {r.saving > 0 && <span className="pill ok"> Saving Grace +{r.saving}</span>}
              {r.tierDown && <span className="pill warn"> down to {r.tierDown.name}</span>}</>}
            {x && <span className="night-xp"> <b>+<CountUp value={x.xp} ms={800} /> XP</b>{x.levelUp ? <span className="pill ok"> level {x.levelUp}</span> : null}</span>}
          </li>
        );
      })}</ol>
      <Rewards game={game} paid={paid} D={D} catalog={catalog} />
    </>
  );
}

// what this game unlocked: levels reached and badges first earned in it, as reward cards (nothing at all when there is nothing new)
function Rewards({ game, paid, D, catalog }) {
  const { me } = usePage();
  const badges = useMemo(() => game.names.flatMap(n => {
    const p = D.players.find(x => x.name === n);
    return p && p.rated ? badgesFor(D, p, catalog).filter(b => b.earned && b.earned.line === game.line).map(b => ({ b, who: n })) : [];
  }), [game, D, catalog]);
  const levels = paid.filter(x => x.levelUp);
  if (!badges.length && !levels.length) return null;
  const many = new Set([...badges.map(x => x.who), ...levels.map(x => x.name)]).size > 1;
  return (
    <ul className="rewards" aria-label="Unlocked in this game">
      {levels.map((x, i) => <LevelReward key={'l' + x.name} level={x.levelUp} who={many ? x.name : null} i={i} />)}
      {badges.map((x, i) => <BadgeReward key={x.who + x.b.id} b={x.b} who={many ? x.who : null} i={levels.length + i} mine={!!me && me.name === x.who} />)}
    </ul>
  );
}

// "Show card text" and the text of every card and landscape in the kingdom: on the Kingdom step (to judge a roll) and at the table
function KingdomText({ resolved, catalog, show, setShow }) {
  return (
    <>
      <p style={{ margin: '10px 0' }}><ShowTextButton on={show} onClick={() => setShow(!show)} /></p>
      {show && <ul className="dn-plain-list night-text">{resolved.filter(r => !r.missing).map(r => <li key={`${r.kind}:${r.id}`} className={'t-' + (r.kind === 'landscape' ? r.obj.type : primaryType(r.obj) || 'action').toLowerCase()}><b>{r.obj.name}</b>{catalog && <CardText text={r.obj.text} hasAnyText={catalog.meta.textRecordCount > 0} />}</li>)}</ul>}
    </>
  );
}

// the setup lines of a rolled kingdom (the same facts as the Randomizer's Setup section, in one short list)
function RolledNotes({ setup }) {
  const lines = [];
  if (setup.needsBane) lines.push('Young Witch needs a Bane: add a card that costs $2 or $3 to the kingdom.');
  if (setup.bane) lines.push(`Young Witch needs a Bane: ${setup.bane.name}.`);
  if (setup.platinumColony != null) lines.push(setup.platinumColony ? 'Use Platinum and Colony.' : 'No Platinum or Colony.');
  if (setup.shelters != null) lines.push(setup.shelters ? 'Use Shelters instead of Estates.' : 'Use Estates (no Shelters).');
  if (setup.ruins) lines.push('A Looter is in: add the Ruins pile.');
  return lines.length ? <ul className="dn-plain-list night-notes">{lines.map(l => <li key={l}>{l}</li>)}</ul> : null;
}
