-- Persistent, joinable voice room per conversation (both direct and
-- group). No ringing/call-state machine -- a row here just means
-- "this user is currently in this conversation's voice room", which
-- both drives the live "N in voice chat" indicator and lets a client
-- map an Agora numeric uid (received via SDK join/leave events) back
-- to a Fragify user/avatar.

create table public.voice_room_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  agora_uid integer not null,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.voice_room_participants enable row level security;

create policy "Participants can see who's in their conversations' voice rooms"
  on public.voice_room_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = voice_room_participants.conversation_id
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Participants can join a voice room in their conversations"
  on public.voice_room_participants for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = voice_room_participants.conversation_id
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Users can leave their own voice room presence"
  on public.voice_room_participants for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant all on table public.voice_room_participants to authenticated;

alter publication supabase_realtime add table public.voice_room_participants;
