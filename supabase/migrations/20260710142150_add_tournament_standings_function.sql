-- Per-event cumulative team standings (points across every match entered so far
-- in one tournament/scrim), for tournament-details.tsx's Results section.
-- get_leaderboard() is a global, cross-tournament, per-player leaderboard —
-- this is intentionally a separate, narrower function: per-team, scoped to a
-- single tournament, using that tournament's own point_rules.

create or replace function public.get_tournament_standings(target_tournament_id uuid)
returns table(
  team_id uuid,
  team_name text,
  matches_played bigint,
  total_kills bigint,
  total_points numeric
)
language sql
as $$
  select
    mr.team_id,
    teams.name as team_name,
    count(distinct mr.match_number) as matches_played,
    coalesce(sum(mr.kills), 0) as total_kills,
    coalesce(sum(
      mr.kills * coalesce((t.point_rules->>'kill_point')::numeric, 1)
      + coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)
    ), 0) as total_points
  from match_results mr
  join teams on teams.id = mr.team_id
  join tournaments t on t.id = mr.tournament_id
  where mr.tournament_id = target_tournament_id
  group by mr.team_id, teams.name
  order by total_points desc;
$$;

grant execute on function public.get_tournament_standings(uuid) to anon, authenticated, service_role;
