-- A throwaway "Test group" to try things on (the host-a-table / pending-games flow, the randomizer, Game night) without touching the real group.
-- Everything it makes is new and lives under the group id 'test' and the logins test-*@dominion.local; it reads and writes nothing of the real group's.
-- Run:    supabase db query --linked -f supabase/test-group/create.sql
-- Remove: supabase db query --linked -f supabase/test-group/remove.sql
-- The six players log in with their name's login (e.g. test-ann@dominion.local, shown on the sign-in screen as the name "Test Ann") and the password `dominion`.
-- Safe to run twice: it stops with a message if the group already exists.
do $$
declare
  names text[] := array['Test Ann', 'Test Bob', 'Test Cy', 'Test Dee', 'Test Eve', 'Test Fay'];
  ids uuid[] := '{}';
  n text; uid uuid; slug text; gid bigint; i int;
  -- a game: date, type, minutes, then [player index, place, vp]; kingdoms are picked from these lists
  base text[] := array['dominion-base-game:cellar','dominion-base-game:chapel','dominion-base-game:moat','dominion-base-game:village','dominion-base-game:workshop','dominion-base-game:militia','dominion-base-game:remodel','dominion-base-game:smithy','dominion-base-game:market','dominion-base-game:laboratory','dominion-base-game:witch','dominion-base-game:festival'];
  sea text[]  := array['seaside:haven','seaside:lighthouse','seaside:native-village','seaside:fishing-village','seaside:caravan','seaside:cutpurse','seaside:island','seaside:warehouse','seaside:monkey','seaside:smugglers','seaside:blockade','seaside:lookout'];
  g jsonb;
  games jsonb := '[
    {"d":"2026-10-03","m":41,"k":"b","r":[[1,1,34],[2,2,27],[3,3,19],[4,4,11]]},
    {"d":"2026-10-03","m":36,"k":"s","r":[[5,1,29],[6,2,24],[1,3,18]]},
    {"d":"2026-10-10","m":28,"k":"b","r":[[2,1,40],[3,2,31]]},
    {"d":"2026-10-10","m":44,"k":"s","r":[[1,1,38],[4,2,33],[5,3,21],[6,4,12]]},
    {"d":"2026-10-17","m":39,"k":"b","r":[[3,1,36],[1,2,30],[2,3,30],[4,4,14]]},
    {"d":"2026-10-17","m":33,"k":"s","r":[[6,1,31],[5,2,22],[4,3,9]]},
    {"d":"2026-10-24","m":47,"k":"b","r":[[1,1,42],[2,2,35],[3,3,26],[4,4,18],[5,5,10]]},
    {"d":"2026-10-24","m":25,"k":"s","r":[[5,1,33],[6,2,25]]},
    {"d":"2026-10-31","m":40,"k":"b","r":[[4,1,37],[1,2,32],[6,3,20],[2,4,13]]},
    {"d":"2026-10-31","m":35,"k":"s","r":[[3,1,30],[5,2,26],[2,3,17]]},
    {"d":"2026-11-05","m":43,"k":"b","r":[[1,1,39],[3,2,28],[5,3,23],[6,4,15]]},
    {"d":"2026-11-05","m":31,"k":"s","r":[[2,1,35],[4,2,27],[6,3,16]]}
  ]';
  kd text[]; pos int;
begin
  if exists (select 1 from groups where id = 'test') then raise exception 'The test group already exists (run remove.sql first to start again).'; end if;
  insert into groups (id, name) values ('test', 'Test group');

  foreach n in array names loop
    uid := gen_random_uuid();
    slug := regexp_replace(lower(n), '[^a-z0-9]+', '-', 'g');
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new, is_sso_user, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', slug || '@dominion.local', extensions.crypt('dominion', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"email_verified":true}', now(), now(), '', '', '', '', false, false);
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', slug || '@dominion.local', 'email_verified', false, 'phone_verified', false), 'email', now(), now(), now());
    insert into players (id, name, group_ids, is_admin, must_change_password) values (uid, n, array['test'], false, false);
    ids := ids || uid;
  end loop;

  insert into seasons (group_id, name, start_date, weeks, target_games) values ('test', 'Test season', '2026-10-01', 8, 6);

  for g in select * from jsonb_array_elements(games) loop
    insert into games (date, type, sets, minutes, group_id, notes)
    values ((g->>'d')::date, '', case when g->>'k' = 'b' then 'Dominion Base Game' else 'Seaside' end, (g->>'m')::int, 'test', null)
    returning id into gid;
    for i in 0 .. jsonb_array_length(g->'r') - 1 loop
      insert into game_results (game_id, player_id, place, vp)
      values (gid, ids[(g->'r'->i->>0)::int], (g->'r'->i->>1)::int, (g->'r'->i->>2)::int);
    end loop;
    kd := case when g->>'k' = 'b' then base else sea end;
    for pos in 1 .. 10 loop
      -- a different ten of the twelve each game, so the kingdoms vary
      insert into game_kingdom (game_id, kind, item_id, position)
      select gid, 'card', kd[((pos - 1 + (gid % 3)) % 12) + 1], pos - 1 on conflict do nothing;
    end loop;
  end loop;
  raise notice 'Test group created: 6 players, 12 games.';
end $$;
