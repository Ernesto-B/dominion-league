// Admin-only: creates a new player's login account and players row.
// Deployed to Supabase (not GitHub Pages) — see README for the one-time
// `supabase functions deploy create-player` setup.
//
// Needs the service-role key to call the Auth Admin API, which must never
// reach the browser. Supabase auto-injects SUPABASE_URL, SUPABASE_ANON_KEY,
// and SUPABASE_SERVICE_ROLE_KEY into every deployed function's environment —
// nothing to configure by hand.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PRESET_PASSWORD = 'dominion';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep identical to slugify() in js/app.js's login screen and scripts/migrate.mjs —
// all three must derive the same fixed login email from a given name.
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    const { data: me, error: meErr } = await serviceClient
      .from('players').select('is_admin').eq('id', user.id).single();
    if (meErr || !me?.is_admin) return json({ error: 'Only the admin can add players.' }, 403);

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const group_ids = Array.isArray(body.group_ids) ? body.group_ids.map((g: unknown) => String(g).trim()).filter(Boolean) : [];
    if (!name) return json({ error: 'Name is required.' }, 400);
    if (!group_ids.length) return json({ error: 'At least one group is required.' }, 400);

    const { data: foundGroups } = await serviceClient.from('groups').select('id').in('id', group_ids);
    const missing = group_ids.filter((g: string) => !(foundGroups || []).some(fg => fg.id === g));
    if (missing.length) return json({ error: `No group with id "${missing[0]}".` }, 400);

    const slug = slugify(name);
    if (!slug) return json({ error: 'That name produced an empty login id — try adding a letter.' }, 400);
    const email = `${slug}@dominion.local`;

    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email, password: PRESET_PASSWORD, email_confirm: true,
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message || 'Could not create the account (name may already be taken).' }, 400);
    }

    const { error: insertErr } = await serviceClient.from('players').insert({
      id: created.user.id, name, group_ids, is_admin: false, must_change_password: true,
    });
    if (insertErr) {
      // Don't leave a dangling auth account with no players row behind.
      await serviceClient.auth.admin.deleteUser(created.user.id);
      return json({ error: insertErr.message }, 400);
    }

    return json({ ok: true, name, email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
