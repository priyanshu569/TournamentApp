-- World Chat: a public community feed. Anyone (authenticated) can post,
-- anyone can read, posts can get replies. Two independent limits on
-- posting, both enforced server-side (client-side only would be
-- trivially bypassable via the API directly):
--   - character limit: 300 chars, enforced as a table CHECK constraint
--   - rate limit: 10 posts per 10 minutes per user, enforced in the
--     INSERT policy's WITH CHECK via a recency count
-- Deletion: a user can delete their own post/reply, or an admin can
-- delete anyone's (same is_admin pattern used elsewhere in this app).
-- No UPDATE policy -- posts/replies aren't editable after posting.
--
-- author_id has no ON DELETE CASCADE to Profiles: delete_own_account()
-- anonymizes the Profiles row in place rather than deleting it, so
-- world chat history survives an account deletion the same way
-- tournament/team history already does elsewhere in this app.

create table public.world_chat_posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid not null references public."Profiles"(id),
  content text not null check (char_length(content) > 0 and char_length(content) <= 300),
  created_at timestamp with time zone not null default now()
);

create table public.world_chat_replies (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.world_chat_posts(id) on delete cascade,
  author_id uuid not null references public."Profiles"(id),
  content text not null check (char_length(content) > 0 and char_length(content) <= 300),
  created_at timestamp with time zone not null default now()
);

create index world_chat_posts_created_at_idx on public.world_chat_posts (created_at desc);
create index world_chat_replies_post_id_idx on public.world_chat_replies (post_id);
create index world_chat_posts_author_recency_idx on public.world_chat_posts (author_id, created_at desc);
create index world_chat_replies_author_recency_idx on public.world_chat_replies (author_id, created_at desc);

alter table public.world_chat_posts enable row level security;
alter table public.world_chat_replies enable row level security;

create policy "Anyone can view world chat posts"
  on public.world_chat_posts for select
  using (true);

create policy "Anyone can view world chat replies"
  on public.world_chat_replies for select
  using (true);

create policy "Rate limited posting to world chat"
  on public.world_chat_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      select count(*) from public.world_chat_posts
      where author_id = (select auth.uid())
        and created_at > now() - interval '10 minutes'
    ) < 10
  );

create policy "Rate limited replying in world chat"
  on public.world_chat_replies for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      select count(*) from public.world_chat_replies
      where author_id = (select auth.uid())
        and created_at > now() - interval '10 minutes'
    ) < 10
  );

create policy "Users delete own world chat posts, admins delete any"
  on public.world_chat_posts for delete
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public."Profiles" p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

create policy "Users delete own world chat replies, admins delete any"
  on public.world_chat_replies for delete
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public."Profiles" p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );
