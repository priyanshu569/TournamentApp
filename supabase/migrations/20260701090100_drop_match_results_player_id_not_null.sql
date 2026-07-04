-- match_results previously required a single registering player_id per row.
-- Since kills are now tracked per-squad-member in player_match_results,
-- team-level match_results rows no longer need a single owning player.

alter table public.match_results
  alter column player_id drop not null;

comment on column public.match_results.player_id is
  'No longer required (nullable as of v11). Team-level kill totals are now auto-synced from player_match_results rather than tied to a single registering player.';
