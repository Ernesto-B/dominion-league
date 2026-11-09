import { groupHue, groupName as nameOfGroup, rememberNightGroup } from '../lib/groups.js';
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import { SET_NAMES, LANDSCAPES } from '../lib/sets.js';
import { buildGameArgs, callGameRpc, resortByVP, toggle } from '../lib/gameForm.js';
import { trustedMinutes, usualMinutes } from '../lib/pending.js';
import { badgesFor, gameXp, leagueXp } from '../lib/xp.js';
import { BadgeReward, LevelReward } from '../components/RewardCard.jsx';
import SeatingHelp from '../components/SeatingHelp.jsx';
import PlayerPick from '../components/PlayerPick.jsx';
import { MAX_PLAYERS, MAX_SEATS } from '../lib/seating.js';
import { MAX_TABLES, STEPS, advance, back, blankNight, cleanMinutes, clearNight, elapsed, gameSummary, hasNight, loadNight, playedMinutes, saveNight, stepNumber, tableLabel, withGameKingdom, nightTabKey } from '../lib/night.js';
import NameIcon from '../components/NameIcon.jsx';
import SetIcon from '../components/SetIcon.jsx';
import EloPreview from '../components/EloPreview.jsx';
import FinishOrder from '../components/FinishOrder.jsx';
import KingdomStep from '../components/KingdomStep.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { DRAFT_PICKS, draftState, poolSizeFor, rollPool } from '../dominion/draft.js';
import { useCatalogLoad } from '../dominion/CatalogContext.jsx';
import { KingdomChip } from '../dominion/components/KingdomChips.jsx';
import { CardText, ShowTextButton } from '../dominion/components/bits.jsx';
import { PlaysScopeContext } from '../dominion/components/RandomizerOptions.jsx';
import { createNightHistory, viewOf } from '../lib/nightHistory.js';
import { RECOMMENDED, itemsOfSet } from '../dominion/recommended.js';
import { DEFAULT_OPTIONS, kingdomFromParams, kingdomToParams, newSeed, setupForHand, stateFromItems, withAvoid } from '../dominion/randomizer.js';
import { analyseKingdom, concernsOf } from '../dominion/analysis.js';
import { requestAnalyze } from '../dominion/analyzeBus.js';
import KingdomCheck from '../components/KingdomCheck.jsx';
import CountUp from '../components/CountUp.jsx';
import { pilesPlayed, playStats } from '../dominion/playStats.js';
import { impliedSets, primaryType, resolveKingdom, shelfOrder } from '../dominion/kingdom.js';

// the options a Game night roll starts from, and Reset goes back to: Attacks allowed, at most two
const KINGDOM_SIZE = 10;   // Kingdom cards in a full kingdom (the check before a kingdom is used says so when there are fewer)
const NIGHT_ROLL = { ...DEFAULT_OPTIONS, maxAttacks: 2 };

const storage = () => { try { return window.localStorage; } catch { return null; } };

/* EXPERIMENT (ux flag "flow"): logging a game as a guided evening instead of one long dialog — who's playing, the kingdom (roll
   one, pick by hand, or skip), a Play screen to keep open at the table, the final scores, then one last check before saving.
   Admin only (the server re-checks). Progress is kept in localStorage (per group, for up to half a day), so a reload, a look at a card, or another tab for a while loses nothing. */
// Keyed by the group: a Game night belongs to ONE group (its players, its saved progress, where the game is saved), so changing the group in the address bar or
// with the browser's back button starts that group's own night instead of carrying the other group's players and progress over.
export default function Night() {
  const { gid } = usePage();
  return <NightBoundary key={gid ?? 'none'} onReset={() => { if (storage()) for (let i = 0; i < MAX_TABLES; i++) clearNight(storage(), gid, i); }}><Tables /></NightBoundary>;
}

/* One or two tables playing at once (one shared device). Each table is a whole Game night of its own (NightFlow, saved in its own slot) and both stay mounted, the
   other one just hidden, so a game's clock, kingdom and unsaved scores are exactly as they were when switching back. The only thing the tables share is who is
   sitting where: a player can't be at both, so whoever is at one table is greyed out at the other. */
function Tables() {
  const [ask, confirmDialog] = useConfirm();
  const { gid, me, allGroups } = usePage();
  const [open, setOpen] = useState(() => (storage() && hasNight(storage(), gid, 1) ? 2 : 1));   // how many tables are running
  // which table is on screen: kept for the session, because picking a card by hand leaves this page and coming back remounts it (it would drop to Table 1)
  const tabKey = nightTabKey(gid);
  const [active, setActiveState] = useState(() => { try { return sessionStorage.getItem(tabKey) === '1' && storage() && hasNight(storage(), gid, 1) ? 1 : 0; } catch { return 0; } });
  const setActive = i => { setActiveState(i); try { sessionStorage.setItem(tabKey, String(i)); } catch { /* not remembered */ } };
  const [info, setInfo] = useState({});                          // slot -> { picked, step, startedAt, done }, reported by each table
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, []);
  const report = useMemo(() => [0, 1].map(i => v => setInfo(s => ({ ...s, [i]: v }))), []);
  const avoidAt = i => (info[1 - i] && !info[1 - i].done ? info[1 - i].kingdom || [] : []);   // the cards and landscapes in play at the other table: there is one copy of each
  const busyAt = i => (info[1 - i] && !info[1 - i].done ? info[1 - i].picked : []);
  const [seatReq, setSeatReq] = useState(null);                // { id, slots: { 0: [names], 1: [names] } }: a split of a crowd, handed to both tables
  const otherFree = i => !info[1 - i] || (info[1 - i].step === 'players' && !info[1 - i].done);   // the other table can be (re)seated while it is still on the player step
  const seat = (from, mine, theirs) => { setSeatReq({ id: Date.now(), slots: { [from]: mine, [1 - from]: theirs } }); setOpen(2); };
  const addTable = () => { setOpen(2); setActive(1); };
  const closeTable = async () => {
    const w = info[1];
    if (w && !w.done && (w.picked.length || w.step !== 'players') && !(await ask({ title: 'Close table 2?', text: 'Anything not saved there is lost.', confirmLabel: 'Close table', danger: true }))) return;
    if (storage()) clearNight(storage(), gid, 1);
    setInfo(s => ({ ...s, 1: undefined })); setOpen(1); setActive(0);
  };
  const admin = !!me;   // every signed-in player can host a table (a non-admin's result goes to the admin for approval)
  return (
    <>
      {confirmDialog}
      {admin && (
        <div className="night-tables" role="group" aria-label="Tables">
          {open === 1 ? <button type="button" className="ghost" onClick={addTable}>+ A second table</button> : (
            <>
              {[0, 1].map(i => (
                <button key={i} type="button" aria-pressed={active === i} className={'night-tab' + (active === i ? ' on' : '')} onClick={() => setActive(i)}>
                  <b>Table {i + 1}{allGroups.length > 1 ? ` · ${nameOfGroup(allGroups, gid)}` : ''}</b><span>{tableLabel(info[i], now)}</span>
                </button>
              ))}
              <button type="button" className="ghost night-tab-x" onClick={closeTable} aria-label="Close table 2">✕</button>
            </>
          )}
        </div>
      )}
      {Array.from({ length: open }, (_, i) => (
        <div key={i} hidden={active !== i}><NightFlow active={active === i} slot={i} busy={busyAt(i)} avoid={avoidAt(i)} onReport={report[i]} seatReq={seatReq} canSeat={otherFree(i)} onSeat={(a, b) => seat(i, a, b)} /></div>
      ))}
    </>
  );
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

function NightFlow({ active = true, slot = 0, busy = [], avoid = [], onReport, seatReq = null, canSeat = true, onSeat = () => {} }) {
  const { me, gid, D, allGroups, enabledSets, playerIdByName, hashFor, reload } = usePage();
  const cat = useCatalogLoad();
  const [st, setSt] = useState(() => (storage() ? loadNight(storage(), gid, undefined, undefined, slot) : blankNight()));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // the browser's Back / Forward arrows (lib/nightHistory.js): this screen's address, and what the arrows do. Only the table on screen takes part.
  const viewNow = viewOf(st), latest = useRef({}), hist = useRef(null), backing = useRef(false);
  latest.current.viewNow = viewNow;
  useEffect(() => {
    if (!active) return undefined;
    const h = hist.current = createNightHistory();
    h.start(latest.current.viewNow);
    const onPop = e => {
      const dir = h.popped(e.state);
      if (!dir || latest.current.done) return;   // not ours, or the game is already saved
      if (dir === 'back') latest.current.goBack(); else latest.current.goForward();
      setTimeout(() => h.settle(latest.current.viewNow), 80);
    };
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('popstate', onPop); hist.current = null; };
  }, [active]);
  useEffect(() => { if (hist.current) hist.current.changed(viewNow, { back: backing.current }); backing.current = false; }, [viewNow]);
  const [check, setCheck] = useState(null);   // the kingdom check: { concerns, analyse, go } while it is asked
  // every move forward or back in the flow (a step, a way of choosing a kingdom, a summary opening or closing, the list of recommended sets, a draft starting or ending) brings the top of the
  // content box into view, so the new screen is read from its first line and not from wherever the last one was scrolled to (most of all on a phone)
  const viewKey = [st.step, st.kingdomMode, st.randomDone, st.recPicking, st.draftSave?.draft ? 1 : 0, st.draftSave?.finished ? 1 : 0].join('|'), lastView = useRef(viewKey);
  useEffect(() => {
    if (viewKey !== lastView.current) requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('.night-card')?.scrollIntoView?.({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })));
    lastView.current = viewKey;
  }, [viewKey]);
  const okSig = useRef(null);               // the kingdom the table already said "start anyway" to
  const savedSt = useRef(null);                          // the form as it was when saved, for Undo
  const [undoing, setUndoing] = useState(false);
  const [done, setDone] = useState(null);                 // { id } after a successful save
  // every option of the Randomizer, the locked cards, the typed seed, the hand-pick panel and a snake draft in progress live in the saved night: a look at a card's page in the middle of setting up loses nothing
  const roll = st.rollOpts || NIGHT_ROLL;
  const setRollOpts = patch => setSt(s => ({ ...s, rollOpts: { ...(s.rollOpts || NIGHT_ROLL), ...patch } }));
  // how often each pile has been played, for the "favor cards we've played less" rule (null until the catalog is in, or with no kingdoms logged)
  // "Only this table's games" counts just the games one of the seated players sat at, so a card the whole group has played but nobody here has counts as new
  const plays = useMemo(() => {
    if (cat.status !== 'ready') return null;
    const stats = playStats(cat.catalog, D.games, me ? me.name : null);
    if (!stats.withKingdom) return null;
    if (!roll.favorTable || !st.picked.length) return pilesPlayed(stats);
    return pilesPlayed(playStats(cat.catalog, D.games.filter(g => st.picked.some(n => g.places && g.places[n] != null)), null));
  }, [cat.status, cat.catalog, D.games, me, roll.favorTable, st.picked]);
  // the rolled kingdom: held in memory after a roll, rebuilt from its saved compact form after a reload
  const rolled = useMemo(() => st.rolled || (cat.status === 'ready' && st.rolledQ ? kingdomFromParams(cat.catalog, new URLSearchParams(st.rolledQ)) : null), [st.rolled, st.rolledQ, cat.status, cat.catalog]);
  const [showText, setShowText] = useState(false);
  const [now, setNow] = useState(Date.now());
  const before = useRef({ ranks: {}, tiers: {} });          // the ladder just before saving, to say what the game changed

  useEffect(() => { if (storage() && !done) saveNight(storage(), gid, st, undefined, slot); }, [st, gid, done, slot]);
  // tell the tab strip who is seated here and how far along the table is
  // a split from either table seats this one with its half of the crowd (once per request)
  const seatedBy = useRef(null);
  useEffect(() => { if (seatReq && seatReq.id !== seatedBy.current && seatReq.slots[slot]) { seatedBy.current = seatReq.id; setSt(s => ({ ...s, picked: seatReq.slots[slot], tie: {} })); } }, [seatReq, slot]);
  useEffect(() => { if (onReport) onReport({ picked: st.picked, step: st.step, startedAt: st.startedAt, kingdom: st.kingdom, done: !!done }); }, [st.picked, st.step, st.startedAt, st.kingdom, done, onReport]);
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
  const clockMinutes = playedMinutes(st.startedAt, st.endedAt ?? Date.now());   // what the timer measured, for the Save step's Match time
  if (!me) return <><h1>Game night</h1><p className="empty">Sign in to host a table.</p></>;
  const isAdmin = !!me.is_admin;
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
  // a recommended set: its cards and landscapes as the kingdom (a hand-made one, so the setup notes are worked out from the cards), with the Bane the set names.
  // The game's expansions and landscape types are exactly what the set uses (not added to whatever was ticked before), as for a rolled kingdom
  const recommend = (kingdom, baneId, set = null) => {
    const implied = catalog ? impliedSets(resolveKingdom(catalog, kingdom)) : { sets: [], landscapes: [] };
    setSt(s => ({ ...s, kingdom, recPicking: false, recSet: set ? set.id : s.recSet, handEdited: true, handBane: baneId || null, randomDone: false, randomOriginal: null, rolled: null, rolledQ: null, kingdomTouched: true, sets: [...implied.sets], landscapes: [...implied.landscapes] }));
  };
  // "Reset" on a chosen recommended set: its own cards and landscapes again, after edits
  const recDef = st.recSet ? RECOMMENDED.find(r => r.id === st.recSet) : null;
  const recBase = catalog && recDef ? itemsOfSet(catalog, recDef) : null;
  // the recommended set to record with the game: only when the kingdom's cards are exactly the set's (none changed, removed or added; landscapes are not compared)
  const cardKey = list => list.filter(i => i.kind === 'card').map(i => i.id).sort().join('|');
  const usedRecommended = recBase && !recBase.missing.length && cardKey(recBase.items) === cardKey(st.kingdom) ? recDef.name : null;
  const itemKey = list => list.map(i => `${i.kind}:${i.id}:${i.on || ''}`).sort().join('|');
  const recChanged = !!recBase && !recBase.missing.length && itemKey(recBase.items) !== itemKey(st.kingdom);
  const resetRecommended = () => { if (recBase) recommend(recBase.items, recBase.baneId, recDef); };
  // the snake draft: Start rolls the pool (the options page's button is the bar at the bottom), Restart goes back to the options page and drops the kingdom
  const startDraft = () => {
    const v = draftState(st.draftSave, st.picked), res = rollPool(catalog, withAvoid(roll, avoid), newSeed(), { plays, n: DRAFT_PICKS, size: v.poolSize ?? poolSizeFor(v.seats.length) });
    setSt(s => ({ ...s, ...(res.ok ? { kingdom: [], rolled: null, rolledQ: null, handOpen: false, handEdited: false, handBane: null } : {}), draftSave: res.ok ? { ...v, draft: { seed: res.seed, options: res.options, n: res.n, size: res.size }, picks: [], banned: [], finished: false, error: '' } : { ...v, error: res.message } }));
  };
  const restartDraft = () => setSt(s => ({ ...s, kingdom: [], rolled: null, rolledQ: null, handOpen: false, handEdited: false, handBane: null, draftSave: { ...draftState(s.draftSave, s.picked), draft: null, picks: [], banned: [], finished: false, error: '' } }));
  // "Restart Drafting": the same pool, every pick and ban taken back, the first seat to go again (and no kingdom, if the draft had finished)
  const redoDraft = () => setSt(s => ({ ...s, kingdom: [], rolled: null, rolledQ: null, handOpen: false, handEdited: false, handBane: null, draftSave: { ...draftState(s.draftSave, s.picked), picks: [], banned: [], finished: false, error: '' } }));
  const setMode = kingdomMode => setSt(s => ({ ...s, kingdomMode, recPicking: kingdomMode === 'recommended' }));   // opening Recommended starts on the list of sets
  const next = () => { setMsg(''); setSt(s => advance(s)); };
  // before a kingdom is used: if the Analyze panel would flag something, ask once (per kingdom) whether to look or go on
  const withCheck = go => {
    if (!catalog || !items.length) { go(); return; }
    const slots = stateFromItems(catalog, items, st.handBane).slots, found = concernsOf(analyseKingdom(catalog, slots)), sig = items.map(i => i.id).join(',');
    // a short kingdom is worth a word too (a full one is 10 Kingdom cards)
    const concerns = slots.length < KINGDOM_SIZE ? [`Only ${slots.length} Kingdom card${slots.length === 1 ? '' : 's'}. A full kingdom has ${KINGDOM_SIZE}.`, ...found] : found;
    if (!concerns.length || okSig.current === sig) { go(); return; }
    setCheck({ concerns, analyse: found.length > 0, go: () => { okSig.current = sig; setCheck(null); go(); } });
  };
  const reviewKingdom = () => {
    const analyse = check?.analyse; setCheck(null);
    if (st.kingdomMode === 'random' || !st.kingdomMode) { if (st.randomDone) setSt(s => ({ ...s, randomDone: false })); if (analyse) requestAnalyze(); }   // the Analyze panel only when it has something to say
  };

  // ---- saving
  const save = async () => {
    if (st.picked.length < 2) { setMsg('Pick at least 2 players.'); return; }
    if (st.picked.length > MAX_PLAYERS) { setMsg(`A table seats at most ${MAX_PLAYERS} players.`); return; }
    if (!st.date) { setMsg('Pick a date.'); return; }
    savedSt.current = st;
    before.current = { ranks: Object.fromEntries(D.ranked.map(p => [p.name, p.rank])), tiers: Object.fromEntries(D.ranked.map(p => [p.name, p.tier.id])) };
    setSaving(true); setMsg('Saving…');
    // a player's table is sent to the admin to approve: nothing about it touches a rating until then. The clock is only trusted when it ran about as long as a game does.
    let call;
    const form = { ...st, editId: null, type: '', recommendedSet: usedRecommended };   // the recommended set's name goes with the game when its cards were kept as they came
    if (isAdmin) call = callGameRpc(sb, 'add_game', buildGameArgs(form, gid, playerIdByName));
    else {
      const args = buildGameArgs(form, gid, playerIdByName), t = trustedMinutes(st.startedAt, st.endedAt ?? Date.now(), usualMinutes(D.games));
      const typed = st.minutesEdit != null ? cleanMinutes(st.minutesEdit) : null;
      args.p_minutes = typed ?? t.minutes; args.p_clock_minutes = t.clock;
      if (typed == null && t.minutes == null) { delete args.p_started_at; delete args.p_ended_at; }   // a clock left running says nothing true
      call = callGameRpc(sb, 'submit_pending_game', args);
    }
    const { data, error } = await call;
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    if (storage()) clearNight(storage(), gid, slot);
    rememberNightGroup(gid);   // the next Game night opens in this group
    setMsg(''); setDone(isAdmin ? { id: data } : { pending: true });
    if (isAdmin) await reload();
  };
  // on the first step Back leaves the flow: to the page the viewer came from, or the rankings when there is none (a fresh tab)
  const goBack = () => {
    if (st.step === 'kingdom' && st.kingdomMode === 'draft' && st.draftSave?.draft) { restartDraft(); return; }   // a draft under way: back to its options page
    if (st.step === 'kingdom' && (st.kingdomMode === 'random' || st.kingdomMode === 'recommended') && st.randomDone) { setSt(s => ({ ...s, randomDone: false, randomOriginal: null })); return; }   // the summary: back to the roll
    if (st.step === 'kingdom' && st.kingdomMode === 'recommended' && !st.recPicking && st.kingdom.length) { setSt(s => ({ ...s, recPicking: true })); return; }   // a set is chosen: Back returns to the list of sets
    if (st.step === 'kingdom' && st.kingdomMode) { setMode(null); return; }   // inside a way of choosing, Back returns to the question
    if (st.step !== 'players') { setSt(s => back(s)); return; }
    if (window.history.length > 1) window.history.back(); else window.location.hash = hashFor('', gid);
  };
  latest.current.goBack = goBack; latest.current.done = done;
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
  // "Next game": the same players and the same kingdom, ready to change a few cards (each tile has Re-roll and Lock) before the next timer starts
  const nextGame = () => {
    const was = savedSt.current; if (!was) return;
    const items = (was.kingdom || []).filter(k => (k.kind === 'card' ? catalog?.cardsById.has(k.id) : catalog?.landscapesById.has(k.id)));
    if (!catalog || !items.length) { startOver(); return; }
    const implied = impliedSets(resolveKingdom(catalog, items));
    const fresh = withGameKingdom({ ...blankNight(), picked: was.picked.slice() }, { items, sets: implied.sets, landscapes: implied.landscapes });
    setSt({ ...fresh, kingdomMode: 'random', rollOpts: was.rollOpts || null });
    setDone(null); setMsg('');
  };
  const startOver = () => { if (storage()) clearNight(storage(), gid, slot); setSt(blankNight()); setDone(null); setMsg(''); };

  if (done && done.pending) return (
    <>
      <div className="head"><div><h1>Sent for approval</h1><p className="lede">{groupName ? `${groupName} — ` : ''}the admin will check the result and the standings update then.</p></div></div>
      <div className="night-card night-done">
        <p style={{ marginTop: 0 }}>Nothing is counted until it is approved. You can host another table in the meantime.</p>
        <p className="night-go">
          <a className="btn" href={hashFor('', gid)}>See the rankings</a>
          {(savedSt.current?.kingdom || []).length > 0 && <button type="button" className="ghost" onClick={nextGame} title="Same players and kingdom; change a few cards before you start">Next game, same kingdom</button>}
          <button type="button" className="ghost" onClick={startOver}>Log another</button>
        </p>
      </div>
    </>
  );
  if (done) return (
    <>
      <div className="head"><div><h1>Game saved</h1><p className="lede">{groupName ? `${groupName} — ` : ''}the standings are updated.</p></div></div>
      <div className="night-card night-done">
        <GameResult game={done.id != null ? D.games.find(x => x.line === done.id) : null} before={before.current} ranked={D.ranked} tierFor={D.tierFor} xp={leagueXp(D, catalog)} D={D} catalog={catalog} />
        <p className="night-go">
          <a className="btn" href={hashFor('', gid)}>See the rankings</a>
          <a className="btn ghost" href={done.id != null ? hashFor('games', gid, done.id) : hashFor('games', gid)}>See the game</a>
          {done.id != null && (savedSt.current?.kingdom || []).length > 0 && <button type="button" className="ghost" onClick={nextGame} title="Same players and kingdom; change a few cards before you start">Next game, same kingdom</button>}
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
  const atRecChosen = st.step === 'kingdom' && !!catalog && st.kingdomMode === 'recommended' && !st.recPicking && st.kingdom.length > 0 && !st.randomDone;   // a chosen set: its button turns it into the summary, as the Random screen's does
  // why the main button is greyed out (nothing when it can be pressed): fewer than 2 players, or no kingdom yet (skip it with its link) or a draft still on
  const holdOn = st.step === 'players' && st.picked.length < 2 ? 'Pick at least 2 players first'
    : st.step === 'players' && st.picked.length > MAX_PLAYERS ? `A table seats at most ${MAX_PLAYERS} players`
    : st.step === 'scores' && st.picked.some(n => !/^\s*-?\d+\s*$/.test(st.vp[n] ?? '')) ? 'Enter every player’s VP first'
    : st.step === 'kingdom' && st.kingdomMode === 'recommended' && st.recPicking ? 'Pick a set first'
    : atRandomRoll && !items.length ? 'Roll a kingdom first' : st.step === 'kingdom' && drafting ? 'Finish the draft first' : st.step === 'kingdom' && !items.length ? 'Set up a kingdom first, or skip it' : '';
  // "Use this kingdom": the Random or Recommended Sets screen closes into its summary (after the short-kingdom / Analyze check)
  const useKingdom = () => withCheck(() => setSt(s => ({ ...s, randomDone: true, handOpen: false, randomOriginal: (atRecChosen && recBase && !recBase.missing.length ? recBase.items : s.kingdom).filter(i => i.kind === 'card').map(i => i.id) })));
  const atDraftOptions = st.step === 'kingdom' && !!catalog && st.kingdomMode === 'draft' && !st.draftSave?.draft;   // the draft's options page: its button replaces Start Game & Timer
  // the page's own Back goes through the browser history when there is an earlier screen of this flow in it (so the arrows and the button stay one list), else it just goes back
  const pressBack = () => { if (hist.current && hist.current.index() > 0) window.history.back(); else { backing.current = true; goBack(); } };
  // a history Forward does what the main button does (never the final Save: an arrow must not save a game)
  const goForward = () => {
    if (st.step === 'review' || holdOn) return;
    if (atDraftOptions) startDraft(); else if (atRandomRoll || atRecChosen) useKingdom(); else if (st.step === 'kingdom') withCheck(next); else next();
  };
  latest.current.goForward = goForward;
  // shown at the table and on the last check in shelf order (expansion, then A to Z) with each expansion's icon, so a card is found in its box at a glance
  const shelved = list => list.slice().sort((a, b) => (a.missing ? 1 : 0) - (b.missing ? 1 : 0) || (a.missing || b.missing ? 0 : shelfOrder(a, b)));
  const kingdomCards = shelved(resolved.filter(r => r.kind === 'card')), kingdomLands = shelved(resolved.filter(r => r.kind === 'landscape'));

  return (
    <>
      <div className="head"><div><h1>Game night{allGroups.length > 1 && <span className="night-group" style={{ '--gh': groupHue(allGroups, gid) }}><i aria-hidden="true" />{groupName}</span>}</h1><p className="lede">A step-by-step way to log a game{groupName ? ` for ${groupName}` : ''}.</p></div></div>
      <ol className="night-steps" aria-label="Steps">
        {STEPS.map(s => <li key={s.id} className={s.id === st.step ? 'now' : stepNumber(s.id) < stepNumber(st.step) ? 'done' : ''} aria-current={s.id === st.step ? 'step' : undefined}><span>{stepNumber(s.id)}</span><em>{s.label}</em></li>)}
      </ol>

      <section className="night-card" aria-labelledby="night-h">
        {/* a chosen recommended set: the heading, then the set's name with its expansions' icons, then its two actions (Reset, and carrying the kingdom over to the Random screen) */}
        {st.step === 'kingdom' && st.kingdomMode === 'recommended' && !st.recPicking && !st.randomDone && st.kingdom.length > 0 ? (<>
          <h2 id="night-h" style={{ marginTop: 0 }}>{step.title}</h2>
          <div className="night-recrow">
          {recDef && <p className="night-recname" aria-label={`Recommended set: ${recDef.name}`}><b>{recDef.name}</b><span className="night-recicons">{recDef.sets.map(n => <SetIcon key={n} name={n} size={20} />)}</span></p>}
          <div className="night-recacts">
            <span className="night-headact">
              <button type="button" className="ghost" onClick={resetRecommended} disabled={!recChanged} title={recChanged ? `Put ${recDef.name} back as the rulebook has it` : 'Nothing has been changed yet'}>Reset</button>
              <button type="button" className="ghost" onClick={() => setMode('random')} title="Open this kingdom in the Random screen to lock cards, re-roll the rest, or roll again from it">Use in Random →</button>
            </span>
          </div>
          </div>
        </>) : <h2 id="night-h" style={{ marginTop: 0 }}>{step.title}</h2>}

        {st.step === 'players' && (
          <>
            {allGroups.length > 1 && (
              <div className="night-groupsel" role="group" aria-label="Which group is this game for?">
                <span className="meta">This game is for</span>
                <div className="pills">{allGroups.map(g => <a key={g.id} href={hashFor('night', g.id)} aria-current={g.id === gid ? 'true' : undefined} style={{ '--gh': groupHue(allGroups, g.id) }}><i aria-hidden="true" />{g.name}</a>)}</div>
              </div>
            )}
            <p className="meta">Tap everyone at the table.{busy.length ? ' Anyone already at the other table is greyed out.' : ''}</p>
            <PlayerPick roster={roster} games={D.games} picked={st.picked} busy={busy} max={MAX_SEATS}
              onToggle={n => { if (!st.picked.includes(n) && st.picked.length >= MAX_SEATS) { setMsg(`Two tables seat ${MAX_SEATS} at most.`); return; } setSt(s => ({ ...s, picked: toggle(s.picked, n), tie: {}, vp: s.vp })); }}
              onSet={names => setSt(s => ({ ...s, picked: names, tie: {}, vp: s.vp }))} />
            <p className="meta" role="status">{st.picked.length ? `${st.picked.length} player${st.picked.length === 1 ? '' : 's'}${st.picked.length < 2 ? ' — pick at least 2' : st.picked.length > MAX_PLAYERS ? ` — a table seats at most ${MAX_PLAYERS}` : ''}` : 'No one picked yet.'}</p>
            <SeatingHelp picked={st.picked} canSeat={canSeat} onSeat={onSeat} />
            {st.picked.length <= MAX_PLAYERS && <EloPreview picked={st.picked} />}
          </>
        )}

        {st.step === 'kingdom' && (
          !catalog ? (cat.status === 'error' ? <p className="meta">The card list isn’t available right now. You can skip the kingdom and still save the game. <button type="button" className="ghost" onClick={cat.retry}>Try again</button> <button type="button" className="linkish" onClick={() => setSt(s => advance({ ...s, kingdom: [] }))}>Skip the kingdom</button></p> : <p className="meta">Loading the card list…</p>) : (
            <PlaysScopeContext.Provider value><KingdomStep avoid={avoid} catalog={catalog} mode={st.kingdomMode} setMode={setMode} players={st.picked} roll={roll} setRollOpts={setRollOpts} resetRoll={() => setSt(s => ({ ...s, rollOpts: null, kept: null }))} kept={st.kept} onKeep={kept => setSt(s => ({ ...s, kept }))}
              hand={st.handOpen} setHand={handOpen => setSt(s => ({ ...s, handOpen }))} draftSave={st.draftSave} onDraft={draftSave => setSt(s => ({ ...s, draftSave }))} onRestartDraft={redoDraft}
              plays={plays} items={items} rolled={rolled} setupNow={setupNow} handEdited={st.handEdited} handBane={st.handBane} resolved={resolved} recDef={recDef} recChanged={recChanged} randomDone={st.randomDone} randomOriginal={st.randomOriginal} setRandomDone={randomDone => setSt(s => ({ ...s, randomDone, handOpen: randomDone ? false : s.handOpen, randomOriginal: randomDone ? s.kingdom.filter(i => i.kind === 'card').map(i => i.id) : null }))} applyKingdom={applyKingdom} onPick={pickByHand} onRecommend={recommend} picking={st.recPicking} onSkip={() => setSt(s => advance({ ...s, kingdom: [], kingdomMode: null }))}
              text={<KingdomText resolved={resolved} catalog={catalog} show={showText} setShow={setShowText} />} /></PlaysScopeContext.Provider>
          )
        )}

        {st.step === 'play' && (
          <>
            <p className="night-timer" role="timer" aria-live="off">{elapsed(st.startedAt, now)}</p>
            {items.length ? (
              <>
                <p className="meta" style={{ margin: '0 0 6px' }}>Tonight’s kingdom</p>
                <div className="dn-kchips">{kingdomCards.map(r => <KingdomChip key={r.id} r={r} plain expansion catalog={catalog} />)}</div>
                {kingdomLands.length > 0 && <div className="dn-kchips">{kingdomLands.map(r => <KingdomChip key={r.id} r={r} plain expansion catalog={catalog} />)}</div>}
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
            {allGroups.length > 1 && <p className="night-savingto" style={{ '--gh': groupHue(allGroups, gid) }}><i aria-hidden="true" />Saving to <b>{groupName}</b></p>}
            <div className="controls">
              <label className="f">Date <input type="date" value={st.date} onChange={e => patch({ date: e.target.value })} /></label>
            </div>
            <MatchTime clock={clockMinutes} value={st.minutesEdit} onChange={v => patch({ minutesEdit: v })} />
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

      {check && <KingdomCheck concerns={check.concerns} canReview={st.kingdomMode === 'random' || !st.kingdomMode} onReview={reviewKingdom} onGo={check.go} onClose={() => setCheck(null)} />}
      <div className="night-actions">
        <button type="button" className="ghost" onClick={pressBack}>← Back</button>
        {st.step === 'review'
          ? <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : isAdmin ? 'Save game' : 'Send for approval'}</button>
          : atDraftOptions ? <button type="button" onClick={startDraft}>Start the draft →</button>
          : atRandomRoll || atRecChosen ? <button type="button" onClick={useKingdom} disabled={!!holdOn} title={holdOn || undefined}>Use this kingdom →</button>
          : <button type="button" onClick={st.step === 'kingdom' ? () => withCheck(next) : next} disabled={!!holdOn} title={holdOn || undefined}>{st.step === 'kingdom' ? 'Start Game & Timer →' : st.step === 'play' ? 'Game over — scores →' : 'Next →'}</button>}
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
  if (setup.platinumColony) lines.push('Use Platinum and Colony.');   // only what to ADD or change: the ordinary game needs no reminder
  if (setup.shelters) lines.push('Use Shelters instead of Estates.');
  if (setup.ruins) lines.push('A Looter is in: add the Ruins pile.');
  return lines.length ? <ul className="dn-plain-list night-notes">{lines.map(l => <li key={l}>{l}</li>)}</ul> : null;
}

// The Save step's match time: what the timer measured, editable in whole minutes for a break in the middle or a clock left running. Typing is kept as text so
// clearing the box to type a new number does not snap back; a value that is not 1 to 1440 falls back to the timer.
export function MatchTime({ clock, value, onChange }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  const shown = text !== '' ? text : clock != null ? String(clock) : '';
  return (
    <label className="f night-minutes">Match time
      <input type="number" inputMode="numeric" min="1" max="1440" step="1" value={shown} placeholder="—"
        onChange={e => { setText(e.target.value); onChange(cleanMinutes(e.target.value)); }}
        onBlur={() => { if (cleanMinutes(text) == null) setText(''); }} /> min
      {value != null && clock != null && value !== clock && <button type="button" className="linkish" onClick={() => { setText(''); onChange(null); }}>use the timer ({clock} min)</button>}
    </label>
  );
}
