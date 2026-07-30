-- Per-category push notification preferences, replacing the single
-- push_enabled master switch with granular toggles underneath it (the
-- master still wins if off). Also wires up chat messages as a proper
-- notification type, which didn't exist before -- conversation
-- participants notifying each other is a new authorized case for
-- insert_notification, alongside the existing tournament-host/admin ones.

alter table public."Profiles"
  add column notify_tournament_updates boolean not null default true,
  add column notify_room_codes boolean not null default true,
  add column notify_results boolean not null default true,
  add column notify_chat_messages boolean not null default true,
  add column notify_social boolean not null default true;

comment on column public."Profiles".notify_social is
  'Gates "new message request" notifications -- the Instagram-style first-contact-from-a-stranger ping.';

alter table public.notifications
  add column conversation_id uuid references public.conversations(id) on delete cascade;

create or replace function public.insert_notification(
  p_user_id uuid, p_title text, p_body text,
  p_tournament_id uuid default null::uuid,
  p_conversation_id uuid default null::uuid
) returns void
    language plpgsql security definer
    set search_path = public
    as $$
begin
  if auth.uid() = p_user_id then
    -- notifying yourself (e.g. free registration confirmed)
  elsif p_tournament_id is not null and exists (
    select 1 from tournaments where id = p_tournament_id and host_id = auth.uid()
  ) then
    -- host notifying a confirmed player of their own tournament
  elsif exists (
    select 1 from "Profiles" where id = auth.uid() and is_admin = true
  ) then
    -- admin broadcast
  elsif exists (
    select 1 from "Profiles" where id = p_user_id and is_admin = true
  ) then
    -- anyone notifying an admin (e.g. new host request submitted)
  elsif p_conversation_id is not null and exists (
    select 1 from conversation_participants cp1
    join conversation_participants cp2 on cp2.conversation_id = cp1.conversation_id
    where cp1.conversation_id = p_conversation_id
      and cp1.user_id = auth.uid()
      and cp2.user_id = p_user_id
  ) then
    -- a conversation participant notifying a fellow participant
  else
    raise exception 'Not authorized to send notification to this user';
  end if;

  insert into notifications (user_id, title, body, tournament_id, conversation_id)
  values (p_user_id, p_title, p_body, p_tournament_id, p_conversation_id);
end;
$$;

grant execute on function public.insert_notification(uuid, text, text, uuid, uuid) to authenticated;

-- ============================================================
-- Chat message push fan-out. Regular chat traffic is push-only (no
-- in-app bell row -- the chat list's own unread badges already cover
-- that, and logging every message would flood the notification
-- center); the caller distinguishes "is_pending" to send a one-off
-- "new message request" ping instead, which the caller then logs via
-- insert_notification since it's a discrete, low-frequency event.
-- Muted participants are excluded entirely -- no push, no log.
-- ============================================================

create or replace function public.get_conversation_notify_targets(p_conversation_id uuid)
returns table(user_id uuid, push_token text, is_pending boolean)
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and user_id = (select auth.uid())
  ) then
    raise exception 'Not a participant of this conversation';
  end if;

  return query
  select
    p.id,
    case
      when not p.push_enabled then null
      when cp.status = 'pending' and not p.notify_social then null
      when cp.status = 'accepted' and not p.notify_chat_messages then null
      else p.push_token
    end,
    (cp.status = 'pending')
  from conversation_participants cp
  join "Profiles" p on p.id = cp.user_id
  where cp.conversation_id = p_conversation_id
    and cp.user_id <> (select auth.uid())
    and cp.muted = false;
end;
$$;

grant execute on function public.get_conversation_notify_targets(uuid) to authenticated;

-- ============================================================
-- Tournament notifications gain a category so their toggles in
-- Settings do something. get_broadcast_recipients (admin broadcasts)
-- is untouched -- it isn't one of the requested categories.
-- ============================================================

create or replace function public.get_confirmed_players(target_tournament_id uuid, p_category text default 'tournament_updates')
returns table(user_id uuid, push_token text)
    language plpgsql security definer
    set search_path = public
    as $$
begin
  if not exists (
    select 1 from tournaments t
    where t.id = target_tournament_id and t.host_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    case
      when not p.push_enabled then null
      when p_category = 'room_codes' and not p.notify_room_codes then null
      when p_category = 'results' and not p.notify_results then null
      when p_category = 'tournament_updates' and not p.notify_tournament_updates then null
      else p.push_token
    end
  from registrations r
  join "Profiles" p on p.id = r.player_id
  where r.tournament_id = target_tournament_id
    and r.status = 'confirmed';
end;
$$;

grant execute on function public.get_confirmed_players(uuid, text) to authenticated;
