-- Rate limits on chat messages (60/min general spam guard, 4 photos/day
-- since photos are the expensive part), plus admin exemptions across
-- every existing rate limit -- world chat posts/replies and now chat
-- messages/images. Admins are trusted by definition (they can already
-- delete anyone's content and read reports), so throttling them serves
-- no purpose and only gets in the way of moderation work.

create index if not exists messages_sender_recency_idx on public.messages (sender_id, created_at desc);

drop policy "Participants can send messages" on public.messages;

create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
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
      or (
        select count(*) from public.messages
        where sender_id = auth.uid() and created_at > now() - interval '1 minute'
      ) < 60
    )
    and (
      image_url is null
      or exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
      or (
        select count(*) from public.messages
        where sender_id = auth.uid() and image_url is not null and created_at > now() - interval '1 day'
      ) < 4
    )
  );

drop policy "Rate limited posting to world chat" on public.world_chat_posts;

create policy "Rate limited posting to world chat"
  on public.world_chat_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
      or (
        select count(*) from public.world_chat_posts
        where author_id = (select auth.uid())
          and created_at > now() - interval '1 day'
      ) < 10
    )
    and (
      image_url is null
      or exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
      or (
        select count(*) from public.world_chat_posts
        where author_id = (select auth.uid())
          and image_url is not null
          and created_at > now() - interval '1 day'
      ) < 1
    )
  );

drop policy "Rate limited replying in world chat" on public.world_chat_replies;

create policy "Rate limited replying in world chat"
  on public.world_chat_replies for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
      or (
        select count(*) from public.world_chat_replies
        where author_id = (select auth.uid())
          and created_at > now() - interval '10 minutes'
      ) < 10
    )
  );
