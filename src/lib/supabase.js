import { createClient } from '@supabase/supabase-js';

/* Safe to commit: these are the public project URL and the publishable
   "anon" key, meant to ship in client-side code. Real access control comes
   from the Row Level Security policies in supabase/schema.sql, not from
   keeping this secret. */
export const SUPABASE_URL = 'https://hwwwpddinirdrxvvphgl.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_EHhdfsgPE5PUzQhRyxx4tQ_xcQ2vmtL';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
