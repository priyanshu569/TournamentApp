--
-- PostgreSQL database dump
--

\restrict BlM2spShHHnIhVs4GnVuuTEkyk2JC1qZvrRtdVQLKipY2DQKmL1IJ5C49Gfei6b

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: cancel_registration(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_registration(p_registration_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT team_id INTO v_team_id
  FROM registrations
  WHERE id = p_registration_id
    AND player_id = auth.uid()
    AND status = 'pending';

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Registration not found, not yours, or no longer cancellable';
  END IF;

  DELETE FROM registrations WHERE id = p_registration_id;
  DELETE FROM team_members WHERE team_id = v_team_id;
  DELETE FROM teams WHERE id = v_team_id;
END;
$$;


--
-- Name: confirm_free_registration(uuid); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: confirm_paid_registration(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_paid_registration(p_registration_id uuid, p_amount_paid numeric, p_razorpay_payment_id text) RETURNS void
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


--
-- Name: create_group_conversation(text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_group_conversation(p_name text, p_member_ids uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_conversation_id uuid;
  v_uid uuid := auth.uid();
  v_member uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.conversations (conversation_type, name) values ('group', p_name) returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id) values (v_conversation_id, v_uid);

  foreach v_member in array p_member_ids loop
    if v_member <> v_uid then
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conversation_id, v_member)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  return v_conversation_id;
end;
$$;


--
-- Name: create_team_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_team_conversation(p_team_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_conversation_id uuid;
  v_captain_id uuid;
  v_host_id uuid;
  v_team_name text;
begin
  select t.captain_id, t.name, tour.host_id
  into v_captain_id, v_team_name, v_host_id
  from public.teams t
  join public.tournaments tour on tour.id = t.tournament_id
  where t.id = p_team_id;

  if v_captain_id is null then
    raise exception 'Team not found';
  end if;

  insert into public.conversations (conversation_type, name, team_id)
  values ('group', v_team_name, p_team_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_captain_id)
  on conflict (conversation_id, user_id) do nothing;

  if v_host_id is not null and v_host_id <> v_captain_id then
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_conversation_id, v_host_id)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return v_conversation_id;
end;
$$;


--
-- Name: delete_own_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_own_account() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.game_profiles where user_id = v_uid;

  update public."Profiles"
  set username = null,
      display_name = null,
      gender = null,
      state = null,
      date_of_birth = null,
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


--
-- Name: get_broadcast_push_tokens(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_broadcast_push_tokens(target_role text) RETURNS TABLE(push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Profiles" WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.push_token FROM "Profiles" p
  WHERE p.push_token IS NOT NULL
    AND (target_role = 'all' OR p.role = target_role);
END;
$$;


--
-- Name: get_broadcast_recipients(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_broadcast_recipients(target_role text) RETURNS TABLE(user_id uuid, push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if not exists (
    select 1 from "Profiles" pr where pr.id = auth.uid() and pr.is_admin = true
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id as user_id, case when p.push_enabled then p.push_token else null end as push_token
  from "Profiles" p
  where (target_role = 'all' or p.role = target_role);
end;
$$;


--
-- Name: get_confirmed_player_tokens(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_confirmed_player_tokens(target_tournament_id uuid) RETURNS TABLE(push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tournaments
    WHERE id = target_tournament_id AND host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.push_token
  FROM registrations r
  JOIN "Profiles" p ON p.id = r.player_id
  WHERE r.tournament_id = target_tournament_id
    AND r.status = 'confirmed'
    AND p.push_token IS NOT NULL;
END;
$$;


--
-- Name: get_confirmed_players(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_confirmed_players(target_tournament_id uuid) RETURNS TABLE(user_id uuid, push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if not exists (
    select 1 from tournaments t
    where t.id = target_tournament_id and t.host_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id as user_id, case when p.push_enabled then p.push_token else null end as push_token
  from registrations r
  join "Profiles" p on p.id = r.player_id
  where r.tournament_id = target_tournament_id
    and r.status = 'confirmed';
end;
$$;


--
-- Name: get_leaderboard(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_leaderboard(p_game text DEFAULT NULL::text) RETURNS TABLE(identity_key text, linked_profile_id uuid, player_uid text, username text, avatar_id text, is_verified boolean, matches_played bigint, wins bigint, total_kills bigint, placement_points numeric, kill_points numeric, total_points numeric)
    LANGUAGE sql
    AS $$
  with per_match as (
    select
      coalesce(r.player_id::text, tm.player_uid || ':' || t.game) as identity_key,
      r.player_id as linked_profile_id,
      pp.display_name as profile_display_name,
      pp.avatar_id,
      pp.is_verified,
      pmr.tournament_id,
      pmr.match_number,
      (array_agg(tm.in_game_name order by pmr.created_at desc))[1] as in_game_name,
      (array_agg(tm.player_uid order by pmr.created_at desc))[1] as player_uid,
      max(pmr.created_at) as last_activity,
      max(coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)) as match_placement_points,
      max(pmr.kills) as match_kills,
      max(coalesce((t.point_rules->>'kill_point')::numeric, 1)) as match_kill_point_value,
      bool_or(mr.placement = 1) as is_win
    from team_members tm
    join player_match_results pmr on pmr.team_member_id = tm.id
    join match_results mr
      on mr.tournament_id = pmr.tournament_id
     and mr.team_id = pmr.team_id
     and mr.match_number = pmr.match_number
    join tournaments t on t.id = pmr.tournament_id
    left join registrations r
      on r.team_id = tm.team_id
     and r.tournament_id = pmr.tournament_id
     and tm.is_captain
    left join public_profiles pp on pp.id = r.player_id
    where p_game is null or t.game = p_game
    group by
      coalesce(r.player_id::text, tm.player_uid || ':' || t.game),
      r.player_id, pp.display_name, pp.avatar_id, pp.is_verified,
      pmr.tournament_id, pmr.match_number
  )
  select
    identity_key,
    linked_profile_id,
    (array_agg(player_uid order by last_activity desc))[1] as player_uid,
    coalesce(max(profile_display_name), (array_agg(in_game_name order by last_activity desc))[1]) as username,
    max(avatar_id) as avatar_id,
    coalesce(bool_or(is_verified), false) as is_verified,
    count(*) as matches_played,
    count(*) filter (where is_win) as wins,
    coalesce(sum(match_kills), 0) as total_kills,
    coalesce(sum(match_placement_points), 0) as placement_points,
    coalesce(sum(match_kills * match_kill_point_value), 0) as kill_points,
    coalesce(sum(match_placement_points + match_kills * match_kill_point_value), 0) as total_points
  from per_match
  group by identity_key, linked_profile_id
  order by total_points desc;
$$;


--
-- Name: get_tournament_standings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tournament_standings(target_tournament_id uuid) RETURNS TABLE(team_id uuid, team_name text, matches_played bigint, total_kills bigint, total_points numeric)
    LANGUAGE sql
    AS $$
  select
    mr.team_id,
    teams.name as team_name,
    count(distinct mr.match_number) as matches_played,
    coalesce(sum(mr.kills), 0) as total_kills,
    coalesce(sum(
      mr.kills * coalesce((t.point_rules->>'kill_point')::numeric, 1)
      + coalesce((t.point_rules->'placement'->>(mr.placement - 1))::numeric, 0)
    ), 0) as total_points
  from match_results mr
  join teams on teams.id = mr.team_id
  join tournaments t on t.id = mr.tournament_id
  where mr.tournament_id = target_tournament_id
  group by mr.team_id, teams.name
  order by total_points desc;
$$;


--
-- Name: insert_notification(uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if auth.uid() = p_user_id then
    -- notifying yourself (e.g. free registration confirmed)
  elsif p_tournament_id is not null and exists (
    select 1 from tournaments where id = p_tournament_id and host_id = auth.uid()
  ) then
    -- host notifying a confirmed player of their own tournament
  elsif exists (
    select 1 from "Profiles" where id = auth.uid() and is_admin = true
  ) then
    -- admin broadcast
  elsif exists (
    select 1 from "Profiles" where id = p_user_id and is_admin = true
  ) then
    -- anyone notifying an admin (e.g. new host request submitted)
  else
    raise exception 'Not authorized to send notification to this user';
  end if;

  insert into notifications (user_id, title, body, tournament_id)
  values (p_user_id, p_title, p_body, p_tournament_id);
end;
$$;


--
-- Name: lock_is_verified(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_is_verified() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF current_user = 'authenticated' AND NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    NEW.is_verified := OLD.is_verified;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_admins_of_host_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admins_of_host_request(p_request_id uuid) RETURNS TABLE(user_id uuid, push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if not exists (
    select 1 from public.host_requests where id = p_request_id and user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select p.id as user_id, p.push_token
  from public."Profiles" p
  where p.is_admin = true;
end;
$$;


--
-- Name: review_host_request(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_host_request(p_request_id uuid, p_approve boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from public."Profiles" where id = auth.uid() and is_admin = true) then
    raise exception 'Not authorized';
  end if;

  select user_id into v_user_id from public.host_requests where id = p_request_id;

  if v_user_id is null then
    raise exception 'Request not found';
  end if;

  update public.host_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_request_id;

  update public."Profiles"
  set host_status = case when p_approve then 'approved' else 'rejected' end,
      role = case when p_approve then 'host' else role end
  where id = v_user_id;
end;
$$;


--
-- Name: start_direct_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_direct_conversation(other_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_conversation_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_uid = other_user_id then
    raise exception 'Cannot message yourself';
  end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = other_user_id)
       or (blocker_id = other_user_id and blocked_id = v_uid)
  ) then
    raise exception 'Cannot start a conversation between these users';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.conversation_type = 'direct'
    and exists (select 1 from public.conversation_participants p1 where p1.conversation_id = c.id and p1.user_id = v_uid)
    and exists (select 1 from public.conversation_participants p2 where p2.conversation_id = c.id and p2.user_id = other_user_id)
    and (select count(*) from public.conversation_participants p3 where p3.conversation_id = c.id) = 2
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (conversation_type) values ('direct') returning id into v_conversation_id;
  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, v_uid), (v_conversation_id, other_user_id);

  return v_conversation_id;
end;
$$;


--
-- Name: submit_host_request(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_host_request(p_name text, p_contact text, p_details text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Profiles" (
    id uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    phone text,
    role text DEFAULT 'player'::text,
    is_verified boolean DEFAULT false,
    push_token text,
    is_admin boolean DEFAULT false,
    host_status text DEFAULT 'none'::text NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    avatar_id text,
    follow_list_private boolean DEFAULT false NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    display_name text,
    gender text,
    state text,
    date_of_birth date,
    games_onboarded boolean DEFAULT false NOT NULL,
    CONSTRAINT profiles_avatar_id_check CHECK (((avatar_id IS NULL) OR (avatar_id = ANY (ARRAY['skull'::text, 'controller'::text, 'headset'::text, 'crosshair'::text, 'ghost'::text, 'heart'::text, 'flower'::text, 'unicorn'::text, 'swordcross'::text, 'meditation'::text])))),
    CONSTRAINT profiles_gender_check CHECK (((gender IS NULL) OR (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])))),
    CONSTRAINT profiles_host_status_check CHECK ((host_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT profiles_username_format_check CHECK (((username IS NULL) OR (username ~ '^[a-z0-9_.]{3,20}$'::text)))
);


--
-- Name: TABLE "Profiles"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public."Profiles" IS 'Player profile data';


--
-- Name: COLUMN "Profiles".host_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Profiles".host_status IS 'none | pending | approved | rejected — tracks the host access request lifecycle. Only approved may create tournaments.';


--
-- Name: COLUMN "Profiles".is_deleted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Profiles".is_deleted IS 'True once the user has deleted their account via delete_own_account(). Personal fields are scrubbed but the row is kept so historical foreign keys stay valid.';


--
-- Name: COLUMN "Profiles".avatar_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Profiles".avatar_id IS 'One of 8 preset avatar keys, or null for the default initials avatar.';


--
-- Name: COLUMN "Profiles".follow_list_private; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public."Profiles".follow_list_private IS 'When true, only the owner (or an admin) can see who follows them or who they follow.';


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocks_check CHECK ((blocker_id <> blocked_id))
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_type text NOT NULL,
    name text,
    team_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_conversation_type_check CHECK ((conversation_type = ANY (ARRAY['direct'::text, 'group'::text])))
);


--
-- Name: TABLE conversations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversations IS 'conversation_type = direct (1:1) or group. team_id is set only for auto-created team chats; null for manually-created ad-hoc groups.';


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_check CHECK ((follower_id <> following_id))
);


--
-- Name: game_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game text NOT NULL,
    in_game_name text NOT NULL,
    game_uid text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT game_profiles_game_check CHECK ((game = ANY (ARRAY['Free Fire'::text, 'BGMI'::text, 'COD Mobile'::text, 'Valorant'::text])))
);


--
-- Name: host_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.host_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    contact text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT host_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: TABLE host_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.host_requests IS 'Requests from players to become hosts, reviewed by an admin via admin-host-requests.tsx.';


--
-- Name: match_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    team_id uuid NOT NULL,
    player_id uuid,
    placement integer,
    kills integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    match_number integer DEFAULT 1 NOT NULL,
    CONSTRAINT match_results_match_number_check CHECK ((match_number > 0))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    tournament_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: player_match_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_match_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid,
    team_id uuid,
    team_member_id uuid,
    kills integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    match_number integer DEFAULT 1 NOT NULL,
    CONSTRAINT player_match_results_match_number_check CHECK ((match_number > 0))
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_profiles WITH (security_invoker=off) AS
 SELECT id,
    username,
    is_verified,
    avatar_id,
    follow_list_private,
    role,
    display_name,
    is_admin
   FROM public."Profiles";


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tournament_id uuid,
    team_id uuid,
    player_id uuid,
    status text DEFAULT 'pending'::text,
    razorpay_order_id text,
    razorpay_payment_id text
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid,
    reported_message_id uuid,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid,
    in_game_name text NOT NULL,
    player_uid text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_substitute boolean DEFAULT false NOT NULL,
    is_captain boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN team_members.is_substitute; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.is_substitute IS 'True for the optional 5th roster slot — a replacement player who can step in for a benched core member on a per-match basis, not a simultaneous 5th active player.';


--
-- Name: COLUMN team_members.is_captain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_members.is_captain IS 'True for exactly the first (non-substitute) roster slot on a team — the only team_members row safely linkable to a real Profile via registrations.player_id. Every other slot is free text typed by the captain and cannot be trusted to represent whoever is actually named.';


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    captain_id uuid,
    tournament_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    host_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text,
    game text DEFAULT 'Free Fire'::text,
    entry_fee bigint DEFAULT '0'::bigint,
    prize_pool bigint DEFAULT '0'::bigint,
    max_teams bigint DEFAULT '12'::bigint,
    status text DEFAULT 'upcoming'::text,
    room_code text,
    room_password text,
    start_time timestamp with time zone,
    description text,
    rules text,
    category text DEFAULT 'tournament'::text NOT NULL,
    lobby_type text,
    match_count integer DEFAULT 1 NOT NULL,
    point_rules jsonb DEFAULT '{"placement": [12, 9, 8, 7, 6, 5, 4, 3, 2, 1], "kill_point": 1}'::jsonb NOT NULL,
    banner_url text,
    CONSTRAINT tournaments_category_check CHECK ((category = ANY (ARRAY['tournament'::text, 'scrim'::text]))),
    CONSTRAINT tournaments_lobby_type_consistency_check CHECK ((((category = 'scrim'::text) AND (lobby_type = ANY (ARRAY['mini'::text, 'mega'::text]))) OR ((category = 'tournament'::text) AND (lobby_type IS NULL)))),
    CONSTRAINT tournaments_match_count_check CHECK ((match_count > 0)),
    CONSTRAINT tournaments_point_rules_shape_check CHECK (((jsonb_typeof((point_rules -> 'placement'::text)) = 'array'::text) AND (jsonb_typeof((point_rules -> 'kill_point'::text)) = 'number'::text)))
);


--
-- Name: TABLE tournaments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tournaments IS 'Tournament listings created by hosts';


--
-- Name: COLUMN tournaments.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tournaments.category IS 'tournament | scrim — top-level event division shown in events.tsx';


--
-- Name: COLUMN tournaments.lobby_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tournaments.lobby_type IS 'mini | mega — only set when category = scrim; null for regular tournaments';


--
-- Name: COLUMN tournaments.match_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tournaments.match_count IS 'Number of matches in this event. Host-configurable at creation; the app pre-fills a default (1 for tournaments, 3 for mini scrims, 5 for mega scrims) but does not otherwise constrain it.';


--
-- Name: COLUMN tournaments.point_rules; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tournaments.point_rules IS 'Per-event scoring: {"placement": [pts for rank 1, rank 2, ...], "kill_point": pts per kill}. Defaults to the standard curve at creation; only overwritten if the host customizes it for that event.';


--
-- Name: COLUMN tournaments.banner_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tournaments.banner_url IS 'Public URL of the tournament banner image in the tournament-banners storage bucket, if one has been uploaded.';


--
-- Name: Profiles Profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Profiles"
    ADD CONSTRAINT "Profiles_pkey" PRIMARY KEY (id);


--
-- Name: blocks blocks_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: follows follows_follower_id_following_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_following_id_key UNIQUE (follower_id, following_id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (id);


--
-- Name: game_profiles game_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_profiles
    ADD CONSTRAINT game_profiles_pkey PRIMARY KEY (id);


--
-- Name: game_profiles game_profiles_user_id_game_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_profiles
    ADD CONSTRAINT game_profiles_user_id_game_key UNIQUE (user_id, game);


--
-- Name: host_requests host_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.host_requests
    ADD CONSTRAINT host_requests_pkey PRIMARY KEY (id);


--
-- Name: match_results match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_pkey PRIMARY KEY (id);


--
-- Name: match_results match_results_tournament_team_match_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_tournament_team_match_key UNIQUE (tournament_id, team_id, match_number);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: player_match_results player_match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_pkey PRIMARY KEY (id);


--
-- Name: player_match_results player_match_results_tournament_member_match_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_tournament_member_match_key UNIQUE (tournament_id, team_member_id, match_number);


--
-- Name: Profiles profiles_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Profiles"
    ADD CONSTRAINT profiles_username_unique UNIQUE (username);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: registrations_razorpay_payment_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registrations_razorpay_payment_id_key ON public.registrations USING btree (razorpay_payment_id) WHERE (razorpay_payment_id IS NOT NULL);


--
-- Name: Profiles protect_is_verified; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_is_verified BEFORE UPDATE ON public."Profiles" FOR EACH ROW EXECUTE FUNCTION public.lock_is_verified();


--
-- Name: blocks blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public."Profiles"(id);


--
-- Name: blocks blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public."Profiles"(id);


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."Profiles"(id);


--
-- Name: conversations conversations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public."Profiles"(id);


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public."Profiles"(id);


--
-- Name: game_profiles game_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_profiles
    ADD CONSTRAINT game_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."Profiles"(id) ON DELETE CASCADE;


--
-- Name: host_requests host_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.host_requests
    ADD CONSTRAINT host_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public."Profiles"(id);


--
-- Name: host_requests host_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.host_requests
    ADD CONSTRAINT host_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."Profiles"(id);


--
-- Name: match_results match_results_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_player_id_fkey FOREIGN KEY (player_id) REFERENCES public."Profiles"(id);


--
-- Name: match_results match_results_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: match_results match_results_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public."Profiles"(id);


--
-- Name: notifications notifications_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."Profiles"(id);


--
-- Name: player_match_results player_match_results_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: player_match_results player_match_results_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: player_match_results player_match_results_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: registrations registrations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: registrations registrations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: reports reports_reported_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_message_id_fkey FOREIGN KEY (reported_message_id) REFERENCES public.messages(id);


--
-- Name: reports reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public."Profiles"(id);


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public."Profiles"(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: tournaments tournaments_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_host_id_fkey FOREIGN KEY (host_id) REFERENCES public."Profiles"(id);


--
-- Name: reports Admins can update reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));


--
-- Name: host_requests Admins can view all host requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all host requests" ON public.host_requests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));


--
-- Name: reports Admins can view all reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true)))));


--
-- Name: registrations Anyone can view registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view registrations" ON public.registrations FOR SELECT USING (true);


--
-- Name: team_members Anyone can view team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view team members" ON public.team_members FOR SELECT USING (true);


--
-- Name: tournaments Anyone can view tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);


--
-- Name: team_members Captain can add team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Captain can add team members" ON public.team_members FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.teams
  WHERE ((teams.id = team_members.team_id) AND (teams.captain_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: teams Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.teams FOR SELECT USING (true);


--
-- Name: player_match_results Hosts and admins can write player_match_results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hosts and admins can write player_match_results" ON public.player_match_results USING (((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = player_match_results.tournament_id) AND (t.host_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true))))));


--
-- Name: tournaments Hosts can create tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hosts can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK (((auth.uid() = host_id) AND (EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = auth.uid()) AND (p.host_status = 'approved'::text))))));


--
-- Name: match_results Hosts can insert results for own tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hosts can insert results for own tournaments" ON public.match_results FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = match_results.tournament_id) AND (t.host_id = auth.uid())))));


--
-- Name: tournaments Hosts can update own tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hosts can update own tournaments" ON public.tournaments FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = host_id));


--
-- Name: match_results Hosts can update results for own tournaments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hosts can update results for own tournaments" ON public.match_results FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = match_results.tournament_id) AND (t.host_id = auth.uid())))));


--
-- Name: messages Participants can read messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can read messages" ON public.messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))));


--
-- Name: messages Participants can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))) AND (NOT (EXISTS ( SELECT 1
   FROM ((public.conversations c
     JOIN public.conversation_participants other ON (((other.conversation_id = c.id) AND (other.user_id <> auth.uid()))))
     JOIN public.blocks b ON ((((b.blocker_id = other.user_id) AND (b.blocked_id = auth.uid())) OR ((b.blocker_id = auth.uid()) AND (b.blocked_id = other.user_id)))))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'direct'::text)))))));


--
-- Name: teams Players can create their own team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can create their own team" ON public.teams FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = captain_id));


--
-- Name: registrations Players can register their team; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can register their team" ON public.registrations FOR INSERT TO authenticated WITH CHECK (((auth.uid() = player_id) AND (( SELECT tournaments.status
   FROM public.tournaments
  WHERE (tournaments.id = registrations.tournament_id)) = 'upcoming'::text)));


--
-- Name: registrations Players can view their own registrations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Players can view their own registrations" ON public.registrations FOR SELECT USING ((auth.uid() = player_id));


--
-- Name: Profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: match_results Results are publicly viewable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Results are publicly viewable" ON public.match_results FOR SELECT USING (true);


--
-- Name: conversation_participants See participants of your own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "See participants of your own conversations" ON public.conversation_participants FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants me
  WHERE ((me.conversation_id = conversation_participants.conversation_id) AND (me.user_id = auth.uid())))));


--
-- Name: conversations See your own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "See your own conversations" ON public.conversations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid())))));


--
-- Name: game_profiles Users can delete own game profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own game profiles" ON public.game_profiles FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: follows Users can follow others; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can follow others" ON public.follows FOR INSERT TO authenticated WITH CHECK ((auth.uid() = follower_id));


--
-- Name: game_profiles Users can insert own game profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own game profiles" ON public.game_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: Profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public."Profiles" FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: conversation_participants Users can leave conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave conversations" ON public.conversation_participants FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: reports Users can submit reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can submit reports" ON public.reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: follows Users can unfollow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE TO authenticated USING ((auth.uid() = follower_id));


--
-- Name: game_profiles Users can update own game profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own game profiles" ON public.game_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: Profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public."Profiles" FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: game_profiles Users can view own game profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own game profiles" ON public.game_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: host_requests Users can view own host request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own host request" ON public.host_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: Profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public."Profiles" FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: reports Users can view own reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING ((auth.uid() = reporter_id));


--
-- Name: blocks Users manage own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own blocks" ON public.blocks TO authenticated USING ((auth.uid() = blocker_id)) WITH CHECK ((auth.uid() = blocker_id));


--
-- Name: follows View follows respecting privacy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View follows respecting privacy" ON public.follows FOR SELECT USING (((auth.uid() = follower_id) OR (auth.uid() = following_id) OR (EXISTS ( SELECT 1
   FROM public."Profiles" me
  WHERE ((me.id = auth.uid()) AND (me.is_admin = true)))) OR ((NOT (EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = follows.following_id) AND (p.follow_list_private = true))))) AND (NOT (EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = follows.follower_id) AND (p.follow_list_private = true))))))));


--
-- Name: blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

--
-- Name: game_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: host_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.host_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: match_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: player_match_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_match_results ENABLE ROW LEVEL SECURITY;

--
-- Name: registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tournaments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict BlM2spShHHnIhVs4GnVuuTEkyk2JC1qZvrRtdVQLKipY2DQKmL1IJ5C49Gfei6b

