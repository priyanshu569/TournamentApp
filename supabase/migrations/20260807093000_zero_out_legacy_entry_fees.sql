-- One-time data fix, not a schema change: 6 tournaments created before
-- the FragCoins pivot (entry_fee: 0 has been hardcoded in
-- create-tournament.tsx/edit-tournament.tsx ever since) still carry a
-- nonzero entry_fee -- Dragons, FFIC, FFwednesday, Ninja, TeamSniper,
-- XYZ-Esports. Anyone registering for one of them right now gets routed
-- to payment.tsx, which calls the create-razorpay-order edge function --
-- which is deliberately not deployed (paid entry is on hold pending
-- store-compliant billing). That's a dead end with no way to ever
-- succeed, not a "held for later" state.
--
-- This zeroes those 6 rows out to match every tournament created since,
-- so new registration attempts go through the normal free-confirmation
-- path instead. Existing registrations on these tournaments are
-- untouched -- only entry_fee changes.
update public.tournaments
  set entry_fee = 0
  where id in (
    '75417a9c-e4fc-494f-ac09-922a2b9dc130', -- Dragons
    'a6aee9df-996c-48a5-9bee-c15a58e42f6e', -- FFIC
    'cf5ab675-39f0-4932-b140-c5412b6829b4', -- FFwednesday
    'dcade03c-ab68-44b1-b930-636c23bbf282', -- Ninja
    '1c18f7b0-a5a9-4b57-82f4-d69551825542', -- TeamSniper
    'd11ad45b-e3ca-40a4-8988-2ab3d0cbd361'  -- XYZ-Esports
  );
