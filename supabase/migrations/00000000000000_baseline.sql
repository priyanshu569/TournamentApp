--
-- PostgreSQL database dump
--

\restrict Skf8m23nOsWZzAAaBU2W8ZNA6loPo736it9aO0CwxbZdllb6vY8Loy9exhnCxdq

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: cancel_registration(uuid); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.cancel_registration(p_registration_id uuid) OWNER TO postgres;

--
-- Name: get_broadcast_push_tokens(text); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.get_broadcast_push_tokens(target_role text) OWNER TO postgres;

--
-- Name: get_broadcast_recipients(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_broadcast_recipients(target_role text) RETURNS TABLE(user_id uuid, push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Profiles" pr WHERE pr.id = auth.uid() AND pr.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id AS user_id, p.push_token FROM "Profiles" p
  WHERE (target_role = 'all' OR p.role = target_role);
END;
$$;


ALTER FUNCTION public.get_broadcast_recipients(target_role text) OWNER TO postgres;

--
-- Name: get_confirmed_player_tokens(uuid); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.get_confirmed_player_tokens(target_tournament_id uuid) OWNER TO postgres;

--
-- Name: get_confirmed_players(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_confirmed_players(target_tournament_id uuid) RETURNS TABLE(user_id uuid, push_token text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = target_tournament_id AND t.host_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id AS user_id, p.push_token
  FROM registrations r
  JOIN "Profiles" p ON p.id = r.player_id
  WHERE r.tournament_id = target_tournament_id
    AND r.status = 'confirmed';
END;
$$;


ALTER FUNCTION public.get_confirmed_players(target_tournament_id uuid) OWNER TO postgres;

--
-- Name: get_leaderboard(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_leaderboard() RETURNS TABLE(player_uid text, username text, is_verified boolean, matches_played bigint, wins bigint, total_kills bigint)
    LANGUAGE sql
    AS $$
  select
    tm.player_uid,
    (array_agg(tm.in_game_name order by pmr.created_at desc))[1] as username,
    false as is_verified,
    count(distinct pmr.tournament_id) as matches_played,
    count(distinct case when mr.placement = 1 then mr.tournament_id end) as wins,
    coalesce(sum(pmr.kills), 0) as total_kills
  from team_members tm
  join player_match_results pmr on pmr.team_member_id = tm.id
  join match_results mr
    on mr.tournament_id = pmr.tournament_id
   and mr.team_id = pmr.team_id
  group by tm.player_uid
  order by total_kills desc;
$$;


ALTER FUNCTION public.get_leaderboard() OWNER TO postgres;

--
-- Name: insert_notification(uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF auth.uid() = p_user_id THEN
    -- notifying yourself (e.g. free registration confirmed)
  ELSIF p_tournament_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM tournaments WHERE id = p_tournament_id AND host_id = auth.uid()
  ) THEN
    -- host notifying a confirmed player of their own tournament
  ELSIF EXISTS (
    SELECT 1 FROM "Profiles" WHERE id = auth.uid() AND is_admin = true
  ) THEN
    -- admin broadcast
  ELSE
    RAISE EXCEPTION 'Not authorized to send notification to this user';
  END IF;

  INSERT INTO notifications (user_id, title, body, tournament_id)
  VALUES (p_user_id, p_title, p_body, p_tournament_id);
END;
$$;


ALTER FUNCTION public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid) OWNER TO postgres;

--
-- Name: lock_is_verified(); Type: FUNCTION; Schema: public; Owner: postgres
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


ALTER FUNCTION public.lock_is_verified() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Profiles" (
    id uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    username text,
    free_fire_uid text,
    phone text,
    role text DEFAULT 'player'::text,
    is_verified boolean DEFAULT false,
    push_token text,
    is_admin boolean DEFAULT false,
    bgmi_uid text
);


ALTER TABLE public."Profiles" OWNER TO postgres;

--
-- Name: TABLE "Profiles"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."Profiles" IS 'Player profile data';


--
-- Name: match_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.match_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    team_id uuid NOT NULL,
    player_id uuid,
    placement integer,
    kills integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.match_results OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: player_match_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_match_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid,
    team_id uuid,
    team_member_id uuid,
    kills integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.player_match_results OWNER TO postgres;

--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.public_profiles WITH (security_invoker='on') AS
 SELECT id,
    username,
    is_verified
   FROM public."Profiles";


ALTER VIEW public.public_profiles OWNER TO postgres;

--
-- Name: registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tournament_id uuid,
    team_id uuid,
    player_id uuid,
    status text DEFAULT 'pending'::text
);


ALTER TABLE public.registrations OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid,
    in_game_name text NOT NULL,
    player_uid text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    captain_id uuid,
    tournament_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: postgres
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
    rules text
);


ALTER TABLE public.tournaments OWNER TO postgres;

--
-- Name: TABLE tournaments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tournaments IS 'Tournament listings created by hosts';


--
-- Name: Profiles Profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Profiles"
    ADD CONSTRAINT "Profiles_pkey" PRIMARY KEY (id);


--
-- Name: match_results match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_pkey PRIMARY KEY (id);


--
-- Name: match_results match_results_tournament_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_tournament_id_team_id_key UNIQUE (tournament_id, team_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: player_match_results player_match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_pkey PRIMARY KEY (id);


--
-- Name: player_match_results player_match_results_tournament_id_team_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_tournament_id_team_member_id_key UNIQUE (tournament_id, team_member_id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: Profiles protect_is_verified; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER protect_is_verified BEFORE UPDATE ON public."Profiles" FOR EACH ROW EXECUTE FUNCTION public.lock_is_verified();


--
-- Name: match_results match_results_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_player_id_fkey FOREIGN KEY (player_id) REFERENCES public."Profiles"(id);


--
-- Name: match_results match_results_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: match_results match_results_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: notifications notifications_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."Profiles"(id);


--
-- Name: player_match_results player_match_results_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: player_match_results player_match_results_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: player_match_results player_match_results_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_match_results
    ADD CONSTRAINT player_match_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: registrations registrations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: registrations registrations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: tournaments tournaments_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_host_id_fkey FOREIGN KEY (host_id) REFERENCES public."Profiles"(id);


--
-- Name: registrations Anyone can view registrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view registrations" ON public.registrations FOR SELECT USING (true);


--
-- Name: team_members Anyone can view team members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view team members" ON public.team_members FOR SELECT USING (true);


--
-- Name: tournaments Anyone can view tournaments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);


--
-- Name: team_members Captain can add team members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Captain can add team members" ON public.team_members FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.teams
  WHERE ((teams.id = team_members.team_id) AND (teams.captain_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: teams Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.teams FOR SELECT USING (true);


--
-- Name: player_match_results Hosts and admins can write player_match_results; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts and admins can write player_match_results" ON public.player_match_results USING (((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = player_match_results.tournament_id) AND (t.host_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public."Profiles" p
  WHERE ((p.id = auth.uid()) AND (p.is_admin = true))))));


--
-- Name: tournaments Hosts can create tournaments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts can create tournaments" ON public.tournaments FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = host_id));


--
-- Name: match_results Hosts can insert results for own tournaments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts can insert results for own tournaments" ON public.match_results FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = match_results.tournament_id) AND (t.host_id = auth.uid())))));


--
-- Name: tournaments Hosts can update own tournaments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts can update own tournaments" ON public.tournaments FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = host_id));


--
-- Name: match_results Hosts can update results for own tournaments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Hosts can update results for own tournaments" ON public.match_results FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = match_results.tournament_id) AND (t.host_id = auth.uid())))));


--
-- Name: teams Players can create their own team; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Players can create their own team" ON public.teams FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = captain_id));


--
-- Name: registrations Players can register their team; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Players can register their team" ON public.registrations FOR INSERT TO authenticated WITH CHECK (((auth.uid() = player_id) AND (( SELECT tournaments.status
   FROM public.tournaments
  WHERE (tournaments.id = registrations.tournament_id)) = 'upcoming'::text)));


--
-- Name: registrations Players can update own registration; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Players can update own registration" ON public.registrations FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = player_id));


--
-- Name: registrations Players can view their own registrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Players can view their own registrations" ON public.registrations FOR SELECT USING ((auth.uid() = player_id));


--
-- Name: Profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public."Profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: match_results Results are publicly viewable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Results are publicly viewable" ON public.match_results FOR SELECT USING (true);


--
-- Name: Profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public."Profiles" FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: Profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public."Profiles" FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: Profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public."Profiles" FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: match_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: player_match_results; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.player_match_results ENABLE ROW LEVEL SECURITY;

--
-- Name: registrations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tournaments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION cancel_registration(p_registration_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cancel_registration(p_registration_id uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_registration(p_registration_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_registration(p_registration_id uuid) TO service_role;


--
-- Name: FUNCTION get_broadcast_push_tokens(target_role text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_broadcast_push_tokens(target_role text) TO anon;
GRANT ALL ON FUNCTION public.get_broadcast_push_tokens(target_role text) TO authenticated;
GRANT ALL ON FUNCTION public.get_broadcast_push_tokens(target_role text) TO service_role;


--
-- Name: FUNCTION get_broadcast_recipients(target_role text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_broadcast_recipients(target_role text) TO anon;
GRANT ALL ON FUNCTION public.get_broadcast_recipients(target_role text) TO authenticated;
GRANT ALL ON FUNCTION public.get_broadcast_recipients(target_role text) TO service_role;


--
-- Name: FUNCTION get_confirmed_player_tokens(target_tournament_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_confirmed_player_tokens(target_tournament_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_confirmed_player_tokens(target_tournament_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_confirmed_player_tokens(target_tournament_id uuid) TO service_role;


--
-- Name: FUNCTION get_confirmed_players(target_tournament_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_confirmed_players(target_tournament_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_confirmed_players(target_tournament_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_confirmed_players(target_tournament_id uuid) TO service_role;


--
-- Name: FUNCTION get_leaderboard(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_leaderboard() TO anon;
GRANT ALL ON FUNCTION public.get_leaderboard() TO authenticated;
GRANT ALL ON FUNCTION public.get_leaderboard() TO service_role;


--
-- Name: FUNCTION insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid) TO anon;
GRANT ALL ON FUNCTION public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.insert_notification(p_user_id uuid, p_title text, p_body text, p_tournament_id uuid) TO service_role;


--
-- Name: FUNCTION lock_is_verified(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.lock_is_verified() TO anon;
GRANT ALL ON FUNCTION public.lock_is_verified() TO authenticated;
GRANT ALL ON FUNCTION public.lock_is_verified() TO service_role;


--
-- Name: TABLE "Profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public."Profiles" TO anon;
GRANT ALL ON TABLE public."Profiles" TO authenticated;
GRANT ALL ON TABLE public."Profiles" TO service_role;


--
-- Name: TABLE match_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.match_results TO anon;
GRANT ALL ON TABLE public.match_results TO authenticated;
GRANT ALL ON TABLE public.match_results TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE player_match_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.player_match_results TO anon;
GRANT ALL ON TABLE public.player_match_results TO authenticated;
GRANT ALL ON TABLE public.player_match_results TO service_role;


--
-- Name: TABLE public_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.public_profiles TO anon;
GRANT ALL ON TABLE public.public_profiles TO authenticated;
GRANT ALL ON TABLE public.public_profiles TO service_role;


--
-- Name: TABLE registrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.registrations TO anon;
GRANT ALL ON TABLE public.registrations TO authenticated;
GRANT ALL ON TABLE public.registrations TO service_role;


--
-- Name: TABLE team_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.team_members TO anon;
GRANT ALL ON TABLE public.team_members TO authenticated;
GRANT ALL ON TABLE public.team_members TO service_role;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


--
-- Name: TABLE tournaments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tournaments TO anon;
GRANT ALL ON TABLE public.tournaments TO authenticated;
GRANT ALL ON TABLE public.tournaments TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict Skf8m23nOsWZzAAaBU2W8ZNA6loPo736it9aO0CwxbZdllb6vY8Loy9exhnCxdq

