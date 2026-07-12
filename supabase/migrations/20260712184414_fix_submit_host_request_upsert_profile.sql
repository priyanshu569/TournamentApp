-- Fixes a foreign-key violation: submit_host_request() only UPDATEd Profiles,
-- but host_requests.user_id references Profiles(id). A brand-new user who
-- taps "Request Host Access" from select-role.tsx before ever tapping
-- "Continue as Player" (the only other place that creates a Profiles row)
-- has no Profiles row yet, so the host_requests insert failed. Now upserts
-- the Profiles row first, in the same function, before inserting the request.

create or replace function public.submit_host_request(p_name text, p_contact text, p_details text)
returns uuid
language plpgsql security definer
as $$
declare
  v_id uuid;
begin
  insert into public."Profiles" (id, role, host_status)
  values (auth.uid(), 'player', 'pending')
  on conflict (id) do update
    set host_status = 'pending',
        role = coalesce(public."Profiles".role, 'player');

  insert into public.host_requests (user_id, name, contact, details)
  values (auth.uid(), p_name, p_contact, p_details)
  returning id into v_id;

  return v_id;
end;
$$;
