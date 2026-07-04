-- The History tab was showing "0 tournaments joined" despite real confirmed
-- registrations existing. Root cause turned out to be a missing/uncached
-- foreign key between registrations.tournament_id and tournaments.id in
-- PostgREST's schema cache — not RLS, and not tab-mount staleness, as first
-- suspected. This migration is idempotent: it adds the FK only if it isn't
-- already present, then forces PostgREST to reload its schema cache.

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
    where tc.table_name = 'registrations'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'tournament_id'
  ) then
    alter table public.registrations
      add constraint registrations_tournament_id_fkey
      foreign key (tournament_id)
      references public.tournaments(id)
      on delete cascade;
  end if;
end $$;

-- Force PostgREST (Supabase's auto-generated API layer) to pick up the FK
-- immediately rather than waiting for its own cache TTL.
notify pgrst, 'reload schema';
