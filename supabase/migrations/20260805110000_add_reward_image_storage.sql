-- Reward catalog images: a public Storage bucket so admins can upload a
-- real product photo from admin-rewards.tsx instead of pasting a hosted
-- URL by hand. Only admins can write (reward_catalog itself is already
-- admin-only per the policies in 20260805090000), everyone can read since
-- the catalog is public. Uploads go to "{admin_uid}/{timestamp}.jpg" --
-- same per-uploader-folder shape as tournament-banners/profile-photos --
-- but the actual write gate is is_admin, not folder ownership, since any
-- admin should be able to manage any reward's image, not just their own.

insert into storage.buckets (id, name, public)
values ('reward-images', 'reward-images', true)
on conflict (id) do nothing;

create policy "Anyone can view reward images"
  on storage.objects for select
  using (bucket_id = 'reward-images');

create policy "Admins can upload reward images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reward-images'
    and exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "Admins can update reward images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'reward-images'
    and exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "Admins can delete reward images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reward-images'
    and exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
  );
