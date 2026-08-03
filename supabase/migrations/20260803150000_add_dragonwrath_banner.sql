-- Adds 'dragonwrath', the top-tier premium profile banner, to the allowed
-- banner_theme values. Purely additive: no existing rows are touched.
--
-- Entitlement is still not enforced at the database level -- see the note in
-- 20260803140000. When subscriptions land, both premium themes need gating in
-- an RPC or RLS policy, not in this CHECK constraint.

alter table public."Profiles" drop constraint "Profiles_banner_theme_check";

alter table public."Profiles"
  add constraint "Profiles_banner_theme_check"
  check (banner_theme in ('powersurge', 'inferno', 'turbo', 'nebula', 'dragonwrath'));
