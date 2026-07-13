-- Restores kill points into the leaderboard total — the earlier
-- placement-only change was a misread of "don't include kills of team"; the
-- actual ask was to make sure only a player's OWN individual kills count,
-- never the whole team's combined kills. That was already true (kills were
-- always summed from player_match_results.kills, which is per team_member,
-- never match_results.kills, which is the team total) — it just needs to be
-- added back into the score, on top of the per-match dedup fix from the
-- previous migration so one real match still can't be double-credited.
--
-- Also brings back the placement_points/kill_points breakdown columns so
-- the UI can keep showing why a player has the total they have.

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
    coalesce(sum(match_placement_points), 0) as placement_points,
    coalesce(sum(match_kills * match_kill_point_value), 0) as kill_points,
    coalesce(sum(match_placement_points + match_kills * match_kill_point_value), 0) as total_points
  from per_match
  group by identity_key, linked_profile_id
  order by total_points desc;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated, service_role;
