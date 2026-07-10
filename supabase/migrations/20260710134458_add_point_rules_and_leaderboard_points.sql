-- Points/Scoring system: per-match score = placement points + (kills * kill_point).
-- point_rules lives per event (not hardcoded) so the standard curve is the default
-- everywhere, but an organizer can override it for a specific event via the
-- "Customize points" toggle in create-tournament.tsx / edit-tournament.tsx.
--
-- Default curve: #1=12, #2=9, #3=8, #4=7, #5=6, #6=5, #7=4, #8=3, #9=2, #10=1,
-- #11+=0 (anything past the 10-entry array falls through to 0). Default kill
-- points: 1 kill = 1 point.

alter table public.tournaments
  add column point_rules jsonb not null default
    '{"placement": [12, 9, 8, 7, 6, 5, 4, 3, 2, 1], "kill_point": 1}'::jsonb;

alter table public.tournaments
  add constraint tournaments_point_rules_shape_check
    check (
      jsonb_typeof(point_rules->'placement') = 'array'
      and jsonb_typeof(point_rules->'kill_point') = 'number'
    );

comment on column public.tournaments.point_rules is
  'Per-event scoring: {"placement": [pts for rank 1, rank 2, ...], "kill_point": pts per kill}. Defaults to the standard curve at creation; only overwritten if the host customizes it for that event.';

-- get_leaderboard() must now compute total_points per match (placement points +
-- kills * kill_point, using that match's own tournament's point_rules) and sum
-- across matches, in addition to the existing kills/wins/matches_played stats.
-- The return signature is changing (new total_points column), so the function
-- must be dropped and recreated rather than replaced in place.
drop function if exists public.get_leaderboard();

create function public.get_leaderboard() returns table(
  player_uid text,
  username text,
  is_verified boolean,
  matches_played bigint,
  wins bigint,
  total_kills bigint,
  total_points numeric
)
language sql
as $$
  select
    tm.player_uid,
    (array_agg(tm.in_game_name order by pmr.created_at desc))[1] as username,
    false as is_verified,
    count(distinct (pmr.tournament_id, pmr.match_number)) as matches_played,
    count(distinct case when mr.placement = 1 then (pmr.tournament_id, pmr.match_number) end) as wins,
    coalesce(sum(pmr.kills), 0) as total_kills,
    coalesce(sum(
      pmr.kills * coalesce((t.point_rules->>'kill_point')::numeric, 1)
      + coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)
    ), 0) as total_points
  from team_members tm
  join player_match_results pmr on pmr.team_member_id = tm.id
  join match_results mr
    on mr.tournament_id = pmr.tournament_id
   and mr.team_id = pmr.team_id
   and mr.match_number = pmr.match_number
  join tournaments t on t.id = pmr.tournament_id
  group by tm.player_uid
  order by total_points desc;
$$;

grant execute on function public.get_leaderboard() to anon, authenticated, service_role;
