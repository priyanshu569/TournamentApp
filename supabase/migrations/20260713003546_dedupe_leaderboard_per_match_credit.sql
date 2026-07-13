-- Hardens get_leaderboard() against double-crediting: if the same player_uid
-- ends up on more than one team_members roster row for the same
-- (tournament_id, match_number) — whether from sloppy manual entry (typing
-- the same UID into two team registrations) or, in principle, someone
-- deliberately joining multiple teams in one match — the old query summed
-- placement points and kills across every matching row, so one real match
-- could get counted 2-3x toward a player's total.
--
-- Fix: first collapse to one row per (identity, tournament, match) — taking
-- the best (max) placement points and kills for that match if duplicated —
-- then sum only across those deduped, distinct matches. matches_played and
-- wins were already computed via COUNT(DISTINCT ...) so they were never
-- affected by this; only the SUM-based placement/kill totals were.

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
  total_points numeric
)
language sql
as $$
  with per_match as (
    select
      coalesce(r.player_id::text, tm.player_uid || ':' || t.game) as identity_key,
      r.player_id as linked_profile_id,
      pp.username as profile_username,
      pp.avatar_id,
      pp.is_verified,
      pmr.tournament_id,
      pmr.match_number,
      (array_agg(tm.in_game_name order by pmr.created_at desc))[1] as in_game_name,
      (array_agg(tm.player_uid order by pmr.created_at desc))[1] as player_uid,
      max(pmr.created_at) as last_activity,
      max(coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)) as match_placement_points,
      max(pmr.kills) as match_kills,
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
      r.player_id, pp.username, pp.avatar_id, pp.is_verified,
      pmr.tournament_id, pmr.match_number
  )
  select
    identity_key,
    linked_profile_id,
    (array_agg(player_uid order by last_activity desc))[1] as player_uid,
    coalesce(max(profile_username), (array_agg(in_game_name order by last_activity desc))[1]) as username,
    max(avatar_id) as avatar_id,
    coalesce(bool_or(is_verified), false) as is_verified,
    count(*) as matches_played,
    count(*) filter (where is_win) as wins,
    coalesce(sum(match_kills), 0) as total_kills,
    coalesce(sum(match_placement_points), 0) as total_points
  from per_match
  group by identity_key, linked_profile_id
  order by total_points desc;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated, service_role;
