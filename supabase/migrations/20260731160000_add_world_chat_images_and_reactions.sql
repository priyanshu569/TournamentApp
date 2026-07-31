-- World chat: raise the character cap to 1000, allow one photo per
-- post, replace the old "10 posts / 10 minutes" rate limit with a
-- "10 posts / day" cap (images capped separately at 1/day), and add
-- reactions. Replies get the same 1000-char cap for a consistent
-- composer but stay text-only and keep their existing 10/10min limit --
-- they're a lighter-weight action than a top-level post.

alter table public.world_chat_posts
  add column image_url text,
  add column image_width int,
  add column image_height int;

alter table public.world_chat_posts drop constraint world_chat_posts_content_check;
alter table public.world_chat_posts add constraint world_chat_posts_content_check
  check (char_length(content) <= 1000 and (char_length(content) > 0 or image_url is not null));

alter table public.world_chat_replies drop constraint world_chat_replies_content_check;
alter table public.world_chat_replies add constraint world_chat_replies_content_check
  check (char_length(content) > 0 and char_length(content) <= 1000);

drop policy "Rate limited posting to world chat" on public.world_chat_posts;

create policy "Rate limited posting to world chat"
  on public.world_chat_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      select count(*) from public.world_chat_posts
      where author_id = (select auth.uid())
        and created_at > now() - interval '1 day'
    ) < 10
    and (
      image_url is null
      or (
        select count(*) from public.world_chat_posts
        where author_id = (select auth.uid())
          and image_url is not null
          and created_at > now() - interval '1 day'
      ) < 1
    )
  );

insert into storage.buckets (id, name, public)
values ('world-chat-images', 'world-chat-images', true)
on conflict (id) do nothing;

create policy "Anyone can view world chat images"
  on storage.objects for select
  to public
  using (bucket_id = 'world-chat-images');

create policy "Users can upload their own world chat images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'world-chat-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ============================================================
-- Reactions: one reaction per user per post (re-tapping the same
-- emoji removes it, tapping a different one replaces it) -- same
-- model as the existing DM message_reactions table.
-- ============================================================

create table public.world_chat_post_reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.world_chat_posts(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index world_chat_post_reactions_post_idx on public.world_chat_post_reactions (post_id);

alter table public.world_chat_post_reactions enable row level security;

create policy "Anyone can view world chat reactions"
  on public.world_chat_post_reactions for select
  using (true);

create policy "Users manage their own world chat reactions"
  on public.world_chat_post_reactions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant all on table public.world_chat_post_reactions to authenticated;
