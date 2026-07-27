-- Fixes the Supabase Advisor "Function Search Path Mutable" warnings.
-- Pins search_path on every SECURITY DEFINER / plain function so a
-- malicious actor with schema-create rights can't shadow an unqualified
-- table/function name ahead of `public` in the resolution path.
-- No behavior change: all unqualified references in these functions
-- (e.g. "Profiles", "tournaments") already resolve inside public.

ALTER FUNCTION public.cancel_registration(uuid) SET search_path = public;
ALTER FUNCTION public.confirm_free_registration(uuid) SET search_path = public;
ALTER FUNCTION public.confirm_paid_registration(uuid, numeric, text) SET search_path = public;
ALTER FUNCTION public.create_group_conversation(text, uuid[]) SET search_path = public;
ALTER FUNCTION public.create_team_conversation(uuid) SET search_path = public;
ALTER FUNCTION public.delete_own_account() SET search_path = public;
ALTER FUNCTION public.get_broadcast_push_tokens(text) SET search_path = public;
ALTER FUNCTION public.get_broadcast_recipients(text) SET search_path = public;
ALTER FUNCTION public.get_confirmed_player_tokens(uuid) SET search_path = public;
ALTER FUNCTION public.get_confirmed_players(uuid) SET search_path = public;
ALTER FUNCTION public.get_leaderboard(text) SET search_path = public;
ALTER FUNCTION public.get_tournament_standings(uuid) SET search_path = public;
ALTER FUNCTION public.insert_notification(uuid, text, text, uuid) SET search_path = public;
ALTER FUNCTION public.lock_is_verified() SET search_path = public;
ALTER FUNCTION public.notify_admins_of_host_request(uuid) SET search_path = public;
ALTER FUNCTION public.review_host_request(uuid, boolean) SET search_path = public;
ALTER FUNCTION public.start_direct_conversation(uuid) SET search_path = public;
ALTER FUNCTION public.submit_host_request(text, text, text) SET search_path = public;
