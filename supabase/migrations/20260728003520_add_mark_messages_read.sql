-- Marks unread messages in a conversation as read, for the "Seen" chat
-- indicator. Implemented as a SECURITY DEFINER RPC rather than a raw
-- UPDATE RLS policy on messages: a policy would have to grant UPDATE on
-- the whole row to any conversation participant, which would also let
-- them tamper with content/sender_id on messages they didn't send. The
-- function hardcodes exactly what's allowed to change (read_at only).

create function public.mark_messages_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and user_id = v_uid
  ) then
    raise exception 'Not a participant of this conversation';
  end if;

  update messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id != v_uid
    and read_at is null;
end;
$$;
