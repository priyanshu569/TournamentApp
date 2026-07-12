-- Fixes a fake control: Settings' "Push Notifications" toggle was bound to a
-- local AsyncStorage boolean that nothing in lib/notifications.ts ever read.
-- Turning it off did nothing — pushes and in-app rows kept arriving exactly
-- as before. Replaces it with a real, server-side preference so it actually
-- works (and survives reinstalls/new devices, unlike AsyncStorage).
--
-- Also adds a DELETE policy for notifications — there wasn't one, so users
-- had no way to clear old notifications even client-side.

alter table public."Profiles"
  add column push_enabled boolean not null default true;

-- Both cross-user push-token lookups now null out the token (but still
-- return the row, so the in-app notification is still logged) when the
-- recipient has opted out.

create or replace function public.get_broadcast_recipients(target_role text) returns table(user_id uuid, push_token text)
    language plpgsql security definer
    as $$
begin
  if not exists (
    select 1 from "Profiles" pr where pr.id = auth.uid() and pr.is_admin = true
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id as user_id, case when p.push_enabled then p.push_token else null end as push_token
  from "Profiles" p
  where (target_role = 'all' or p.role = target_role);
end;
$$;

create or replace function public.get_confirmed_players(target_tournament_id uuid) returns table(user_id uuid, push_token text)
    language plpgsql security definer
    as $$
begin
  if not exists (
    select 1 from tournaments t
    where t.id = target_tournament_id and t.host_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id as user_id, case when p.push_enabled then p.push_token else null end as push_token
  from registrations r
  join "Profiles" p on p.id = r.player_id
  where r.tournament_id = target_tournament_id
    and r.status = 'confirmed';
end;
$$;

create policy "Users can delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);
