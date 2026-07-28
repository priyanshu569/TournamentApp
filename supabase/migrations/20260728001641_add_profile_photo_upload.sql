-- Lets a player upload a real profile photo instead of picking a preset
-- avatar. Storage bucket follows the same per-user-folder pattern as
-- tournament-banners: uploads go to "{uid}/{timestamp}.jpg", so storage
-- RLS only needs "is this your own folder" -- Profiles RLS already
-- gates who can attach a URL to their own row.

alter table public."Profiles"
  add column avatar_url text;

comment on column public."Profiles".avatar_url is
  'Public URL of an uploaded profile photo in the profile-photos storage bucket, if set. Takes priority over avatar_id when present.';

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view profile photos"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Users can upload their own profile photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own profile photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own profile photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- public_profiles: append avatar_url at the end so this stays a plain
-- CREATE OR REPLACE (Postgres forbids reordering/dropping existing
-- view columns, only appending is allowed without a DROP).
create or replace view public.public_profiles with (security_invoker=off) as
 select id,
    username,
    is_verified,
    avatar_id,
    follow_list_private,
    role,
    display_name,
    is_admin,
    avatar_url
   from public."Profiles";

-- get_leaderboard: adding a column to RETURNS TABLE requires a drop,
-- CREATE OR REPLACE can't change the return type.
drop function public.get_leaderboard(text);

create function public.get_leaderboard(p_game text DEFAULT NULL::text)
RETURNS TABLE(identity_key text, linked_profile_id uuid, player_uid text, username text, avatar_id text, avatar_url text, is_verified boolean, matches_played bigint, wins bigint, total_kills bigint, placement_points numeric, kill_points numeric, total_points numeric)
    LANGUAGE sql
    AS $$
  with per_match as (
    select
      coalesce(r.player_id::text, tm.player_uid || ':' || t.game) as identity_key,
      r.player_id as linked_profile_id,
      pp.display_name as profile_display_name,
      pp.avatar_id,
      pp.avatar_url,
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
      r.player_id, pp.display_name, pp.avatar_id, pp.avatar_url, pp.is_verified,
      pmr.tournament_id, pmr.match_number
  )
  select
    identity_key,
    linked_profile_id,
    (array_agg(player_uid order by last_activity desc))[1] as player_uid,
    coalesce(max(profile_display_name), (array_agg(in_game_name order by last_activity desc))[1]) as username,
    max(avatar_id) as avatar_id,
    max(avatar_url) as avatar_url,
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
