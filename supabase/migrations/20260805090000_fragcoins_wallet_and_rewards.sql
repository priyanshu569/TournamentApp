-- FragCoins: entry fees are free for now (UI-side change, not in this
-- migration), and prize pools pay out in FragCoins instead of cash --
-- redeemable only for physical goods, never cash-convertible. Adds a wallet
-- + ledger, a host-customizable per-placement coin distribution, an
-- admin-managed reward catalog, and a redemption flow.
--
-- Security note: coins_balance is deliberately its own table, not a column
-- on Profiles. "Users can update own profile" has no column-level
-- restriction, so any column added directly to Profiles is trivially
-- settable by the owning user via a plain client update call. wallets has
-- no insert/update policy for authenticated/anon at all -- every balance
-- change goes through the SECURITY DEFINER functions below, which bypass
-- RLS as the function owner.

-- ---- tournaments: prize coin rules + one-time distribution guard ----

alter table public.tournaments
  add column coin_rules jsonb,
  add column coins_distributed_at timestamptz;

comment on column public.tournaments.coin_rules is
  'Host-customized per-placement FragCoin prize distribution, e.g. {"placement": [500, 300, 200]}. Same shape/convention as point_rules.';

-- ---- wallets ----

create table public.wallets (
  user_id uuid primary key references public."Profiles"(id) on delete cascade,
  coins_balance bigint not null default 0 check (coins_balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

create policy "Users can view own wallet" on public.wallets
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all wallets" on public.wallets
  for select to authenticated
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

-- ---- reward_catalog: admin-managed goods redeemable for coins ----

create table public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  coin_cost bigint not null check (coin_cost > 0),
  stock_quantity integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.reward_catalog enable row level security;

create policy "Anyone can view active rewards" on public.reward_catalog
  for select
  using (
    is_active
    or exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true)
  );

create policy "Admins manage reward catalog" on public.reward_catalog
  for all to authenticated
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

-- ---- coin_redemptions: a user's request to trade coins for a reward ----

create table public.coin_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."Profiles"(id) on delete cascade,
  reward_id uuid not null references public.reward_catalog(id),
  reward_name text not null,
  coin_cost bigint not null,
  status text not null default 'pending' check (status in ('pending', 'shipped', 'fulfilled', 'cancelled')),
  shipping_name text not null,
  shipping_address text not null,
  shipping_phone text not null,
  admin_notes text,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

comment on column public.coin_redemptions.reward_name is
  'Snapshot of the reward name at redemption time, so a later catalog edit or removal does not rewrite history.';
comment on column public.coin_redemptions.coin_cost is
  'Snapshot of the coin cost at redemption time, for the same reason.';

alter table public.coin_redemptions enable row level security;

create policy "Users can view own redemptions" on public.coin_redemptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view and manage all redemptions" on public.coin_redemptions
  for all to authenticated
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

-- No insert policy for regular users -- creation only via redeem_reward()
-- below, which validates balance and stock atomically.

-- ---- coin_transactions: append-only ledger behind the wallet balance ----

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public."Profiles"(id) on delete cascade,
  amount bigint not null,
  type text not null check (type in ('prize_won', 'redemption', 'admin_adjustment')),
  tournament_id uuid references public.tournaments(id) on delete set null,
  redemption_id uuid references public.coin_redemptions(id) on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.coin_transactions enable row level security;

create policy "Users can view own transactions" on public.coin_transactions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all transactions" on public.coin_transactions
  for select to authenticated
  using (exists (select 1 from public."Profiles" p where p.id = auth.uid() and p.is_admin = true));

-- No insert policy -- only ever written by the SECURITY DEFINER functions
-- below, alongside the wallet/redemption changes they make in the same
-- transaction, so a balance change and its ledger entry can never drift.

-- ---- distribute_tournament_prizes: host/admin-only, one-time per tournament ----

create function public.distribute_tournament_prizes(p_tournament_id uuid) returns void
    language plpgsql security definer
    set search_path = public
    as $$
declare
  v_authorized boolean;
  v_status text;
  v_coin_rules jsonb;
  v_already_distributed timestamptz;
  v_title text;
  v_team record;
  v_rank int := 0;
  v_coin_amount bigint;
  v_player_id uuid;
begin
  select
    (t.host_id = auth.uid() or exists (select 1 from "Profiles" p where p.id = auth.uid() and p.is_admin = true)),
    t.status, t.coin_rules, t.coins_distributed_at, t.title
  into v_authorized, v_status, v_coin_rules, v_already_distributed, v_title
  from tournaments t
  where t.id = p_tournament_id;

  if v_title is null then
    raise exception 'Tournament not found';
  end if;

  if not v_authorized then
    raise exception 'Not authorized to distribute prizes for this tournament';
  end if;

  if v_status <> 'completed' then
    raise exception 'Tournament must be marked completed first';
  end if;

  if v_already_distributed is not null then
    raise exception 'Prizes have already been distributed for this tournament';
  end if;

  if v_coin_rules is null or jsonb_array_length(coalesce(v_coin_rules->'placement', '[]'::jsonb)) = 0 then
    raise exception 'No prize coin rules set for this tournament';
  end if;

  -- Set the guard before the loop, inside this same transaction, so a
  -- concurrent second call can't both pass the "already distributed" check
  -- above before either commits.
  update tournaments set coins_distributed_at = now() where id = p_tournament_id;

  for v_team in
    select mr.team_id, teams.name as team_name,
      coalesce(sum(
        mr.kills * coalesce((t.point_rules->>'kill_point')::numeric, 1)
        + coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)
      ), 0) as total_points
    from match_results mr
    join teams on teams.id = mr.team_id
    join tournaments t on t.id = mr.tournament_id
    where mr.tournament_id = p_tournament_id
    group by mr.team_id, teams.name
    order by total_points desc
  loop
    v_rank := v_rank + 1;
    v_coin_amount := coalesce((v_coin_rules->'placement'->>(v_rank - 1))::bigint, 0);

    if v_coin_amount > 0 then
      -- The registering player is the only reliably-linked Fragify account
      -- for a team -- squad members entered as free-text roster rows don't
      -- necessarily have one. Same attribution choice get_leaderboard()
      -- already makes for the same reason.
      select r.player_id into v_player_id
      from registrations r
      where r.team_id = v_team.team_id and r.tournament_id = p_tournament_id
      limit 1;

      if v_player_id is not null then
        insert into wallets (user_id, coins_balance)
        values (v_player_id, v_coin_amount)
        on conflict (user_id) do update
          set coins_balance = wallets.coins_balance + v_coin_amount, updated_at = now();

        insert into coin_transactions (user_id, amount, type, tournament_id, description)
        values (
          v_player_id, v_coin_amount, 'prize_won', p_tournament_id,
          'Placed #' || v_rank || ' in ' || v_title || ' with ' || v_team.team_name
        );
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.distribute_tournament_prizes(uuid) from public;
grant execute on function public.distribute_tournament_prizes(uuid) to authenticated;

-- ---- redeem_reward: atomic balance check + stock check + debit + order ----

create function public.redeem_reward(
  p_reward_id uuid,
  p_shipping_name text,
  p_shipping_address text,
  p_shipping_phone text
) returns uuid
    language plpgsql security definer
    set search_path = public
    as $$
declare
  v_reward record;
  v_balance bigint;
  v_redemption_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_shipping_name), '') = ''
    or coalesce(trim(p_shipping_address), '') = ''
    or coalesce(trim(p_shipping_phone), '') = '' then
    raise exception 'Shipping name, address and phone are required';
  end if;

  -- Locks the reward row so two concurrent redemptions of the last unit of
  -- stock can't both pass the stock check before either commits.
  select id, name, coin_cost, stock_quantity, is_active into v_reward
  from reward_catalog where id = p_reward_id
  for update;

  if v_reward.id is null or not v_reward.is_active then
    raise exception 'This reward is not available';
  end if;

  if v_reward.stock_quantity is not null and v_reward.stock_quantity <= 0 then
    raise exception 'This reward is out of stock';
  end if;

  select coins_balance into v_balance from wallets where user_id = auth.uid() for update;
  if coalesce(v_balance, 0) < v_reward.coin_cost then
    raise exception 'Not enough FragCoins for this reward';
  end if;

  update wallets set coins_balance = coins_balance - v_reward.coin_cost, updated_at = now()
  where user_id = auth.uid();

  if v_reward.stock_quantity is not null then
    update reward_catalog set stock_quantity = stock_quantity - 1 where id = p_reward_id;
  end if;

  insert into coin_redemptions (user_id, reward_id, reward_name, coin_cost, shipping_name, shipping_address, shipping_phone)
  values (auth.uid(), v_reward.id, v_reward.name, v_reward.coin_cost, trim(p_shipping_name), trim(p_shipping_address), trim(p_shipping_phone))
  returning id into v_redemption_id;

  insert into coin_transactions (user_id, amount, type, redemption_id, description)
  values (auth.uid(), -v_reward.coin_cost, 'redemption', v_redemption_id, 'Redeemed for ' || v_reward.name);

  return v_redemption_id;
end;
$$;

revoke all on function public.redeem_reward(uuid, text, text, text) from public;
grant execute on function public.redeem_reward(uuid, text, text, text) to authenticated;

-- ---- admin_cancel_redemption: admin-only, refunds coins + restocks ----
--
-- Marking shipped/fulfilled has no coin implications, so those transitions
-- go through the plain "Admins can view and manage all redemptions" UPDATE
-- policy above -- no RPC needed. Cancelling is different: the user already
-- paid coins for something they won't receive, so this specifically exists
-- to make sure that reversal actually happens rather than relying on an
-- admin to remember to credit it back separately.

create function public.admin_cancel_redemption(p_redemption_id uuid, p_notes text default null) returns void
    language plpgsql security definer
    set search_path = public
    as $$
declare
  v_is_admin boolean;
  v_redemption record;
begin
  select exists (select 1 from "Profiles" p where p.id = auth.uid() and p.is_admin = true) into v_is_admin;
  if not v_is_admin then
    raise exception 'Not authorized';
  end if;

  select id, user_id, reward_id, coin_cost, status into v_redemption
  from coin_redemptions where id = p_redemption_id
  for update;

  if v_redemption.id is null then
    raise exception 'Redemption not found';
  end if;

  if v_redemption.status = 'cancelled' then
    raise exception 'Already cancelled';
  end if;

  if v_redemption.status = 'fulfilled' then
    raise exception 'Already delivered -- cannot cancel a fulfilled redemption';
  end if;

  update coin_redemptions
    set status = 'cancelled', admin_notes = coalesce(p_notes, admin_notes)
  where id = p_redemption_id;

  update wallets set coins_balance = coins_balance + v_redemption.coin_cost, updated_at = now()
  where user_id = v_redemption.user_id;

  insert into coin_transactions (user_id, amount, type, redemption_id, description)
  values (
    v_redemption.user_id, v_redemption.coin_cost, 'admin_adjustment', p_redemption_id,
    'Refund: redemption cancelled' || coalesce(' — ' || p_notes, '')
  );

  update reward_catalog set stock_quantity = stock_quantity + 1
  where id = v_redemption.reward_id and stock_quantity is not null;
end;
$$;

revoke all on function public.admin_cancel_redemption(uuid, text) from public;
grant execute on function public.admin_cancel_redemption(uuid, text) to authenticated;
