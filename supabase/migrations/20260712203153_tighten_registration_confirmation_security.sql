-- Close a payment-bypass hole: the "Players can update own registration" UPDATE
-- policy had no WITH CHECK, so any player could set their own registration's
-- status straight to 'confirmed' via the client, skipping payment entirely.
-- Fix: drop that policy, and route both confirmation paths through
-- SECURITY DEFINER functions that validate the business rule server-side.

ALTER TABLE public.registrations
  ADD COLUMN razorpay_order_id text,
  ADD COLUMN razorpay_payment_id text;

CREATE UNIQUE INDEX registrations_razorpay_payment_id_key
  ON public.registrations (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

DROP POLICY "Players can update own registration" ON public.registrations;

-- Free tournaments: still player-initiated, but the function itself checks
-- the tournament truly has no entry fee before confirming.
CREATE FUNCTION public.confirm_free_registration(p_registration_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_tournament_id uuid;
  v_player_id uuid;
  v_status text;
  v_entry_fee numeric;
BEGIN
  SELECT r.tournament_id, r.player_id, r.status
    INTO v_tournament_id, v_player_id, v_status
  FROM registrations r
  WHERE r.id = p_registration_id;

  IF v_player_id IS NULL OR v_player_id <> auth.uid() THEN
    RAISE EXCEPTION 'Registration not found or not yours';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Registration is not pending';
  END IF;

  SELECT entry_fee INTO v_entry_fee FROM tournaments WHERE id = v_tournament_id;

  IF v_entry_fee IS NOT NULL AND v_entry_fee > 0 THEN
    RAISE EXCEPTION 'This tournament requires payment and cannot be self-confirmed';
  END IF;

  UPDATE registrations SET status = 'confirmed' WHERE id = p_registration_id;
END;
$$;

ALTER FUNCTION public.confirm_free_registration(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.confirm_free_registration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_free_registration(uuid) TO authenticated;

-- Paid tournaments: only ever called by the verify-razorpay-payment edge
-- function (service_role), after it has verified the Razorpay signature.
-- Amount is re-checked here as defense-in-depth in case that function's
-- caller-side check is ever bypassed or misused.
CREATE FUNCTION public.confirm_paid_registration(
  p_registration_id uuid,
  p_amount_paid numeric,
  p_razorpay_payment_id text
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_tournament_id uuid;
  v_status text;
  v_entry_fee numeric;
BEGIN
  SELECT r.tournament_id, r.status INTO v_tournament_id, v_status
  FROM registrations r
  WHERE r.id = p_registration_id;

  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  IF v_status = 'confirmed' THEN
    RETURN;
  END IF;

  SELECT entry_fee INTO v_entry_fee FROM tournaments WHERE id = v_tournament_id;

  IF v_entry_fee IS NULL OR p_amount_paid < v_entry_fee THEN
    RAISE EXCEPTION 'Amount paid does not cover entry fee';
  END IF;

  UPDATE registrations
  SET status = 'confirmed', razorpay_payment_id = p_razorpay_payment_id
  WHERE id = p_registration_id;
END;
$$;

ALTER FUNCTION public.confirm_paid_registration(uuid, numeric, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.confirm_paid_registration(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_paid_registration(uuid, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paid_registration(uuid, numeric, text) TO service_role;
