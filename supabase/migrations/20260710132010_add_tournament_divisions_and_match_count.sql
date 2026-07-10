-- Phase 1 (Events Divisions): split events into Tournaments vs Scrims, with an
-- optional Mini/Mega lobby type for scrims, and a host-configurable match count.
-- lobby_type only sets the app's *default* match_count (mini=3, mega=5-6) — the
-- host can always override the exact number via a plain numeric input.

alter table public.tournaments
  add column category text not null default 'tournament',
  add column lobby_type text,
  add column match_count integer not null default 1;

alter table public.tournaments
  add constraint tournaments_category_check
    check (category in ('tournament', 'scrim'));

-- lobby_type must be set (mini/mega) when category = scrim, and must be null
-- otherwise — keeps the two fields from drifting out of sync with each other.
alter table public.tournaments
  add constraint tournaments_lobby_type_consistency_check
    check (
      (category = 'scrim' and lobby_type in ('mini', 'mega'))
      or (category = 'tournament' and lobby_type is null)
    );

alter table public.tournaments
  add constraint tournaments_match_count_check
    check (match_count > 0);

comment on column public.tournaments.category is
  'tournament | scrim — top-level event division shown in events.tsx';
comment on column public.tournaments.lobby_type is
  'mini | mega — only set when category = scrim; null for regular tournaments';
comment on column public.tournaments.match_count is
  'Number of matches in this event. Host-configurable at creation; the app pre-fills a default (1 for tournaments, 3 for mini scrims, 5 for mega scrims) but does not otherwise constrain it.';
