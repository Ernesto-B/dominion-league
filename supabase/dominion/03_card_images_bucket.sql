-- The card pictures: a PRIVATE storage bucket that only signed-in members of the league can read.
-- Safe to run again (the bucket is upserted, the policy is dropped and created). Nothing here lets a browser WRITE: there is deliberately no insert / update / delete policy,
-- so only the project owner's tools can add pictures (`npm run cards:upload`, which uses the Supabase CLI's own login).
--
-- A private bucket cannot be used as a plain <img src>: the site downloads each picture with the member's session and keeps it on the device
-- (src/dominion/cardImages.js), so a picture is fetched at most once per device.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', false, 2097152, array['image/webp', 'application/json'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "card_images_read" on storage.objects;
create policy "card_images_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'card-images');
