-- Adds an optional city field (nullable -- leaving it blank is how a
-- player opts out of sharing it, same pattern as state/gender already
-- being optional) and makes game_profiles publicly readable so another
-- player's profile can show their per-game info. In-game name/UID are
-- already public elsewhere in the app (leaderboard, registration
-- lists), so this doesn't raise the sensitivity bar -- only INSERT/
-- UPDATE/DELETE stay restricted to the owning user.

alter table public."Profiles"
  add column city text;

comment on column public."Profiles".city is
  'Optional, player-supplied. Null means the player has not chosen to share it.';

create or replace view public.public_profiles with (security_invoker=off) as
 select id,
    username,
    is_verified,
    avatar_id,
    follow_list_private,
    role,
    display_name,
    is_admin,
    avatar_url,
    gender,
    state,
    city
   from public."Profiles";

drop policy "Users can view own game profiles" on public.game_profiles;

create policy "Anyone can view game profiles"
  on public.game_profiles for select
  using (true);
