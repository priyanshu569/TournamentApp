-- Persistent, joinable voice room per conversation (both direct and
-- group). No ringing/call-state machine -- a row here just means
-- "this user is currently in this conversation's voice room", driving
-- the live "N in voice chat" indicator shown to people who haven't
-- joined yet. LiveKit's own room state (via useParticipants) is the
-- source of truth once you're actually connected -- a participant's
-- LiveKit identity is just their user_id directly, so no separate
-- numeric-id-to-profile mapping is needed here.

create table public.voice_room_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
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
