-- "Anyone can view registrations" (USING (true)) is intentional -- the
-- app needs public visibility of registration status/team/tournament
-- for things like registration lists and standings. But that policy
-- controls ROW visibility, not COLUMN visibility, so it was also
-- exposing razorpay_order_id/razorpay_payment_id to any caller,
-- including unauthenticated anon-key requests.
--
-- No screen in the app ever reads or displays these two columns --
-- they're only written by confirm_paid_registration (SECURITY DEFINER,
-- unaffected by this revoke since it runs as the function owner). This
-- narrows column-level SELECT instead of touching row visibility.

revoke select (razorpay_order_id, razorpay_payment_id)
  on public.registrations
  from anon, authenticated;
