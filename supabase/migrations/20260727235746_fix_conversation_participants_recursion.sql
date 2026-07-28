-- Fixes "infinite recursion detected in policy for relation
-- conversation_participants", introduced by the earlier
-- fix_auth_rls_initialization_plan migration.
--
-- "See participants of your own conversations" checks membership by
-- querying conversation_participants from inside its own USING clause.
-- Wrapping auth.uid() as (select auth.uid()) changed the query plan
-- enough to trigger genuine RLS self-reference recursion, where the
-- original bare auth.uid() form happened not to.
--
-- Fix: move the membership check into a SECURITY DEFINER function.
-- Calling a function is opaque to the RLS recursion check, so the
-- function's internal query does not re-trigger this same policy,
-- while still only evaluating auth.uid() once per query.

CREATE FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  );
$$;

ALTER POLICY "See participants of your own conversations" ON public.conversation_participants
  USING (public.is_conversation_participant(conversation_id, (select auth.uid())));
