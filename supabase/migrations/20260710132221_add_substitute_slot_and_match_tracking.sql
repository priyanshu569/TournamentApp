-- Phase 1 (Substitute Slot): optional 5th roster member who can replace one of
-- the core 4 for a specific match, not a simultaneous 5th active player.
--
-- Recording "who actually played a given match" requires match-level granularity
-- that match_results / player_match_results don't have today — both currently
-- hold exactly one aggregate row per team/player for the whole tournament. This
-- migration adds that granularity (match_number) so enter-results.tsx and
-- live-scoreboard.tsx can be reworked to operate per match. This is scoped
-- narrowly to what the substitute feature needs — the points/placement-curve
-- rework (per-event point_rules, kill multipliers) is still a separate,
-- later phase and is NOT part of this migration.
--
-- Design choice: a benched roster member for a given match simply has no
-- player_match_results row for that match_number, rather than a row with
-- kills=0 plus a separate played/active flag. This keeps "matches_played" in
-- get_leaderboard() correct (a match with no row for a player doesn't count
-- toward their total) without an extra column. Revisit if you'd rather keep an
-- explicit "0 kills, did not play" record for visibility in the results UI.

alter table public.team_members
  add column is_substitute boolean not null default false;

comment on column public.team_members.is_substitute is
  'True for the optional 5th roster slot — a replacement player who can step in for a benched core member on a per-match basis, not a simultaneous 5th active player.';

-- match_results: one row per team per match instead of one row per team per tournament.
alter table public.match_results
  add column match_number integer not null default 1;

alter table public.match_results
  add constraint match_results_match_number_check check (match_number > 0);

alter table public.match_results
  drop constraint match_results_tournament_id_team_id_key;

alter table public.match_results
  add constraint match_results_tournament_team_match_key
    unique (tournament_id, team_id, match_number);

-- player_match_results: one row per roster member per match instead of one row
-- per roster member per tournament. A member with no row for a given
-- match_number did not play that match (see design note above).
alter table public.player_match_results
  add column match_number integer not null default 1;

alter table public.player_match_results
  add constraint player_match_results_match_number_check check (match_number > 0);

alter table public.player_match_results
  drop constraint player_match_results_tournament_id_team_member_id_key;

alter table public.player_match_results
  add constraint player_match_results_tournament_member_match_key
    unique (tournament_id, team_member_id, match_number);

-- get_leaderboard() must join on match_number too now that a team/player can
-- have many rows per tournament — without this the join would cross-multiply
-- every match_results row against every player_match_results row sharing the
-- same tournament_id+team_id, inflating kill totals. matches_played/wins also
-- move from "distinct tournament" to "distinct tournament+match" since a
-- placement is now recorded per match rather than once per tournament.
create or replace function public.get_leaderboard() returns table(
  player_uid text,
  username text,
  is_verified boolean,
  matches_played bigint,
  wins bigint,
  total_kills bigint
)
language sql
as $$
  select
    tm.player_uid,
    (array_agg(tm.in_game_name order by pmr.created_at desc))[1] as username,
    false as is_verified,
    count(distinct (pmr.tournament_id, pmr.match_number)) as matches_played,
    count(distinct case when mr.placement = 1 then (pmr.tournament_id, pmr.match_number) end) as wins,
    coalesce(sum(pmr.kills), 0) as total_kills
  from team_members tm
  join player_match_results pmr on pmr.team_member_id = tm.id
  join match_results mr
    on mr.tournament_id = pmr.tournament_id
   and mr.team_id = pmr.team_id
   and mr.match_number = pmr.match_number
  group by tm.player_uid
  order by total_kills desc;
$$;
