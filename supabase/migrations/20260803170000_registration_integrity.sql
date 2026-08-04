-- Closes two integrity gaps in tournament registration found during a
-- review of the registration flow:
--
-- 1. Nothing prevented the same player from registering more than one team
--    for the same tournament. There was no unique constraint, and
--    create-team.tsx's "already registered" gate is a client-side UX
--    convenience only -- not a security boundary, since any client can call
--    the REST API directly with their own JWT and skip the app entirely.
--
-- 2. max_teams was only checked client-side (in create-team.tsx, before the
--    insert): a classic check-then-act race. Two players near the last slot
--    could both pass that check and both insert, overbooking the
--    tournament. Also trivially bypassable via a direct API call.

-- One-time cleanup: this constraint already has a real violator in
-- production -- player 0bf0154e-4020-4a64-b5b6-cf39b158895f holds two
-- confirmed, unpaid registrations for tournament dcade03c-ab68-44b1-b930-
-- 636c23bbf282 ("hsffay" from 2026-06-22, "Testing1" from 2026-06-27).
-- Both team names and the lack of any payment strongly suggest this is
-- leftover test data from development, not a real player. Keeping the
-- earlier one and removing the later duplicate so the constraint below can
-- actually be added -- flagging this here rather than deciding it silently.
delete from public.registrations
  where id = '65e3a6cb-d52f-4b66-a888-68760cd7130c';

-- (1) One active registration per player per tournament. Registrations are
-- hard-deleted on cancellation (see cancel_registration()), never soft-
-- cancelled with a status flag, so a plain unique constraint is correct --
-- there's no legitimate "cancelled" row that should coexist with a new one.
alter table public.registrations
  add constraint registrations_one_per_player_per_tournament
  unique (tournament_id, player_id);

-- (2) Enforce max_teams server-side too, as defense-in-depth alongside the
-- existing client-side check. This narrows but does not fully eliminate the
-- race window under READ COMMITTED -- two inserts landing in the same
-- instant could still both pass this subquery before either commits.
-- Closing that completely would mean routing registration through a
-- SECURITY DEFINER function that locks the tournament row first. Left as a
-- known residual gap: a near-simultaneous overbook by more than one slot is
-- low-probability and low-consequence enough here not to warrant that
-- bigger structural change yet.
alter policy "Players can register their team" on public.registrations
  with check (
    (select auth.uid()) = player_id
    and (
      select tournaments.status from public.tournaments
      where tournaments.id = registrations.tournament_id
    ) = 'upcoming'
    and (
      select count(*) from public.registrations r2
      where r2.tournament_id = registrations.tournament_id
    ) < (
      select coalesce(tournaments.max_teams, 2147483647) from public.tournaments
      where tournaments.id = registrations.tournament_id
    )
  );
