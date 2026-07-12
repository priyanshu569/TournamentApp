-- Fixes two bugs in get_leaderboard():
-- 1. is_verified was hardcoded to `false` — verified badges never showed for
--    anyone, genuinely verified or not.
-- 2. No game filter — Free Fire/BGMI/COD Mobile/Valorant results were all
--    summed into one board, even though each tournament's point_rules curve
--    isn't necessarily comparable across games.
--
-- Fixing #1 safely is the tricky part: team_members.player_uid is free text
-- typed by whoever registered the team, not a stable link to a real account.
-- Naively joining that text against every Profile's saved game UID would let
-- a captain type in a well-known verified player's UID as a teammate's name
-- and inherit their verified badge/avatar/username on the public leaderboard
-- — a real, easy impersonation path, not a theoretical one.
--
-- The one team_members row that CAN be safely and correctly linked to a real
-- account is the captain's own slot, because registrations.player_id is set
-- from auth.uid() at insert time (RLS-enforced) — nobody but the actual
-- registrant can ever appear there. So we add is_captain to mark that slot,
-- and only that slot ever gets joined back to a real profile. Every other
-- roster slot (teammates, substitute) stays anonymous text, which is honest
-- given what we can actually verify.

alter table public.team_members
  add column is_captain boolean not null default false;

comment on column public.team_members.is_captain is
  'True for exactly the first (non-substitute) roster slot on a team — the only team_members row safely linkable to a real Profile via registrations.player_id. Every other slot is free text typed by the captain and cannot be trusted to represent whoever is actually named.';

drop function if exists public.get_leaderboard();

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
