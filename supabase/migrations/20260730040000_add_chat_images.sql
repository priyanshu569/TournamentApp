-- Image messages in 1:1/group chat, mirroring the voice-message bucket
-- ("chat-audio" in 20260729034452_add_voice_messages.sql): private
-- bucket, RLS gated on conversation membership via the upload path's
-- folder structure "{conversation_id}/{sender_id}/{timestamp}.jpg".

alter table public.messages
  add column image_url text;

comment on column public.messages.image_url is
  'Storage path (not a public URL -- bucket is private) of an image message in the chat-images bucket, if this message is one.';

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

create policy "Participants can view their conversations' images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[1]
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Participants can upload images to their conversations"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id::text = (storage.foldername(name))[1]
        and cp.user_id = (select auth.uid())
    )
  );

create policy "Senders can delete their own chat images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = (select auth.uid()::text)
  );
