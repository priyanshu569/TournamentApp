-- Fixes the Supabase Advisor "Auth RLS Initialization Plan" performance lint.
-- Every policy below is functionally identical to its current definition --
-- only bare auth.uid() calls are wrapped as (select auth.uid()) so Postgres
-- evaluates them once per query instead of once per row scanned.

ALTER POLICY "Admins can update reports" ON public.reports
  USING (EXISTS (
    SELECT 1 FROM public."Profiles" p
    WHERE p.id = (select auth.uid()) AND p.is_admin = true
  ));

ALTER POLICY "Admins can view all host requests" ON public.host_requests
  USING (EXISTS (
    SELECT 1 FROM public."Profiles" p
    WHERE p.id = (select auth.uid()) AND p.is_admin = true
  ));

ALTER POLICY "Admins can view all reports" ON public.reports
  USING (EXISTS (
    SELECT 1 FROM public."Profiles" p
    WHERE p.id = (select auth.uid()) AND p.is_admin = true
  ));

ALTER POLICY "Hosts and admins can write player_match_results" ON public.player_match_results
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = player_match_results.tournament_id AND t.host_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public."Profiles" p
      WHERE p.id = (select auth.uid()) AND p.is_admin = true
    )
  );

ALTER POLICY "Hosts can create tournaments" ON public.tournaments
  WITH CHECK (
    (select auth.uid()) = host_id
    AND EXISTS (
      SELECT 1 FROM public."Profiles" p
      WHERE p.id = (select auth.uid()) AND p.host_status = 'approved'
    )
  );

ALTER POLICY "Hosts can insert results for own tournaments" ON public.match_results
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = match_results.tournament_id AND t.host_id = (select auth.uid())
  ));

ALTER POLICY "Hosts can update results for own tournaments" ON public.match_results
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = match_results.tournament_id AND t.host_id = (select auth.uid())
  ));

ALTER POLICY "Participants can read messages" ON public.messages
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (select auth.uid())
  ));

ALTER POLICY "Participants can send messages" ON public.messages
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = (select auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.conversation_participants other
        ON other.conversation_id = c.id AND other.user_id <> (select auth.uid())
      JOIN public.blocks b
        ON (b.blocker_id = other.user_id AND b.blocked_id = (select auth.uid()))
        OR (b.blocker_id = (select auth.uid()) AND b.blocked_id = other.user_id)
      WHERE c.id = messages.conversation_id AND c.conversation_type = 'direct'
    )
  );

ALTER POLICY "Players can register their team" ON public.registrations
  WITH CHECK (
    (select auth.uid()) = player_id
    AND (
      SELECT tournaments.status FROM public.tournaments
      WHERE tournaments.id = registrations.tournament_id
    ) = 'upcoming'
  );

ALTER POLICY "Players can view their own registrations" ON public.registrations
  USING ((select auth.uid()) = player_id);

ALTER POLICY "See participants of your own conversations" ON public.conversation_participants
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants me
    WHERE me.conversation_id = conversation_participants.conversation_id AND me.user_id = (select auth.uid())
  ));

ALTER POLICY "See your own conversations" ON public.conversations
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = (select auth.uid())
  ));

ALTER POLICY "Users can delete own game profiles" ON public.game_profiles
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own notifications" ON public.notifications
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can follow others" ON public.follows
  WITH CHECK ((select auth.uid()) = follower_id);

ALTER POLICY "Users can insert own game profiles" ON public.game_profiles
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can leave conversations" ON public.conversation_participants
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can submit reports" ON public.reports
  WITH CHECK ((select auth.uid()) = reporter_id);

ALTER POLICY "Users can unfollow" ON public.follows
  USING ((select auth.uid()) = follower_id);

ALTER POLICY "Users can update own game profiles" ON public.game_profiles
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own notifications" ON public.notifications
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own profile" ON public."Profiles"
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can view own game profiles" ON public.game_profiles
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own host request" ON public.host_requests
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own notifications" ON public.notifications
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own reports" ON public.reports
  USING ((select auth.uid()) = reporter_id);

ALTER POLICY "Users manage own blocks" ON public.blocks
  USING ((select auth.uid()) = blocker_id)
  WITH CHECK ((select auth.uid()) = blocker_id);

ALTER POLICY "View follows respecting privacy" ON public.follows
  USING (
    (select auth.uid()) = follower_id
    OR (select auth.uid()) = following_id
    OR EXISTS (
      SELECT 1 FROM public."Profiles" me
      WHERE me.id = (select auth.uid()) AND me.is_admin = true
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public."Profiles" p
        WHERE p.id = follows.following_id AND p.follow_list_private = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM public."Profiles" p
        WHERE p.id = follows.follower_id AND p.follow_list_private = true
      )
    )
  );
