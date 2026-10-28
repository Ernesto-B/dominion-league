// Admin-only password recovery. The temporary password is returned just once
// to the admin, who must verify the player out of band before sharing it.
// This function is deliberately the only place that may use the Auth Admin
// API for resets; its service-role key never reaches the browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function temporaryPassword() {
  // Web Crypto is available in Supabase Edge Functions. Avoid punctuation so
  // the admin can safely read the one-time password aloud or copy it.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Not signed in.' }, 401);

    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: admin, error: adminErr } = await serviceClient
      .from('players').select('is_admin').eq('id', user.id).single();
    if (adminErr || !admin?.is_admin) return json({ error: 'Only the admin can reset passwords.' }, 403);

    const body = await req.json().catch(() => ({}));
    const playerId = String(body.player_id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
      return json({ error: 'Choose a valid player.' }, 400);
    }
    const { data: player, error: playerErr } = await serviceClient
      .from('players').select('id, name').eq('id', playerId).single();
    if (playerErr || !player) return json({ error: 'That player no longer exists.' }, 404);

    const password = temporaryPassword();
    const { error: passwordErr } = await serviceClient.auth.admin.updateUserById(playerId, { password });
    if (passwordErr) return json({ error: 'Could not reset that password.' }, 500);

    // Supabase terminates the player's sessions when their password changes;
    // existing short-lived access JWTs can remain valid only until expiry.
    const { error: flagErr } = await serviceClient.from('players')
      .update({ must_change_password: true }).eq('id', playerId);
    if (flagErr) return json({ error: 'Password reset, but the password-change requirement could not be saved. Try again.' }, 500);

    return json({ ok: true, name: player.name, temporary_password: password });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
