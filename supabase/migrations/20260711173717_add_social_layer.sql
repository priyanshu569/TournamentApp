-- Social layer: avatars, follows (with owner-controlled list privacy), chat
-- (1:1 DMs + group conversations, including auto-created team chats and
-- manually-created ad-hoc groups), blocks, and reports.

-- ============================================================
-- Avatars (preset picker, 8 esports-style options)
-- ============================================================

alter table public."Profiles"
  add column avatar_id text;

alter table public."Profiles"
  add constraint profiles_avatar_id_check
    check (avatar_id is null or avatar_id in (
      'flame', 'lightning', 'skull', 'controller',
      'headset', 'crosshair', 'trophy', 'ghost'
    ));

comment on column public."Profiles".avatar_id is
  'One of 8 preset avatar keys, or null for the default initials avatar.';

-- ============================================================
-- Follows (owner-controlled list privacy)
-- ============================================================

alter table public."Profiles"
  add column follow_list_private boolean not null default false;

comment on column public."Profiles".follow_list_private is
  'When true, only the owner (or an admin) can see who follows them or who they follow.';

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public."Profiles"(id),
  following_id uuid not null references public."Profiles"(id),
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

-- A follow row is visible to the two people directly involved, to admins, or
-- to anyone else UNLESS either side of that specific relationship has their
-- list marked private.
create policy "View follows respecting privacy"
  on public.follows for select
  using (
    auth.uid() = follower_id
    or auth.uid() = following_id
    or exists (select 1 from public."Profiles" me where me.id = auth.uid() and me.is_admin = true)
    or (
      not exists (select 1 from public."Profiles" p where p.id = follows.following_id and p.follow_list_private = true)
      and not exists (select 1 from public."Profiles" p where p.id = follows.follower_id and p.follow_list_private = true)
    )
  );

create policy "Users can follow others"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

grant all on table public.follows to anon, authenticated, service_role;

-- ============================================================
-- Blocks (1:1 DMs only — created before Chat since the messages insert
-- policy below references this table)
-- ============================================================

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public."Profiles"(id),
  blocked_id uuid not null references public."Profiles"(id),
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "Users manage own blocks"
  on public.blocks for all
  to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

grant all on table public.blocks to anon, authenticated, service_role;

-- ============================================================
-- Chat: conversations, participants, messages
-- ============================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null check (conversation_type in ('direct', 'group')),
  name text,
  team_id uuid references public.teams(id),
  created_at timestamptz not null default now()
);

comment on table public.conversations is
  'conversation_type = direct (1:1) or group. team_id is set only for auto-created team chats; null for manually-created ad-hoc groups.';

alter table public.conversations enable row level security;

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public."Profiles"(id),
  content text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.messages enable row level security;

create policy "See participants of your own conversations"
  on public.conversation_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants me
      where me.conversation_id = conversation_participants.conversation_id
        and me.user_id = auth.uid()
    )
  );

grant all on table public.conversation_participants to anon, authenticated, service_role;

create policy "See your own conversations"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
    )
  );

grant all on table public.conversations to anon, authenticated, service_role;

create policy "Participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- Blocks only gate 1:1 direct messages, never group chats (including team
-- chats) — a shared team/group conversation stays intact regardless of
-- blocks between individual members.
create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
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
  );

grant all on table public.messages to anon, authenticated, service_role;

alter publication supabase_realtime add table public.messages;

-- ============================================================
-- Reports
-- ============================================================

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public."Profiles"(id),
  reported_user_id uuid references public."Profiles"(id),
  reported_message_id uuid references public.messages(id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Users can submit reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

create policy "Admins can view all reports"
  on public.reports for select
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

create policy "Admins can update reports"
  on public.reports for update
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

grant all on table public.reports to anon, authenticated, service_role;

-- ============================================================
-- RPCs
-- ============================================================

-- Starts (or reuses) a 1:1 DM between the caller and another user. Blocked
-- either direction between the two prevents a new conversation from starting.
create function public.start_direct_conversation(other_user_id uuid) returns uuid
language plpgsql security definer
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
  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_uid), (v_conversation_id, other_user_id);

  return v_conversation_id;
end;
$$;

grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- Manually creates an ad-hoc group conversation (the "create groups in DMs too" feature).
create function public.create_group_conversation(p_name text, p_member_ids uuid[]) returns uuid
language plpgsql security definer
as $$
declare
  v_conversation_id uuid;
  v_uid uuid := auth.uid();
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.conversations (conversation_type, name) values ('group', p_name) returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id) values (v_conversation_id, v_uid);

  foreach v_member in array p_member_ids loop
    if v_member <> v_uid then
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conversation_id, v_member)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  return v_conversation_id;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- Auto-creates a team's group chat right after registration: the team's
-- captain plus the tournament's host (the only two roles guaranteed to have
-- a real Fragify account for a given team today — other roster slots are
-- free-text entries with no account link).
create function public.create_team_conversation(p_team_id uuid) returns uuid
language plpgsql security definer
as $$
declare
  v_conversation_id uuid;
  v_captain_id uuid;
  v_host_id uuid;
  v_team_name text;
begin
  select t.captain_id, t.name, tour.host_id
  into v_captain_id, v_team_name, v_host_id
  from public.teams t
  join public.tournaments tour on tour.id = t.tournament_id
  where t.id = p_team_id;

  if v_captain_id is null then
    raise exception 'Team not found';
  end if;

  insert into public.conversations (conversation_type, name, team_id)
  values ('group', v_team_name, p_team_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_captain_id)
  on conflict (conversation_id, user_id) do nothing;

  if v_host_id is not null and v_host_id <> v_captain_id then
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation_id, v_host_id)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return v_conversation_id;
end;
$$;

grant execute on function public.create_team_conversation(uuid) to authenticated;
