-- Fixes the Supabase Advisor "Multiple Permissive Policies" warnings.
-- Each affected table had two separate permissive SELECT policies that
-- Postgres evaluates independently and ORs together per row, instead of
-- one combined policy evaluated once.

-- registrations: "Players can view their own registrations" is fully
-- redundant -- "Anyone can view registrations" (USING (true)) already
-- grants access to every row for every caller, so the narrower policy
-- never restricts or adds anything. Drop the dead policy only; the
-- underlying "anyone can read" behavior is unchanged.
DROP POLICY "Players can view their own registrations" ON public.registrations;

-- host_requests: merge the two genuinely-different SELECT conditions
-- (admin sees all OR owner sees own) into a single policy with the
-- same combined logic.
DROP POLICY "Admins can view all host requests" ON public.host_requests;
DROP POLICY "Users can view own host request" ON public.host_requests;

CREATE POLICY "Users can view own host request or admins view all" ON public.host_requests
  FOR SELECT USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public."Profiles" p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

-- reports: same merge -- admin sees all OR reporter sees own.
DROP POLICY "Admins can view all reports" ON public.reports;
DROP POLICY "Users can view own reports" ON public.reports;

CREATE POLICY "Users can view own reports or admins view all" ON public.reports
  FOR SELECT USING (
    (select auth.uid()) = reporter_id
    OR EXISTS (
      SELECT 1 FROM public."Profiles" p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );
