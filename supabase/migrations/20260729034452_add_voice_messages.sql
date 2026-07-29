-- Voice messages in 1:1/group chat (not World Chat). Unlike the
-- avatar/banner buckets, this one is NOT public -- a voice message
-- carries the same privacy expectation as the text message it
-- replaces, which is already scoped to conversation participants via
-- the messages table's own RLS. A public bucket would bypass that
-- entirely (anyone with the URL could listen, participant or not), so
-- this uses a private bucket with storage RLS that checks conversation
-- membership via the upload path's folder structure:
-- "{conversation_id}/{sender_id}/{timestamp}.m4a".

alter table public.messages
  add column audio_url text,
  add column audio_duration_seconds integer;

comment on column public.messages.audio_url is
  'Storage path (not a public URL -- bucket is private) of a voice message in the chat-audio bucket, if this message is one.';

insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', false)
on conflict (id) do nothing;

create policy "Participants can view their conversations' audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-audio'
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[1]
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Participants can upload audio to their conversations"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-audio'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[1]
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Senders can delete their own voice messages"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-audio'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );
