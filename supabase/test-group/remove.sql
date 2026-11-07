-- Removes everything create.sql made (the group 'test', its players and logins, games, kingdoms and season), and nothing else.
-- Run: supabase db query --linked -f supabase/test-group/remove.sql
do $$
begin
  if to_regclass('public.pending_games') is not null then delete from pending_games where group_id = 'test'; end if;
  delete from games where group_id = 'test';                       -- game_results and game_kingdom go with them
  delete from seasons where group_id = 'test';
  delete from auth.users where id in (select id from players where group_ids = array['test']);   -- only players that belong to the test group alone (their players rows go with them)
  delete from groups where id = 'test';
end $$;
