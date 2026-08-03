-- Removes 'inferno' now that the banner has been dropped from the app
-- entirely (superseded by 'dragonwrath'). Any profile still set to it falls
-- back to Classic (null) rather than being left pointing at a banner that no
-- longer renders.

update public."Profiles"
  set banner_theme = null
  where banner_theme = 'inferno';

alter table public."Profiles" drop constraint "Profiles_banner_theme_check";

alter table public."Profiles"
  add constraint "Profiles_banner_theme_check"
  check (banner_theme in ('powersurge', 'turbo', 'nebula', 'dragonwrath'));
