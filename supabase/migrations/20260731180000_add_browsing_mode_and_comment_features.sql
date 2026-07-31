-- Three unrelated additions bundled together since they're small:
--
-- 1. browsing_mode: a host can browse the app as a player without
--    changing their actual identity. Previously "switch to player"
--    mutated role/host_status directly, which made a host's own posts
--    and messages show up publicly labeled "Player" -- wrong, since
--    everyone else should still see them as a Host regardless of how
--    they're personally browsing. role/host_status now stay untouched
--    by view-switching; only this new column reflects the temporary
--    view, and only screens gating *functionality* (which dashboard to
--    show) should read it -- public designations (getDesignation etc.)
--    keep reading role/is_admin exactly as before.
--
-- 2. Threaded comment replies: world_chat_replies gets a self-referencing
--    reply_to_id so a reply can target another reply, not just the post.
--
-- 3. Comment likes and post saves: same one-row-per-user model as the
--    existing world_chat_post_reactions table.

alter table public."Profiles"
  add column browsing_mode text check (browsing_mode in ('player', 'host'));

comment on column public."Profiles".browsing_mode is
  'Personal view preference for a host browsing as a player (or back). Never mutates role/host_status, and is never exposed via public_profiles -- it only affects what the owning user sees of their own app, not how others see them.';

alter table public.world_chat_replies
  add column reply_to_id uuid references public.world_chat_replies(id) on delete set null;

create table public.world_chat_reply_likes (
  id uuid default gen_random_uuid() primary key,
  reply_id uuid not null references public.world_chat_replies(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  created_at timestamptz not null default now(),
  unique (reply_id, user_id)
);

create index world_chat_reply_likes_reply_idx on public.world_chat_reply_likes (reply_id);
alter table public.world_chat_reply_likes enable row level security;

create policy "Anyone can view comment likes"
  on public.world_chat_reply_likes for select
  using (true);

create policy "Users manage their own comment likes"
  on public.world_chat_reply_likes for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant all on table public.world_chat_reply_likes to authenticated;

create table public.world_chat_post_saves (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.world_chat_posts(id) on delete cascade,
  user_id uuid not null references public."Profiles"(id),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index world_chat_post_saves_user_idx on public.world_chat_post_saves (user_id);
alter table public.world_chat_post_saves enable row level security;

create policy "Users view their own saves"
  on public.world_chat_post_saves for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users manage their own saves"
  on public.world_chat_post_saves for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant all on table public.world_chat_post_saves to authenticated;
