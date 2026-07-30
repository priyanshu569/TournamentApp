-- Group management: admins, member add/remove, group photo/description,
-- and system messages ("X added Y", "X is now an admin") logging what
-- happened directly in the chat feed, the way WhatsApp/Telegram do.

alter table public.conversation_participants
  add column is_admin boolean not null default false;

alter table public.conversations
  add column avatar_url text,
  add column description text;

alter table public.messages
  add column is_system boolean not null default false;

-- ============================================================
-- Group creation: creator becomes admin, logs a system message.
-- Replaces the version from 20260711173717_add_social_layer.sql.
-- ============================================================

create or replace function public.create_group_conversation(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_uid uuid := (select auth.uid());
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.conversations (conversation_type, name) values ('group', p_name) returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, is_admin) values (v_conversation_id, v_uid, true);

  foreach v_member in array p_member_ids loop
    if v_member <> v_uid then
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conversation_id, v_member)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  insert into public.messages (conversation_id, sender_id, content, is_system)
  values (v_conversation_id, v_uid, 'created the group', true);

  return v_conversation_id;
end;
$$;

-- ============================================================
-- Admin management RPCs
-- ============================================================

create or replace function public.is_group_admin(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = p_user_id
      and is_admin = true
  );
$$;

create or replace function public.add_group_members(p_conversation_id uuid, p_member_ids uuid[])
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member uuid;
  v_added_names text[] := '{}';
  v_name text;
begin
  if not public.is_group_admin(p_conversation_id, v_uid) then
    raise exception 'Only group admins can add members.';
  end if;

  foreach v_member in array p_member_ids loop
    insert into public.conversation_participants (conversation_id, user_id)
    values (p_conversation_id, v_member)
    on conflict (conversation_id, user_id) do nothing;

    if found then
      select display_name into v_name from public."Profiles" where id = v_member;
      v_added_names := array_append(v_added_names, coalesce(v_name, 'someone'));
    end if;
  end loop;

  if coalesce(array_length(v_added_names, 1), 0) > 0 then
    insert into public.messages (conversation_id, sender_id, content, is_system)
    values (p_conversation_id, v_uid, 'added ' || array_to_string(v_added_names, ', '), true);
  end if;
end;
$$;

create or replace function public.remove_group_member(p_conversation_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
begin
  if not public.is_group_admin(p_conversation_id, v_uid) then
    raise exception 'Only group admins can remove members.';
  end if;

  if p_user_id = v_uid then
    raise exception 'Use "Leave Group" to remove yourself.';
  end if;

  if public.is_group_admin(p_conversation_id, p_user_id)
    and (select count(*) from public.conversation_participants where conversation_id = p_conversation_id and is_admin = true) <= 1
  then
    raise exception 'Promote another admin first -- a group needs at least one.';
  end if;

  select display_name into v_name from public."Profiles" where id = p_user_id;

  delete from public.conversation_participants
  where conversation_id = p_conversation_id and user_id = p_user_id;

  if found then
    insert into public.messages (conversation_id, sender_id, content, is_system)
    values (p_conversation_id, v_uid, 'removed ' || coalesce(v_name, 'a member'), true);
  end if;
end;
$$;

create or replace function public.set_group_admin(p_conversation_id uuid, p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
begin
  if not public.is_group_admin(p_conversation_id, v_uid) then
    raise exception 'Only group admins can change admin status.';
  end if;

  if not p_is_admin
    and (select count(*) from public.conversation_participants where conversation_id = p_conversation_id and is_admin = true) <= 1
  then
    raise exception 'A group needs at least one admin -- promote someone else first.';
  end if;

  update public.conversation_participants
  set is_admin = p_is_admin
  where conversation_id = p_conversation_id and user_id = p_user_id;

  if found then
    select display_name into v_name from public."Profiles" where id = p_user_id;
    insert into public.messages (conversation_id, sender_id, content, is_system)
    values (
      p_conversation_id, v_uid,
      coalesce(v_name, 'A member') || (case when p_is_admin then ' is now an admin' else ' is no longer an admin' end),
      true
    );
  end if;
end;
$$;

grant execute on function public.is_group_admin(uuid, uuid) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.set_group_admin(uuid, uuid, boolean) to authenticated;

-- ============================================================
-- Group photo / name / description -- admins only. Storage bucket is
-- public (it's just a group icon, same sensitivity level as profile
-- photos), but only an admin of that group can upload to its path.
-- ============================================================

create policy "Group admins can update their group's info"
  on public.conversations for update
  to authenticated
  using (
    conversation_type = 'group'
    and public.is_group_admin(id, (select auth.uid()))
  );

insert into storage.buckets (id, name, public)
values ('group-photos', 'group-photos', true)
on conflict (id) do nothing;

create policy "Anyone can view group photos"
  on storage.objects for select
  to public
  using (bucket_id = 'group-photos');

create policy "Group admins can upload their group's photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'group-photos'
    and public.is_group_admin((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );

create policy "Group admins can replace their group's photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_admin((storage.foldername(name))[1]::uuid, (select auth.uid()))
  );
