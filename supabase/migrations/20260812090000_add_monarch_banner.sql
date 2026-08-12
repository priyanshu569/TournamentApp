-- Adds 'monarch' (iridescent butterflies over a twilight garden) to the
-- allowed banner_theme values. Purely additive: no existing rows are touched,
-- and the four themes already live keep working exactly as before.
--
-- Entitlement is still not enforced at the database level -- see the note in
-- 20260803140000. When subscriptions land, all the premium themes need gating
-- in an RPC or RLS policy, not in this CHECK constraint.

alter table public."Profiles" drop constraint "Profiles_banner_theme_check";

alter table public."Profiles"
  add constraint "Profiles_banner_theme_check"
  check (banner_theme in ('powersurge', 'turbo', 'nebula', 'dragonwrath', 'monarch'));
