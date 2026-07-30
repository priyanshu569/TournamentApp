-- Instagram-style message requests: a brand new 1:1 DM starts 'pending'
-- for the recipient (regardless of whether they follow/are followed by
-- the sender) until they explicitly accept or decline. Also adds
-- per-user pin/mute on conversations, both self-service via a narrow
-- column-level grant rather than an RPC.

alter table public.conversation_participants
  add column status text not null default 'accepted' check (status in ('accepted', 'pending')),
  add column pinned boolean not null default false,
  add column muted boolean not null default false;

-- Users may freely pin/mute their own membership row, but not touch
-- status/is_admin/anything else -- those stay behind their own RPCs.
create policy "Users can update their own participant settings"
  on public.conversation_participants for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.conversation_participants from authenticated;
grant update (pinned, muted) on public.conversation_participants to authenticated;

-- ============================================================
-- start_direct_conversation: the initiator is auto-accepted, the
-- recipient starts pending -- this is the only place a direct
-- conversation is created, so it's the only place this needs to change.
-- ============================================================

create or replace function public.start_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_uid = other_user_id then
    raise exception 'Cannot message yourself';
  end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = other_user_id)
       or (blocker_id = other_user_id and blocked_id = v_uid)
  ) then
    raise exception 'Cannot start a conversation between these users';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.conversation_type = 'direct'
    and exists (select 1 from public.conversation_participants p1 where p1.conversation_id = c.id and p1.user_id = v_uid)
    and exists (select 1 from public.conversation_participants p2 where p2.conversation_id = c.id and p2.user_id = other_user_id)
    and (select count(*) from public.conversation_participants p3 where p3.conversation_id = c.id) = 2
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (conversation_type) values ('direct') returning id into v_conversation_id;
  insert into public.conversation_participants (conversation_id, user_id, status)
  values (v_conversation_id, v_uid, 'accepted'), (v_conversation_id, other_user_id, 'pending');

  return v_conversation_id;
end;
$$;

grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- ============================================================
-- Accepting a request. Declining is just the existing "leave
-- conversation" delete (already permitted -- own row, own choice).
-- ============================================================

create or replace function public.accept_message_request(p_conversation_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  update public.conversation_participants
  set status = 'accepted'
  where conversation_id = p_conversation_id and user_id = v_uid and status = 'pending';

  if not found then
    raise exception 'No pending request to accept.';
  end if;
end;
$$;

grant execute on function public.accept_message_request(uuid) to authenticated;
