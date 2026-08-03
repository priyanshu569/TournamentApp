-- Replaces the original three banner themes (aurora/holographic/ember)
-- with more dramatic, gamified ones (powersurge/inferno/turbo) -- the
-- soft ambient-gradient look didn't fit this app's competitive-esports
-- identity. Nulls out anyone already on an old value first since the
-- CHECK constraint is about to stop allowing it (the feature only just
-- shipped, so this is a precaution, not an expected real migration).

update public."Profiles"
  set banner_theme = null
  where banner_theme in ('aurora', 'holographic', 'ember');

alter table public."Profiles" drop constraint "Profiles_banner_theme_check";

alter table public."Profiles"
  add constraint "Profiles_banner_theme_check"
  check (banner_theme in ('powersurge', 'inferno', 'turbo'));
