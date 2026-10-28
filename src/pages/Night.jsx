import { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '../PageContext.js';
import { sb } from '../lib/supabase.js';
import { SET_NAMES, LANDSCAPES } from '../lib/sets.js';
import { buildGameArgs, resortByVP, toggle } from '../lib/gameForm.js';
import { STEPS, advance, back, blankNight, canAdvance, clearNight, elapsed, gameSummary, loadNight, saveNight, stepNumber } from '../lib/night.js';
import NameIcon from '../components/NameIcon.jsx';
import SetIcon from '../components/SetIcon.jsx';
import EloPreview from '../components/EloPreview.jsx';
import FinishOrder from '../components/FinishOrder.jsx';
import KingdomPicker from '../components/KingdomPicker.jsx';
import { useCatalogLoad } from '../dominion/CatalogContext.jsx';
import { KingdomChip } from '../dominion/components/KingdomChips.jsx';
import { CardText } from '../dominion/components/bits.jsx';
import { DEFAULT_OPTIONS, kingdomFromParams, kingdomToParams, toGameItems } from '../dominion/randomizer.js';
import SnakeDraft from '../dominion/components/SnakeDraft.jsx';
import CountUp from '../components/CountUp.jsx';
import RandomizerPanel from '../dominion/components/RandomizerPanel.jsx';
import { pilesPlayed, playStats } from '../dominion/playStats.js';
import { impliedSets, primaryType, resolveKingdom } from '../dominion/kingdom.js';

const storage = () => { try { return window.sessionStorage; } catch { return null; } };

/* EXPERIMENT (ux flag "flow"): logging a game as a guided evening instead of one long dialog — who's playing, the kingdom (roll
   one, pick by hand, or skip), a Play screen to keep open at the table, the final scores, then one last check before saving.
   Admin only (the server re-checks). Progress is kept in sessionStorage, so a reload, or a look at a card, loses nothing. */
export default function Night() {
  const { me, gid, D, allGroups, enabledSets, playerIdByName, hashFor, reload } = usePage();
  const cat = useCatalogLoad();
  const [st, setSt] = useState(() => (storage() ? loadNight(storage(), gid) : blankNight()));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const savedSt = useRef(null);                          // the form as it was when saved, for Undo
  const [undoing, setUndoing] = useState(false);
  const [done, setDone] = useState(null);                 // { id } after a successful save
  const [roll, setRoll] = useState(DEFAULT_OPTIONS);          // every option of the Randomizer, here too
  const setRollOpts = patch => setRoll(r => ({ ...r, ...patch }));
  // how often each pile has been played, for the "favor cards we've played less" rule (null until the catalog is in, or with no kingdoms logged)
  const plays = useMemo(() => {
    if (cat.status !== 'ready') return null;
    const stats = playStats(cat.catalog, D.games, me ? me.name : null);
    return stats.withKingdom ? pilesPlayed(stats) : null;
  }, [cat.status, cat.catalog, D.games, me]);
  // the rolled kingdom: held in memory after a roll, rebuilt from its saved compact form after a reload
  const rolled = useMemo(() => st.rolled || (cat.status === 'ready' && st.rolledQ ? kingdomFromParams(cat.catalog, new URLSearchParams(st.rolledQ)) : null), [st.rolled, st.rolledQ, cat.status, cat.catalog]);
  const [showText, setShowText] = useState(false);
  const [drafting, setDrafting] = useState(false);            // the Kingdom step's snake draft (in memory only)
  const [now, setNow] = useState(Date.now());
  const before = useRef({ ranks: {}, tiers: {} });          // the ladder just before saving, to say what the game changed

  useEffect(() => { if (storage() && !done) saveNight(storage(), gid, st); }, [st, gid, done]);
  useEffect(() => { if (st.step !== 'play') return undefined; const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, [st.step]);
  useEffect(() => { window.scrollTo(0, 0); }, [st.step, done]);

  const groupName = (allGroups.find(g => g.id === gid) || {}).name;
  const roster = D.roster.slice().sort((a, b) => a.localeCompare(b));
  const patch = p => setSt(s => ({ ...s, ...p }));
  if (!me || !me.is_admin) return <><h1>Game night</h1><p className="empty">Only the admin can log a game.</p></>;
  const catalog = cat.status === 'ready' ? cat.catalog : null;
  const items = st.kingdom;
  const resolved = catalog ? resolveKingdom(catalog, items) : [];

  // ---- the kingdom
  const applyKingdom = (kingdom, rolled = null) => {
    const implied = catalog ? impliedSets(resolveKingdom(catalog, kingdom)) : { sets: [], landscapes: [] };
    setSt(s => ({ ...s, kingdom, kingdomTouched: true, rolled, rolledQ: rolled ? kingdomToParams(rolled).toString() : null, sets: [...new Set([...(rolled ? [] : s.sets), ...implied.sets])], landscapes: [...new Set([...(rolled ? [] : s.landscapes), ...implied.landscapes])] }));
  };

  // ---- saving
  const save = async () => {
    if (st.picked.length < 2) { setMsg('Pick at least 2 players.'); return; }
    if (!st.date) { setMsg('Pick a date.'); return; }
    savedSt.current = st;
    before.current = { ranks: Object.fromEntries(D.ranked.map(p => [p.name, p.rank])), tiers: Object.fromEntries(D.ranked.map(p => [p.name, p.tier.id])) };
    setSaving(true); setMsg('Saving…');
    const { data, error } = await sb.rpc('add_game', buildGameArgs({ ...st, editId: null }, gid, playerIdByName));
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    if (storage()) clearNight(storage(), gid);
    setMsg(''); setDone({ id: data });
    await reload();
  };
  // on the first step Back leaves the flow: to the page the viewer came from, or the rankings when there is none (a fresh tab)
  const goBack = () => {
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
        <GameResult game={done.id != null ? D.games.find(x => x.line === done.id) : null} before={before.current} ranked={D.ranked} tierFor={D.tierFor} />
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
  const ok = canAdvance(st.step, st);
  const kingdomCards = resolved.filter(r => r.kind === 'card'), kingdomLands = resolved.filter(r => r.kind === 'landscape');

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
          <>
            {!catalog ? (cat.status === 'error' ? <p className="meta">The card list isn’t available right now. You can skip the kingdom and still save the game. <button type="button" className="ghost" onClick={cat.retry}>Try again</button></p> : <p className="meta">Loading the card list…</p>) : (
              <>
                <p className="meta">Roll a kingdom exactly as in the Randomizer, pick the cards yourself, or skip this step.</p>
                {drafting
                  ? <SnakeDraft catalog={catalog} players={st.picked} opts={roll} setOpts={setRollOpts} plays={plays}
                      onDone={res => { applyKingdom(toGameItems(res), res); setDrafting(false); }} onCancel={() => setDrafting(false)} />
                  : <>
                <p className="meta" style={{ marginBottom: 6 }}>Or take turns choosing it: <button type="button" className="linkish" onClick={() => setDrafting(true)}>Snake draft</button></p>
                <RandomizerPanel catalog={catalog} opts={roll} setOpts={setRollOpts} state={rolled} plays={plays} heading={false} emptyHint={false}
                  onState={res => applyKingdom(toGameItems(res), res)} onReset={() => setRoll(DEFAULT_OPTIONS)} />
                  </>}
                <details className="dn-mech night-hand" open={!!items.length && !rolled}><summary>{items.length && !rolled ? 'Your kingdom — change it if you like' : 'Or pick the cards by hand'}</summary>
                  <KingdomPicker items={items} onChange={(kingdom, implied) => setSt(s => ({ ...s, kingdom, rolled: null, rolledQ: null, kingdomTouched: true, sets: [...new Set([...s.sets, ...implied.sets])], landscapes: [...new Set([...s.landscapes, ...implied.landscapes])] }))} />
                </details>
                {items.length > 0 && !rolled && <KingdomText resolved={resolved} catalog={catalog} show={showText} setShow={setShowText} />}
              </>
            )}
          </>
        )}

        {st.step === 'play' && (
          <>
            <p className="night-timer" role="timer" aria-live="off">{elapsed(st.startedAt, now)}</p>
            {items.length ? (
              <>
                <p className="meta" style={{ margin: '0 0 6px' }}>Tonight’s kingdom</p>
                <div className="dn-kchips">{kingdomCards.map(r => <KingdomChip key={r.id} r={r} plain />)}</div>
                {kingdomLands.length > 0 && <div className="dn-kchips">{kingdomLands.map(r => <KingdomChip key={r.id} r={r} plain />)}</div>}
                {rolled && rolled.setup && <RolledNotes setup={rolled.setup} />}
                <KingdomText resolved={resolved} catalog={catalog} show={showText} setShow={setShowText} />
              </>
            ) : <p className="meta">No kingdom was picked. Have a great game — come back here when it ends.</p>}
            <p className="night-players meta">{st.picked.join(' · ')}</p>
          </>
        )}

        {st.step === 'scores' && (
          <>
            <p className="meta">Enter each player’s VP and the order sorts itself, ties included. No VP tracked? Use the arrows and the “tied” box.</p>
            <FinishOrder bs={st} setBs={setSt} resort={resortByVP} />
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
            {items.length > 0 && <><p className="meta" style={{ margin: '12px 0 4px' }}>Kingdom ({kingdomCards.length} card{kingdomCards.length === 1 ? '' : 's'}{kingdomLands.length ? `, ${kingdomLands.length} landscape${kingdomLands.length === 1 ? '' : 's'}` : ''})</p><div className="dn-kchips">{resolved.map(r => <KingdomChip key={`${r.kind}:${r.id}`} r={r} plain />)}</div></>}
            <label className="f" style={{ marginTop: 12 }}>Notes <input type="text" size={40} value={st.notes} onChange={e => patch({ notes: e.target.value })} /></label>
            {msg && <p className="dn-rz-msg" role="alert">{msg}</p>}
          </>
        )}
      </section>

      <div className="night-actions">
        <button type="button" className="ghost" onClick={goBack}>← Back</button>
        {st.step === 'review'
          ? <button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save game'}</button>
          : <button type="button" onClick={() => { setMsg(''); setSt(s => advance(s)); }} disabled={!ok}>{st.step === 'kingdom' ? (items.length ? 'Next →' : 'Skip →') : st.step === 'play' ? 'Game over — scores →' : 'Next →'}</button>}
      </div>
      <p className="meta night-reset"><button type="button" className="linkish" onClick={startOver}>Start over</button></p>
    </>
  );
}

// what the saved game did: each player's Elo, their move on the ladder, and any tier crossed
function GameResult({ game, before, ranked, tierFor }) {
  const rows = gameSummary(game, before, ranked, tierFor);
  if (!game) return <p className="meta" style={{ marginTop: 0 }}>Updating the standings…</p>;
  if (!rows) return <p style={{ marginTop: 0 }}>Nice game. This one doesn’t change anyone’s rating.</p>;
  return (
    <>
      <p style={{ marginTop: 0 }}>Nice game. Here’s what it did:</p>
      <ol className="night-result night-did">{rows.map((r, i) => (
        <li key={r.name} style={{ '--i': i }}>
          <b>{r.name}</b> <span className={r.delta > 0 ? 'up-t' : r.delta < 0 ? 'down-t' : ''}>{r.delta > 0 ? '+' : r.delta < 0 ? '−' : ''}<CountUp value={Math.abs(r.delta)} ms={800} /></span>
          <span className="meta"> · {r.before} → {r.after}{r.rankAfter != null && <> · #{r.rankAfter}</>}</span>
          {r.rankMove !== 0 && <span className={r.rankMove > 0 ? 'up-t' : 'down-t'}> {r.rankMove > 0 ? '▲' : '▼'}{Math.abs(r.rankMove)}</span>}
          {r.tierUp && <span className="pill ok"> now a {r.tierUp.name}</span>}
          {r.tierDown && <span className="pill warn"> down to {r.tierDown.name}</span>}
        </li>
      ))}</ol>
    </>
  );
}

// "Show card text" and the text of every card and landscape in the kingdom: on the Kingdom step (to judge a roll) and at the table
function KingdomText({ resolved, catalog, show, setShow }) {
  return (
    <>
      <label className="dn-check" style={{ margin: '10px 0' }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show card text</label>
      {show && <ul className="dn-plain-list night-text">{resolved.filter(r => !r.missing).map(r => <li key={`${r.kind}:${r.id}`} className={'t-' + (r.kind === 'landscape' ? r.obj.type : primaryType(r.obj) || 'action').toLowerCase()}><b>{r.obj.name}</b>{catalog && <CardText text={r.obj.text} hasAnyText={catalog.meta.textRecordCount > 0} />}</li>)}</ul>}
    </>
  );
}

// the setup lines of a rolled kingdom (the same facts as the Randomizer's Setup section, in one short list)
function RolledNotes({ setup }) {
  const lines = [];
  if (setup.bane) lines.push(`Young Witch needs a Bane: ${setup.bane.name}.`);
  if (setup.platinumColony != null) lines.push(setup.platinumColony ? 'Use Platinum and Colony.' : 'No Platinum or Colony.');
  if (setup.shelters != null) lines.push(setup.shelters ? 'Use Shelters instead of Estates.' : 'Use Estates (no Shelters).');
  if (setup.ruins) lines.push('A Looter is in: add the Ruins pile.');
  return lines.length ? <ul className="dn-plain-list night-notes">{lines.map(l => <li key={l}>{l}</li>)}</ul> : null;
}
