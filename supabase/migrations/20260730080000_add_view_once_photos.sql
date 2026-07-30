-- View-once photos: sender flags a photo message view_once at send
-- time; the first participant who isn't the sender to open it consumes
-- it (viewed_at set, image_url cleared) so nobody -- including the
-- sender -- can load it again afterward. The underlying storage object
-- is left in place (this app never automates storage cleanup anywhere
-- else either); only the DB reference that makes it reachable through
-- the app is removed.

alter table public.messages
  add column view_once boolean not null default false,
  add column viewed_at timestamptz;

create or replace function public.reveal_view_once_message(p_message_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_image_url text;
  v_view_once boolean;
  v_viewed_at timestamptz;
  v_is_participant boolean;
begin
  select sender_id, image_url, view_once, viewed_at
  into v_sender_id, v_image_url, v_view_once, v_viewed_at
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

  update public.messages
  set viewed_at = now(), image_url = null
  where id = p_message_id;

  return v_image_url;
end;
$$;

grant execute on function public.reveal_view_once_message(uuid) to authenticated;
