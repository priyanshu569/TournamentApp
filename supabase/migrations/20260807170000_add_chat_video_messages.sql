-- Video chat messages, up to 60 seconds, compressed client-side before
-- upload. Reuses the chat-images bucket (no size/mime restriction set on
-- it, and it's already private + conversation-scoped via RLS) rather
-- than standing up a near-identical bucket just for video -- path
-- convention stays "{conversation_id}/{sender_id}/{timestamp}.ext",
-- same as every other media type there.
--
-- video_thumbnail_url is a separate uploaded JPEG (a static frame
-- grabbed client-side), not derived server-side -- lets the chat list
-- render instantly like an image message instead of needing to open
-- the video just to show a preview.

alter table public.messages
  add column video_url text,
  add column video_thumbnail_url text,
  add column video_width integer,
  add column video_height integer,
  add column video_duration_seconds integer;

comment on column public.messages.video_url is
  'Storage path (not a public URL -- bucket is private) of a video message in the chat-images bucket, if this message is one. Capped at 60 seconds, compressed client-side before upload.';
comment on column public.messages.video_thumbnail_url is
  'Storage path of a static preview-frame JPEG for the video, generated and uploaded client-side alongside it.';

-- The 4-heavy-media/day cap previously only counted photos (image_url)
-- and view-once sends. Video is heavier than either, so it needs to
-- count too, not get its own separate unbounded allowance -- same cap,
-- broader definition of "media" for what counts against it.
create or replace function public.count_recent_own_messages(p_window interval, p_image_or_view_once_only boolean default false)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.messages
  where sender_id = auth.uid()
    and created_at > now() - p_window
    and (not p_image_or_view_once_only or image_url is not null or view_once or video_url is not null);
$$;

alter policy "Participants can send messages" on public.messages
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
    and not exists (
      select 1
      from public.conversations c
      join public.conversation_participants other
        on other.conversation_id = c.id and other.user_id <> auth.uid()
      join public.blocks b
        on (b.blocker_id = other.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = other.user_id)
      where c.id = messages.conversation_id and c.conversation_type = 'direct'
    )
    and (
      exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
      or public.count_recent_own_messages(interval '1 minute') < 60
    )
    and (
      (image_url is null and not coalesce(view_once, false) and video_url is null)
      or exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
      or public.count_recent_own_messages(interval '1 day', true) < 4
    )
  );
