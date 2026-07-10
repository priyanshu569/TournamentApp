-- Tournament banner images: a public Supabase Storage bucket + a banner_url
-- column on tournaments. Uploads go to a path prefixed with the uploader's own
-- auth.uid() (e.g. "{uid}/{timestamp}.jpg"), so storage RLS only needs to check
-- "is this your own folder" — it doesn't need to know which tournament the
-- banner belongs to. Attaching a banner_url to a specific tournament row is
-- already gated by the existing "Hosts can update own tournaments" policy, so
-- a user uploading a file doesn't imply they can attach it to someone else's
-- tournament.

alter table public.tournaments
  add column banner_url text;

comment on column public.tournaments.banner_url is
  'Public URL of the tournament banner image in the tournament-banners storage bucket, if one has been uploaded.';

insert into storage.buckets (id, name, public)
values ('tournament-banners', 'tournament-banners', true)
on conflict (id) do nothing;

create policy "Anyone can view tournament banners"
  on storage.objects for select
  using (bucket_id = 'tournament-banners');

create policy "Users can upload their own tournament banners"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tournament-banners'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own tournament banners"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tournament-banners'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own tournament banners"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tournament-banners'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
