-- Exposes is_admin on public_profiles so other users' profiles can show an
-- ADMIN badge (previously only visible to the account owner). This is just
-- a "staff" indicator, not sensitive personal data.

create or replace view public.public_profiles
with (security_invoker = off) as
select
  id,
  username,
  is_verified,
  avatar_id,
  follow_list_private,
  role,
  display_name,
  is_admin
from public."Profiles";

grant select on public.public_profiles to anon, authenticated, service_role;

-- Lets a participant leave a group conversation (there was no DELETE policy
-- on conversation_participants at all before this).
create policy "Users can leave conversations" on public.conversation_participants
  for delete using (auth.uid() = user_id);
