-- "infinite recursion detected in policy for relation X" on every message
-- send. Root cause: the rate-limit clauses in messages/world_chat_posts/
-- world_chat_replies' INSERT policies (from 20260731190000) used
-- "select count(*) from <same table> where ..." directly inside their
-- own WITH CHECK. That self-referential-subquery-inside-an-INSERT-policy
-- shape is a known Postgres RLS gotcha: a plain SELECT with the same
-- shape evaluates fine (confirmed by testing in isolation), but
-- evaluating it as part of the SAME table's own INSERT check triggers
-- Postgres's recursion guard. This was already latent before today's
-- session -- world_chat_posts/replies have the identical pattern and
-- were never actually exercised by anyone tripping it.
--
-- Fix: move each self-count into its own SECURITY DEFINER function.
-- SECURITY DEFINER functions run as their owner (the migration role,
-- which owns these tables) and so bypass RLS for their internal query --
-- the same reason every other cross-table check in this codebase
-- (distribute_tournament_prizes, redeem_reward, etc.) already uses this
-- pattern. That breaks the self-reference: the count query no longer
-- needs to re-evaluate the INSERT policy it's being called from.
--
-- Verified against the linked database in a rolled-back transaction
-- before writing this migration -- the recursion reproduced with the
-- old shape and was gone with this one.

create or replace function public.count_recent_own_messages(p_window interval, p_image_or_view_once_only boolean default false)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.messages
  where sender_id = auth.uid()
    and created_at > now() - p_window
    and (not p_image_or_view_once_only or image_url is not null or view_once);
$$;

grant execute on function public.count_recent_own_messages(interval, boolean) to authenticated;

alter policy "Participants can send messages" on public.messages
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
    and not exists (
      select 1
      from public.conversations c
      join public.conversation_participants other
        on other.conversation_id = c.id and other.user_id <> auth.uid()
      join public.blocks b
        on (b.blocker_id = other.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = other.user_id)
      where c.id = messages.conversation_id and c.conversation_type = 'direct'
    )
    and (
      exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
      or public.count_recent_own_messages(interval '1 minute') < 60
    )
    and (
      (image_url is null and not coalesce(view_once, false))
      or exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
      or public.count_recent_own_messages(interval '1 day', true) < 4
    )
  );

create or replace function public.count_recent_own_world_posts(p_window interval, p_image_only boolean default false)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.world_chat_posts
  where author_id = auth.uid()
    and created_at > now() - p_window
    and (not p_image_only or image_url is not null);
$$;

grant execute on function public.count_recent_own_world_posts(interval, boolean) to authenticated;

alter policy "Rate limited posting to world chat" on public.world_chat_posts
  with check (
    (select auth.uid()) = author_id
    and (
      exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
      or public.count_recent_own_world_posts(interval '1 day') < 10
    )
    and (
      image_url is null
      or exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
      or public.count_recent_own_world_posts(interval '1 day', true) < 1
    )
  );

create or replace function public.count_recent_own_world_replies(p_window interval)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int from public.world_chat_replies
  where author_id = auth.uid()
    and created_at > now() - p_window;
$$;

grant execute on function public.count_recent_own_world_replies(interval) to authenticated;

alter policy "Rate limited replying in world chat" on public.world_chat_replies
  with check (
    (select auth.uid()) = author_id
    and (
      exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
      or public.count_recent_own_world_replies(interval '10 minutes') < 10
    )
  );
