-- Fixes a pre-existing bug: public_profiles had security_invoker=on, which
-- means it enforced the CALLING user's RLS on the underlying "Profiles"
-- table. Since Profiles' only SELECT policy is "auth.uid() = id", the view
-- has only ever been able to return the querying user's own row — never
-- another user's. This silently broke "by {username}" host displays for any
-- genuinely different viewer (it only ever appeared to work because there's
-- been a single tester viewing their own tournaments), and it blocks the new
-- Social layer entirely (a public profile screen needs to read other users'
-- data).
--
-- Fix: security_invoker=off, so the view runs as its owner and bypasses the
-- base table's RLS — the view's own narrow column list becomes the actual
-- security boundary instead. Also extends the exposed columns with the new
-- avatar_id/follow_list_private/role fields needed for public profile pages,
-- while still excluding phone/push_token/is_admin/host_status/game UIDs.

create or replace view public.public_profiles
with (security_invoker = off) as
select
  id,
  username,
  is_verified,
  avatar_id,
  follow_list_private,
  role
from public."Profiles";

grant select on public.public_profiles to anon, authenticated, service_role;
