-- Delete Account (required for Apple App Store approval, guideline 5.1.1v).
-- Approach: anonymize-on-delete. The Profiles row is scrubbed of personal
-- data but kept (same id), so every foreign key pointing to it — tournaments
-- .host_id, teams.captain_id, registrations.player_id, notifications.user_id,
-- match_results.player_id, host_requests.user_id/reviewed_by — stays valid
-- with no rewriting needed. Other players'/hosts' tournament history is
-- unaffected. The actual auth.users credential is then deleted so the person
-- genuinely can't log back in.

alter table public."Profiles"
  add column is_deleted boolean not null default false;

comment on column public."Profiles".is_deleted is
  'True once the user has deleted their account via delete_own_account(). Personal fields are scrubbed but the row is kept so historical foreign keys stay valid.';

create function public.delete_own_account()
returns void
language plpgsql security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public."Profiles"
  set username = null,
      free_fire_uid = null,
      bgmi_uid = null,
      phone = null,
      push_token = null,
      role = null,
      host_status = 'none',
      is_admin = false,
      is_deleted = true
  where id = v_uid;

  delete from auth.users where id = v_uid;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
