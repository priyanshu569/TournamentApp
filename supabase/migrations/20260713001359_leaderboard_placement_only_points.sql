-- Leaderboard ranking should be driven purely by placement, not inflated by
-- kill count — a player shouldn't be able to out-rank better-placing players
-- just by farming kills. total_points now equals placement_points only;
-- kill_points is dropped (kills are still shown via the existing total_kills
-- column, they just no longer feed the ranking score).

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
  select
    coalesce(r.player_id::text, tm.player_uid || ':' || t.game) as identity_key,
    r.player_id as linked_profile_id,
    (array_agg(tm.player_uid order by pmr.created_at desc))[1] as player_uid,
    coalesce(pp.username, (array_agg(tm.in_game_name order by pmr.created_at desc))[1]) as username,
    pp.avatar_id,
    coalesce(pp.is_verified, false) as is_verified,
    count(distinct (pmr.tournament_id, pmr.match_number)) as matches_played,
    count(distinct case when mr.placement = 1 then (pmr.tournament_id, pmr.match_number) end) as wins,
    coalesce(sum(pmr.kills), 0) as total_kills,
    coalesce(sum(coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)), 0) as total_points
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
  group by coalesce(r.player_id::text, tm.player_uid || ':' || t.game), r.player_id, pp.username, pp.avatar_id, pp.is_verified
  order by total_points desc;
$$;

grant execute on function public.get_leaderboard(text) to anon, authenticated, service_role;
