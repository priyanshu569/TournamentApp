-- Role selection rework: host access is no longer self-service. A user
-- requests it (host_requests row), an admin approves/rejects it, and only
-- then does tournaments-creation become allowed for them.

alter table public."Profiles"
  add column host_status text not null default 'none';

alter table public."Profiles"
  add constraint profiles_host_status_check
    check (host_status in ('none', 'pending', 'approved', 'rejected'));

comment on column public."Profiles".host_status is
  'none | pending | approved | rejected — tracks the host access request lifecycle. Only approved may create tournaments.';

-- Backfill: anyone who already has role = host today keeps host capability.
update public."Profiles" set host_status = 'approved' where role = 'host';

create table public.host_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."Profiles"(id),
  name text not null,
  contact text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public."Profiles"(id)
);

comment on table public.host_requests is
  'Requests from players to become hosts, reviewed by an admin via admin-host-requests.tsx.';

alter table public.host_requests enable row level security;

create policy "Users can view own host request"
  on public.host_requests for select
  using (auth.uid() = user_id);

create policy "Admins can view all host requests"
  on public.host_requests for select
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

grant all on table public.host_requests to anon, authenticated, service_role;

-- Submits a host request and flips the caller's own host_status to pending,
-- atomically. Also backfills role to 'player' if it was never set, so a
-- brand-new user choosing the host path from select-role.tsx isn't left with
-- no role at all while their request is reviewed.
create function public.submit_host_request(p_name text, p_contact text, p_details text)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid;
begin
  insert into public.host_requests (user_id, name, contact, details)
  values (auth.uid(), p_name, p_contact, p_details)
  returning id into v_id;

  update public."Profiles"
  set host_status = 'pending',
      role = coalesce(role, 'player')
  where id = auth.uid();

  return v_id;
end;
$$;

grant execute on function public.submit_host_request(text, text, text) to authenticated;

-- Admin approves/rejects a request; keeps host_requests and Profiles.host_status
-- in sync in one transaction rather than exposing a raw UPDATE policy.
create function public.review_host_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql security definer
as $$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from public."Profiles" where id = auth.uid() and is_admin = true) then
    raise exception 'Not authorized';
  end if;

  select user_id into v_user_id from public.host_requests where id = p_request_id;

  if v_user_id is null then
    raise exception 'Request not found';
  end if;

  update public.host_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_request_id;

  update public."Profiles"
  set host_status = case when p_approve then 'approved' else 'rejected' end,
      role = case when p_approve then 'host' else role end
  where id = v_user_id;
end;
$$;

grant execute on function public.review_host_request(uuid, boolean) to authenticated;

-- Lets a regular player fetch admin push tokens ONLY to notify them about
-- their own just-submitted host request — scoped by request ownership so it
-- can't be used to indiscriminately harvest admin tokens.
create function public.notify_admins_of_host_request(p_request_id uuid)
returns table(user_id uuid, push_token text)
language plpgsql security definer
as $$
begin
  if not exists (
    select 1 from public.host_requests where id = p_request_id and user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id as user_id, p.push_token
  from public."Profiles" p
  where p.is_admin = true;
end;
$$;

grant execute on function public.notify_admins_of_host_request(uuid) to authenticated;

-- insert_notification previously allowed: notifying yourself, a host notifying
-- a confirmed player of their own tournament, or an admin broadcasting. Add a
-- fourth case: anyone may notify an admin (needed for the host-request flow).
create or replace function public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid default null::uuid) returns void
    language plpgsql security definer
    as $$
begin
  if auth.uid() = p_user_id then
    -- notifying yourself (e.g. free registration confirmed)
  elsif p_tournament_id is not null and exists (
    select 1 from tournaments where id = p_tournament_id and host_id = auth.uid()
  ) then
    -- host notifying a confirmed player of their own tournament
  elsif exists (
    select 1 from "Profiles" where id = auth.uid() and is_admin = true
  ) then
    -- admin broadcast
  elsif exists (
    select 1 from "Profiles" where id = p_user_id and is_admin = true
  ) then
    -- anyone notifying an admin (e.g. new host request submitted)
  else
    raise exception 'Not authorized to send notification to this user';
  end if;

  insert into notifications (user_id, title, body, tournament_id)
  values (p_user_id, p_title, p_body, p_tournament_id);
end;
$$;

-- Host-only actions now require host_status = 'approved', not just role = 'host'.
drop policy if exists "Hosts can create tournaments" on public.tournaments;

create policy "Hosts can create tournaments"
  on public.tournaments for insert
  to authenticated
  with check (
    auth.uid() = host_id
    and exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.host_status = 'approved')
  );
