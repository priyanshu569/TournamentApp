-- Reports: let reporters attach proof screenshots, let world chat
-- posts be reported (not just messages/profiles), let admins leave a
-- resolution note, and notify the reporter of the outcome. Message/post
-- content isn't visible to admins through normal RLS (messages are
-- participant-only, and an admin reviewing a report is rarely a
-- participant) -- a security-definer RPC exposes just enough of the
-- reported message for admins to see what was actually reported.

alter table public.reports
  add column reported_post_id uuid references public.world_chat_posts(id),
  add column proof_image_url text,
  add column admin_response text;

insert into storage.buckets (id, name, public)
values ('report-proof-images', 'report-proof-images', false)
on conflict (id) do nothing;

create policy "Reporters can upload their own proof images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'report-proof-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Reporters and admins can view proof images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'report-proof-images'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or exists (select 1 from public."Profiles" p where p.id = (select auth.uid()) and p.is_admin = true)
    )
  );

create or replace function public.get_reported_message(p_message_id uuid)
returns table(content text, image_url text, audio_url text, sender_id uuid, conversation_id uuid, created_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from "Profiles" where id = (select auth.uid()) and is_admin = true) then
    raise exception 'Not authorized';
  end if;

  return query
  select m.content, m.image_url, m.audio_url, m.sender_id, m.conversation_id, m.created_at
  from messages m
  where m.id = p_message_id;
end;
$$;

grant execute on function public.get_reported_message(uuid) to authenticated;
