import { useState } from 'react';
import { sb } from '../lib/supabase.js';
import { useLeague } from '../League.jsx';

export default function PasswordChange({ me }) {
  const { boot } = useLeague();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async e => {
    e.preventDefault();
    if (a.length < 8) { setError('Use at least 8 characters.'); return; }
    if (a !== b) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: upErr } = await sb.auth.updateUser({ password: a });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    await sb.rpc('mark_password_changed');
    await boot();
    setBusy(false);
  };

  return (
    <form className="builder" style={{ maxWidth: 360, margin: '60px auto 0' }} onSubmit={go}>
      <h1 style={{ fontSize: 28 }}>Set a password</h1>
      <p className="lede">Signed in as {me.name}. Pick a new password — the one you used to sign in just now was only a placeholder.</p>
      {error && <p className="note" style={{ color: 'var(--brick)' }}>{error}</p>}
      <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <label className="f">New password <input type="password" id="pwNew" autoComplete="new-password" value={a} onChange={e => setA(e.target.value)} /></label>
        <label className="f">Confirm <input type="password" id="pwConf" autoComplete="new-password" value={b} onChange={e => setB(e.target.value)} /></label>
      </div>
      <button id="pwGo" type="submit" disabled={busy}>Save and continue</button>
    </form>
  );
}
