-- Closes two gaps in view-once photos:
--
-- 1. The raw storage path lived in messages.image_url like any other
--    photo, so it went out to every participant (sender included) the
--    moment the row was created -- via the ordinary messages select AND
--    the messages_${id} realtime channel in chat-thread.tsx -- long
--    before anyone tapped "reveal". reveal_view_once_message's checks
--    ("not your own photo", "already viewed") never came into play,
--    because nothing forced a client to go through it to get the path.
--
-- 2. The underlying storage object was never deleted after viewing (see
--    20260730080000_add_view_once_photos.sql's own comment), so a path
--    captured via #1 stayed valid to re-sign forever.
--
-- Together, "view once" was a UI convention the official app happened
-- to honor, not something the backend enforced.
--
-- Fix: the path now lives in a side table with NO client select policy
-- at all -- unreachable except through reveal_view_once_message
-- (SECURITY DEFINER, bypasses RLS), which still runs every authorization
-- check it always did. Once revealed, the client deletes the object
-- itself via a narrowly-scoped storage policy that only authorizes
-- deleting a path this table knows about, and only after its message has
-- actually been revealed.

create table public.view_once_photos (
  message_id uuid primary key references public.messages(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.view_once_photos enable row level security;

-- Sender attaches the path to their own just-inserted view-once message.
-- Deliberately no select/update/delete policy for authenticated/anon --
-- every other access goes through the SECURITY DEFINER function below.
create policy "Senders can register their own view-once photo"
  on public.view_once_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid()) and m.view_once = true
    )
  );

create or replace function public.reveal_view_once_message(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_view_once boolean;
  v_viewed_at timestamptz;
  v_is_participant boolean;
  v_storage_path text;
begin
  select sender_id, view_once, viewed_at
  into v_sender_id, v_view_once, v_viewed_at
  from public.messages
  where id = p_message_id;

  if v_sender_id is null then
    raise exception 'Message not found.';
  end if;

  if not v_view_once then
    raise exception 'This message is not a view-once photo.';
  end if;

  if v_sender_id = (select auth.uid()) then
    raise exception 'You cannot view your own view-once photo.';
  end if;

  if v_viewed_at is not null then
    raise exception 'This photo has already been viewed.';
  end if;

  select exists(
    select 1 from public.conversation_participants cp
    join public.messages m on m.conversation_id = cp.conversation_id
    where m.id = p_message_id and cp.user_id = (select auth.uid())
  ) into v_is_participant;

  if not v_is_participant then
    raise exception 'Not authorized to view this message.';
  end if;

  select storage_path into v_storage_path
  from public.view_once_photos
  where message_id = p_message_id;

  if v_storage_path is null then
    raise exception 'Photo not found.';
  end if;

  update public.messages
  set viewed_at = now()
  where id = p_message_id;

  return v_storage_path;
end;
$$;

grant execute on function public.reveal_view_once_message(uuid) to authenticated;

-- Scoped narrowly on purpose: only a path registered in
-- view_once_photos, only once its message has actually been revealed
-- (viewed_at set by the function above), only for a participant of that
-- conversation. Leaves the existing "senders can delete their own chat
-- images" policy untouched -- that one still covers ordinary photos.
create policy "Participants can delete revealed view-once images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1
      from public.view_once_photos vop
      join public.messages m on m.id = vop.message_id
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where vop.storage_path = storage.objects.name
        and m.viewed_at is not null
        and cp.user_id = (select auth.uid())
    )
  );

-- The 4-photos/day check counted image_url is not null. Going forward,
-- view-once sends leave image_url null (the path lives in
-- view_once_photos instead), so without this change they'd silently
-- bypass the daily cap entirely -- the whole reason it exists (photos
-- are the expensive part) applies just as much to view-once ones.
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
      or (
        select count(*) from public.messages
        where sender_id = auth.uid() and created_at > now() - interval '1 minute'
      ) < 60
    )
    and (
      (image_url is null and not coalesce(view_once, false))
      or exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
      or (
        select count(*) from public.messages
        where sender_id = auth.uid()
          and (image_url is not null or view_once)
          and created_at > now() - interval '1 day'
      ) < 4
    )
  );
