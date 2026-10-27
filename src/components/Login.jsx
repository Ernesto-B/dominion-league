import { useState } from 'react';
import { sb } from '../lib/supabase.js';
import { slugify } from '../lib/format.js';
import { useLeague } from '../League.jsx';

export default function Login({ title, error: bootError }) {
  const { boot } = useLeague();
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async e => {
    e.preventDefault();
    if (!name.trim() || !pw) return;
    setBusy(true);
    setError(null);
    const { error: authErr } = await sb.auth.signInWithPassword({ email: slugify(name.trim()) + '@dominion.local', password: pw });
    if (authErr) { setError('Could not sign in. Check the name and password.'); setBusy(false); return; }
    await boot();
    setBusy(false);
  };

  const shown = error || bootError;
  return (
    <form className="builder" style={{ maxWidth: 360, margin: '60px auto 0' }} onSubmit={go}>
      <h1 style={{ fontSize: 28 }}>Sign in</h1>
      <p className="lede">{title || 'Dominion Night'}</p>
      {shown && <p className="note" style={{ color: 'var(--brick)' }}>{shown}</p>}
      <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <label className="f">Name <input type="text" id="liName" autoComplete="username" value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="f">Password <input type="password" id="liPw" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      </div>
      <button id="liGo" type="submit" disabled={busy}>Sign in</button>
    </form>
  );
}
