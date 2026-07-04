-- Adds per-player kill tracking, one row per squad member per tournament.
-- Introduced in v10→v11 session to fix duplicate/mismatched leaderboard
-- entries caused by kills previously being stored only at the team level.

create table if not exists public.player_match_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  kills integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_match_results_unique_member_per_tournament
    unique (tournament_id, team_member_id)
);

comment on table public.player_match_results is
  'One row per squad member per tournament. Team-level total in match_results.kills is auto-synced from the sum of these rows.';

-- Keep updated_at current on edit
create or replace function public.set_player_match_results_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_player_match_results_updated_at on public.player_match_results;

create trigger trg_player_match_results_updated_at
before update on public.player_match_results
for each row
execute function public.set_player_match_results_updated_at();

-- RLS: mirror match_results policies (adjust if your existing policies differ)
-- NOTE: the policies below assume a `tournaments.host_id` column referencing
-- auth.uid(). Verify the exact column name against your actual `tournaments`
-- table before running this — swap it in if it's named differently
-- (e.g. `created_by`, `organizer_id`).
alter table public.player_match_results enable row level security;

create policy "Anyone can read player match results"
  on public.player_match_results
  for select
  using (true);

create policy "Hosts can insert/update player match results for their tournaments"
  on public.player_match_results
  for all
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = player_match_results.tournament_id
        and t.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tournaments t
      where t.id = player_match_results.tournament_id
        and t.host_id = auth.uid()
    )
  );
