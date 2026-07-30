-- Backs reply/react/delete/pin on chat messages.
--
-- deleted_at + content-clearing is "unsend": the row survives (so
-- reply_to_id references and read receipts stay valid) but content is
-- replaced with a placeholder both sides see. message_deletions is
-- the other, purely-local mode ("delete for you"): a per-user hide
-- that never touches the sender's copy or the other participant's.

alter table public.messages
  add column deleted_at timestamptz,
  add column reply_to_id uuid references public.messages(id) on delete set null,
  add column is_forwarded boolean not null default false,
  add column pinned_at timestamptz,
  add column image_width integer,
  add column image_height integer;

-- ============================================================
-- Delete for You (per-user hide, never synced to the other side)
-- ============================================================

create table public.message_deletions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_deletions enable row level security;

create policy "Users manage their own message deletions"
  on public.message_deletions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant all on table public.message_deletions to authenticated;

-- ============================================================
-- Unsend (soft delete visible to everyone) -- SECURITY DEFINER so we
-- don't need a broad UPDATE policy on messages that could be used to
-- rewrite content/sender_id after the fact.
-- ============================================================

create or replace function public.unsend_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages
  set content = 'This message was deleted',
      image_url = null,
      audio_url = null,
      audio_duration_seconds = null,
      deleted_at = now()
  where id = p_message_id
    and sender_id = (select auth.uid())
    and deleted_at is null;

  if not found then
    raise exception 'Message not found or not yours to unsend.';
  end if;
end;
$$;

grant execute on function public.unsend_message(uuid) to authenticated;

-- ============================================================
-- Pin (any participant can pin/unpin; toggles, one active pin shown
-- at a time by the client sorting on pinned_at desc)
-- ============================================================

create or replace function public.toggle_pinned_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_is_participant boolean;
  v_new_state boolean;
begin
  select conversation_id into v_conversation_id
  from public.messages where id = p_message_id;

  if v_conversation_id is null then
    raise exception 'Message not found.';
  end if;

  select exists(
    select 1 from public.conversation_participants
    where conversation_id = v_conversation_id and user_id = (select auth.uid())
  ) into v_is_participant;

  if not v_is_participant then
    raise exception 'Not a participant of this conversation.';
  end if;

  update public.messages
  set pinned_at = case when pinned_at is null then now() else null end
  where id = p_message_id
  returning (pinned_at is not null) into v_new_state;

  return v_new_state;
end;
$$;

grant execute on function public.toggle_pinned_message(uuid) to authenticated;

-- ============================================================
-- Reactions
-- ============================================================

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy "Participants can view reactions in their conversations"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Participants can react to messages in their conversations"
  on public.message_reactions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.messages m
      join public.conversation_participants cp on cp.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Users can change their own reaction"
  on public.message_reactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own reaction"
  on public.message_reactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant all on table public.message_reactions to authenticated;

alter publication supabase_realtime add table public.message_reactions;
