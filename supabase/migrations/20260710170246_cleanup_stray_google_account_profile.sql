-- Cleans up the stray Google account (auth.users id
-- 0a1aa49f-5c43-4e20-9c59-41ed60cca621, priyanshuyadav2755@gmail.com), created
-- from earlier testing (predates today's session) and already deleted via the
-- Auth dashboard. It turned out not to be empty — it owned a tournament, a
-- team, a registration, some notifications, and a match result — so those are
-- reassigned to the real phone-based account (0bf0154e-4020-4a64-b5b6-cf39b158895f)
-- before the leftover Profiles row is removed, rather than losing that data.
-- Deleting the auth.users row doesn't cascade to public."Profiles" (no FK
-- enforced between them), so the profile would otherwise be left orphaned
-- with no matching auth user.

update public.tournaments
set host_id = '0bf0154e-4020-4a64-b5b6-cf39b158895f'
where host_id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';

update public.teams
set captain_id = '0bf0154e-4020-4a64-b5b6-cf39b158895f'
where captain_id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';

update public.registrations
set player_id = '0bf0154e-4020-4a64-b5b6-cf39b158895f'
where player_id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';

update public.notifications
set user_id = '0bf0154e-4020-4a64-b5b6-cf39b158895f'
where user_id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';

update public.match_results
set player_id = '0bf0154e-4020-4a64-b5b6-cf39b158895f'
where player_id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';

delete from public.host_requests
where user_id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';

delete from public."Profiles"
where id = '0a1aa49f-5c43-4e20-9c59-41ed60cca621';
