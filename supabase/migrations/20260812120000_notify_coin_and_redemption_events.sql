-- Players had no idea when they won FragCoins or when a redemption moved --
-- both were silent, discoverable only by opening the wallet and noticing the
-- number had changed. This wires both into the existing notification system.
--
-- Coin wins are logged from inside distribute_tournament_prizes rather than
-- from the client: the payout loop is the only place that knows who placed
-- where and for how much, and putting the notification in the same
-- transaction means a player can never be credited without being told (or
-- told about a payout that then rolled back).
--
-- The function now returns the winners so the caller can also send pushes --
-- SQL can't reach Expo's push service, so the in-app row is written here and
-- the push is fired client-side, the same split every other notification in
-- this app already uses. Changing the return type needs a DROP; nothing but
-- tournament-details.tsx calls this.

drop function public.distribute_tournament_prizes(uuid);

-- Output columns are prefixed `winner_` deliberately. RETURNS TABLE declares
-- each name as an implicit variable inside the body, so a bare `user_id`
-- here collides with wallets.user_id in the upsert's ON CONFLICT clause and
-- the whole payout fails with "column reference is ambiguous".
create function public.distribute_tournament_prizes(p_tournament_id uuid)
returns table(winner_id uuid, winner_push_token text, winner_coins bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_host boolean;
  v_is_admin boolean;
  v_status text;
  v_coin_rules jsonb;
  v_already_distributed timestamptz;
  v_title text;
  v_team record;
  v_rank int := 0;
  v_coin_amount bigint;
  v_player_id uuid;
  v_max_placement bigint;
  v_total_prize bigint;
  -- Auto-safe thresholds -- above either, distribution must go through
  -- an admin instead of the host. Adjust here if real usage outgrows
  -- these; there's nothing else that depends on the exact numbers.
  v_auto_cap_per_placement constant bigint := 5000;
  v_auto_cap_total constant bigint := 15000;
begin
  select t.host_id = auth.uid(), t.status, t.coin_rules, t.coins_distributed_at, t.title
  into v_is_host, v_status, v_coin_rules, v_already_distributed, v_title
  from tournaments t
  where t.id = p_tournament_id;

  if v_title is null then
    raise exception 'Tournament not found';
  end if;

  select exists (select 1 from "Profiles" p where p.id = auth.uid() and p.is_admin = true) into v_is_admin;

  if not (v_is_host or v_is_admin) then
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

  select max(elem::bigint), sum(elem::bigint)
  into v_max_placement, v_total_prize
  from jsonb_array_elements_text(v_coin_rules->'placement') as elem;

  if not v_is_admin and (coalesce(v_max_placement, 0) > v_auto_cap_per_placement or coalesce(v_total_prize, 0) > v_auto_cap_total) then
    raise exception 'This tournament''s prize amounts (max % per placement, % total) are above the automatic limit (% per placement, % total). Ask a Fragify admin to distribute prizes for it.',
      v_max_placement, v_total_prize, v_auto_cap_per_placement, v_auto_cap_total;
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

        -- Written directly rather than through insert_notification: this
        -- runs as the definer, and the auth checks in that function are
        -- built for a caller acting on their own behalf.
        insert into notifications (user_id, title, body, tournament_id)
        values (
          v_player_id,
          '🏆 You won FragCoins!',
          'You placed #' || v_rank || ' in ' || v_title || ' and earned '
            || v_coin_amount || ' FragCoins. Open your wallet to spend them.'
        , p_tournament_id);

        -- Push token comes back only if the player actually wants results
        -- pushes; the in-app row above is written either way.
        return query
        select v_player_id,
               case when p.push_enabled and p.notify_results then p.push_token else null end,
               v_coin_amount
        from "Profiles" p
        where p.id = v_player_id;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.distribute_tournament_prizes(uuid) from public;
grant execute on function public.distribute_tournament_prizes(uuid) to authenticated;

-- Redemption status changes are sent from admin-redemptions.tsx, which can
-- already write the in-app row (insert_notification permits an admin
-- notifying anyone) but can't read another user's push_token -- Profiles
-- exposes that to nobody. This is the narrow, admin-gated way to get it.
--
-- Gated on the master push_enabled switch only, not a per-category toggle:
-- "your order shipped" is transactional, not the kind of thing to bury
-- behind a marketing-style preference.
create function public.admin_get_push_token(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not exists (select 1 from "Profiles" p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Not authorized';
  end if;

  select case when p.push_enabled then p.push_token else null end
  into v_token
  from "Profiles" p
  where p.id = p_user_id;

  return v_token;
end;
$$;

revoke all on function public.admin_get_push_token(uuid) from public;
grant execute on function public.admin_get_push_token(uuid) to authenticated;
