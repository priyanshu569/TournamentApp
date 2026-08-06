-- Locks down three things a host could previously do that shouldn't be
-- freely reversible: changing the announced date/time after creation,
-- moving status backward (ongoing -> upcoming, completed -> anything),
-- and self-marking their own results as admin-verified. Admins are
-- exempt from all three -- they're the intended override path when a
-- host's mistake needs correcting.
--
-- The "Hosts can update own tournaments" policy has never had an admin
-- clause (checked: only ever host_id = auth.uid(), since baseline) --
-- without adding one, admins have no real ability to exercise the
-- override this migration is meant to give them, so that's fixed here
-- too, not just the lock rules themselves.
--
-- RLS alone can't compare a row's old and new values in one expression
-- (WITH CHECK only sees the proposed new row), so the actual lock logic
-- is a BEFORE UPDATE trigger, which has OLD/NEW both.

alter table public.tournaments
  add column results_verified_at timestamptz,
  add column results_verified_by uuid references public."Profiles"(id);

comment on column public.tournaments.results_verified_at is
  'Set by an admin after reviewing a completed tournament''s uploaded results. Players see "results pending verification" instead of "tournament has ended" until this is set.';

alter policy "Hosts can update own tournaments" on public.tournaments
  using (
    (select auth.uid()) = host_id
    or exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
  );

create or replace function public.enforce_tournament_lock_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_status_rank constant jsonb := '{"upcoming": 0, "ongoing": 1, "completed": 2}'::jsonb;
begin
  select exists (select 1 from "Profiles" p where p.id = auth.uid() and p.is_admin = true) into v_is_admin;

  if v_is_admin then
    return new;
  end if;

  if new.start_time is distinct from old.start_time then
    raise exception 'Only an admin can change a tournament''s date and time once it has been created.';
  end if;

  if (v_status_rank->>new.status)::int < (v_status_rank->>old.status)::int then
    raise exception 'Tournament status can''t be moved backward. Ask an admin if this needs to be corrected.';
  end if;

  if new.results_verified_at is distinct from old.results_verified_at
     or new.results_verified_by is distinct from old.results_verified_by then
    raise exception 'Only an admin can verify tournament results.';
  end if;

  return new;
end;
$$;

create trigger tournament_lock_rules
  before update on public.tournaments
  for each row
  execute function public.enforce_tournament_lock_rules();
