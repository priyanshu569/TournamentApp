-- Adds 'nebula', the first premium (subscription-only) profile banner, to the
-- allowed banner_theme values. Purely additive: the three existing free themes
-- keep working and no existing rows are touched.
--
-- Note: entitlement is NOT enforced here. There is no subscription system in
-- the app yet, so this migration only widens the CHECK constraint. When
-- subscriptions land, gating belongs in an RPC or an RLS policy -- a plain
-- CHECK constraint can't express "premium accounts only".

alter table public."Profiles" drop constraint "Profiles_banner_theme_check";

alter table public."Profiles"
  add constraint "Profiles_banner_theme_check"
  check (banner_theme in ('powersurge', 'inferno', 'turbo', 'nebula'));
