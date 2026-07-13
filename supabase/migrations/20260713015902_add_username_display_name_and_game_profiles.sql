-- Splits the single "username" field into two concepts:
--   - username: a unique, lowercase, no-space handle (Instagram-style),
--     used to identify an account.
--   - display_name: the freeform name other users actually see everywhere
--     in the UI (host names, chat names, leaderboard names, etc).
--
-- Also adds gender/state/date_of_birth, and moves per-game UID/IGN data out
-- of two fixed Profiles columns (free_fire_uid, bgmi_uid) into a proper
-- game_profiles table that can hold any of the app's games per user.
--
-- Existing accounts currently have a display-name-style value in username
-- (e.g. "Priyanshu Yadav" — spaces, capitals), which won't satisfy the new
-- format. Per product decision: preserve that value as display_name, then
-- auto-generate a valid starter handle from it (lowercase, non-alphanumerics
-- stripped, numeric suffix appended on collision) rather than interrupting
-- existing users with a forced "claim your handle" screen.
--
-- Existing users are also marked games_onboarded = true so they are never
-- shown the new mandatory game-details onboarding screen retroactively —
-- that screen only applies to accounts signing up from now on.

alter table public."Profiles" add column display_name text;
alter table public."Profiles" add column gender text;
alter table public."Profiles" add column state text;
alter table public."Profiles" add column date_of_birth date;
alter table public."Profiles" add column games_onboarded boolean not null default false;

-- Snapshot "already fully onboarded under the old system" before anything
-- else changes, so this doesn't get confused by the username rewrite below.
update public."Profiles"
set games_onboarded = true
where role is not null and username is not null;

update public."Profiles"
set display_name = username
where display_name is null and username is not null;

-- --- game_profiles ---------------------------------------------------

create table public.game_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."Profiles"(id) on delete cascade,
  game text not null check (game in ('Free Fire', 'BGMI', 'COD Mobile', 'Valorant')),
  in_game_name text not null,
  game_uid text not null,
  created_at timestamp with time zone not null default now(),
  unique (user_id, game)
);

alter table public.game_profiles enable row level security;

create policy "Users can view own game profiles" on public.game_profiles
  for select using (auth.uid() = user_id);

create policy "Users can insert own game profiles" on public.game_profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own game profiles" on public.game_profiles
  for update using (auth.uid() = user_id);

create policy "Users can delete own game profiles" on public.game_profiles
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.game_profiles to authenticated;
grant select on public.game_profiles to service_role;

-- Carry over existing per-account UIDs (there was no separate in-game-name
-- field at this level before, so display_name is used as a starting point —
-- editable afterward on the new game-details screen).
insert into public.game_profiles (user_id, game, in_game_name, game_uid)
select id, 'Free Fire', coalesce(display_name, 'Player'), free_fire_uid
from public."Profiles"
where free_fire_uid is not null and trim(free_fire_uid) <> ''
on conflict (user_id, game) do nothing;

insert into public.game_profiles (user_id, game, in_game_name, game_uid)
select id, 'BGMI', coalesce(display_name, 'Player'), bgmi_uid
from public."Profiles"
where bgmi_uid is not null and trim(bgmi_uid) <> ''
on conflict (user_id, game) do nothing;

alter table public."Profiles" drop column free_fire_uid;
alter table public."Profiles" drop column bgmi_uid;

-- --- username: generate valid handles for existing accounts -----------

do $$
declare
  rec record;
  base text;
  candidate text;
  suffix int;
begin
  for rec in
    select id, username from public."Profiles"
    where username is not null
      and username !~ '^[a-z0-9_.]{3,20}$'
  loop
    base := lower(regexp_replace(rec.username, '[^a-zA-Z0-9]', '', 'g'));
    base := left(base, 20);
    if base is null or base = '' then
      base := 'user';
    end if;
    if length(base) < 3 then
      base := rpad(base, 3, '0');
    end if;

    candidate := base;
    suffix := 0;
    while exists (
      select 1 from public."Profiles"
      where username = candidate and id <> rec.id
    ) loop
      suffix := suffix + 1;
      candidate := left(base, 20 - length(suffix::text)) || suffix::text;
    end loop;

    update public."Profiles" set username = candidate where id = rec.id;
  end loop;
end $$;

alter table public."Profiles"
  add constraint profiles_username_format_check
    check (username is null or username ~ '^[a-z0-9_.]{3,20}$');

alter table public."Profiles"
  add constraint profiles_username_unique unique (username);

alter table public."Profiles"
  add constraint profiles_gender_check
    check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));

-- --- public_profiles: expose display_name -----------------------------

create or replace view public.public_profiles
with (security_invoker = off) as
select
  id,
  username,
  is_verified,
  avatar_id,
  follow_list_private,
  role,
  display_name
from public."Profiles";

grant select on public.public_profiles to anon, authenticated, service_role;

-- --- delete_own_account: scrub the new fields + game_profiles ---------

create or replace function public.delete_own_account()
returns void
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.game_profiles where user_id = v_uid;

  update public."Profiles"
  set username = null,
      display_name = null,
      gender = null,
      state = null,
      date_of_birth = null,
      phone = null,
      push_token = null,
      role = null,
      host_status = 'none',
      is_admin = false,
      is_deleted = true
  where id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

-- --- get_leaderboard: show display_name, not the unique handle ----------

drop function if exists public.get_leaderboard(text);

create function public.get_leaderboard(p_game text default null) returns table(
  identity_key text,
  linked_profile_id uuid,
  player_uid text,
  username text,
  avatar_id text,
  is_verified boolean,
  matches_played bigint,
  wins bigint,
  total_kills bigint,
  placement_points numeric,
  kill_points numeric,
  total_points numeric
)
language sql
as $$
  with per_match as (
    select
      coalesce(r.player_id::text, tm.player_uid || ':' || t.game) as identity_key,
      r.player_id as linked_profile_id,
      pp.display_name as profile_display_name,
      pp.avatar_id,
      pp.is_verified,
      pmr.tournament_id,
      pmr.match_number,
      (array_agg(tm.in_game_name order by pmr.created_at desc))[1] as in_game_name,
      (array_agg(tm.player_uid order by pmr.created_at desc))[1] as player_uid,
      max(pmr.created_at) as last_activity,
      max(coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)) as match_placement_points,
      max(pmr.kills) as match_kills,
      max(coalesce((t.point_rules->>'kill_point')::numeric, 1)) as match_kill_point_value,
      bool_or(mr.placement = 1) as is_win
    from team_members tm
    join player_match_results pmr on pmr.team_member_id = tm.id
    join match_results mr
      on mr.tournament_id = pmr.tournament_id
     and mr.team_id = pmr.team_id
     and mr.match_number = pmr.match_number
    join tournaments t on t.id = pmr.tournament_id
    left join registrations r
      on r.team_id = tm.team_id
     and r.tournament_id = pmr.tournament_id
     and tm.is_captain
    left join public_profiles pp on pp.id = r.player_id
    where p_game is null or t.game = p_game
    group by
      coalesce(r.player_id::text, tm.player_uid || ':' || t.game),
      r.player_id, pp.display_name, pp.avatar_id, pp.is_verified,
      pmr.tournament_id, pmr.match_number
  )
  select
    identity_key,
    linked_profile_id,
    (array_agg(player_uid order by last_activity desc))[1] as player_uid,
    coalesce(max(profile_display_name), (array_agg(in_game_name order by last_activity desc))[1]) as username,
    max(avatar_id) as avatar_id,
    coalesce(bool_or(is_verified), false) as is_verified,
    count(*) as matches_played,
    count(*) filter (where is_win) as wins,
    coalesce(sum(match_kills), 0) as total_kills,
    coalesce(sum(match_placement_points), 0) as placement_points,
    coalesce(sum(match_kills * match_kill_point_value), 0) as kill_points,
    coalesce(sum(match_placement_points + match_kills * match_kill_point_value), 0) as total_points
  from per_match
  group by identity_key, linked_profile_id
  order by total_points desc;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated, service_role;
