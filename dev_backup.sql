--
-- PostgreSQL database dump
--

\restrict gr9feHcAXtWNK80W7Ik5qeyYLjt9hZSdb3jE5GrBRO3d0iBF7jU0snig1hJd8K1

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: competition_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.competition_status AS ENUM (
    'open',
    'active',
    'completed'
);


ALTER TYPE public.competition_status OWNER TO postgres;

--
-- Name: competition_tier; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.competition_tier AS ENUM (
    'common',
    'rare'
);


ALTER TYPE public.competition_tier OWNER TO postgres;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'eft',
    'ewallet',
    'bank_transfer',
    'mobile_money',
    'other'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: position; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."position" AS ENUM (
    'GK',
    'DEF',
    'MID',
    'FWD'
);


ALTER TYPE public."position" OWNER TO postgres;

--
-- Name: rarity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rarity AS ENUM (
    'common',
    'rare',
    'unique',
    'epic',
    'legendary'
);


ALTER TYPE public.rarity OWNER TO postgres;

--
-- Name: swap_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.swap_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'cancelled'
);


ALTER TYPE public.swap_status OWNER TO postgres;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_type AS ENUM (
    'deposit',
    'withdrawal',
    'purchase',
    'sale',
    'entry_fee',
    'prize',
    'swap_fee'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: withdrawal_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.withdrawal_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'rejected'
);


ALTER TYPE public.withdrawal_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: competition_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competition_entries (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    user_id character varying NOT NULL,
    lineup_card_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    captain_id integer,
    total_score real DEFAULT 0 NOT NULL,
    rank integer,
    prize_amount real DEFAULT 0,
    prize_card_id integer,
    joined_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.competition_entries OWNER TO postgres;

--
-- Name: competition_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.competition_entries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.competition_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: competitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competitions (
    id integer NOT NULL,
    name text NOT NULL,
    tier public.competition_tier NOT NULL,
    entry_fee real DEFAULT 0 NOT NULL,
    status public.competition_status DEFAULT 'open'::public.competition_status NOT NULL,
    game_week integer NOT NULL,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    prize_card_rarity public.rarity,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.competitions OWNER TO postgres;

--
-- Name: competitions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.competitions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.competitions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: epl_fixtures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epl_fixtures (
    id integer NOT NULL,
    api_id integer NOT NULL,
    home_team text NOT NULL,
    home_team_logo text,
    home_team_id integer,
    away_team text NOT NULL,
    away_team_logo text,
    away_team_id integer,
    home_goals integer,
    away_goals integer,
    fixture_status text DEFAULT 'NS'::text NOT NULL,
    status_long text DEFAULT 'Not Started'::text,
    elapsed integer,
    venue text,
    referee text,
    round text,
    match_date timestamp without time zone NOT NULL,
    season integer DEFAULT 2024 NOT NULL,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.epl_fixtures OWNER TO postgres;

--
-- Name: epl_fixtures_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.epl_fixtures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.epl_fixtures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: epl_injuries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epl_injuries (
    id integer NOT NULL,
    player_api_id integer NOT NULL,
    player_name text NOT NULL,
    player_photo text,
    team text NOT NULL,
    team_logo text,
    injury_type text,
    reason text,
    fixture_api_id integer,
    fixture_date timestamp without time zone,
    season integer DEFAULT 2024 NOT NULL,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.epl_injuries OWNER TO postgres;

--
-- Name: epl_injuries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.epl_injuries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.epl_injuries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: epl_players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epl_players (
    id integer NOT NULL,
    api_id integer NOT NULL,
    name text NOT NULL,
    firstname text,
    lastname text,
    age integer,
    nationality text,
    photo text,
    team text,
    team_logo text,
    team_id integer,
    epl_position text,
    number integer,
    goals integer DEFAULT 0,
    assists integer DEFAULT 0,
    yellow_cards integer DEFAULT 0,
    red_cards integer DEFAULT 0,
    appearances integer DEFAULT 0,
    minutes integer DEFAULT 0,
    rating text,
    injured boolean DEFAULT false,
    season integer DEFAULT 2024 NOT NULL,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.epl_players OWNER TO postgres;

--
-- Name: epl_players_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.epl_players ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.epl_players_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: epl_standings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epl_standings (
    id integer NOT NULL,
    team_id integer NOT NULL,
    team_name text NOT NULL,
    team_logo text,
    rank integer NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    played integer DEFAULT 0 NOT NULL,
    won integer DEFAULT 0 NOT NULL,
    drawn integer DEFAULT 0 NOT NULL,
    lost integer DEFAULT 0 NOT NULL,
    goals_for integer DEFAULT 0 NOT NULL,
    goals_against integer DEFAULT 0 NOT NULL,
    goal_diff integer DEFAULT 0 NOT NULL,
    form text,
    season integer DEFAULT 2024 NOT NULL,
    last_updated timestamp without time zone DEFAULT now()
);


ALTER TABLE public.epl_standings OWNER TO postgres;

--
-- Name: epl_standings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.epl_standings ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.epl_standings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: epl_sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epl_sync_log (
    id integer NOT NULL,
    endpoint text NOT NULL,
    synced_at timestamp without time zone DEFAULT now(),
    record_count integer DEFAULT 0
);


ALTER TABLE public.epl_sync_log OWNER TO postgres;

--
-- Name: epl_sync_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.epl_sync_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.epl_sync_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lineups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lineups (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    card_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    captain_id integer
);


ALTER TABLE public.lineups OWNER TO postgres;

--
-- Name: lineups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.lineups ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lineups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: player_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_cards (
    id integer NOT NULL,
    player_id integer NOT NULL,
    owner_id character varying,
    rarity public.rarity DEFAULT 'common'::public.rarity NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    last_5_scores jsonb DEFAULT '[0, 0, 0, 0, 0]'::jsonb,
    for_sale boolean DEFAULT false NOT NULL,
    price real DEFAULT 0,
    acquired_at timestamp without time zone DEFAULT now(),
    serial_id text,
    serial_number integer,
    max_supply integer DEFAULT 0,
    decisive_score integer DEFAULT 35
);


ALTER TABLE public.player_cards OWNER TO postgres;

--
-- Name: player_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.player_cards ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.player_cards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players (
    id integer NOT NULL,
    name text NOT NULL,
    team text NOT NULL,
    league text NOT NULL,
    "position" public."position" NOT NULL,
    nationality text NOT NULL,
    age integer NOT NULL,
    overall integer NOT NULL,
    image_url text
);


ALTER TABLE public.players OWNER TO postgres;

--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.players ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.players_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: swap_offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.swap_offers (
    id integer NOT NULL,
    offerer_user_id character varying NOT NULL,
    receiver_user_id character varying NOT NULL,
    offered_card_id integer NOT NULL,
    requested_card_id integer NOT NULL,
    top_up_amount real DEFAULT 0,
    top_up_direction text DEFAULT 'none'::text,
    status public.swap_status DEFAULT 'pending'::public.swap_status NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.swap_offers OWNER TO postgres;

--
-- Name: swap_offers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.swap_offers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.swap_offers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    type public.transaction_type NOT NULL,
    amount real NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    payment_method text,
    external_transaction_id text
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_onboarding; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_onboarding (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    pack_cards jsonb DEFAULT '[]'::jsonb,
    selected_cards jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.user_onboarding OWNER TO postgres;

--
-- Name: user_onboarding_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.user_onboarding ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.user_onboarding_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    balance real DEFAULT 0 NOT NULL,
    locked_balance real DEFAULT 0 NOT NULL
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.wallets ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.withdrawal_requests (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    amount real NOT NULL,
    fee real DEFAULT 0 NOT NULL,
    net_amount real NOT NULL,
    payment_method text NOT NULL,
    bank_name text,
    account_holder text,
    account_number text,
    iban text,
    swift_code text,
    ewallet_provider text,
    ewallet_id text,
    status public.withdrawal_status DEFAULT 'pending'::public.withdrawal_status NOT NULL,
    admin_notes text,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.withdrawal_requests OWNER TO postgres;

--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.withdrawal_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.withdrawal_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: competition_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competition_entries (id, competition_id, user_id, lineup_card_ids, captain_id, total_score, rank, prize_amount, prize_card_id, joined_at) FROM stdin;
1	3	54644807	[15, 17, 18, 19, 16]	17	0	\N	0	\N	2026-02-12 08:17:51.397271
\.


--
-- Data for Name: competitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competitions (id, name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, created_at) FROM stdin;
1	Common Cup - GW1	common	0	open	1	2026-02-12 08:13:18.304	2026-02-15 23:59:59.999	rare	2026-02-12 08:13:18.30697
2	Rare Championship - GW1	rare	20	open	1	2026-02-12 08:13:18.304	2026-02-15 23:59:59.999	unique	2026-02-12 08:13:18.312328
3	Common Cup - GW2	common	0	open	2	2026-02-15 23:59:59.999	2026-02-22 23:59:59.999	rare	2026-02-12 08:13:18.317043
4	Rare Championship - GW2	rare	20	open	2	2026-02-15 23:59:59.999	2026-02-22 23:59:59.999	unique	2026-02-12 08:13:18.320821
\.


--
-- Data for Name: epl_fixtures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epl_fixtures (id, api_id, home_team, home_team_logo, home_team_id, away_team, away_team_logo, away_team_id, home_goals, away_goals, fixture_status, status_long, elapsed, venue, referee, round, match_date, season, last_updated) FROM stdin;
382	1208022	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	2	FT	Match Finished	90	Portman Road	T. Robinson	Regular Season - 1	2024-08-17 11:30:00	2024	2026-02-12 13:00:07.254
383	1208025	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Southampton	https://media.api-sports.io/football/teams/41.png	41	1	0	FT	Match Finished	90	St. James' Park	C. Pawson	Regular Season - 1	2024-08-17 14:00:00	2024	2026-02-12 13:00:07.262
384	1208023	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Wolves	https://media.api-sports.io/football/teams/39.png	39	2	0	FT	Match Finished	90	Emirates Stadium	J. Gillett	Regular Season - 1	2024-08-17 14:00:00	2024	2026-02-12 13:00:07.274
385	1208024	Everton	https://media.api-sports.io/football/teams/45.png	45	Brighton	https://media.api-sports.io/football/teams/51.png	51	0	3	FT	Match Finished	90	Goodison Park	S. Hooper	Regular Season - 1	2024-08-17 14:00:00	2024	2026-02-12 13:00:07.283
386	1208026	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	1	FT	Match Finished	90	The City Ground	M. Oliver	Regular Season - 1	2024-08-17 14:00:00	2024	2026-02-12 13:00:07.289
387	1208027	West Ham	https://media.api-sports.io/football/teams/48.png	48	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	1	2	FT	Match Finished	90	London Stadium	T. Harrington	Regular Season - 1	2024-08-17 16:30:00	2024	2026-02-12 13:00:07.294
388	1208028	Brentford	https://media.api-sports.io/football/teams/55.png	55	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	2	1	FT	Match Finished	90	Gtech Community Stadium	S. Barrott	Regular Season - 1	2024-08-18 13:00:00	2024	2026-02-12 13:00:07.299
389	1208029	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	2	FT	Match Finished	90	Stamford Bridge	A. Taylor	Regular Season - 1	2024-08-18 15:30:00	2024	2026-02-12 13:00:07.305
390	1208030	Leicester	https://media.api-sports.io/football/teams/46.png	46	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	1	FT	Match Finished	90	King Power Stadium	C. Kavanagh	Regular Season - 1	2024-08-19 19:00:00	2024	2026-02-12 13:00:07.308
391	1208033	Brighton	https://media.api-sports.io/football/teams/51.png	51	Manchester United	https://media.api-sports.io/football/teams/33.png	33	2	1	FT	Match Finished	90	American Express Stadium	C. Pawson	Regular Season - 2	2024-08-24 11:30:00	2024	2026-02-12 13:00:07.312
392	1208035	Fulham	https://media.api-sports.io/football/teams/36.png	36	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	1	FT	Match Finished	90	Craven Cottage	D. Bond	Regular Season - 2	2024-08-24 14:00:00	2024	2026-02-12 13:00:07.316
393	1208038	Southampton	https://media.api-sports.io/football/teams/41.png	41	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	0	1	FT	Match Finished	90	St. Mary's Stadium	S. Barrott	Regular Season - 2	2024-08-24 14:00:00	2024	2026-02-12 13:00:07.32
394	1208039	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Everton	https://media.api-sports.io/football/teams/45.png	45	4	0	FT	Match Finished	90	Tottenham Hotspur Stadium	A. Taylor	Regular Season - 2	2024-08-24 14:00:00	2024	2026-02-12 13:00:07.332
395	1208037	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Ipswich	https://media.api-sports.io/football/teams/57.png	57	4	1	FT	Match Finished	90	Etihad Stadium	S. Allison	Regular Season - 2	2024-08-24 14:00:00	2024	2026-02-12 13:00:07.345
396	1208034	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	West Ham	https://media.api-sports.io/football/teams/48.png	48	0	2	FT	Match Finished	90	Selhurst Park	R. Jones	Regular Season - 2	2024-08-24 14:00:00	2024	2026-02-12 13:00:07.384
397	1208032	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Arsenal	https://media.api-sports.io/football/teams/42.png	42	0	2	FT	Match Finished	90	Villa Park	M. Oliver	Regular Season - 2	2024-08-24 16:30:00	2024	2026-02-12 13:00:07.391
398	1208031	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	1	FT	Match Finished	90	Vitality Stadium	D. Coote	Regular Season - 2	2024-08-25 13:00:00	2024	2026-02-12 13:00:07.405
399	1208040	Wolves	https://media.api-sports.io/football/teams/39.png	39	Chelsea	https://media.api-sports.io/football/teams/49.png	49	2	6	FT	Match Finished	90	Molineux Stadium	D. England	Regular Season - 2	2024-08-25 13:00:00	2024	2026-02-12 13:00:07.411
400	1208036	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Brentford	https://media.api-sports.io/football/teams/55.png	55	2	0	FT	Match Finished	90	Anfield	S. Attwell	Regular Season - 2	2024-08-25 15:30:00	2024	2026-02-12 13:00:07.416
401	1208041	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Brighton	https://media.api-sports.io/football/teams/51.png	51	1	1	FT	Match Finished	90	Emirates Stadium	C. Kavanagh	Regular Season - 3	2024-08-31 11:30:00	2024	2026-02-12 13:00:07.422
402	1208044	Everton	https://media.api-sports.io/football/teams/45.png	45	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	3	FT	Match Finished	90	Goodison Park	S. Attwell	Regular Season - 3	2024-08-31 14:00:00	2024	2026-02-12 13:00:07.426
403	1208046	Leicester	https://media.api-sports.io/football/teams/46.png	46	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	1	2	FT	Match Finished	90	King Power Stadium	D. Coote	Regular Season - 3	2024-08-31 14:00:00	2024	2026-02-12 13:00:07.434
404	1208042	Brentford	https://media.api-sports.io/football/teams/55.png	55	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	1	FT	Match Finished	90	Gtech Community Stadium	J. Smith	Regular Season - 3	2024-08-31 14:00:00	2024	2026-02-12 13:00:07.441
405	1208045	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	1	FT	Match Finished	90	Portman Road	L. Smith	Regular Season - 3	2024-08-31 14:00:00	2024	2026-02-12 13:00:07.444
406	1208049	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Wolves	https://media.api-sports.io/football/teams/39.png	39	1	1	FT	Match Finished	90	The City Ground	S. Hooper	Regular Season - 3	2024-08-31 14:00:00	2024	2026-02-12 13:00:07.453
407	1208050	West Ham	https://media.api-sports.io/football/teams/48.png	48	Manchester City	https://media.api-sports.io/football/teams/50.png	50	1	3	FT	Match Finished	90	London Stadium	M. Oliver	Regular Season - 3	2024-08-31 16:30:00	2024	2026-02-12 13:00:07.469
408	1208048	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Tottenham	https://media.api-sports.io/football/teams/47.png	47	2	1	FT	Match Finished	90	St. James' Park	R. Jones	Regular Season - 3	2024-09-01 12:30:00	2024	2026-02-12 13:00:07.472
409	1208043	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	1	1	FT	Match Finished	90	Stamford Bridge	J. Gillett	Regular Season - 3	2024-09-01 12:30:00	2024	2026-02-12 13:00:07.476
411	1208058	Southampton	https://media.api-sports.io/football/teams/41.png	41	Manchester United	https://media.api-sports.io/football/teams/33.png	33	0	3	FT	Match Finished	90	St. Mary's Stadium	S. Attwell	Regular Season - 4	2024-09-14 11:30:00	2024	2026-02-12 13:00:07.483
412	1208055	Fulham	https://media.api-sports.io/football/teams/36.png	36	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	1	FT	Match Finished	90	Craven Cottage	T. Robinson	Regular Season - 4	2024-09-14 14:00:00	2024	2026-02-12 13:00:07.486
413	1208056	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	0	1	FT	Match Finished	90	Anfield	M. Oliver	Regular Season - 4	2024-09-14 14:00:00	2024	2026-02-12 13:00:07.49
414	1208057	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Brentford	https://media.api-sports.io/football/teams/55.png	55	2	1	FT	Match Finished	90	Etihad Stadium	D. Bond	Regular Season - 4	2024-09-14 14:00:00	2024	2026-02-12 13:00:07.494
415	1208053	Brighton	https://media.api-sports.io/football/teams/51.png	51	Ipswich	https://media.api-sports.io/football/teams/57.png	57	0	0	FT	Match Finished	90	American Express Stadium	S. Barrott	Regular Season - 4	2024-09-14 14:00:00	2024	2026-02-12 13:00:07.497
416	1208054	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	2	FT	Match Finished	90	Selhurst Park	T. Harrington	Regular Season - 4	2024-09-14 14:00:00	2024	2026-02-12 13:00:07.5
417	1208052	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Everton	https://media.api-sports.io/football/teams/45.png	45	3	2	FT	Match Finished	90	Villa Park	C. Pawson	Regular Season - 4	2024-09-14 16:30:00	2024	2026-02-12 13:00:07.504
418	1208051	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Chelsea	https://media.api-sports.io/football/teams/49.png	49	0	1	FT	Match Finished	90	Vitality Stadium	A. Taylor	Regular Season - 4	2024-09-14 19:00:00	2024	2026-02-12 13:00:07.509
419	1208059	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Arsenal	https://media.api-sports.io/football/teams/42.png	42	0	1	FT	Match Finished	90	Tottenham Hotspur Stadium	J. Gillett	Regular Season - 4	2024-09-15 13:00:00	2024	2026-02-12 13:00:07.514
420	1208060	Wolves	https://media.api-sports.io/football/teams/39.png	39	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	2	FT	Match Finished	90	Molineux Stadium	C. Kavanagh	Regular Season - 4	2024-09-15 15:30:00	2024	2026-02-12 13:00:07.518
421	1208070	West Ham	https://media.api-sports.io/football/teams/48.png	48	Chelsea	https://media.api-sports.io/football/teams/49.png	49	0	3	FT	Match Finished	90	London Stadium	S. Barrott	Regular Season - 5	2024-09-21 11:30:00	2024	2026-02-12 13:00:07.522
422	1208064	Fulham	https://media.api-sports.io/football/teams/36.png	36	Newcastle	https://media.api-sports.io/football/teams/34.png	34	3	1	FT	Match Finished	90	Craven Cottage	P. Bankes	Regular Season - 5	2024-09-21 14:00:00	2024	2026-02-12 13:00:07.527
423	1208066	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	3	0	FT	Match Finished	90	Anfield	T. Harrington	Regular Season - 5	2024-09-21 14:00:00	2024	2026-02-12 13:00:07.531
424	1208068	Southampton	https://media.api-sports.io/football/teams/41.png	41	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	1	FT	Match Finished	90	St. Mary's Stadium	S. Allison	Regular Season - 5	2024-09-21 14:00:00	2024	2026-02-12 13:00:07.536
425	1208065	Leicester	https://media.api-sports.io/football/teams/46.png	46	Everton	https://media.api-sports.io/football/teams/45.png	45	1	1	FT	Match Finished	90	King Power Stadium	D. England	Regular Season - 5	2024-09-21 14:00:00	2024	2026-02-12 13:00:07.547
426	1208069	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Brentford	https://media.api-sports.io/football/teams/55.png	55	3	1	FT	Match Finished	90	Tottenham Hotspur Stadium	J. Brooks	Regular Season - 5	2024-09-21 14:00:00	2024	2026-02-12 13:00:07.556
427	1208061	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Wolves	https://media.api-sports.io/football/teams/39.png	39	3	1	FT	Match Finished	90	Villa Park	T. Robinson	Regular Season - 5	2024-09-21 14:00:00	2024	2026-02-12 13:00:07.562
428	1208063	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Manchester United	https://media.api-sports.io/football/teams/33.png	33	0	0	FT	Match Finished	90	Selhurst Park	D. Coote	Regular Season - 5	2024-09-21 16:30:00	2024	2026-02-12 13:00:07.567
429	1208062	Brighton	https://media.api-sports.io/football/teams/51.png	51	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	2	2	FT	Match Finished	90	American Express Stadium	R. Jones	Regular Season - 5	2024-09-22 13:00:00	2024	2026-02-12 13:00:07.571
430	1208067	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Arsenal	https://media.api-sports.io/football/teams/42.png	42	2	2	FT	Match Finished	90	Etihad Stadium	M. Oliver	Regular Season - 5	2024-09-22 15:30:00	2024	2026-02-12 13:00:07.577
431	1208078	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Manchester City	https://media.api-sports.io/football/teams/50.png	50	1	1	FT	Match Finished	90	St. James' Park	J. Gillett	Regular Season - 6	2024-09-28 11:30:00	2024	2026-02-12 13:00:07.582
432	1208072	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Leicester	https://media.api-sports.io/football/teams/46.png	46	4	2	FT	Match Finished	90	Emirates Stadium	S. Barrott	Regular Season - 6	2024-09-28 14:00:00	2024	2026-02-12 13:00:07.595
433	1208075	Everton	https://media.api-sports.io/football/teams/45.png	45	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	2	1	FT	Match Finished	90	Goodison Park	A. Madley	Regular Season - 6	2024-09-28 14:00:00	2024	2026-02-12 13:00:07.599
434	1208074	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Brighton	https://media.api-sports.io/football/teams/51.png	51	4	2	FT	Match Finished	90	Stamford Bridge	P. Bankes	Regular Season - 6	2024-09-28 14:00:00	2024	2026-02-12 13:00:07.639
435	1208073	Brentford	https://media.api-sports.io/football/teams/55.png	55	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	1	FT	Match Finished	90	Gtech Community Stadium	S. Hooper	Regular Season - 6	2024-09-28 14:00:00	2024	2026-02-12 13:00:07.642
436	1208079	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Fulham	https://media.api-sports.io/football/teams/36.png	36	0	1	FT	Match Finished	90	The City Ground	J. Smith	Regular Season - 6	2024-09-28 14:00:00	2024	2026-02-12 13:00:07.651
437	1208080	Wolves	https://media.api-sports.io/football/teams/39.png	39	Liverpool	https://media.api-sports.io/football/teams/40.png	40	1	2	FT	Match Finished	90	Molineux Stadium	A. Taylor	Regular Season - 6	2024-09-28 16:30:00	2024	2026-02-12 13:00:07.888
438	1208076	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	2	FT	Match Finished	90	Portman Road	S. Attwell	Regular Season - 6	2024-09-29 13:00:00	2024	2026-02-12 13:00:08.072
440	1208071	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	1	FT	Match Finished	90	Vitality Stadium	M. Oliver	Regular Season - 6	2024-09-30 19:00:00	2024	2026-02-12 13:00:08.702
441	1208086	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	1	FT	Match Finished	90	Selhurst Park	S. Hooper	Regular Season - 7	2024-10-05 11:30:00	2024	2026-02-12 13:00:10.148
442	1208081	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	1	FT	Match Finished	90	Emirates Stadium	T. Harrington	Regular Season - 7	2024-10-05 14:00:00	2024	2026-02-12 13:00:10.192
443	1208088	Leicester	https://media.api-sports.io/football/teams/46.png	46	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	0	FT	Match Finished	90	King Power Stadium	D. Bond	Regular Season - 7	2024-10-05 14:00:00	2024	2026-02-12 13:00:10.216
444	1208090	West Ham	https://media.api-sports.io/football/teams/48.png	48	Ipswich	https://media.api-sports.io/football/teams/57.png	57	4	1	FT	Match Finished	90	London Stadium	A. Taylor	Regular Season - 7	2024-10-05 14:00:00	2024	2026-02-12 13:00:10.26
445	1208089	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Fulham	https://media.api-sports.io/football/teams/36.png	36	3	2	FT	Match Finished	90	Etihad Stadium	P. Bankes	Regular Season - 7	2024-10-05 14:00:00	2024	2026-02-12 13:00:10.404
446	1208083	Brentford	https://media.api-sports.io/football/teams/55.png	55	Wolves	https://media.api-sports.io/football/teams/39.png	39	5	3	FT	Match Finished	90	Gtech Community Stadium	A. Madley	Regular Season - 7	2024-10-05 14:00:00	2024	2026-02-12 13:00:10.624
447	1208087	Everton	https://media.api-sports.io/football/teams/45.png	45	Newcastle	https://media.api-sports.io/football/teams/34.png	34	0	0	FT	Match Finished	90	Goodison Park	C. Pawson	Regular Season - 7	2024-10-05 16:30:00	2024	2026-02-12 13:00:10.703
448	1208085	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	1	1	FT	Match Finished	90	Stamford Bridge	C. Kavanagh	Regular Season - 7	2024-10-06 13:00:00	2024	2026-02-12 13:00:10.756
449	1208082	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Manchester United	https://media.api-sports.io/football/teams/33.png	33	0	0	FT	Match Finished	90	Villa Park	R. Jones	Regular Season - 7	2024-10-06 13:00:00	2024	2026-02-12 13:00:10.761
450	1208084	Brighton	https://media.api-sports.io/football/teams/51.png	51	Tottenham	https://media.api-sports.io/football/teams/47.png	47	3	2	FT	Match Finished	90	American Express Stadium	D. Coote	Regular Season - 7	2024-10-06 15:30:00	2024	2026-02-12 13:00:10.766
451	1208099	Tottenham	https://media.api-sports.io/football/teams/47.png	47	West Ham	https://media.api-sports.io/football/teams/48.png	48	4	1	FT	Match Finished	90	Tottenham Hotspur Stadium	A. Madley	Regular Season - 8	2024-10-19 11:30:00	2024	2026-02-12 13:00:10.769
452	1208095	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Brentford	https://media.api-sports.io/football/teams/55.png	55	2	1	FT	Match Finished	90	Old Trafford	S. Barrott	Regular Season - 8	2024-10-19 14:00:00	2024	2026-02-12 13:00:10.773
453	1208096	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Brighton	https://media.api-sports.io/football/teams/51.png	51	0	1	FT	Match Finished	90	St. James' Park	P. Bankes	Regular Season - 8	2024-10-19 14:00:00	2024	2026-02-12 13:00:10.775
454	1208092	Fulham	https://media.api-sports.io/football/teams/36.png	36	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	1	3	FT	Match Finished	90	Craven Cottage	D. England	Regular Season - 8	2024-10-19 14:00:00	2024	2026-02-12 13:00:10.778
455	1208098	Southampton	https://media.api-sports.io/football/teams/41.png	41	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	3	FT	Match Finished	90	St. Mary's Stadium	A. Taylor	Regular Season - 8	2024-10-19 14:00:00	2024	2026-02-12 13:00:10.782
456	1208093	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Everton	https://media.api-sports.io/football/teams/45.png	45	0	2	FT	Match Finished	90	Portman Road	M. Oliver	Regular Season - 8	2024-10-19 14:00:00	2024	2026-02-12 13:00:10.789
457	1208091	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Arsenal	https://media.api-sports.io/football/teams/42.png	42	2	0	FT	Match Finished	90	Vitality Stadium	R. Jones	Regular Season - 8	2024-10-19 16:30:00	2024	2026-02-12 13:00:10.792
458	1208100	Wolves	https://media.api-sports.io/football/teams/39.png	39	Manchester City	https://media.api-sports.io/football/teams/50.png	50	1	2	FT	Match Finished	90	Molineux Stadium	C. Kavanagh	Regular Season - 8	2024-10-20 13:00:00	2024	2026-02-12 13:00:10.796
459	1208094	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Chelsea	https://media.api-sports.io/football/teams/49.png	49	2	1	FT	Match Finished	90	Anfield	J. Brooks	Regular Season - 8	2024-10-20 15:30:00	2024	2026-02-12 13:00:10.799
460	1208097	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	1	0	FT	Match Finished	90	The City Ground	T. Robinson	Regular Season - 8	2024-10-21 19:00:00	2024	2026-02-12 13:00:10.802
461	1208110	Leicester	https://media.api-sports.io/football/teams/46.png	46	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	1	3	FT	Match Finished	90	King Power Stadium	C. Pawson	Regular Season - 9	2024-10-25 19:00:00	2024	2026-02-12 13:00:10.805
462	1208111	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Southampton	https://media.api-sports.io/football/teams/41.png	41	1	0	FT	Match Finished	90	Etihad Stadium	T. Harrington	Regular Season - 9	2024-10-26 14:00:00	2024	2026-02-12 13:00:10.808
463	1208106	Brighton	https://media.api-sports.io/football/teams/51.png	51	Wolves	https://media.api-sports.io/football/teams/39.png	39	2	2	FT	Match Finished	90	American Express Stadium	M. Oliver	Regular Season - 9	2024-10-26 14:00:00	2024	2026-02-12 13:00:10.811
464	1208105	Brentford	https://media.api-sports.io/football/teams/55.png	55	Ipswich	https://media.api-sports.io/football/teams/57.png	57	4	3	FT	Match Finished	90	Gtech Community Stadium	L. Smith	Regular Season - 9	2024-10-26 14:00:00	2024	2026-02-12 13:00:10.814
465	1208104	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	1	FT	Match Finished	90	Villa Park	C. Kavanagh	Regular Season - 9	2024-10-26 14:00:00	2024	2026-02-12 13:00:10.817
466	1208109	Everton	https://media.api-sports.io/football/teams/45.png	45	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	1	FT	Match Finished	90	Goodison Park	J. Brooks	Regular Season - 9	2024-10-26 16:30:00	2024	2026-02-12 13:00:10.82
467	1208112	West Ham	https://media.api-sports.io/football/teams/48.png	48	Manchester United	https://media.api-sports.io/football/teams/33.png	33	2	1	FT	Match Finished	90	London Stadium	D. Coote	Regular Season - 9	2024-10-27 13:00:00	2024	2026-02-12 13:00:10.823
469	1208108	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	0	FT	Match Finished	90	Selhurst Park	D. Bond	Regular Season - 9	2024-10-27 13:00:00	2024	2026-02-12 13:00:10.828
470	1208103	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Liverpool	https://media.api-sports.io/football/teams/40.png	40	2	2	FT	Match Finished	90	Emirates Stadium	A. Taylor	Regular Season - 9	2024-10-27 15:30:00	2024	2026-02-12 13:00:10.831
471	1208118	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	0	FT	Match Finished	90	St. James' Park	J. Brooks	Regular Season - 10	2024-11-02 12:30:00	2024	2026-02-12 13:00:10.833
472	1208113	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Manchester City	https://media.api-sports.io/football/teams/50.png	50	2	1	FT	Match Finished	90	Vitality Stadium	M. Oliver	Regular Season - 10	2024-11-02 15:00:00	2024	2026-02-12 13:00:10.836
473	1208116	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Brighton	https://media.api-sports.io/football/teams/51.png	51	2	1	FT	Match Finished	90	Anfield	T. Harrington	Regular Season - 10	2024-11-02 15:00:00	2024	2026-02-12 13:00:10.838
474	1208120	Southampton	https://media.api-sports.io/football/teams/41.png	41	Everton	https://media.api-sports.io/football/teams/45.png	45	1	0	FT	Match Finished	90	St. Mary's Stadium	A. Madley	Regular Season - 10	2024-11-02 15:00:00	2024	2026-02-12 13:00:10.841
475	1208115	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Leicester	https://media.api-sports.io/football/teams/46.png	46	1	1	FT	Match Finished	90	Portman Road	T. Robinson	Regular Season - 10	2024-11-02 15:00:00	2024	2026-02-12 13:00:10.844
476	1208119	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	West Ham	https://media.api-sports.io/football/teams/48.png	48	3	0	FT	Match Finished	90	The City Ground	P. Bankes	Regular Season - 10	2024-11-02 15:00:00	2024	2026-02-12 13:00:10.846
477	1208122	Wolves	https://media.api-sports.io/football/teams/39.png	39	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	2	2	FT	Match Finished	90	Molineux Stadium	A. Taylor	Regular Season - 10	2024-11-02 17:30:00	2024	2026-02-12 13:00:10.849
478	1208121	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	4	1	FT	Match Finished	90	Tottenham Hotspur Stadium	C. Pawson	Regular Season - 10	2024-11-03 14:00:00	2024	2026-02-12 13:00:10.853
479	1208117	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Chelsea	https://media.api-sports.io/football/teams/49.png	49	1	1	FT	Match Finished	90	Old Trafford	R. Jones	Regular Season - 10	2024-11-03 16:30:00	2024	2026-02-12 13:00:10.856
480	1208114	Fulham	https://media.api-sports.io/football/teams/36.png	36	Brentford	https://media.api-sports.io/football/teams/55.png	55	2	1	FT	Match Finished	90	Craven Cottage	S. Attwell	Regular Season - 10	2024-11-04 20:00:00	2024	2026-02-12 13:00:10.858
481	1208132	Wolves	https://media.api-sports.io/football/teams/39.png	39	Southampton	https://media.api-sports.io/football/teams/41.png	41	2	0	FT	Match Finished	90	Molineux Stadium	T. Bramall	Regular Season - 11	2024-11-09 15:00:00	2024	2026-02-12 13:00:10.861
482	1208131	West Ham	https://media.api-sports.io/football/teams/48.png	48	Everton	https://media.api-sports.io/football/teams/45.png	45	0	0	FT	Match Finished	90	London Stadium	S. Attwell	Regular Season - 11	2024-11-09 15:00:00	2024	2026-02-12 13:00:10.864
483	1208126	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Fulham	https://media.api-sports.io/football/teams/36.png	36	0	2	FT	Match Finished	90	Selhurst Park	M. Salisbury	Regular Season - 11	2024-11-09 15:00:00	2024	2026-02-12 13:00:10.866
484	1208123	Brentford	https://media.api-sports.io/football/teams/55.png	55	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	3	2	FT	Match Finished	90	Gtech Community Stadium	D. Bond	Regular Season - 11	2024-11-09 15:00:00	2024	2026-02-12 13:00:10.869
485	1208124	Brighton	https://media.api-sports.io/football/teams/51.png	51	Manchester City	https://media.api-sports.io/football/teams/50.png	50	2	1	FT	Match Finished	90	American Express Stadium	S. Barrott	Regular Season - 11	2024-11-09 17:30:00	2024	2026-02-12 13:00:10.875
486	1208127	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	0	FT	Match Finished	90	Anfield	D. Coote	Regular Season - 11	2024-11-09 20:00:00	2024	2026-02-12 13:00:10.878
487	1208128	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Leicester	https://media.api-sports.io/football/teams/46.png	46	3	0	FT	Match Finished	90	Old Trafford	P. Bankes	Regular Season - 11	2024-11-10 14:00:00	2024	2026-02-12 13:00:10.881
488	1208130	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	2	FT	Match Finished	90	Tottenham Hotspur Stadium	D. England	Regular Season - 11	2024-11-10 14:00:00	2024	2026-02-12 13:00:10.884
489	1208129	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	3	FT	Match Finished	90	The City Ground	A. Taylor	Regular Season - 11	2024-11-10 14:00:00	2024	2026-02-12 13:00:10.886
490	1208125	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	1	FT	Match Finished	90	Stamford Bridge	M. Oliver	Regular Season - 11	2024-11-10 16:30:00	2024	2026-02-12 13:00:10.889
491	1208139	Leicester	https://media.api-sports.io/football/teams/46.png	46	Chelsea	https://media.api-sports.io/football/teams/49.png	49	1	2	FT	Match Finished	90	King Power Stadium	A. Madley	Regular Season - 12	2024-11-23 12:30:00	2024	2026-02-12 13:00:10.892
492	1208133	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Brighton	https://media.api-sports.io/football/teams/51.png	51	1	2	FT	Match Finished	90	Vitality Stadium	S. Attwell	Regular Season - 12	2024-11-23 15:00:00	2024	2026-02-12 13:00:10.895
493	1208137	Fulham	https://media.api-sports.io/football/teams/36.png	36	Wolves	https://media.api-sports.io/football/teams/39.png	39	1	4	FT	Match Finished	90	Craven Cottage	R. Jones	Regular Season - 12	2024-11-23 15:00:00	2024	2026-02-12 13:00:10.898
494	1208134	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	3	0	FT	Match Finished	90	Emirates Stadium	S. Hooper	Regular Season - 12	2024-11-23 15:00:00	2024	2026-02-12 13:00:10.901
495	1208136	Everton	https://media.api-sports.io/football/teams/45.png	45	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	0	FT	Match Finished	90	Goodison Park	C. Kavanagh	Regular Season - 12	2024-11-23 15:00:00	2024	2026-02-12 13:00:10.904
496	1208135	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	2	2	FT	Match Finished	90	Villa Park	T. Robinson	Regular Season - 12	2024-11-23 15:00:00	2024	2026-02-12 13:00:10.906
498	1208142	Southampton	https://media.api-sports.io/football/teams/41.png	41	Liverpool	https://media.api-sports.io/football/teams/40.png	40	2	3	FT	Match Finished	90	St. Mary's Stadium	S. Barrott	Regular Season - 12	2024-11-24 14:00:00	2024	2026-02-12 13:00:10.913
499	1208138	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Manchester United	https://media.api-sports.io/football/teams/33.png	33	1	1	FT	Match Finished	90	Portman Road	A. Taylor	Regular Season - 12	2024-11-24 16:30:00	2024	2026-02-12 13:00:10.917
500	1208141	Newcastle	https://media.api-sports.io/football/teams/34.png	34	West Ham	https://media.api-sports.io/football/teams/48.png	48	0	2	FT	Match Finished	90	St. James' Park	C. Pawson	Regular Season - 12	2024-11-25 20:00:00	2024	2026-02-12 13:00:10.92
501	1208144	Brighton	https://media.api-sports.io/football/teams/51.png	51	Southampton	https://media.api-sports.io/football/teams/41.png	41	1	1	FT	Match Finished	90	American Express Stadium	R. Jones	Regular Season - 13	2024-11-29 20:00:00	2024	2026-02-12 13:00:10.923
502	1208152	Wolves	https://media.api-sports.io/football/teams/39.png	39	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	4	FT	Match Finished	90	Molineux Stadium	P. Bankes	Regular Season - 13	2024-11-30 15:00:00	2024	2026-02-12 13:00:10.932
503	1208146	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	1	FT	Match Finished	90	Selhurst Park	D. England	Regular Season - 13	2024-11-30 15:00:00	2024	2026-02-12 13:00:10.935
504	1208143	Brentford	https://media.api-sports.io/football/teams/55.png	55	Leicester	https://media.api-sports.io/football/teams/46.png	46	4	1	FT	Match Finished	90	Gtech Community Stadium	M. Oliver	Regular Season - 13	2024-11-30 15:00:00	2024	2026-02-12 13:00:10.938
505	1208149	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	0	FT	Match Finished	90	The City Ground	T. Harrington	Regular Season - 13	2024-11-30 15:00:00	2024	2026-02-12 13:00:10.943
506	1208151	West Ham	https://media.api-sports.io/football/teams/48.png	48	Arsenal	https://media.api-sports.io/football/teams/42.png	42	2	5	FT	Match Finished	90	London Stadium	A. Taylor	Regular Season - 13	2024-11-30 17:30:00	2024	2026-02-12 13:00:10.947
507	1208148	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Everton	https://media.api-sports.io/football/teams/45.png	45	4	0	FT	Match Finished	90	Old Trafford	J. Brooks	Regular Season - 13	2024-12-01 13:30:00	2024	2026-02-12 13:00:10.955
508	1208150	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	1	FT	Match Finished	90	Tottenham Hotspur Stadium	D. Bond	Regular Season - 13	2024-12-01 13:30:00	2024	2026-02-12 13:00:10.959
509	1208145	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	3	0	FT	Match Finished	90	Stamford Bridge	S. Attwell	Regular Season - 13	2024-12-01 13:30:00	2024	2026-02-12 13:00:10.964
510	1208147	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Manchester City	https://media.api-sports.io/football/teams/50.png	50	2	0	FT	Match Finished	90	Anfield	C. Kavanagh	Regular Season - 13	2024-12-01 16:00:00	2024	2026-02-12 13:00:10.968
511	1208158	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	1	FT	Match Finished	90	Portman Road	C. Pawson	Regular Season - 14	2024-12-03 19:30:00	2024	2026-02-12 13:00:10.971
512	1208159	Leicester	https://media.api-sports.io/football/teams/46.png	46	West Ham	https://media.api-sports.io/football/teams/48.png	48	3	1	FT	Match Finished	90	King Power Stadium	J. Smith	Regular Season - 14	2024-12-03 20:15:00	2024	2026-02-12 13:00:10.974
513	1208161	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Liverpool	https://media.api-sports.io/football/teams/40.png	40	3	3	FT	Match Finished	90	St. James' Park	A. Madley	Regular Season - 14	2024-12-04 19:30:00	2024	2026-02-12 13:00:10.976
514	1208162	Southampton	https://media.api-sports.io/football/teams/41.png	41	Chelsea	https://media.api-sports.io/football/teams/49.png	49	1	5	FT	Match Finished	90	St. Mary's Stadium	T. Harrington	Regular Season - 14	2024-12-04 19:30:00	2024	2026-02-12 13:00:10.98
515	1208156	Everton	https://media.api-sports.io/football/teams/45.png	45	Wolves	https://media.api-sports.io/football/teams/39.png	39	4	0	FT	Match Finished	90	Goodison Park	M. Salisbury	Regular Season - 14	2024-12-04 19:30:00	2024	2026-02-12 13:00:10.982
516	1208160	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	3	0	FT	Match Finished	90	Etihad Stadium	M. Oliver	Regular Season - 14	2024-12-04 19:30:00	2024	2026-02-12 13:00:10.984
517	1208154	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Manchester United	https://media.api-sports.io/football/teams/33.png	33	2	0	FT	Match Finished	90	Emirates Stadium	S. Barrott	Regular Season - 14	2024-12-04 20:15:00	2024	2026-02-12 13:00:10.987
518	1208155	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Brentford	https://media.api-sports.io/football/teams/55.png	55	3	1	FT	Match Finished	90	Villa Park	L. Smith	Regular Season - 14	2024-12-04 20:15:00	2024	2026-02-12 13:00:10.99
519	1208157	Fulham	https://media.api-sports.io/football/teams/36.png	36	Brighton	https://media.api-sports.io/football/teams/51.png	51	3	1	FT	Match Finished	90	Craven Cottage	P. Bankes	Regular Season - 14	2024-12-05 19:30:00	2024	2026-02-12 13:00:10.993
520	1208153	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	0	FT	Match Finished	90	Vitality Stadium	S. Hooper	Regular Season - 14	2024-12-05 20:15:00	2024	2026-02-12 13:00:10.996
521	1208165	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Manchester City	https://media.api-sports.io/football/teams/50.png	50	2	2	FT	Match Finished	90	Selhurst Park	R. Jones	Regular Season - 15	2024-12-07 15:00:00	2024	2026-02-12 13:00:10.998
522	1208164	Brentford	https://media.api-sports.io/football/teams/55.png	55	Newcastle	https://media.api-sports.io/football/teams/34.png	34	4	2	FT	Match Finished	90	Gtech Community Stadium	S. Hooper	Regular Season - 15	2024-12-07 15:00:00	2024	2026-02-12 13:00:11.001
523	1208163	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Southampton	https://media.api-sports.io/football/teams/41.png	41	1	0	FT	Match Finished	90	Villa Park	D. Bond	Regular Season - 15	2024-12-07 15:00:00	2024	2026-02-12 13:00:11.004
524	1208170	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	2	3	FT	Match Finished	90	Old Trafford	D. England	Regular Season - 15	2024-12-07 17:30:00	2024	2026-02-12 13:00:11.007
525	1208167	Fulham	https://media.api-sports.io/football/teams/36.png	36	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	1	FT	Match Finished	90	Craven Cottage	C. Kavanagh	Regular Season - 15	2024-12-08 14:00:00	2024	2026-02-12 13:00:11.01
527	1208168	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	2	FT	Match Finished	90	Portman Road	M. Salisbury	Regular Season - 15	2024-12-08 14:00:00	2024	2026-02-12 13:00:11.016
528	1208171	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Chelsea	https://media.api-sports.io/football/teams/49.png	49	3	4	FT	Match Finished	90	Tottenham Hotspur Stadium	A. Taylor	Regular Season - 15	2024-12-08 16:30:00	2024	2026-02-12 13:00:11.019
529	1208172	West Ham	https://media.api-sports.io/football/teams/48.png	48	Wolves	https://media.api-sports.io/football/teams/39.png	39	2	1	FT	Match Finished	90	London Stadium	J. Brooks	Regular Season - 15	2024-12-09 20:00:00	2024	2026-02-12 13:00:11.022
530	1208179	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Leicester	https://media.api-sports.io/football/teams/46.png	46	4	0	FT	Match Finished	90	St. James' Park	T. Bramall	Regular Season - 16	2024-12-14 15:00:00	2024	2026-02-12 13:00:11.025
531	1208182	Wolves	https://media.api-sports.io/football/teams/39.png	39	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	2	FT	Match Finished	90	Molineux Stadium	S. Hooper	Regular Season - 16	2024-12-14 15:00:00	2024	2026-02-12 13:00:11.027
532	1208177	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Fulham	https://media.api-sports.io/football/teams/36.png	36	2	2	FT	Match Finished	90	Anfield	T. Harrington	Regular Season - 16	2024-12-14 15:00:00	2024	2026-02-12 13:00:11.03
533	1208174	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Everton	https://media.api-sports.io/football/teams/45.png	45	0	0	FT	Match Finished	90	Emirates Stadium	C. Pawson	Regular Season - 16	2024-12-14 15:00:00	2024	2026-02-12 13:00:11.037
534	1208180	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	1	FT	Match Finished	90	The City Ground	S. Barrott	Regular Season - 16	2024-12-14 17:30:00	2024	2026-02-12 13:00:11.04
535	1208175	Brighton	https://media.api-sports.io/football/teams/51.png	51	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	1	3	FT	Match Finished	90	American Express Stadium	M. Oliver	Regular Season - 16	2024-12-15 14:00:00	2024	2026-02-12 13:00:11.043
536	1208178	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Manchester United	https://media.api-sports.io/football/teams/33.png	33	1	2	FT	Match Finished	90	Etihad Stadium	A. Taylor	Regular Season - 16	2024-12-15 16:30:00	2024	2026-02-12 13:00:11.047
537	1208181	Southampton	https://media.api-sports.io/football/teams/41.png	41	Tottenham	https://media.api-sports.io/football/teams/47.png	47	0	5	FT	Match Finished	90	St. Mary's Stadium	D. England	Regular Season - 16	2024-12-15 19:00:00	2024	2026-02-12 13:00:11.051
538	1208176	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Brentford	https://media.api-sports.io/football/teams/55.png	55	2	1	FT	Match Finished	90	Stamford Bridge	P. Bankes	Regular Season - 16	2024-12-15 19:00:00	2024	2026-02-12 13:00:11.056
539	1208173	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	1	FT	Match Finished	90	Vitality Stadium	C. Kavanagh	Regular Season - 16	2024-12-16 20:00:00	2024	2026-02-12 13:00:11.06
540	1208183	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Manchester City	https://media.api-sports.io/football/teams/50.png	50	2	1	FT	Match Finished	90	Villa Park	P. Bankes	Regular Season - 17	2024-12-21 12:30:00	2024	2026-02-12 13:00:11.063
541	1208192	West Ham	https://media.api-sports.io/football/teams/48.png	48	Brighton	https://media.api-sports.io/football/teams/51.png	51	1	1	FT	Match Finished	90	London Stadium	R. Jones	Regular Season - 17	2024-12-21 15:00:00	2024	2026-02-12 13:00:11.068
542	1208184	Brentford	https://media.api-sports.io/football/teams/55.png	55	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	0	2	FT	Match Finished	90	Gtech Community Stadium	M. Oliver	Regular Season - 17	2024-12-21 15:00:00	2024	2026-02-12 13:00:11.072
543	1208188	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Newcastle	https://media.api-sports.io/football/teams/34.png	34	0	4	FT	Match Finished	90	Portman Road	S. Attwell	Regular Season - 17	2024-12-21 15:00:00	2024	2026-02-12 13:00:11.076
544	1208185	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	5	FT	Match Finished	90	Selhurst Park	S. Hooper	Regular Season - 17	2024-12-21 17:30:00	2024	2026-02-12 13:00:11.079
545	1208190	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	0	3	FT	Match Finished	90	Old Trafford	C. Pawson	Regular Season - 17	2024-12-22 14:00:00	2024	2026-02-12 13:00:11.083
546	1208187	Fulham	https://media.api-sports.io/football/teams/36.png	36	Southampton	https://media.api-sports.io/football/teams/41.png	41	0	0	FT	Match Finished	90	Craven Cottage	T. Robinson	Regular Season - 17	2024-12-22 14:00:00	2024	2026-02-12 13:00:11.087
547	1208186	Everton	https://media.api-sports.io/football/teams/45.png	45	Chelsea	https://media.api-sports.io/football/teams/49.png	49	0	0	FT	Match Finished	90	Goodison Park	C. Kavanagh	Regular Season - 17	2024-12-22 14:00:00	2024	2026-02-12 13:00:11.091
548	1208189	Leicester	https://media.api-sports.io/football/teams/46.png	46	Wolves	https://media.api-sports.io/football/teams/39.png	39	0	3	FT	Match Finished	90	King Power Stadium	A. Taylor	Regular Season - 17	2024-12-22 14:00:00	2024	2026-02-12 13:00:11.093
549	1208191	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Liverpool	https://media.api-sports.io/football/teams/40.png	40	3	6	FT	Match Finished	90	Tottenham Hotspur Stadium	S. Barrott	Regular Season - 17	2024-12-22 16:30:00	2024	2026-02-12 13:00:11.098
550	1208198	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Everton	https://media.api-sports.io/football/teams/45.png	45	1	1	FT	Match Finished	90	Etihad Stadium	S. Hooper	Regular Season - 18	2024-12-26 12:30:00	2024	2026-02-12 13:00:11.101
551	1208199	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	3	0	FT	Match Finished	90	St. James' Park	A. Taylor	Regular Season - 18	2024-12-26 15:00:00	2024	2026-02-12 13:00:11.104
552	1208193	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	0	FT	Match Finished	90	Vitality Stadium	T. Bramall	Regular Season - 18	2024-12-26 15:00:00	2024	2026-02-12 13:00:11.107
553	1208201	Southampton	https://media.api-sports.io/football/teams/41.png	41	West Ham	https://media.api-sports.io/football/teams/48.png	48	0	1	FT	Match Finished	90	St. Mary's Stadium	L. Smith	Regular Season - 18	2024-12-26 15:00:00	2024	2026-02-12 13:00:11.11
554	1208196	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	2	FT	Match Finished	90	Stamford Bridge	S. Barrott	Regular Season - 18	2024-12-26 15:00:00	2024	2026-02-12 13:00:11.112
556	1208202	Wolves	https://media.api-sports.io/football/teams/39.png	39	Manchester United	https://media.api-sports.io/football/teams/33.png	33	2	0	FT	Match Finished	90	Molineux Stadium	T. Harrington	Regular Season - 18	2024-12-26 17:30:00	2024	2026-02-12 13:00:11.118
557	1208197	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Leicester	https://media.api-sports.io/football/teams/46.png	46	3	1	FT	Match Finished	90	Anfield	D. Bond	Regular Season - 18	2024-12-26 20:00:00	2024	2026-02-12 13:00:11.123
558	1208195	Brighton	https://media.api-sports.io/football/teams/51.png	51	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	0	FT	Match Finished	90	American Express Stadium	A. Madley	Regular Season - 18	2024-12-27 19:30:00	2024	2026-02-12 13:00:11.126
559	1208194	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	0	FT	Match Finished	90	Emirates Stadium	D. England	Regular Season - 18	2024-12-27 20:15:00	2024	2026-02-12 13:00:11.131
560	1208209	Leicester	https://media.api-sports.io/football/teams/46.png	46	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	2	FT	Match Finished	90	King Power Stadium	M. Oliver	Regular Season - 19	2024-12-29 14:30:00	2024	2026-02-12 13:00:11.135
561	1208207	Fulham	https://media.api-sports.io/football/teams/36.png	36	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	2	FT	Match Finished	90	Craven Cottage	R. Jones	Regular Season - 19	2024-12-29 15:00:00	2024	2026-02-12 13:00:11.138
562	1208206	Everton	https://media.api-sports.io/football/teams/45.png	45	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	0	2	FT	Match Finished	90	Goodison Park	T. Harrington	Regular Season - 19	2024-12-29 15:00:00	2024	2026-02-12 13:00:11.141
563	1208211	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Wolves	https://media.api-sports.io/football/teams/39.png	39	2	2	FT	Match Finished	90	Tottenham Hotspur Stadium	C. Kavanagh	Regular Season - 19	2024-12-29 15:00:00	2024	2026-02-12 13:00:11.144
564	1208205	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Southampton	https://media.api-sports.io/football/teams/41.png	41	2	1	FT	Match Finished	90	Selhurst Park	M. Salisbury	Regular Season - 19	2024-12-29 15:00:00	2024	2026-02-12 13:00:11.147
565	1208212	West Ham	https://media.api-sports.io/football/teams/48.png	48	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	5	FT	Match Finished	90	London Stadium	A. Taylor	Regular Season - 19	2024-12-29 17:15:00	2024	2026-02-12 13:00:11.15
566	1208208	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Chelsea	https://media.api-sports.io/football/teams/49.png	49	2	0	FT	Match Finished	90	Portman Road	J. Brooks	Regular Season - 19	2024-12-30 19:45:00	2024	2026-02-12 13:00:11.152
567	1208203	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Brighton	https://media.api-sports.io/football/teams/51.png	51	2	2	FT	Match Finished	90	Villa Park	C. Pawson	Regular Season - 19	2024-12-30 19:45:00	2024	2026-02-12 13:00:11.154
568	1208210	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Newcastle	https://media.api-sports.io/football/teams/34.png	34	0	2	FT	Match Finished	90	Old Trafford	S. Hooper	Regular Season - 19	2024-12-30 20:00:00	2024	2026-02-12 13:00:11.157
569	1208204	Brentford	https://media.api-sports.io/football/teams/55.png	55	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	3	FT	Match Finished	90	Gtech Community Stadium	P. Bankes	Regular Season - 19	2025-01-01 17:30:00	2024	2026-02-12 13:00:11.159
570	1208221	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	2	FT	Match Finished	90	Tottenham Hotspur Stadium	A. Madley	Regular Season - 20	2025-01-04 12:30:00	2024	2026-02-12 13:00:11.163
571	1208213	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Everton	https://media.api-sports.io/football/teams/45.png	45	1	0	FT	Match Finished	90	Vitality Stadium	J. Brooks	Regular Season - 20	2025-01-04 15:00:00	2024	2026-02-12 13:00:11.166
572	1208220	Southampton	https://media.api-sports.io/football/teams/41.png	41	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	5	FT	Match Finished	90	St. Mary's Stadium	S. Attwell	Regular Season - 20	2025-01-04 15:00:00	2024	2026-02-12 13:00:11.169
573	1208219	Manchester City	https://media.api-sports.io/football/teams/50.png	50	West Ham	https://media.api-sports.io/football/teams/48.png	48	4	1	FT	Match Finished	90	Etihad Stadium	M. Salisbury	Regular Season - 20	2025-01-04 15:00:00	2024	2026-02-12 13:00:11.171
574	1208216	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Chelsea	https://media.api-sports.io/football/teams/49.png	49	1	1	FT	Match Finished	90	Selhurst Park	T. Robinson	Regular Season - 20	2025-01-04 15:00:00	2024	2026-02-12 13:00:11.174
575	1208214	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	1	FT	Match Finished	90	Villa Park	J. Gillett	Regular Season - 20	2025-01-04 15:00:00	2024	2026-02-12 13:00:11.176
576	1208215	Brighton	https://media.api-sports.io/football/teams/51.png	51	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	1	FT	Match Finished	90	American Express Stadium	A. Taylor	Regular Season - 20	2025-01-04 17:30:00	2024	2026-02-12 13:00:11.18
577	1208217	Fulham	https://media.api-sports.io/football/teams/36.png	36	Ipswich	https://media.api-sports.io/football/teams/57.png	57	2	2	FT	Match Finished	90	Craven Cottage	D. Bond	Regular Season - 20	2025-01-05 14:00:00	2024	2026-02-12 13:00:11.183
578	1208218	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Manchester United	https://media.api-sports.io/football/teams/33.png	33	2	2	FT	Match Finished	90	Anfield	M. Oliver	Regular Season - 20	2025-01-05 16:30:00	2024	2026-02-12 13:00:11.185
579	1208222	Wolves	https://media.api-sports.io/football/teams/39.png	39	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	0	3	FT	Match Finished	90	Molineux Stadium	P. Bankes	Regular Season - 20	2025-01-06 20:00:00	2024	2026-02-12 13:00:11.188
580	1208229	West Ham	https://media.api-sports.io/football/teams/48.png	48	Fulham	https://media.api-sports.io/football/teams/36.png	36	3	2	FT	Match Finished	90	London Stadium	C. Pawson	Regular Season - 21	2025-01-14 19:30:00	2024	2026-02-12 13:00:11.192
581	1208230	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	2	FT	Match Finished	90	Stamford Bridge	R. Jones	Regular Season - 21	2025-01-14 19:30:00	2024	2026-02-12 13:00:11.195
582	1208224	Brentford	https://media.api-sports.io/football/teams/55.png	55	Manchester City	https://media.api-sports.io/football/teams/50.png	50	2	2	FT	Match Finished	90	Gtech Community Stadium	A. Taylor	Regular Season - 21	2025-01-14 19:30:00	2024	2026-02-12 13:00:11.199
583	1208228	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Liverpool	https://media.api-sports.io/football/teams/40.png	40	1	1	FT	Match Finished	90	The City Ground	C. Kavanagh	Regular Season - 21	2025-01-14 20:00:00	2024	2026-02-12 13:00:11.201
585	1208225	Everton	https://media.api-sports.io/football/teams/45.png	45	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	0	1	FT	Match Finished	90	Goodison Park	S. Barrott	Regular Season - 21	2025-01-15 19:30:00	2024	2026-02-12 13:00:11.207
586	1208227	Leicester	https://media.api-sports.io/football/teams/46.png	46	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	2	FT	Match Finished	90	King Power Stadium	A. Madley	Regular Season - 21	2025-01-15 19:30:00	2024	2026-02-12 13:00:11.21
587	1208223	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Tottenham	https://media.api-sports.io/football/teams/47.png	47	2	1	FT	Match Finished	90	Emirates Stadium	S. Hooper	Regular Season - 21	2025-01-15 20:00:00	2024	2026-02-12 13:00:11.213
588	1208226	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Brighton	https://media.api-sports.io/football/teams/51.png	51	0	2	FT	Match Finished	90	Portman Road	T. Harrington	Regular Season - 21	2025-01-16 19:30:00	2024	2026-02-12 13:00:11.216
589	1208232	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	1	FT	Match Finished	90	Old Trafford	J. Brooks	Regular Season - 21	2025-01-16 20:00:00	2024	2026-02-12 13:00:11.219
590	1208240	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	4	FT	Match Finished	90	St. James' Park	S. Attwell	Regular Season - 22	2025-01-18 12:30:00	2024	2026-02-12 13:00:11.222
591	1208238	Leicester	https://media.api-sports.io/football/teams/46.png	46	Fulham	https://media.api-sports.io/football/teams/36.png	36	0	2	FT	Match Finished	90	King Power Stadium	M. Salisbury	Regular Season - 22	2025-01-18 15:00:00	2024	2026-02-12 13:00:11.224
592	1208242	West Ham	https://media.api-sports.io/football/teams/48.png	48	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	2	FT	Match Finished	90	London Stadium	T. Bramall	Regular Season - 22	2025-01-18 15:00:00	2024	2026-02-12 13:00:11.232
593	1208234	Brentford	https://media.api-sports.io/football/teams/55.png	55	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	2	FT	Match Finished	90	Gtech Community Stadium	A. Madley	Regular Season - 22	2025-01-18 15:00:00	2024	2026-02-12 13:00:11.239
594	1208233	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	2	FT	Match Finished	90	Emirates Stadium	C. Kavanagh	Regular Season - 22	2025-01-18 17:30:00	2024	2026-02-12 13:00:11.242
595	1208239	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Brighton	https://media.api-sports.io/football/teams/51.png	51	1	3	FT	Match Finished	90	Old Trafford	P. Bankes	Regular Season - 22	2025-01-19 14:00:00	2024	2026-02-12 13:00:11.253
596	1208236	Everton	https://media.api-sports.io/football/teams/45.png	45	Tottenham	https://media.api-sports.io/football/teams/47.png	47	3	2	FT	Match Finished	90	Goodison Park	D. England	Regular Season - 22	2025-01-19 14:00:00	2024	2026-02-12 13:00:11.258
597	1208241	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	2	FT	Match Finished	90	The City Ground	A. Taylor	Regular Season - 22	2025-01-19 14:00:00	2024	2026-02-12 13:00:11.263
598	1208237	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	6	FT	Match Finished	90	Portman Road	S. Barrott	Regular Season - 22	2025-01-19 16:30:00	2024	2026-02-12 13:00:11.267
599	1208235	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Wolves	https://media.api-sports.io/football/teams/39.png	39	3	1	FT	Match Finished	90	Stamford Bridge	S. Hooper	Regular Season - 22	2025-01-20 20:00:00	2024	2026-02-12 13:00:11.27
600	1208243	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	5	0	FT	Match Finished	90	Vitality Stadium	C. Pawson	Regular Season - 23	2025-01-25 15:00:00	2024	2026-02-12 13:00:11.274
601	1208252	Wolves	https://media.api-sports.io/football/teams/39.png	39	Arsenal	https://media.api-sports.io/football/teams/42.png	42	0	1	FT	Match Finished	90	Molineux Stadium	M. Oliver	Regular Season - 23	2025-01-25 15:00:00	2024	2026-02-12 13:00:11.277
602	1208248	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Ipswich	https://media.api-sports.io/football/teams/57.png	57	4	1	FT	Match Finished	90	Anfield	M. Salisbury	Regular Season - 23	2025-01-25 15:00:00	2024	2026-02-12 13:00:11.28
603	1208250	Southampton	https://media.api-sports.io/football/teams/41.png	41	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	3	FT	Match Finished	90	St. Mary's Stadium	S. Barrott	Regular Season - 23	2025-01-25 15:00:00	2024	2026-02-12 13:00:11.282
604	1208245	Brighton	https://media.api-sports.io/football/teams/51.png	51	Everton	https://media.api-sports.io/football/teams/45.png	45	0	1	FT	Match Finished	90	American Express Stadium	T. Robinson	Regular Season - 23	2025-01-25 15:00:00	2024	2026-02-12 13:00:11.285
605	1208249	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Chelsea	https://media.api-sports.io/football/teams/49.png	49	3	1	FT	Match Finished	90	Etihad Stadium	J. Brooks	Regular Season - 23	2025-01-25 17:30:00	2024	2026-02-12 13:00:11.29
606	1208251	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Leicester	https://media.api-sports.io/football/teams/46.png	46	1	2	FT	Match Finished	90	Tottenham Hotspur Stadium	R. Jones	Regular Season - 23	2025-01-26 14:00:00	2024	2026-02-12 13:00:11.293
607	1208246	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Brentford	https://media.api-sports.io/football/teams/55.png	55	1	2	FT	Match Finished	90	Selhurst Park	T. Harrington	Regular Season - 23	2025-01-26 14:00:00	2024	2026-02-12 13:00:11.296
608	1208244	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	1	FT	Match Finished	90	Villa Park	P. Bankes	Regular Season - 23	2025-01-26 16:30:00	2024	2026-02-12 13:00:11.3
609	1208247	Fulham	https://media.api-sports.io/football/teams/36.png	36	Manchester United	https://media.api-sports.io/football/teams/33.png	33	0	1	FT	Match Finished	90	Craven Cottage	A. Taylor	Regular Season - 23	2025-01-26 19:00:00	2024	2026-02-12 13:00:11.303
610	1208261	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Brighton	https://media.api-sports.io/football/teams/51.png	51	7	0	FT	Match Finished	90	The City Ground	S. Hooper	Regular Season - 24	2025-02-01 12:30:00	2024	2026-02-12 13:00:11.305
611	1208260	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	2	FT	Match Finished	90	St. James' Park	C. Kavanagh	Regular Season - 24	2025-02-01 15:00:00	2024	2026-02-12 13:00:11.308
612	1208253	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	2	FT	Match Finished	90	Vitality Stadium	D. England	Regular Season - 24	2025-02-01 15:00:00	2024	2026-02-12 13:00:11.311
614	1208258	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Southampton	https://media.api-sports.io/football/teams/41.png	41	1	2	FT	Match Finished	90	Portman Road	M. Oliver	Regular Season - 24	2025-02-01 15:00:00	2024	2026-02-12 13:00:11.319
615	1208262	Wolves	https://media.api-sports.io/football/teams/39.png	39	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	0	FT	Match Finished	90	Molineux Stadium	A. Madley	Regular Season - 24	2025-02-01 17:30:00	2024	2026-02-12 13:00:11.322
616	1208259	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	2	FT	Match Finished	90	Old Trafford	J. Brooks	Regular Season - 24	2025-02-02 14:00:00	2024	2026-02-12 13:00:11.327
617	1208255	Brentford	https://media.api-sports.io/football/teams/55.png	55	Tottenham	https://media.api-sports.io/football/teams/47.png	47	0	2	FT	Match Finished	90	Gtech Community Stadium	J. Gillett	Regular Season - 24	2025-02-02 14:00:00	2024	2026-02-12 13:00:11.33
618	1208254	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Manchester City	https://media.api-sports.io/football/teams/50.png	50	5	1	FT	Match Finished	90	Emirates Stadium	P. Bankes	Regular Season - 24	2025-02-02 16:30:00	2024	2026-02-12 13:00:11.332
619	1208256	Chelsea	https://media.api-sports.io/football/teams/49.png	49	West Ham	https://media.api-sports.io/football/teams/48.png	48	2	1	FT	Match Finished	90	Stamford Bridge	S. Attwell	Regular Season - 24	2025-02-03 20:00:00	2024	2026-02-12 13:00:11.334
620	1208166	Everton	https://media.api-sports.io/football/teams/45.png	45	Liverpool	https://media.api-sports.io/football/teams/40.png	40	2	2	FT	Match Finished	90	Goodison Park	M. Oliver	Regular Season - 15	2025-02-12 19:30:00	2024	2026-02-12 13:00:11.338
621	1208264	Brighton	https://media.api-sports.io/football/teams/51.png	51	Chelsea	https://media.api-sports.io/football/teams/49.png	49	3	0	FT	Match Finished	90	American Express Stadium	C. Kavanagh	Regular Season - 25	2025-02-14 20:00:00	2024	2026-02-12 13:00:11.34
622	1208267	Leicester	https://media.api-sports.io/football/teams/46.png	46	Arsenal	https://media.api-sports.io/football/teams/42.png	42	0	2	FT	Match Finished	90	King Power Stadium	S. Barrott	Regular Season - 25	2025-02-15 12:30:00	2024	2026-02-12 13:00:11.343
623	1208266	Fulham	https://media.api-sports.io/football/teams/36.png	36	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	2	1	FT	Match Finished	90	Craven Cottage	T. Bramall	Regular Season - 25	2025-02-15 15:00:00	2024	2026-02-12 13:00:11.346
624	1208270	Southampton	https://media.api-sports.io/football/teams/41.png	41	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	3	FT	Match Finished	90	St. Mary's Stadium	J. Gillett	Regular Season - 25	2025-02-15 15:00:00	2024	2026-02-12 13:00:11.349
625	1208272	West Ham	https://media.api-sports.io/football/teams/48.png	48	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	1	FT	Match Finished	90	London Stadium	D. England	Regular Season - 25	2025-02-15 15:00:00	2024	2026-02-12 13:00:11.352
626	1208269	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Newcastle	https://media.api-sports.io/football/teams/34.png	34	4	0	FT	Match Finished	90	Etihad Stadium	A. Madley	Regular Season - 25	2025-02-15 15:00:00	2024	2026-02-12 13:00:11.355
627	1208263	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	1	FT	Match Finished	90	Villa Park	R. Jones	Regular Season - 25	2025-02-15 15:00:00	2024	2026-02-12 13:00:11.358
628	1208265	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Everton	https://media.api-sports.io/football/teams/45.png	45	1	2	FT	Match Finished	90	Selhurst Park	A. Taylor	Regular Season - 25	2025-02-15 17:30:00	2024	2026-02-12 13:00:11.361
629	1208268	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Wolves	https://media.api-sports.io/football/teams/39.png	39	2	1	FT	Match Finished	90	Anfield	S. Hooper	Regular Season - 25	2025-02-16 14:00:00	2024	2026-02-12 13:00:11.364
630	1208271	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Manchester United	https://media.api-sports.io/football/teams/33.png	33	1	0	FT	Match Finished	90	Tottenham Hotspur Stadium	P. Bankes	Regular Season - 25	2025-02-16 16:30:00	2024	2026-02-12 13:00:11.366
631	1208305	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Liverpool	https://media.api-sports.io/football/teams/40.png	40	2	2	FT	Match Finished	90	Villa Park	C. Pawson	Regular Season - 29	2025-02-19 19:30:00	2024	2026-02-12 13:00:11.369
632	1208279	Leicester	https://media.api-sports.io/football/teams/46.png	46	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	4	FT	Match Finished	90	King Power Stadium	T. Harrington	Regular Season - 26	2025-02-21 20:00:00	2024	2026-02-12 13:00:11.372
633	1208276	Everton	https://media.api-sports.io/football/teams/45.png	45	Manchester United	https://media.api-sports.io/football/teams/33.png	33	2	2	FT	Match Finished	90	Goodison Park	A. Madley	Regular Season - 26	2025-02-22 12:30:00	2024	2026-02-12 13:00:11.374
634	1208273	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Wolves	https://media.api-sports.io/football/teams/39.png	39	0	1	FT	Match Finished	90	Vitality Stadium	M. Salisbury	Regular Season - 26	2025-02-22 15:00:00	2024	2026-02-12 13:00:11.377
635	1208277	Fulham	https://media.api-sports.io/football/teams/36.png	36	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	2	FT	Match Finished	90	Craven Cottage	R. Jones	Regular Season - 26	2025-02-22 15:00:00	2024	2026-02-12 13:00:11.38
636	1208282	Southampton	https://media.api-sports.io/football/teams/41.png	41	Brighton	https://media.api-sports.io/football/teams/51.png	51	0	4	FT	Match Finished	90	St. Mary's Stadium	D. Bond	Regular Season - 26	2025-02-22 15:00:00	2024	2026-02-12 13:00:11.383
637	1208274	Arsenal	https://media.api-sports.io/football/teams/42.png	42	West Ham	https://media.api-sports.io/football/teams/48.png	48	0	1	FT	Match Finished	90	Emirates Stadium	C. Pawson	Regular Season - 26	2025-02-22 15:00:00	2024	2026-02-12 13:00:11.386
638	1208278	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	4	FT	Match Finished	90	Portman Road	T. Robinson	Regular Season - 26	2025-02-22 15:00:00	2024	2026-02-12 13:00:11.389
639	1208275	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Chelsea	https://media.api-sports.io/football/teams/49.png	49	2	1	FT	Match Finished	90	Villa Park	M. Oliver	Regular Season - 26	2025-02-22 17:30:00	2024	2026-02-12 13:00:11.391
640	1208281	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	4	3	FT	Match Finished	90	St. James' Park	J. Gillett	Regular Season - 26	2025-02-23 14:00:00	2024	2026-02-12 13:00:11.394
641	1208280	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	2	FT	Match Finished	90	Etihad Stadium	A. Taylor	Regular Season - 26	2025-02-23 16:30:00	2024	2026-02-12 13:00:11.397
643	1208284	Brighton	https://media.api-sports.io/football/teams/51.png	51	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	1	FT	Match Finished	90	American Express Stadium	M. Oliver	Regular Season - 27	2025-02-25 19:30:00	2024	2026-02-12 13:00:11.402
644	1208289	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	4	1	FT	Match Finished	90	Selhurst Park	S. Barrott	Regular Season - 27	2025-02-25 19:30:00	2024	2026-02-12 13:00:11.405
645	1208290	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Southampton	https://media.api-sports.io/football/teams/41.png	41	4	0	FT	Match Finished	90	Stamford Bridge	T. Bramall	Regular Season - 27	2025-02-25 20:15:00	2024	2026-02-12 13:00:11.409
646	1208292	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Ipswich	https://media.api-sports.io/football/teams/57.png	57	3	2	FT	Match Finished	90	Old Trafford	D. England	Regular Season - 27	2025-02-26 19:30:00	2024	2026-02-12 13:00:11.412
647	1208286	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	1	FT	Match Finished	90	Tottenham Hotspur Stadium	J. Gillett	Regular Season - 27	2025-02-26 19:30:00	2024	2026-02-12 13:00:11.416
648	1208283	Brentford	https://media.api-sports.io/football/teams/55.png	55	Everton	https://media.api-sports.io/football/teams/45.png	45	1	1	FT	Match Finished	90	Gtech Community Stadium	S. Hooper	Regular Season - 27	2025-02-26 19:30:00	2024	2026-02-12 13:00:11.42
649	1208285	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Arsenal	https://media.api-sports.io/football/teams/42.png	42	0	0	FT	Match Finished	90	The City Ground	A. Madley	Regular Season - 27	2025-02-26 19:30:00	2024	2026-02-12 13:00:11.423
650	1208291	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Newcastle	https://media.api-sports.io/football/teams/34.png	34	2	0	FT	Match Finished	90	Anfield	S. Attwell	Regular Season - 27	2025-02-26 20:15:00	2024	2026-02-12 13:00:11.426
651	1208287	West Ham	https://media.api-sports.io/football/teams/48.png	48	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	0	FT	Match Finished	90	London Stadium	A. Taylor	Regular Season - 27	2025-02-27 20:00:00	2024	2026-02-12 13:00:11.429
652	1208299	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Manchester City	https://media.api-sports.io/football/teams/50.png	50	1	0	FT	Match Finished	90	The City Ground	C. Kavanagh	Regular Season - 28	2025-03-08 12:30:00	2024	2026-02-12 13:00:11.432
653	1208297	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	1	FT	Match Finished	90	Anfield	L. Smith	Regular Season - 28	2025-03-08 15:00:00	2024	2026-02-12 13:00:11.434
654	1208294	Brighton	https://media.api-sports.io/football/teams/51.png	51	Fulham	https://media.api-sports.io/football/teams/36.png	36	2	1	FT	Match Finished	90	American Express Stadium	S. Barrott	Regular Season - 28	2025-03-08 15:00:00	2024	2026-02-12 13:00:11.437
655	1208296	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	0	FT	Match Finished	90	Selhurst Park	S. Hooper	Regular Season - 28	2025-03-08 15:00:00	2024	2026-02-12 13:00:11.44
656	1208293	Brentford	https://media.api-sports.io/football/teams/55.png	55	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	0	1	FT	Match Finished	90	Gtech Community Stadium	J. Gillett	Regular Season - 28	2025-03-08 17:30:00	2024	2026-02-12 13:00:11.443
657	1208302	Wolves	https://media.api-sports.io/football/teams/39.png	39	Everton	https://media.api-sports.io/football/teams/45.png	45	1	1	FT	Match Finished	90	Molineux Stadium	S. Attwell	Regular Season - 28	2025-03-08 20:00:00	2024	2026-02-12 13:00:11.446
658	1208300	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	2	FT	Match Finished	90	Tottenham Hotspur Stadium	J. Brooks	Regular Season - 28	2025-03-09 14:00:00	2024	2026-02-12 13:00:11.449
659	1208295	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Leicester	https://media.api-sports.io/football/teams/46.png	46	1	0	FT	Match Finished	90	Stamford Bridge	T. Robinson	Regular Season - 28	2025-03-09 14:00:00	2024	2026-02-12 13:00:11.451
660	1208298	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	1	FT	Match Finished	90	Old Trafford	A. Taylor	Regular Season - 28	2025-03-09 16:30:00	2024	2026-02-12 13:00:11.454
661	1208301	West Ham	https://media.api-sports.io/football/teams/48.png	48	Newcastle	https://media.api-sports.io/football/teams/34.png	34	0	1	FT	Match Finished	90	London Stadium	M. Salisbury	Regular Season - 28	2025-03-10 20:00:00	2024	2026-02-12 13:00:11.457
662	1208312	Southampton	https://media.api-sports.io/football/teams/41.png	41	Wolves	https://media.api-sports.io/football/teams/39.png	39	1	2	FT	Match Finished	90	St. Mary's Stadium	R. Jones	Regular Season - 29	2025-03-15 15:00:00	2024	2026-02-12 13:00:11.46
663	1208306	Everton	https://media.api-sports.io/football/teams/45.png	45	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	1	FT	Match Finished	90	Goodison Park	D. Bond	Regular Season - 29	2025-03-15 15:00:00	2024	2026-02-12 13:00:11.462
664	1208310	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Brighton	https://media.api-sports.io/football/teams/51.png	51	2	2	FT	Match Finished	90	Etihad Stadium	S. Hooper	Regular Season - 29	2025-03-15 15:00:00	2024	2026-02-12 13:00:11.465
665	1208308	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	2	4	FT	Match Finished	90	Portman Road	M. Salisbury	Regular Season - 29	2025-03-15 15:00:00	2024	2026-02-12 13:00:11.468
666	1208303	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Brentford	https://media.api-sports.io/football/teams/55.png	55	1	2	FT	Match Finished	90	Vitality Stadium	C. Pawson	Regular Season - 29	2025-03-15 17:30:00	2024	2026-02-12 13:00:11.471
667	1208307	Fulham	https://media.api-sports.io/football/teams/36.png	36	Tottenham	https://media.api-sports.io/football/teams/47.png	47	2	0	FT	Match Finished	90	Craven Cottage	A. Madley	Regular Season - 29	2025-03-16 13:30:00	2024	2026-02-12 13:00:11.474
668	1208304	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Chelsea	https://media.api-sports.io/football/teams/49.png	49	1	0	FT	Match Finished	90	Emirates Stadium	C. Kavanagh	Regular Season - 29	2025-03-16 13:30:00	2024	2026-02-12 13:00:11.476
669	1208309	Leicester	https://media.api-sports.io/football/teams/46.png	46	Manchester United	https://media.api-sports.io/football/teams/33.png	33	0	3	FT	Match Finished	90	King Power Stadium	T. Bramall	Regular Season - 29	2025-03-16 19:00:00	2024	2026-02-12 13:00:11.48
670	1208317	Wolves	https://media.api-sports.io/football/teams/39.png	39	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	0	FT	Match Finished	90	Molineux Stadium	T. Harrington	Regular Season - 30	2025-04-01 18:45:00	2024	2026-02-12 13:00:11.482
672	1208316	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Manchester United	https://media.api-sports.io/football/teams/33.png	33	1	0	FT	Match Finished	90	The City Ground	J. Gillett	Regular Season - 30	2025-04-01 19:00:00	2024	2026-02-12 13:00:11.487
673	1208320	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Brentford	https://media.api-sports.io/football/teams/55.png	55	2	1	FT	Match Finished	90	St. James' Park	P. Bankes	Regular Season - 30	2025-04-02 18:45:00	2024	2026-02-12 13:00:11.49
674	1208313	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Ipswich	https://media.api-sports.io/football/teams/57.png	57	1	2	FT	Match Finished	90	Vitality Stadium	R. Jones	Regular Season - 30	2025-04-02 18:45:00	2024	2026-02-12 13:00:11.492
675	1208321	Southampton	https://media.api-sports.io/football/teams/41.png	41	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	1	1	FT	Match Finished	90	St. Mary's Stadium	A. Madley	Regular Season - 30	2025-04-02 18:45:00	2024	2026-02-12 13:00:11.495
676	1208319	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	0	FT	Match Finished	90	Etihad Stadium	D. England	Regular Season - 30	2025-04-02 18:45:00	2024	2026-02-12 13:00:11.498
677	1208315	Brighton	https://media.api-sports.io/football/teams/51.png	51	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	0	3	FT	Match Finished	90	American Express Stadium	S. Attwell	Regular Season - 30	2025-04-02 18:45:00	2024	2026-02-12 13:00:11.501
678	1208322	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Everton	https://media.api-sports.io/football/teams/45.png	45	1	0	FT	Match Finished	90	Anfield	S. Barrott	Regular Season - 30	2025-04-02 19:00:00	2024	2026-02-12 13:00:11.505
679	1208318	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	0	FT	Match Finished	90	Stamford Bridge	C. Pawson	Regular Season - 30	2025-04-03 19:00:00	2024	2026-02-12 13:00:11.507
680	1208326	Everton	https://media.api-sports.io/football/teams/45.png	45	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	1	FT	Match Finished	90	Goodison Park	D. England	Regular Season - 31	2025-04-05 11:30:00	2024	2026-02-12 13:00:11.512
681	1208332	West Ham	https://media.api-sports.io/football/teams/48.png	48	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	2	2	FT	Match Finished	90	London Stadium	T. Robinson	Regular Season - 31	2025-04-05 14:00:00	2024	2026-02-12 13:00:11.515
682	1208325	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Brighton	https://media.api-sports.io/football/teams/51.png	51	2	1	FT	Match Finished	90	Selhurst Park	A. Taylor	Regular Season - 31	2025-04-05 14:00:00	2024	2026-02-12 13:00:11.52
683	1208328	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Wolves	https://media.api-sports.io/football/teams/39.png	39	1	2	FT	Match Finished	90	Portman Road	P. Bankes	Regular Season - 31	2025-04-05 14:00:00	2024	2026-02-12 13:00:11.526
684	1208323	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	2	1	FT	Match Finished	90	Villa Park	S. Hooper	Regular Season - 31	2025-04-05 16:30:00	2024	2026-02-12 13:00:11.529
685	1208327	Fulham	https://media.api-sports.io/football/teams/36.png	36	Liverpool	https://media.api-sports.io/football/teams/40.png	40	3	2	FT	Match Finished	90	Craven Cottage	C. Kavanagh	Regular Season - 31	2025-04-06 13:00:00	2024	2026-02-12 13:00:11.537
686	1208331	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Southampton	https://media.api-sports.io/football/teams/41.png	41	3	1	FT	Match Finished	90	Tottenham Hotspur Stadium	M. Salisbury	Regular Season - 31	2025-04-06 13:00:00	2024	2026-02-12 13:00:11.542
688	1208330	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	0	FT	Match Finished	90	Old Trafford	J. Brooks	Regular Season - 31	2025-04-06 15:30:00	2024	2026-02-12 13:00:11.564
689	1208329	Leicester	https://media.api-sports.io/football/teams/46.png	46	Newcastle	https://media.api-sports.io/football/teams/34.png	34	0	3	FT	Match Finished	90	King Power Stadium	R. Jones	Regular Season - 31	2025-04-07 19:00:00	2024	2026-02-12 13:00:11.567
690	1208338	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	5	2	FT	Match Finished	90	Etihad Stadium	J. Gillett	Regular Season - 32	2025-04-12 11:30:00	2024	2026-02-12 13:00:11.571
691	1208341	Southampton	https://media.api-sports.io/football/teams/41.png	41	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	0	3	FT	Match Finished	90	St. Mary's Stadium	T. Bramall	Regular Season - 32	2025-04-12 14:00:00	2024	2026-02-12 13:00:11.58
692	1208335	Brighton	https://media.api-sports.io/football/teams/51.png	51	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	2	FT	Match Finished	90	American Express Stadium	D. Bond	Regular Season - 32	2025-04-12 14:00:00	2024	2026-02-12 13:00:11.584
693	1208340	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Everton	https://media.api-sports.io/football/teams/45.png	45	0	1	FT	Match Finished	90	The City Ground	C. Pawson	Regular Season - 32	2025-04-12 14:00:00	2024	2026-02-12 13:00:11.59
694	1208334	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Brentford	https://media.api-sports.io/football/teams/55.png	55	1	1	FT	Match Finished	90	Emirates Stadium	S. Hooper	Regular Season - 32	2025-04-12 16:30:00	2024	2026-02-12 13:00:11.619
695	1208342	Wolves	https://media.api-sports.io/football/teams/39.png	39	Tottenham	https://media.api-sports.io/football/teams/47.png	47	4	2	FT	Match Finished	90	Molineux Stadium	A. Taylor	Regular Season - 32	2025-04-13 13:00:00	2024	2026-02-12 13:00:11.623
696	1208337	Liverpool	https://media.api-sports.io/football/teams/40.png	40	West Ham	https://media.api-sports.io/football/teams/48.png	48	2	1	FT	Match Finished	90	Anfield	A. Madley	Regular Season - 32	2025-04-13 13:00:00	2024	2026-02-12 13:00:11.626
697	1208336	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Ipswich	https://media.api-sports.io/football/teams/57.png	57	2	2	FT	Match Finished	90	Stamford Bridge	S. Attwell	Regular Season - 32	2025-04-13 13:00:00	2024	2026-02-12 13:00:11.628
698	1208339	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Manchester United	https://media.api-sports.io/football/teams/33.png	33	4	1	FT	Match Finished	90	St. James' Park	C. Kavanagh	Regular Season - 32	2025-04-13 15:30:00	2024	2026-02-12 13:00:11.631
699	1208333	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	0	FT	Match Finished	90	Vitality Stadium	M. Oliver	Regular Season - 32	2025-04-14 19:00:00	2024	2026-02-12 13:00:11.633
701	1208346	Everton	https://media.api-sports.io/football/teams/45.png	45	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	2	FT	Match Finished	90	Goodison Park	S. Hooper	Regular Season - 33	2025-04-19 14:00:00	2024	2026-02-12 13:00:11.641
702	1208352	West Ham	https://media.api-sports.io/football/teams/48.png	48	Southampton	https://media.api-sports.io/football/teams/41.png	41	1	1	FT	Match Finished	90	London Stadium	A. Kitchen	Regular Season - 33	2025-04-19 14:00:00	2024	2026-02-12 13:00:11.652
703	1208345	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	0	0	FT	Match Finished	90	Selhurst Park	S. Barrott	Regular Season - 33	2025-04-19 14:00:00	2024	2026-02-12 13:00:11.658
704	1208344	Brentford	https://media.api-sports.io/football/teams/55.png	55	Brighton	https://media.api-sports.io/football/teams/51.png	51	4	2	FT	Match Finished	90	Gtech Community Stadium	T. Robinson	Regular Season - 33	2025-04-19 14:00:00	2024	2026-02-12 13:00:11.662
705	1208343	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Newcastle	https://media.api-sports.io/football/teams/34.png	34	4	1	FT	Match Finished	90	Villa Park	J. Gillett	Regular Season - 33	2025-04-19 16:30:00	2024	2026-02-12 13:00:11.67
706	1208350	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Wolves	https://media.api-sports.io/football/teams/39.png	39	0	1	FT	Match Finished	90	Old Trafford	R. Jones	Regular Season - 33	2025-04-20 13:00:00	2024	2026-02-12 13:00:11.674
707	1208347	Fulham	https://media.api-sports.io/football/teams/36.png	36	Chelsea	https://media.api-sports.io/football/teams/49.png	49	1	2	FT	Match Finished	90	Craven Cottage	A. Taylor	Regular Season - 33	2025-04-20 13:00:00	2024	2026-02-12 13:00:11.678
708	1208348	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Arsenal	https://media.api-sports.io/football/teams/42.png	42	0	4	FT	Match Finished	90	Portman Road	C. Kavanagh	Regular Season - 33	2025-04-20 13:00:00	2024	2026-02-12 13:00:11.68
709	1208349	Leicester	https://media.api-sports.io/football/teams/46.png	46	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	1	FT	Match Finished	90	King Power Stadium	S. Attwell	Regular Season - 33	2025-04-20 15:30:00	2024	2026-02-12 13:00:11.683
710	1208351	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	1	2	FT	Match Finished	90	Tottenham Hotspur Stadium	P. Bankes	Regular Season - 33	2025-04-21 19:00:00	2024	2026-02-12 13:00:11.686
711	1208358	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	1	FT	Match Finished	90	Etihad Stadium	C. Pawson	Regular Season - 34	2025-04-22 19:00:00	2024	2026-02-12 13:00:11.691
712	1208354	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	2	2	FT	Match Finished	90	Emirates Stadium	M. Salisbury	Regular Season - 34	2025-04-23 19:00:00	2024	2026-02-12 13:00:11.701
713	1208356	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Everton	https://media.api-sports.io/football/teams/45.png	45	1	0	FT	Match Finished	90	Stamford Bridge	C. Kavanagh	Regular Season - 34	2025-04-26 11:30:00	2024	2026-02-12 13:00:11.714
714	1208359	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Ipswich	https://media.api-sports.io/football/teams/57.png	57	3	0	FT	Match Finished	90	St. James' Park	M. Salisbury	Regular Season - 34	2025-04-26 14:00:00	2024	2026-02-12 13:00:11.721
715	1208362	Wolves	https://media.api-sports.io/football/teams/39.png	39	Leicester	https://media.api-sports.io/football/teams/46.png	46	3	0	FT	Match Finished	90	Molineux Stadium	S. Barrott	Regular Season - 34	2025-04-26 14:00:00	2024	2026-02-12 13:00:11.728
716	1208361	Southampton	https://media.api-sports.io/football/teams/41.png	41	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	2	FT	Match Finished	90	St. Mary's Stadium	T. Harrington	Regular Season - 34	2025-04-26 14:00:00	2024	2026-02-12 13:00:11.731
717	1208355	Brighton	https://media.api-sports.io/football/teams/51.png	51	West Ham	https://media.api-sports.io/football/teams/48.png	48	3	2	FT	Match Finished	90	American Express Stadium	D. England	Regular Season - 34	2025-04-26 14:00:00	2024	2026-02-12 13:00:11.735
718	1208353	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Manchester United	https://media.api-sports.io/football/teams/33.png	33	1	1	FT	Match Finished	90	Vitality Stadium	P. Bankes	Regular Season - 34	2025-04-27 13:00:00	2024	2026-02-12 13:00:11.738
719	1208357	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Tottenham	https://media.api-sports.io/football/teams/47.png	47	5	1	FT	Match Finished	90	Anfield	T. Bramall	Regular Season - 34	2025-04-27 15:30:00	2024	2026-02-12 13:00:11.74
720	1208360	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	2	FT	Match Finished	90	The City Ground	D. England	Regular Season - 34	2025-05-01 18:30:00	2024	2026-02-12 13:00:11.744
721	1208371	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Wolves	https://media.api-sports.io/football/teams/39.png	39	1	0	FT	Match Finished	90	Etihad Stadium	P. Bankes	Regular Season - 35	2025-05-02 19:00:00	2024	2026-02-12 13:00:11.749
722	1208364	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	0	FT	Match Finished	90	Villa Park	R. Jones	Regular Season - 35	2025-05-03 11:30:00	2024	2026-02-12 13:00:11.752
723	1208369	Everton	https://media.api-sports.io/football/teams/45.png	45	Ipswich	https://media.api-sports.io/football/teams/57.png	57	2	2	FT	Match Finished	90	Goodison Park	L. Smith	Regular Season - 35	2025-05-03 14:00:00	2024	2026-02-12 13:00:11.755
724	1208370	Leicester	https://media.api-sports.io/football/teams/46.png	46	Southampton	https://media.api-sports.io/football/teams/41.png	41	2	0	FT	Match Finished	90	King Power Stadium	D. Webb	Regular Season - 35	2025-05-03 14:00:00	2024	2026-02-12 13:00:11.759
725	1208363	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	1	2	FT	Match Finished	90	Emirates Stadium	J. Gillett	Regular Season - 35	2025-05-03 16:30:00	2024	2026-02-12 13:00:11.762
726	1208372	West Ham	https://media.api-sports.io/football/teams/48.png	48	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	1	FT	Match Finished	90	London Stadium	M. Oliver	Regular Season - 35	2025-05-04 13:00:00	2024	2026-02-12 13:00:11.766
727	1208366	Brighton	https://media.api-sports.io/football/teams/51.png	51	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	1	FT	Match Finished	90	American Express Stadium	C. Pawson	Regular Season - 35	2025-05-04 13:00:00	2024	2026-02-12 13:00:11.768
728	1208365	Brentford	https://media.api-sports.io/football/teams/55.png	55	Manchester United	https://media.api-sports.io/football/teams/33.png	33	4	3	FT	Match Finished	90	Gtech Community Stadium	A. Taylor	Regular Season - 35	2025-05-04 13:00:00	2024	2026-02-12 13:00:11.771
730	1208368	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	1	1	FT	Match Finished	90	Selhurst Park	A. Madley	Regular Season - 35	2025-05-05 19:00:00	2024	2026-02-12 13:00:11.777
731	1208374	Fulham	https://media.api-sports.io/football/teams/36.png	36	Everton	https://media.api-sports.io/football/teams/45.png	45	1	3	FT	Match Finished	90	Craven Cottage	D. England	Regular Season - 36	2025-05-10 14:00:00	2024	2026-02-12 13:00:11.781
732	1208382	Wolves	https://media.api-sports.io/football/teams/39.png	39	Brighton	https://media.api-sports.io/football/teams/51.png	51	0	2	FT	Match Finished	90	Molineux Stadium	M. Oliver	Regular Season - 36	2025-05-10 14:00:00	2024	2026-02-12 13:00:11.784
733	1208380	Southampton	https://media.api-sports.io/football/teams/41.png	41	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	0	FT	Match Finished	90	St. Mary's Stadium	T. Robinson	Regular Season - 36	2025-05-10 14:00:00	2024	2026-02-12 13:00:11.787
734	1208375	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Brentford	https://media.api-sports.io/football/teams/55.png	55	0	1	FT	Match Finished	90	Portman Road	S. Barrott	Regular Season - 36	2025-05-10 14:00:00	2024	2026-02-12 13:00:11.79
735	1208373	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	0	1	FT	Match Finished	90	Vitality Stadium	S. Attwell	Regular Season - 36	2025-05-10 16:30:00	2024	2026-02-12 13:00:11.793
736	1208378	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Chelsea	https://media.api-sports.io/football/teams/49.png	49	2	0	FT	Match Finished	90	St. James' Park	J. Brooks	Regular Season - 36	2025-05-11 11:00:00	2024	2026-02-12 13:00:11.796
737	1208377	Manchester United	https://media.api-sports.io/football/teams/33.png	33	West Ham	https://media.api-sports.io/football/teams/48.png	48	0	2	FT	Match Finished	90	Old Trafford	J. Gillett	Regular Season - 36	2025-05-11 13:15:00	2024	2026-02-12 13:00:11.8
738	1208381	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	0	2	FT	Match Finished	90	Tottenham Hotspur Stadium	C. Kavanagh	Regular Season - 36	2025-05-11 13:15:00	2024	2026-02-12 13:00:11.804
739	1208379	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	2	FT	Match Finished	90	The City Ground	T. Harrington	Regular Season - 36	2025-05-11 13:15:00	2024	2026-02-12 13:00:11.807
740	1208376	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Arsenal	https://media.api-sports.io/football/teams/42.png	42	2	2	FT	Match Finished	90	Anfield	A. Taylor	Regular Season - 36	2025-05-11 15:30:00	2024	2026-02-12 13:00:11.819
741	1208384	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Tottenham	https://media.api-sports.io/football/teams/47.png	47	2	0	FT	Match Finished	90	Villa Park	P. Bankes	Regular Season - 37	2025-05-16 18:30:00	2024	2026-02-12 13:00:11.823
742	1208387	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Manchester United	https://media.api-sports.io/football/teams/33.png	33	1	0	FT	Match Finished	90	Stamford Bridge	C. Kavanagh	Regular Season - 37	2025-05-16 19:15:00	2024	2026-02-12 13:00:11.826
743	1208389	Everton	https://media.api-sports.io/football/teams/45.png	45	Southampton	https://media.api-sports.io/football/teams/41.png	41	2	0	FT	Match Finished	90	Goodison Park	M. Oliver	Regular Season - 37	2025-05-18 11:00:00	2024	2026-02-12 13:00:11.829
744	1208392	West Ham	https://media.api-sports.io/football/teams/48.png	48	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	1	2	FT	Match Finished	90	London Stadium	S. Barrott	Regular Season - 37	2025-05-18 13:15:00	2024	2026-02-12 13:00:11.832
745	1208390	Leicester	https://media.api-sports.io/football/teams/46.png	46	Ipswich	https://media.api-sports.io/football/teams/57.png	57	2	0	FT	Match Finished	90	King Power Stadium	A. Kitchen	Regular Season - 37	2025-05-18 14:00:00	2024	2026-02-12 13:00:11.834
746	1208385	Brentford	https://media.api-sports.io/football/teams/55.png	55	Fulham	https://media.api-sports.io/football/teams/36.png	36	2	3	FT	Match Finished	90	Gtech Community Stadium	J. Gillett	Regular Season - 37	2025-05-18 14:00:00	2024	2026-02-12 13:00:11.839
747	1208383	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Newcastle	https://media.api-sports.io/football/teams/34.png	34	1	0	FT	Match Finished	90	Emirates Stadium	S. Hooper	Regular Season - 37	2025-05-18 15:30:00	2024	2026-02-12 13:00:11.842
748	1208386	Brighton	https://media.api-sports.io/football/teams/51.png	51	Liverpool	https://media.api-sports.io/football/teams/40.png	40	3	2	FT	Match Finished	90	American Express Stadium	A. Madley	Regular Season - 37	2025-05-19 19:00:00	2024	2026-02-12 13:00:11.845
749	1208391	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	3	1	FT	Match Finished	90	Etihad Stadium	T. Bramall	Regular Season - 37	2025-05-20 19:00:00	2024	2026-02-12 13:00:11.847
750	1208388	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Wolves	https://media.api-sports.io/football/teams/39.png	39	4	2	FT	Match Finished	90	Selhurst Park	D. Webb	Regular Season - 37	2025-05-20 19:00:00	2024	2026-02-12 13:00:11.85
751	1208397	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	2	0	FT	Match Finished	90	Old Trafford	T. Bramall	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.853
752	1208398	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Everton	https://media.api-sports.io/football/teams/45.png	45	0	1	FT	Match Finished	90	St. James' Park	T. Harrington	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.856
753	1208393	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Leicester	https://media.api-sports.io/football/teams/46.png	46	2	0	FT	Match Finished	90	Vitality Stadium	L. Smith	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.859
754	1208394	Fulham	https://media.api-sports.io/football/teams/36.png	36	Manchester City	https://media.api-sports.io/football/teams/50.png	50	0	2	FT	Match Finished	90	Craven Cottage	A. Madley	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.862
755	1208402	Wolves	https://media.api-sports.io/football/teams/39.png	39	Brentford	https://media.api-sports.io/football/teams/55.png	55	1	1	FT	Match Finished	90	Molineux Stadium	C. Pawson	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.865
756	1208396	Liverpool	https://media.api-sports.io/football/teams/40.png	40	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	1	1	FT	Match Finished	90	Anfield	D. England	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.867
757	1208400	Southampton	https://media.api-sports.io/football/teams/41.png	41	Arsenal	https://media.api-sports.io/football/teams/42.png	42	1	2	FT	Match Finished	90	St. Mary's Stadium	D. Bond	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.871
381	1208021	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	0	FT	Match Finished	90	Old Trafford	R. Jones	Regular Season - 1	2024-08-16 19:00:00	2024	2026-02-12 13:00:06.763
410	1208047	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Liverpool	https://media.api-sports.io/football/teams/40.png	40	0	3	FT	Match Finished	90	Old Trafford	A. Taylor	Regular Season - 3	2024-09-01 15:00:00	2024	2026-02-12 13:00:07.479
439	1208077	Manchester United	https://media.api-sports.io/football/teams/33.png	33	Tottenham	https://media.api-sports.io/football/teams/47.png	47	0	3	FT	Match Finished	90	Old Trafford	C. Kavanagh	Regular Season - 6	2024-09-29 15:30:00	2024	2026-02-12 13:00:08.643
468	1208107	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Newcastle	https://media.api-sports.io/football/teams/34.png	34	2	1	FT	Match Finished	90	Stamford Bridge	S. Hooper	Regular Season - 9	2024-10-27 13:00:00	2024	2026-02-12 13:00:10.825
497	1208140	Manchester City	https://media.api-sports.io/football/teams/50.png	50	Tottenham	https://media.api-sports.io/football/teams/47.png	47	0	4	FT	Match Finished	90	Etihad Stadium	J. Brooks	Regular Season - 12	2024-11-23 17:30:00	2024	2026-02-12 13:00:10.909
526	1208169	Leicester	https://media.api-sports.io/football/teams/46.png	46	Brighton	https://media.api-sports.io/football/teams/51.png	51	2	2	FT	Match Finished	90	King Power Stadium	S. Attwell	Regular Season - 15	2024-12-08 14:00:00	2024	2026-02-12 13:00:11.012
555	1208200	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Tottenham	https://media.api-sports.io/football/teams/47.png	47	1	0	FT	Match Finished	90	The City Ground	C. Pawson	Regular Season - 18	2024-12-26 15:00:00	2024	2026-02-12 13:00:11.115
584	1208231	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Wolves	https://media.api-sports.io/football/teams/39.png	39	3	0	FT	Match Finished	90	St. James' Park	D. England	Regular Season - 21	2025-01-15 19:30:00	2024	2026-02-12 13:00:11.204
613	1208257	Everton	https://media.api-sports.io/football/teams/45.png	45	Leicester	https://media.api-sports.io/football/teams/46.png	46	4	0	FT	Match Finished	90	Goodison Park	D. Bond	Regular Season - 24	2025-02-01 15:00:00	2024	2026-02-12 13:00:11.316
642	1208288	Wolves	https://media.api-sports.io/football/teams/39.png	39	Fulham	https://media.api-sports.io/football/teams/36.png	36	1	2	FT	Match Finished	90	Molineux Stadium	P. Bankes	Regular Season - 27	2025-02-25 19:30:00	2024	2026-02-12 13:00:11.4
671	1208314	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Fulham	https://media.api-sports.io/football/teams/36.png	36	2	1	FT	Match Finished	90	Emirates Stadium	J. Brooks	Regular Season - 30	2025-04-01 18:45:00	2024	2026-02-12 13:00:11.485
687	1208324	Brentford	https://media.api-sports.io/football/teams/55.png	55	Chelsea	https://media.api-sports.io/football/teams/49.png	49	0	0	FT	Match Finished	90	Gtech Community Stadium	M. Oliver	Regular Season - 31	2025-04-06 13:00:00	2024	2026-02-12 13:00:11.557
700	1208311	Newcastle	https://media.api-sports.io/football/teams/34.png	34	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	5	0	FT	Match Finished	90	St. James' Park	D. England	Regular Season - 29	2025-04-16 18:30:00	2024	2026-02-12 13:00:11.638
729	1208367	Chelsea	https://media.api-sports.io/football/teams/49.png	49	Liverpool	https://media.api-sports.io/football/teams/40.png	40	3	1	FT	Match Finished	90	Stamford Bridge	S. Hooper	Regular Season - 35	2025-05-04 15:30:00	2024	2026-02-12 13:00:11.774
758	1208401	Tottenham	https://media.api-sports.io/football/teams/47.png	47	Brighton	https://media.api-sports.io/football/teams/51.png	51	1	4	FT	Match Finished	90	Tottenham Hotspur Stadium	R. Jones	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.873
759	1208395	Ipswich	https://media.api-sports.io/football/teams/57.png	57	West Ham	https://media.api-sports.io/football/teams/48.png	48	1	3	FT	Match Finished	90	Portman Road	T. Robinson	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.876
760	1208399	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	65	Chelsea	https://media.api-sports.io/football/teams/49.png	49	0	1	FT	Match Finished	90	The City Ground	A. Taylor	Regular Season - 38	2025-05-25 15:00:00	2024	2026-02-12 13:00:11.88
\.


--
-- Data for Name: epl_injuries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epl_injuries (id, player_api_id, player_name, player_photo, team, team_logo, injury_type, reason, fixture_api_id, fixture_date, season, last_updated) FROM stdin;
3169	153434	W. Fish	https://media.api-sports.io/football/players/153434.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208021	2024-08-16 19:00:00	2024	2026-02-12 08:44:20.969
3170	288006	R. Hojlund	https://media.api-sports.io/football/players/288006.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208021	2024-08-16 19:00:00	2024	2026-02-12 08:44:20.972
3171	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208021	2024-08-16 19:00:00	2024	2026-02-12 08:44:20.974
3172	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208021	2024-08-16 19:00:00	2024	2026-02-12 08:44:20.976
3173	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208021	2024-08-16 19:00:00	2024	2026-02-12 08:44:20.979
3174	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Injury	1208021	2024-08-16 19:00:00	2024	2026-02-12 08:44:20.982
3175	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208022	2024-08-17 11:30:00	2024	2026-02-12 08:44:20.984
3176	138836	H. Clarke	https://media.api-sports.io/football/players/138836.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Achilles Tendon Injury	1208022	2024-08-17 11:30:00	2024	2026-02-12 08:44:20.987
3177	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208022	2024-08-17 11:30:00	2024	2026-02-12 08:44:20.99
3178	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208022	2024-08-17 11:30:00	2024	2026-02-12 08:44:20.993
3179	326763	C. Humphreys	https://media.api-sports.io/football/players/326763.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Injury	1208022	2024-08-17 11:30:00	2024	2026-02-12 08:44:20.997
3180	334729	B. Clark	https://media.api-sports.io/football/players/334729.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Back Injury	1208022	2024-08-17 11:30:00	2024	2026-02-12 08:44:20.999
3181	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.004
3182	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.007
3183	41725	F. Vieira	https://media.api-sports.io/football/players/41725.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Groin Injury	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.01
3184	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.013
3185	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.018
3186	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.021
3187	130	N. Semedo	https://media.api-sports.io/football/players/130.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Red Card	1208023	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.024
3188	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.027
3189	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.031
3190	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.034
3191	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.037
3192	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Groin Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.039
3193	70747	J. Enciso	https://media.api-sports.io/football/players/70747.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.041
3194	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.044
3195	129058	B. Verbruggen	https://media.api-sports.io/football/players/129058.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.046
3196	46731	P. Estupinan	https://media.api-sports.io/football/players/46731.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.048
3197	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.051
3198	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Injury	1208024	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.057
3199	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.059
3200	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.063
3201	328105	L. Miley	https://media.api-sports.io/football/players/328105.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.067
3202	31146	S. Tonali	https://media.api-sports.io/football/players/31146.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Suspended	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.071
3203	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.075
3204	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.08
3205	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.082
3206	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.085
3207	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Ankle Injury	1208025	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.087
3208	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Back Injury	1208026	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.09
3209	18870	D. Brooks	https://media.api-sports.io/football/players/18870.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Shoulder Injury	1208026	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.092
3210	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Ankle Injury	1208026	2024-08-17 14:00:00	2024	2026-02-12 08:44:21.095
3211	2869	E. Alvarez	https://media.api-sports.io/football/players/2869.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Thigh Injury	1208027	2024-08-17 16:30:00	2024	2026-02-12 08:44:21.1
3212	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208027	2024-08-17 16:30:00	2024	2026-02-12 08:44:21.105
3213	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208027	2024-08-17 16:30:00	2024	2026-02-12 08:44:21.109
3214	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208028	2024-08-18 13:00:00	2024	2026-02-12 08:44:21.111
3215	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208028	2024-08-18 13:00:00	2024	2026-02-12 08:44:21.113
3216	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208028	2024-08-18 13:00:00	2024	2026-02-12 08:44:21.116
3217	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208028	2024-08-18 13:00:00	2024	2026-02-12 08:44:21.118
3218	19974	I. Toney	https://media.api-sports.io/football/players/19974.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Coach's decision	1208028	2024-08-18 13:00:00	2024	2026-02-12 08:44:21.121
3219	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208028	2024-08-18 13:00:00	2024	2026-02-12 08:44:21.124
3220	67972	C. Gallagher	https://media.api-sports.io/football/players/67972.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208029	2024-08-18 15:30:00	2024	2026-02-12 08:44:21.127
3221	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208029	2024-08-18 15:30:00	2024	2026-02-12 08:44:21.131
3222	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208029	2024-08-18 15:30:00	2024	2026-02-12 08:44:21.133
3223	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Leg Injury	1208029	2024-08-18 15:30:00	2024	2026-02-12 08:44:21.136
3224	18741	C. Coady	https://media.api-sports.io/football/players/18741.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208030	2024-08-19 19:00:00	2024	2026-02-12 08:44:21.139
3225	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208030	2024-08-19 19:00:00	2024	2026-02-12 08:44:21.142
3226	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Broken Leg	1208030	2024-08-19 19:00:00	2024	2026-02-12 08:44:21.145
3227	152969	L. Thomas	https://media.api-sports.io/football/players/152969.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Injury	1208030	2024-08-19 19:00:00	2024	2026-02-12 08:44:21.147
3228	18968	Y. Bissouma	https://media.api-sports.io/football/players/18968.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208030	2024-08-19 19:00:00	2024	2026-02-12 08:44:21.151
3229	18932	F. Forster	https://media.api-sports.io/football/players/18932.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208030	2024-08-19 19:00:00	2024	2026-02-12 08:44:21.154
3230	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.157
3231	129058	B. Verbruggen	https://media.api-sports.io/football/players/129058.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.16
3232	46731	P. Estupinan	https://media.api-sports.io/football/players/46731.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.164
3233	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.166
3234	288006	R. Hojlund	https://media.api-sports.io/football/players/288006.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.17
3235	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.175
3236	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.177
3237	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.179
3238	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208033	2024-08-24 11:30:00	2024	2026-02-12 08:44:21.182
3239	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208034	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.186
3240	18806	W. Hughes	https://media.api-sports.io/football/players/18806.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Illness	1208034	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.188
3241	18741	C. Coady	https://media.api-sports.io/football/players/18741.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208035	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.19
3242	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208035	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.192
3243	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208035	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.195
3244	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208035	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.198
3245	152969	L. Thomas	https://media.api-sports.io/football/players/152969.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Injury	1208035	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.201
3246	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.204
3247	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Leg Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.207
3248	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.21
3249	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.212
3250	138836	H. Clarke	https://media.api-sports.io/football/players/138836.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Achilles Tendon Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.215
3251	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.218
3252	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.22
3253	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Injury	1208037	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.223
3254	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208038	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.228
3255	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208038	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.231
3256	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208038	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.235
3257	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208038	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.239
3258	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Ankle Injury	1208038	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.242
3259	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208038	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.244
3260	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Head Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.247
3261	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.25
3262	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.253
3263	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.256
3264	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.261
3265	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.264
3266	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.266
3267	894	A. Young	https://media.api-sports.io/football/players/894.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Red Card	1208039	2024-08-24 14:00:00	2024	2026-02-12 08:44:21.269
3268	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208032	2024-08-24 16:30:00	2024	2026-02-12 08:44:21.271
3269	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208032	2024-08-24 16:30:00	2024	2026-02-12 08:44:21.273
3270	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Groin Injury	1208032	2024-08-24 16:30:00	2024	2026-02-12 08:44:21.276
3271	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208032	2024-08-24 16:30:00	2024	2026-02-12 08:44:21.278
3272	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208032	2024-08-24 16:30:00	2024	2026-02-12 08:44:21.281
3273	41725	F. Vieira	https://media.api-sports.io/football/players/41725.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Groin Injury	1208032	2024-08-24 16:30:00	2024	2026-02-12 08:44:21.284
3274	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Back Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.286
3275	18870	D. Brooks	https://media.api-sports.io/football/players/18870.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Shoulder Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.289
3276	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Ankle Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.292
3277	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.294
3278	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.296
3279	328105	L. Miley	https://media.api-sports.io/football/players/328105.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.299
3280	2806	F. Schar	https://media.api-sports.io/football/players/2806.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Red Card	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.301
3281	31146	S. Tonali	https://media.api-sports.io/football/players/31146.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Suspended	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.303
3282	138906	J. White	https://media.api-sports.io/football/players/138906.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.306
3283	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208031	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.308
3284	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208040	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.311
3285	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208040	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.313
3286	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208040	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.316
3287	130	N. Semedo	https://media.api-sports.io/football/players/130.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Suspended	1208040	2024-08-25 13:00:00	2024	2026-02-12 08:44:21.318
3288	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208036	2024-08-25 15:30:00	2024	2026-02-12 08:44:21.32
3289	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208036	2024-08-25 15:30:00	2024	2026-02-12 08:44:21.322
3290	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208036	2024-08-25 15:30:00	2024	2026-02-12 08:44:21.324
3291	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208036	2024-08-25 15:30:00	2024	2026-02-12 08:44:21.326
3292	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Groin Injury	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.328
3293	47311	M. Merino	https://media.api-sports.io/football/players/47311.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Shoulder Injury	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.33
3294	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.332
3295	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.334
3296	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.337
3297	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.338
3298	328225	B. Gruda	https://media.api-sports.io/football/players/328225.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Lacking Match Fitness	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.34
3299	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Lacking Match Fitness	1208041	2024-08-31 11:30:00	2024	2026-02-12 08:44:21.342
3300	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.344
3301	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.346
3302	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.348
3303	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.35
3304	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.354
3305	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.356
3306	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Ankle Injury	1208042	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.359
3307	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208044	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.361
3308	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208044	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.365
3309	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208044	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.369
3310	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Back Injury	1208044	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.371
3311	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Ankle Injury	1208044	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.373
3312	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208045	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.376
3313	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208045	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.379
3314	138836	H. Clarke	https://media.api-sports.io/football/players/138836.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Achilles Tendon Injury	1208045	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.382
3315	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208045	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.383
3316	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208045	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.386
3317	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.389
3318	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.393
3319	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.395
3320	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.397
3321	21090	Diego Carlos	https://media.api-sports.io/football/players/21090.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.399
3322	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.401
3323	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208046	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.403
3324	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208049	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.405
3325	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208049	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.407
3326	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208049	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.409
3327	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208049	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.411
3328	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knee Injury	1208049	2024-08-31 14:00:00	2024	2026-02-12 08:44:21.414
3329	18813	A. Cresswell	https://media.api-sports.io/football/players/18813.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Thigh Injury	1208050	2024-08-31 16:30:00	2024	2026-02-12 08:44:21.415
3330	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208050	2024-08-31 16:30:00	2024	2026-02-12 08:44:21.418
3331	631	P. Foden	https://media.api-sports.io/football/players/631.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Illness	1208050	2024-08-31 16:30:00	2024	2026-02-12 08:44:21.421
3332	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Thigh Injury	1208043	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.422
3333	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208043	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.425
3334	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208043	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.427
3335	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.429
3336	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.431
3337	328105	L. Miley	https://media.api-sports.io/football/players/328105.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.433
3338	2806	F. Schar	https://media.api-sports.io/football/players/2806.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Red Card	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.436
3339	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.438
3340	1463	J. Willock	https://media.api-sports.io/football/players/1463.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Thigh Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.44
3341	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.442
3342	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208048	2024-09-01 12:30:00	2024	2026-02-12 08:44:21.444
3343	288006	R. Hojlund	https://media.api-sports.io/football/players/288006.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.447
3344	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.449
3345	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.452
3346	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.454
3347	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.457
3348	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.459
3349	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.461
3350	293	C. Jones	https://media.api-sports.io/football/players/293.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208047	2024-09-01 15:00:00	2024	2026-02-12 08:44:21.463
3351	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.466
3352	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.468
3353	288006	R. Hojlund	https://media.api-sports.io/football/players/288006.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.47
3354	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.473
3355	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.475
3356	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.478
3357	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.481
3358	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208058	2024-09-14 11:30:00	2024	2026-02-12 08:44:21.483
3359	104	Carlos Vinicius	https://media.api-sports.io/football/players/104.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208055	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.485
3360	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Achilles Tendon Injury	1208055	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.488
3361	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.49
3362	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.492
3363	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.494
3364	328225	B. Gruda	https://media.api-sports.io/football/players/328225.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Lacking Match Fitness	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.496
3365	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Lacking Match Fitness	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.498
3366	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.5
3367	138836	H. Clarke	https://media.api-sports.io/football/players/138836.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Achilles Tendon Injury	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.503
3368	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208053	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.504
3369	19720	T. Chalobah	https://media.api-sports.io/football/players/19720.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Injury	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.506
3370	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.509
3371	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.511
3372	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.514
3373	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.516
3374	1135	O. Edouard	https://media.api-sports.io/football/players/1135.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Lacking Match Fitness	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.518
3375	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.52
3376	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208054	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.522
3377	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208056	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.525
3378	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Lacking Match Fitness	1208056	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.527
3379	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208056	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.529
3380	18739	W. Boly	https://media.api-sports.io/football/players/18739.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Calf Injury	1208056	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.532
3381	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Lacking Match Fitness	1208056	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.534
3382	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.536
3383	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.539
3384	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.541
3385	427736	Gustavo Nunes	https://media.api-sports.io/football/players/427736.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Back Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.543
3386	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.546
3387	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.548
3388	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knock	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.551
3389	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208057	2024-09-14 14:00:00	2024	2026-02-12 08:44:21.553
3390	983	L. Bailey	https://media.api-sports.io/football/players/983.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.554
3391	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.557
3392	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.559
3393	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.561
3394	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.563
3395	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.566
3396	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.568
3397	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.571
3398	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Calf Injury	1208052	2024-09-14 16:30:00	2024	2026-02-12 08:44:21.572
3399	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Back Injury	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.575
3400	2273	K. Arrizabalaga	https://media.api-sports.io/football/players/2273.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Loan agreement	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.577
3401	284797	D. Ouattara	https://media.api-sports.io/football/players/284797.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Ankle Injury	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.58
3402	161907	M. Gusto	https://media.api-sports.io/football/players/161907.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.582
3403	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.584
3404	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.587
3405	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Thigh Injury	1208051	2024-09-14 19:00:00	2024	2026-02-12 08:44:21.589
3406	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.591
3407	18968	Y. Bissouma	https://media.api-sports.io/football/players/18968.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Groin Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.597
3408	47311	M. Merino	https://media.api-sports.io/football/players/47311.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Shoulder Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.6
3409	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Ankle Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.602
3410	2937	D. Rice	https://media.api-sports.io/football/players/2937.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Red Card	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.604
3411	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.606
3412	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.608
3413	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Calf Injury	1208059	2024-09-15 13:00:00	2024	2026-02-12 08:44:21.611
3414	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.613
3415	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.615
3416	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.618
3417	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knee Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.62
3418	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.623
3419	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.625
3420	328105	L. Miley	https://media.api-sports.io/football/players/328105.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.628
3421	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208060	2024-09-15 15:30:00	2024	2026-02-12 08:44:21.63
3422	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Achilles Tendon Injury	1208070	2024-09-21 11:30:00	2024	2026-02-12 08:44:21.632
3423	161907	M. Gusto	https://media.api-sports.io/football/players/161907.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208070	2024-09-21 11:30:00	2024	2026-02-12 08:44:21.634
3424	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208070	2024-09-21 11:30:00	2024	2026-02-12 08:44:21.636
3425	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208070	2024-09-21 11:30:00	2024	2026-02-12 08:44:21.639
3426	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Thigh Injury	1208070	2024-09-21 11:30:00	2024	2026-02-12 08:44:21.641
3427	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.644
3428	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.646
3429	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.649
3430	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.65
3431	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.652
3432	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.654
3433	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.656
3434	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.659
3435	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.661
3436	41606	Toti	https://media.api-sports.io/football/players/41606.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Thigh Injury	1208061	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.663
3437	104	Carlos Vinicius	https://media.api-sports.io/football/players/104.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208064	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.667
3438	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208064	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.671
3439	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208064	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.674
3440	328105	L. Miley	https://media.api-sports.io/football/players/328105.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208064	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.678
3441	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208064	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.682
3442	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.685
3443	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.687
3444	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.689
3445	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.692
3446	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.694
3447	2990	I. Gueye	https://media.api-sports.io/football/players/2990.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.696
3448	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Groin Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.698
3449	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Calf Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.7
3450	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Thigh Injury	1208065	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.703
3451	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208066	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.705
3452	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Thigh Injury	1208066	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.708
3453	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Back Injury	1208066	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.71
3454	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.712
3455	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.716
3456	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.718
3457	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.72
3458	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.723
3459	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.726
3460	138836	H. Clarke	https://media.api-sports.io/football/players/138836.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Achilles Tendon Injury	1208068	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.728
3461	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.73
3462	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.732
3463	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.734
3464	427736	Gustavo Nunes	https://media.api-sports.io/football/players/427736.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Back Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.737
3465	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.741
3466	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.743
3467	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knock	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.746
3468	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.751
3469	20649	Y. Wissa	https://media.api-sports.io/football/players/20649.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208069	2024-09-21 14:00:00	2024	2026-02-12 08:44:21.753
3470	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Ankle Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.757
3471	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.76
3472	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.762
3473	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.765
3474	19720	T. Chalobah	https://media.api-sports.io/football/players/19720.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.77
3475	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.774
3476	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.776
3477	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.779
3478	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.781
3479	288006	R. Hojlund	https://media.api-sports.io/football/players/288006.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Muscle Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.785
3480	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Muscle Injury	1208063	2024-09-21 16:30:00	2024	2026-02-12 08:44:21.788
3481	328225	B. Gruda	https://media.api-sports.io/football/players/328225.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Lacking Match Fitness	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.79
3482	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.792
3483	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.796
3484	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.799
3485	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.83
3486	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Lacking Match Fitness	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.833
3487	18739	W. Boly	https://media.api-sports.io/football/players/18739.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Calf Injury	1208062	2024-09-22 13:00:00	2024	2026-02-12 08:44:21.836
3488	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.839
3489	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.841
3490	629	K. De Bruyne	https://media.api-sports.io/football/players/629.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.844
3491	47311	M. Merino	https://media.api-sports.io/football/players/47311.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Shoulder Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.846
3492	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Ankle Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.849
3493	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.851
3494	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.853
3495	641	O. Zinchenko	https://media.api-sports.io/football/players/641.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Calf Injury	1208067	2024-09-22 15:30:00	2024	2026-02-12 08:44:21.855
3496	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Back Injury	1208071	2024-09-30 19:00:00	2024	2026-02-12 08:44:21.857
3497	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208071	2024-09-30 19:00:00	2024	2026-02-12 08:44:21.859
3498	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208071	2024-09-30 19:00:00	2024	2026-02-12 08:44:21.862
3499	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208071	2024-09-30 19:00:00	2024	2026-02-12 08:44:21.864
3500	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208071	2024-09-30 19:00:00	2024	2026-02-12 08:44:21.867
3501	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Ankle Injury	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.869
3502	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.87
3503	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.874
3504	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.876
3505	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.878
3506	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.88
3507	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208086	2024-10-05 11:30:00	2024	2026-02-12 08:44:21.883
3508	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Ankle Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.886
3509	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.888
3510	641	O. Zinchenko	https://media.api-sports.io/football/players/641.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Calf Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.891
3511	38746	J. Timber	https://media.api-sports.io/football/players/38746.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Muscle Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.894
3512	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Knee Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.899
3513	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.909
3514	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.912
3515	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.915
3516	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208081	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.919
3517	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.922
3518	427736	Gustavo Nunes	https://media.api-sports.io/football/players/427736.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Back Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.925
3519	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.932
3520	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.934
3521	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.936
3522	20649	Y. Wissa	https://media.api-sports.io/football/players/20649.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.938
3523	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Knock	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.941
3524	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.944
3525	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.947
3526	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.95
3527	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.954
3528	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.958
3529	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Injury	1208083	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.961
3530	18779	H. Choudhury	https://media.api-sports.io/football/players/18779.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Shoulder Injury	1208088	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.965
3531	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208088	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.972
3532	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208088	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.975
3533	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208088	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.977
3534	18943	J. Vestergaard	https://media.api-sports.io/football/players/18943.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Ankle Injury	1208088	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.979
3535	1150	T. Adams	https://media.api-sports.io/football/players/1150.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Back Injury	1208088	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.981
3536	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208089	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.983
3537	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208089	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.985
3538	629	K. De Bruyne	https://media.api-sports.io/football/players/629.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208089	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.987
3539	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208089	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.989
3540	104	Carlos Vinicius	https://media.api-sports.io/football/players/104.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208089	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.991
3541	131	J. Cuenca	https://media.api-sports.io/football/players/131.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208089	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.993
3542	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Achilles Tendon Injury	1208090	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.996
3543	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208090	2024-10-05 14:00:00	2024	2026-02-12 08:44:21.998
3544	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208090	2024-10-05 14:00:00	2024	2026-02-12 08:44:22.001
3545	15797	J. Cajuste	https://media.api-sports.io/football/players/15797.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Knee Injury	1208090	2024-10-05 14:00:00	2024	2026-02-12 08:44:22.003
3546	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.006
3547	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.007
3548	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Calf Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.01
3549	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Lacking Match Fitness	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.013
3550	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.015
3551	2864	A. Isak	https://media.api-sports.io/football/players/2864.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Finger Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.018
3552	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.02
3553	328105	L. Miley	https://media.api-sports.io/football/players/328105.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.023
3554	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.025
3555	18941	M. Targett	https://media.api-sports.io/football/players/18941.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Injury	1208087	2024-10-05 16:30:00	2024	2026-02-12 08:44:22.027
3556	19191	J. McGinn	https://media.api-sports.io/football/players/19191.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.03
3557	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Thigh Injury	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.033
3558	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Groin Injury	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.037
3559	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.039
3560	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.041
3561	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Head Injury	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.044
3562	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Health problems	1208082	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.047
3563	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208085	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.049
3564	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208085	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.052
3565	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208085	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.057
3566	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Lacking Match Fitness	1208085	2024-10-06 13:00:00	2024	2026-02-12 08:44:22.06
3567	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.062
3568	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.064
3569	38695	J. P. van Hecke	https://media.api-sports.io/football/players/38695.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.067
3570	301771	S. Adingra	https://media.api-sports.io/football/players/301771.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knock	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.07
3571	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.073
3572	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Thigh Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.077
3573	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.082
3574	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.084
3575	186	Son Heung-Min	https://media.api-sports.io/football/players/186.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208084	2024-10-06 15:30:00	2024	2026-02-12 08:44:22.087
3576	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208099	2024-10-19 11:30:00	2024	2026-02-12 08:44:22.089
3577	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Achilles Tendon Injury	1208099	2024-10-19 11:30:00	2024	2026-02-12 08:44:22.093
3578	104	Carlos Vinicius	https://media.api-sports.io/football/players/104.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208092	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.095
3579	2920	T. Castagne	https://media.api-sports.io/football/players/2920.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208092	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.098
3580	131	J. Cuenca	https://media.api-sports.io/football/players/131.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208092	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.101
3581	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Shoulder Injury	1208092	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.105
3582	766	R. Olsen	https://media.api-sports.io/football/players/766.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Lacking Match Fitness	1208092	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.108
3583	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Lacking Match Fitness	1208092	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.111
3584	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.113
3585	2752	M. Luongo	https://media.api-sports.io/football/players/2752.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.117
3586	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Finger Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.119
3587	299813	A. Al-Hamadi	https://media.api-sports.io/football/players/299813.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Knock	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.121
3588	15797	J. Cajuste	https://media.api-sports.io/football/players/15797.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Knee Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.123
3589	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.125
3590	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.127
3591	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.129
3592	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.131
3593	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Muscle Injury	1208093	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.134
3594	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.137
3595	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.139
3596	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.14
3597	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knee Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.143
3598	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Head Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.145
3599	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Health problems	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.146
3600	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.148
3601	427736	Gustavo Nunes	https://media.api-sports.io/football/players/427736.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Back Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.15
3602	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.152
3603	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.154
3604	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.156
3605	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Knock	1208095	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.158
3606	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.16
3607	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.162
3608	169	K. Trippier	https://media.api-sports.io/football/players/169.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Muscle Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.165
3609	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Back Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.167
3610	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.169
3611	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.171
3612	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.173
3613	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.175
3614	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208096	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.178
3615	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.181
3616	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.183
3617	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.185
3618	18779	H. Choudhury	https://media.api-sports.io/football/players/18779.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Shoulder Injury	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.188
3619	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.19
3620	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.192
3621	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208098	2024-10-19 14:00:00	2024	2026-02-12 08:44:22.194
3622	912	Neto	https://media.api-sports.io/football/players/912.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Loan agreement	1208091	2024-10-19 16:30:00	2024	2026-02-12 08:44:22.197
3623	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Ankle Injury	1208091	2024-10-19 16:30:00	2024	2026-02-12 08:44:22.199
3624	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208091	2024-10-19 16:30:00	2024	2026-02-12 08:44:22.201
3625	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208091	2024-10-19 16:30:00	2024	2026-02-12 08:44:22.203
3626	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Muscle Injury	1208091	2024-10-19 16:30:00	2024	2026-02-12 08:44:22.205
3627	38746	J. Timber	https://media.api-sports.io/football/players/38746.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Muscle Injury	1208091	2024-10-19 16:30:00	2024	2026-02-12 08:44:22.208
3628	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.21
3629	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.212
3630	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.217
3631	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.219
3632	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.221
3633	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.224
3634	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.227
3635	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.229
3636	629	K. De Bruyne	https://media.api-sports.io/football/players/629.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.235
3637	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208100	2024-10-20 13:00:00	2024	2026-02-12 08:44:22.242
3638	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.245
3639	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.252
3640	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.256
3641	47380	M. Cucurella	https://media.api-sports.io/football/players/47380.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Yellow Cards	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.258
3642	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Yellow Cards	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.259
3643	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.262
3644	2933	B. Chilwell	https://media.api-sports.io/football/players/2933.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Illness	1208094	2024-10-20 15:30:00	2024	2026-02-12 08:44:22.265
3645	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.267
3646	18746	M. Gibbs-White	https://media.api-sports.io/football/players/18746.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Suspended	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.27
3647	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Lacking Match Fitness	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.272
3648	2938	J. Ward-Prowse	https://media.api-sports.io/football/players/2938.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Red Card	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.274
3649	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.277
3650	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.279
3651	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.282
3652	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.284
3653	50999	M. Turner	https://media.api-sports.io/football/players/50999.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Loan agreement	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.287
3654	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Ankle Injury	1208097	2024-10-21 19:00:00	2024	2026-02-12 08:44:22.289
3655	18779	H. Choudhury	https://media.api-sports.io/football/players/18779.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Shoulder Injury	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.292
3656	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.294
3657	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.296
3658	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.299
3659	18943	J. Vestergaard	https://media.api-sports.io/football/players/18943.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.302
3660	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.305
3661	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Lacking Match Fitness	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.309
3662	18746	M. Gibbs-White	https://media.api-sports.io/football/players/18746.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Ankle Injury	1208110	2024-10-25 19:00:00	2024	2026-02-12 08:44:22.312
3663	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Red Card	1208104	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.314
3664	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208104	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.316
3665	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Injury	1208104	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.318
3666	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.322
3667	427736	Gustavo Nunes	https://media.api-sports.io/football/players/427736.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Back Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.324
3668	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.326
3669	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.328
3670	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.33
3671	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.332
3672	127579	J. Greaves	https://media.api-sports.io/football/players/127579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.335
3673	2752	M. Luongo	https://media.api-sports.io/football/players/2752.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.338
3674	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Finger Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.341
3675	18823	B. Johnson	https://media.api-sports.io/football/players/18823.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208105	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.345
3676	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.349
3677	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.351
3678	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.354
3679	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.356
3680	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.358
3681	383685	Y. Minteh	https://media.api-sports.io/football/players/383685.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.361
3682	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.363
3683	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.366
3684	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.368
3685	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.371
3686	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.373
3687	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.374
3688	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Injury	1208106	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.377
3689	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.379
3690	629	K. De Bruyne	https://media.api-sports.io/football/players/629.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.381
3691	1422	J. Doku	https://media.api-sports.io/football/players/1422.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.383
3692	19187	J. Grealish	https://media.api-sports.io/football/players/19187.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.385
3693	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.388
3694	627	K. Walker	https://media.api-sports.io/football/players/627.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Illness	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.39
3695	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.393
3696	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.395
3697	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.397
3698	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208111	2024-10-26 14:00:00	2024	2026-02-12 08:44:22.399
3699	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.4
3700	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.403
3701	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.405
3702	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.407
3703	2729	J. Andersen	https://media.api-sports.io/football/players/2729.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Red Card	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.41
3704	2920	T. Castagne	https://media.api-sports.io/football/players/2920.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.412
3705	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Shoulder Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.414
3706	104	Carlos Vinicius	https://media.api-sports.io/football/players/104.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Calf Injury	1208109	2024-10-26 16:30:00	2024	2026-02-12 08:44:22.416
3707	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.418
3708	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.42
3709	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.422
3710	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.424
3711	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Ankle Injury	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.426
3712	186	Son Heung-Min	https://media.api-sports.io/football/players/186.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Injury	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.428
3713	19235	D. Spence	https://media.api-sports.io/football/players/19235.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Groin Injury	1208108	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.43
3714	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208107	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.433
3715	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208107	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.435
3716	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208107	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.437
3717	169	K. Trippier	https://media.api-sports.io/football/players/169.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Muscle Injury	1208107	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.439
3718	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208107	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.442
3719	18886	M. Dubravka	https://media.api-sports.io/football/players/18886.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Knee Injury	1208107	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.444
3720	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Achilles Tendon Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.446
3721	15911	M. Kudus	https://media.api-sports.io/football/players/15911.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.448
3722	9971	Antony	https://media.api-sports.io/football/players/9971.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.45
3723	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.453
3724	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.455
3725	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.457
3726	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knee Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.459
3727	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Head Injury	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.462
3728	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Health problems	1208112	2024-10-27 14:00:00	2024	2026-02-12 08:44:22.464
3729	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.466
3730	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Ankle Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.468
3731	22090	W. Saliba	https://media.api-sports.io/football/players/22090.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Red Card	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.471
3732	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.472
3733	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.475
3734	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.477
3735	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.479
3736	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.481
3737	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.483
3738	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208103	2024-10-27 16:30:00	2024	2026-02-12 08:44:22.484
3739	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.486
3740	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.489
3741	169	K. Trippier	https://media.api-sports.io/football/players/169.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Muscle Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.491
3742	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.493
3743	19163	J. Murphy	https://media.api-sports.io/football/players/19163.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Thigh Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.495
3744	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.498
3745	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.5
3746	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.503
3747	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Ankle Injury	1208118	2024-11-02 12:30:00	2024	2026-02-12 08:44:22.505
3748	2273	K. Arrizabalaga	https://media.api-sports.io/football/players/2273.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.507
3749	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.509
3750	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.511
3751	284797	D. Ouattara	https://media.api-sports.io/football/players/284797.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.513
3752	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.515
3753	19187	J. Grealish	https://media.api-sports.io/football/players/19187.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.519
3754	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208113	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.522
3755	138836	H. Clarke	https://media.api-sports.io/football/players/138836.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Red Card	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.524
3756	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.526
3757	127579	J. Greaves	https://media.api-sports.io/football/players/127579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.528
3758	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.531
3759	18397	J. Taylor	https://media.api-sports.io/football/players/18397.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.533
3760	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Finger Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.535
3761	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.537
3762	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.539
3763	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.542
3764	18779	H. Choudhury	https://media.api-sports.io/football/players/18779.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Shoulder Injury	1208115	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.543
3765	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.546
3766	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.548
3767	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Chest Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.551
3768	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.553
3769	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.555
3770	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.557
3771	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.56
3772	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Calf Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.562
3773	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.564
3774	383685	Y. Minteh	https://media.api-sports.io/football/players/383685.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.567
3775	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208116	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.569
3776	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208119	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.571
3777	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Lacking Match Fitness	1208119	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.573
3778	2938	J. Ward-Prowse	https://media.api-sports.io/football/players/2938.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Loan agreement	1208119	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.575
3779	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Achilles Tendon Injury	1208119	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.577
3780	15911	M. Kudus	https://media.api-sports.io/football/players/15911.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208119	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.58
3781	1243	T. Soucek	https://media.api-sports.io/football/players/1243.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Illness	1208119	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.582
3782	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.583
3783	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.586
3784	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.588
3785	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.591
3786	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.593
3787	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.595
3788	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.597
3789	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208120	2024-11-02 15:00:00	2024	2026-02-12 08:44:22.6
3790	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.602
3791	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.604
3792	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.606
3793	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.608
3794	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.61
3795	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.612
3796	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.614
3797	19586	E. Eze	https://media.api-sports.io/football/players/19586.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.616
3798	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.619
3799	2490	J. Lerma	https://media.api-sports.io/football/players/2490.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.62
3800	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.623
3801	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.626
3802	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.629
3803	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.631
3804	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208122	2024-11-02 17:30:00	2024	2026-02-12 08:44:22.633
3805	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208121	2024-11-03 14:00:00	2024	2026-02-12 08:44:22.635
3806	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208121	2024-11-03 14:00:00	2024	2026-02-12 08:44:22.637
3807	19235	D. Spence	https://media.api-sports.io/football/players/19235.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Groin Injury	1208121	2024-11-03 14:00:00	2024	2026-02-12 08:44:22.639
3808	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208121	2024-11-03 14:00:00	2024	2026-02-12 08:44:22.641
3809	9971	Antony	https://media.api-sports.io/football/players/9971.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.643
3810	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.646
3811	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.648
3812	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.65
3813	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.652
3814	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knee Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.655
3815	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Head Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.658
3816	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.661
3817	18	J. Sancho	https://media.api-sports.io/football/players/18.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Illness	1208117	2024-11-03 16:30:00	2024	2026-02-12 08:44:22.664
3818	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Shoulder Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.667
3819	104	Carlos Vinicius	https://media.api-sports.io/football/players/104.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Calf Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.669
3820	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.672
3821	427736	Gustavo Nunes	https://media.api-sports.io/football/players/427736.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Back Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.674
3822	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.677
3823	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.679
3824	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208114	2024-11-04 20:00:00	2024	2026-02-12 08:44:22.682
3825	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Foot Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.684
3826	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.685
3827	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.688
3828	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.69
3829	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.693
3830	284797	D. Ouattara	https://media.api-sports.io/football/players/284797.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.695
3831	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.697
3832	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Injury	1208123	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.699
3833	19586	E. Eze	https://media.api-sports.io/football/players/19586.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.701
3834	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.704
3835	18806	W. Hughes	https://media.api-sports.io/football/players/18806.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Yellow Cards	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.706
3836	2490	J. Lerma	https://media.api-sports.io/football/players/2490.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.708
3837	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.71
3838	1468	E. Nketiah	https://media.api-sports.io/football/players/1468.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.712
3839	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.714
3840	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.716
3841	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Shoulder Injury	1208126	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.719
3842	2869	E. Alvarez	https://media.api-sports.io/football/players/2869.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.72
3843	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Achilles Tendon Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.723
3844	15911	M. Kudus	https://media.api-sports.io/football/players/15911.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.725
3845	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.727
3846	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.729
3847	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.731
3848	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.733
3849	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Thigh Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.735
3850	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Knee Injury	1208131	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.737
3851	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.739
3852	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.741
3853	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.743
3854	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.745
3855	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.748
3856	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.75
3857	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.752
3858	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.754
3859	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.757
3860	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208132	2024-11-09 15:00:00	2024	2026-02-12 08:44:22.759
3861	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.761
3862	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.764
3863	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.766
3864	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Calf Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.769
3865	383685	Y. Minteh	https://media.api-sports.io/football/players/383685.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.771
3866	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.775
3867	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.777
3868	19187	J. Grealish	https://media.api-sports.io/football/players/19187.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.779
3869	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.781
3870	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208124	2024-11-09 17:30:00	2024	2026-02-12 08:44:22.783
3871	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208127	2024-11-09 20:00:00	2024	2026-02-12 08:44:22.786
3872	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208127	2024-11-09 20:00:00	2024	2026-02-12 08:44:22.789
3873	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Chest Injury	1208127	2024-11-09 20:00:00	2024	2026-02-12 08:44:22.791
3874	19035	H. Elliott	https://media.api-sports.io/football/players/19035.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Broken ankle	1208127	2024-11-09 20:00:00	2024	2026-02-12 08:44:22.793
3875	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208127	2024-11-09 20:00:00	2024	2026-02-12 08:44:22.797
3876	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208127	2024-11-09 20:00:00	2024	2026-02-12 08:44:22.8
3877	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.803
3878	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.807
3879	37145	T. Malacia	https://media.api-sports.io/football/players/37145.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.81
3880	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Health problems	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.814
3881	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.817
3882	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.819
3883	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.821
3884	1098	P. Daka	https://media.api-sports.io/football/players/1098.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Ankle Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.823
3885	19004	B. De Cordova-Reid	https://media.api-sports.io/football/players/19004.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Calf Injury	1208128	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.825
3886	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208129	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.828
3887	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Lacking Match Fitness	1208129	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.83
3888	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208129	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.832
3889	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208129	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.834
3890	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Back Injury	1208129	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.836
3891	380690	M. Moore	https://media.api-sports.io/football/players/380690.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Illness	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.838
3892	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.84
3893	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.842
3894	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.845
3895	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.847
3896	127579	J. Greaves	https://media.api-sports.io/football/players/127579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.849
3897	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.853
3898	18397	J. Taylor	https://media.api-sports.io/football/players/18397.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Injury	1208130	2024-11-10 14:00:00	2024	2026-02-12 08:44:22.855
3899	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208125	2024-11-10 16:30:00	2024	2026-02-12 08:44:22.857
3900	18	J. Sancho	https://media.api-sports.io/football/players/18.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Illness	1208125	2024-11-10 16:30:00	2024	2026-02-12 08:44:22.859
3901	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208125	2024-11-10 16:30:00	2024	2026-02-12 08:44:22.861
3902	645	R. Sterling	https://media.api-sports.io/football/players/645.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Loan agreement	1208125	2024-11-10 16:30:00	2024	2026-02-12 08:44:22.864
3903	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208125	2024-11-10 16:30:00	2024	2026-02-12 08:44:22.866
3904	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208125	2024-11-10 16:30:00	2024	2026-02-12 08:44:22.868
3905	311334	F. Buonanotte	https://media.api-sports.io/football/players/311334.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Yellow Cards	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.871
3906	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.874
3907	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.878
3908	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.882
3909	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.885
3910	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.888
3911	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208139	2024-11-23 12:30:00	2024	2026-02-12 08:44:22.892
3912	1117	K. Tierney	https://media.api-sports.io/football/players/1117.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208134	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.896
3913	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208134	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.9
3914	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208134	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.903
3915	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208134	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.907
3916	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208134	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.911
3917	138908	E. Anderson	https://media.api-sports.io/football/players/138908.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Ankle Injury	1208134	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.913
3918	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.916
3919	19354	E. Konsa	https://media.api-sports.io/football/players/19354.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hip Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.918
3920	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.92
3921	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.923
3922	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.926
3923	2601	D. Kamada	https://media.api-sports.io/football/players/2601.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Red Card	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.929
3924	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.932
3925	1468	E. Nketiah	https://media.api-sports.io/football/players/1468.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Thigh Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.934
3926	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.936
3927	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.938
3928	19586	E. Eze	https://media.api-sports.io/football/players/19586.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Thigh Injury	1208135	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.941
3929	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.944
3930	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Yellow Cards	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.947
3931	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.949
3932	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.951
3933	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.954
3934	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.957
3935	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Calf Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.96
3936	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.963
3937	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Toe Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.966
3938	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Calf Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.971
3939	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208133	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.974
3940	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.976
3941	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.979
3942	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.981
3943	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.984
3944	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.986
3945	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Foot Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.992
3946	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.997
3947	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:22.999
3948	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208136	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.002
3949	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.004
3950	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.006
3951	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.008
3952	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.01
3953	388777	B. Meupiyou	https://media.api-sports.io/football/players/388777.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.012
3954	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.015
3955	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.016
3956	449245	Pedro Lima	https://media.api-sports.io/football/players/449245.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Ankle Injury	1208137	2024-11-23 15:00:00	2024	2026-02-12 08:44:23.019
3957	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.022
3958	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.024
3959	2291	M. Kovacic	https://media.api-sports.io/football/players/2291.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.026
3960	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.028
3961	1422	J. Doku	https://media.api-sports.io/football/players/1422.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Muscle Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.03
3962	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.032
3963	380690	M. Moore	https://media.api-sports.io/football/players/380690.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Illness	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.034
3964	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.037
3965	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.039
3966	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.041
3967	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208140	2024-11-23 17:30:00	2024	2026-02-12 08:44:23.043
3968	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.045
3969	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knee Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.047
3970	20355	A. Ramsdale	https://media.api-sports.io/football/players/20355.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Finger Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.049
3971	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.052
3972	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.055
3973	283	T. Alexander-Arnold	https://media.api-sports.io/football/players/283.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.057
3974	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.06
3975	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.062
3976	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Chest Injury	1208142	2024-11-24 14:00:00	2024	2026-02-12 08:44:23.065
3977	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.067
3978	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.069
3979	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.071
3980	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Groin Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.074
3981	127579	J. Greaves	https://media.api-sports.io/football/players/127579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.076
3982	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.079
3983	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.081
3984	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.083
3985	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.086
3986	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Back Injury	1208138	2024-11-24 16:30:00	2024	2026-02-12 08:44:23.089
3987	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208141	2024-11-25 20:00:00	2024	2026-02-12 08:44:23.091
3988	18961	D. Burn	https://media.api-sports.io/football/players/18961.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Yellow Cards	1208141	2024-11-25 20:00:00	2024	2026-02-12 08:44:23.094
3989	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208141	2024-11-25 20:00:00	2024	2026-02-12 08:44:23.096
3990	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208141	2024-11-25 20:00:00	2024	2026-02-12 08:44:23.099
3991	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Achilles Tendon Injury	1208141	2024-11-25 20:00:00	2024	2026-02-12 08:44:23.101
3992	15911	M. Kudus	https://media.api-sports.io/football/players/15911.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208141	2024-11-25 20:00:00	2024	2026-02-12 08:44:23.104
3993	356041	C. Baleba	https://media.api-sports.io/football/players/356041.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Red Card	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.106
3994	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.109
3995	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.113
3996	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.115
3997	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.118
3998	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Toe Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.12
3999	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.122
4000	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knee Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.124
4001	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.128
4002	20355	A. Ramsdale	https://media.api-sports.io/football/players/20355.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Finger Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.13
4003	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.133
4004	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.138
4005	15812	P. Onuachu	https://media.api-sports.io/football/players/15812.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208144	2024-11-29 20:00:00	2024	2026-02-12 08:44:23.141
4006	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Foot Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.145
4007	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.149
4008	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.152
4009	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.156
4010	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.159
4011	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.162
4012	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.164
4013	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.167
4014	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208143	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.173
4015	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.179
4016	2601	D. Kamada	https://media.api-sports.io/football/players/2601.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Red Card	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.185
4017	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.192
4018	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.202
4019	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.205
4020	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.207
4021	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.209
4022	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208146	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.212
4023	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.214
4024	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.217
4025	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Groin Injury	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.22
4026	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.222
4027	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.225
4028	18823	B. Johnson	https://media.api-sports.io/football/players/18823.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Knock	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.229
4029	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Injury	1208149	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.231
4030	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.234
4031	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.237
4032	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.239
4033	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.242
4034	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.244
4035	449245	Pedro Lima	https://media.api-sports.io/football/players/449245.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Ankle Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.247
4036	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.249
4037	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.251
4038	19281	A. Semenyo	https://media.api-sports.io/football/players/19281.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Yellow Cards	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.254
4039	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Injury	1208152	2024-11-30 15:00:00	2024	2026-02-12 08:44:23.256
4040	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Achilles Tendon Injury	1208151	2024-11-30 17:30:00	2024	2026-02-12 08:44:23.259
4041	15911	M. Kudus	https://media.api-sports.io/football/players/15911.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208151	2024-11-30 17:30:00	2024	2026-02-12 08:44:23.262
4042	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208151	2024-11-30 17:30:00	2024	2026-02-12 08:44:23.264
4043	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208151	2024-11-30 17:30:00	2024	2026-02-12 08:44:23.267
4044	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208145	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.27
4045	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208145	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.272
4046	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208145	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.275
4047	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Foot Injury	1208145	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.277
4048	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.28
4049	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.282
4050	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knock	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.285
4051	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.287
4052	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.289
4053	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Calf Injury	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.291
4054	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Ankle Injury	1208148	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.294
4055	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.296
4056	380690	M. Moore	https://media.api-sports.io/football/players/380690.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Illness	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.299
4057	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.301
4058	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.303
4059	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.306
4060	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.31
4061	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Ankle Injury	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.312
4062	2729	J. Andersen	https://media.api-sports.io/football/players/2729.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.314
4063	131	J. Cuenca	https://media.api-sports.io/football/players/131.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knock	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.317
4064	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208150	2024-12-01 13:30:00	2024	2026-02-12 08:44:23.319
4065	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.322
4066	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.324
4067	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.326
4068	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Chest Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.329
4069	1145	I. Konate	https://media.api-sports.io/football/players/1145.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Knee Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.331
4070	1600	K. Tsimikas	https://media.api-sports.io/football/players/1600.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Ankle Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.334
4071	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.336
4072	2291	M. Kovacic	https://media.api-sports.io/football/players/2291.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.339
4073	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.342
4074	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Health problems	1208147	2024-12-01 16:00:00	2024	2026-02-12 08:44:23.345
4075	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.347
4076	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.349
4077	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.351
4078	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.353
4079	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.356
4080	2601	D. Kamada	https://media.api-sports.io/football/players/2601.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Red Card	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.358
4081	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.361
4082	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.363
4083	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208158	2024-12-03 19:30:00	2024	2026-02-12 08:44:23.367
4084	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208159	2024-12-03 20:15:00	2024	2026-02-12 08:44:23.369
4085	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208159	2024-12-03 20:15:00	2024	2026-02-12 08:44:23.372
4086	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208159	2024-12-03 20:15:00	2024	2026-02-12 08:44:23.374
4087	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208159	2024-12-03 20:15:00	2024	2026-02-12 08:44:23.377
4088	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208159	2024-12-03 20:15:00	2024	2026-02-12 08:44:23.38
4089	138	J. Todibo	https://media.api-sports.io/football/players/138.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Injury	1208159	2024-12-03 20:15:00	2024	2026-02-12 08:44:23.383
4090	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.386
4091	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.388
4092	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.39
4093	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.393
4094	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.396
4095	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.398
4096	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.4
4097	130	N. Semedo	https://media.api-sports.io/football/players/130.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Yellow Cards	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.401
4098	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208156	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.404
4099	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208160	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.407
4100	2291	M. Kovacic	https://media.api-sports.io/football/players/2291.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208160	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.409
4101	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208160	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.412
4102	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Health problems	1208160	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.415
4103	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208160	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.417
4104	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208160	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.419
4105	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.422
4106	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.424
4107	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.427
4108	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.43
4109	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.432
4110	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.434
4111	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Chest Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.437
4112	1145	I. Konate	https://media.api-sports.io/football/players/1145.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Knee Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.438
4113	1600	K. Tsimikas	https://media.api-sports.io/football/players/1600.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Ankle Injury	1208161	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.441
4114	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.443
4115	304317	T. Dibling	https://media.api-sports.io/football/players/304317.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Yellow Cards	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.445
4116	19733	F. Downes	https://media.api-sports.io/football/players/19733.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Yellow Cards	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.448
4117	144729	T. Harwood-Bellis	https://media.api-sports.io/football/players/144729.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Yellow Cards	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.45
4118	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.452
4119	20355	A. Ramsdale	https://media.api-sports.io/football/players/20355.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Finger Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.454
4120	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.457
4121	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.459
4122	270508	L. Ugochukwu	https://media.api-sports.io/football/players/270508.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Loan agreement	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.461
4123	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Knee Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.463
4124	15812	P. Onuachu	https://media.api-sports.io/football/players/15812.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.465
4125	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.467
4126	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.469
4127	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208162	2024-12-04 19:30:00	2024	2026-02-12 08:44:23.471
4128	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Injury	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.474
4129	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.476
4130	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.478
4131	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Injury	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.481
4132	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.483
4133	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Yellow Cards	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.485
4134	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Yellow Cards	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.489
4135	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.492
4136	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knock	1208154	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.495
4137	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.499
4138	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.502
4139	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Foot Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.504
4140	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.507
4141	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.508
4142	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.511
4143	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208155	2024-12-04 20:15:00	2024	2026-02-12 08:44:23.513
4144	2729	J. Andersen	https://media.api-sports.io/football/players/2729.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.514
4145	19025	T. Cairney	https://media.api-sports.io/football/players/19025.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Red Card	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.516
4146	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Yellow Cards	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.518
4147	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.52
4148	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.523
4149	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.525
4150	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.527
4151	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.528
4152	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.53
4153	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208157	2024-12-05 19:30:00	2024	2026-02-12 08:44:23.532
4154	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.535
4155	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.537
4156	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.539
4157	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.54
4158	380690	M. Moore	https://media.api-sports.io/football/players/380690.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Illness	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.542
4159	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.544
4160	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.546
4161	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.548
4162	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.551
4163	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Ankle Injury	1208153	2024-12-05 20:15:00	2024	2026-02-12 08:44:23.553
4164	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.555
4165	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.557
4166	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.559
4167	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.561
4168	15812	P. Onuachu	https://media.api-sports.io/football/players/15812.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.564
4169	20355	A. Ramsdale	https://media.api-sports.io/football/players/20355.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Finger Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.567
4170	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.569
4171	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.571
4172	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.573
4173	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Knee Injury	1208163	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.575
4174	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.578
4175	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.579
4176	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.581
4177	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.583
4178	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.586
4179	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.588
4180	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208164	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.591
4181	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.593
4182	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.596
4183	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.598
4184	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Knee Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.6
4185	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.602
4186	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.605
4187	631	P. Foden	https://media.api-sports.io/football/players/631.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Illness	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.607
4188	2291	M. Kovacic	https://media.api-sports.io/football/players/2291.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.609
4189	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.611
4190	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.613
4191	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Health problems	1208165	2024-12-07 15:00:00	2024	2026-02-12 08:44:23.615
4192	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208170	2024-12-07 17:30:00	2024	2026-02-12 08:44:23.617
4193	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208170	2024-12-07 17:30:00	2024	2026-02-12 08:44:23.619
4194	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208170	2024-12-07 17:30:00	2024	2026-02-12 08:44:23.621
4195	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208170	2024-12-07 17:30:00	2024	2026-02-12 08:44:23.623
4196	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208170	2024-12-07 17:30:00	2024	2026-02-12 08:44:23.626
4197	2729	J. Andersen	https://media.api-sports.io/football/players/2729.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.627
4198	19025	T. Cairney	https://media.api-sports.io/football/players/19025.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Red Card	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.629
4199	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.632
4200	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.634
4201	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.636
4202	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.638
4203	641	O. Zinchenko	https://media.api-sports.io/football/players/641.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.64
4204	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.642
4205	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Injury	1208167	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.644
4206	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.647
4207	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.649
4208	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.651
4209	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.653
4210	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.655
4211	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.658
4212	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.659
4213	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208168	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.661
4214	311334	F. Buonanotte	https://media.api-sports.io/football/players/311334.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Loan agreement	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.663
4215	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.665
4216	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.667
4217	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.669
4218	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.672
4219	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.674
4220	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.677
4221	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.679
4222	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.681
4223	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.684
4224	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.687
4225	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208169	2024-12-08 14:00:00	2024	2026-02-12 08:44:23.689
4226	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.692
4227	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.694
4228	380690	M. Moore	https://media.api-sports.io/football/players/380690.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Illness	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.696
4229	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.698
4230	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.701
4231	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.703
4232	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.706
4233	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.708
4234	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.71
4235	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Illness	1208171	2024-12-08 16:30:00	2024	2026-02-12 08:44:23.713
4236	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.715
4237	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.718
4238	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.721
4239	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.723
4240	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.725
4241	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.727
4242	2056	P. Sarabia	https://media.api-sports.io/football/players/2056.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Muscle Injury	1208172	2024-12-09 20:00:00	2024	2026-02-12 08:44:23.73
4243	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.733
4244	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.735
4245	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.738
4246	641	O. Zinchenko	https://media.api-sports.io/football/players/641.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.741
4247	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.743
4248	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.747
4249	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Ankle Injury	1208174	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.749
4250	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.751
4251	1145	I. Konate	https://media.api-sports.io/football/players/1145.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Knee Injury	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.753
4252	6716	A. Mac Allister	https://media.api-sports.io/football/players/6716.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Yellow Cards	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.755
4253	1600	K. Tsimikas	https://media.api-sports.io/football/players/1600.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Ankle Injury	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.758
4254	2729	J. Andersen	https://media.api-sports.io/football/players/2729.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.761
4255	152967	C. Bassey	https://media.api-sports.io/football/players/152967.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Yellow Cards	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.763
4256	19025	T. Cairney	https://media.api-sports.io/football/players/19025.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Red Card	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.766
4257	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.769
4258	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208177	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.771
4259	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.773
4260	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.776
4261	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.778
4262	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.78
4263	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Knee Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.782
4264	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.784
4265	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.786
4266	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.788
4267	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.79
4268	22233	B. Soumare	https://media.api-sports.io/football/players/22233.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Yellow Cards	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.792
4269	152970	J. Stolarczyk	https://media.api-sports.io/football/players/152970.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.794
4270	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Muscle Injury	1208179	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.796
4271	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.798
4272	195103	J. Gomes	https://media.api-sports.io/football/players/195103.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Yellow Cards	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.8
4273	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.802
4274	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.804
4275	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.806
4276	2056	P. Sarabia	https://media.api-sports.io/football/players/2056.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Muscle Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.808
4277	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.81
4278	1590	J. Sa	https://media.api-sports.io/football/players/1590.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Shoulder Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.812
4279	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.814
4280	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.816
4281	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.818
4282	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208182	2024-12-14 15:00:00	2024	2026-02-12 08:44:23.82
4283	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208180	2024-12-14 17:30:00	2024	2026-02-12 08:44:23.823
4284	47547	A. Moreno	https://media.api-sports.io/football/players/47547.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Loan agreement	1208180	2024-12-14 17:30:00	2024	2026-02-12 08:44:23.825
4285	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208180	2024-12-14 17:30:00	2024	2026-02-12 08:44:23.827
4286	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208180	2024-12-14 17:30:00	2024	2026-02-12 08:44:23.83
4287	983	L. Bailey	https://media.api-sports.io/football/players/983.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Thigh Injury	1208180	2024-12-14 17:30:00	2024	2026-02-12 08:44:23.832
4288	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Muscle Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.835
4289	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.837
4290	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Toe Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.839
4291	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.841
4292	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Thigh Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.843
4293	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.845
4294	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Lacking Match Fitness	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.847
4295	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.85
4296	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.853
4297	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Calf Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.854
4298	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Groin Injury	1208175	2024-12-15 14:00:00	2024	2026-02-12 08:44:23.856
4299	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.858
4300	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.861
4301	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.863
4302	284230	R. Lewis	https://media.api-sports.io/football/players/284230.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Red Card	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.865
4303	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.867
4304	284324	A. Garnacho	https://media.api-sports.io/football/players/284324.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.869
4305	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.872
4306	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.874
4307	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knock	1208178	2024-12-15 16:30:00	2024	2026-02-12 08:44:23.877
4308	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.878
4309	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.881
4310	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.884
4311	1864	P. Neto	https://media.api-sports.io/football/players/1864.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Yellow Cards	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.885
4312	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.887
4313	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.889
4314	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.891
4315	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208176	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.893
4316	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.895
4317	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.897
4318	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.899
4319	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.902
4320	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.904
4321	20355	A. Ramsdale	https://media.api-sports.io/football/players/20355.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Finger Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.905
4322	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.908
4323	18968	Y. Bissouma	https://media.api-sports.io/football/players/18968.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Yellow Cards	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.909
4324	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.911
4325	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.913
4326	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.915
4327	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.918
4328	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.92
4329	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208181	2024-12-15 19:00:00	2024	2026-02-12 08:44:23.922
4330	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.925
4331	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.927
4332	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.931
4333	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.934
4334	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.937
4335	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.94
4336	2284	Emerson	https://media.api-sports.io/football/players/2284.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Yellow Cards	1208173	2024-12-16 20:00:00	2024	2026-02-12 08:44:23.942
4337	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208183	2024-12-21 12:30:00	2024	2026-02-12 08:44:23.945
4338	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208183	2024-12-21 12:30:00	2024	2026-02-12 08:44:23.948
4339	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208183	2024-12-21 12:30:00	2024	2026-02-12 08:44:23.951
4340	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208183	2024-12-21 12:30:00	2024	2026-02-12 08:44:23.953
4341	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.955
4342	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.959
4343	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.961
4344	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.964
4345	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.968
4346	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knock	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.971
4347	36922	S. van den Berg	https://media.api-sports.io/football/players/36922.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Groin Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.973
4348	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.976
4349	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208184	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.98
4350	161948	L. Delap	https://media.api-sports.io/football/players/161948.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Yellow Cards	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.982
4351	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.986
4352	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.989
4353	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.991
4354	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.993
4355	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Yellow Cards	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.996
4356	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:23.998
4357	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.001
4358	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.004
4359	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.007
4360	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Injury	1208188	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.009
4361	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.011
4362	930	C. Soler	https://media.api-sports.io/football/players/930.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Yellow Cards	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.013
4363	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.016
4364	1469	D. Welbeck	https://media.api-sports.io/football/players/1469.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.019
4365	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.021
4366	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Toe Injury	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.023
4367	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.026
4368	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208192	2024-12-21 15:00:00	2024	2026-02-12 08:44:24.028
4369	19586	E. Eze	https://media.api-sports.io/football/players/19586.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Leg Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.03
4370	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.033
4371	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.035
4372	13736	D. Munoz	https://media.api-sports.io/football/players/13736.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Yellow Cards	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.038
4373	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.04
4374	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Knee Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.042
4375	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.044
4376	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.046
4377	641	O. Zinchenko	https://media.api-sports.io/football/players/641.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Muscle Injury	1208185	2024-12-21 17:30:00	2024	2026-02-12 08:44:24.048
4378	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Loan agreement	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.05
4379	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.053
4380	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.055
4381	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Knee Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.058
4382	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.06
4383	47380	M. Cucurella	https://media.api-sports.io/football/players/47380.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Red Card	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.062
4384	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.064
4385	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.067
4386	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.07
4387	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.073
4388	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Injury	1208186	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.076
4389	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.079
4390	899	A. Pereira	https://media.api-sports.io/football/players/899.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Yellow Cards	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.081
4391	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.083
4392	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.085
4393	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.088
4394	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.09
4395	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Red Card	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.093
4396	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208187	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.095
4397	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.098
4398	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.101
4399	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.103
4400	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.106
4401	1135	O. Edouard	https://media.api-sports.io/football/players/1135.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Lacking Match Fitness	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.108
4402	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Muscle Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.111
4403	21138	R. Ait-Nouri	https://media.api-sports.io/football/players/21138.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Red Card	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.114
4404	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.117
4405	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.119
4406	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.121
4407	2056	P. Sarabia	https://media.api-sports.io/football/players/2056.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Muscle Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.123
4408	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208189	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.126
4409	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.129
4410	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.132
4411	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.134
4412	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.137
4413	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.139
4414	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.141
4415	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.144
4416	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208190	2024-12-22 14:00:00	2024	2026-02-12 08:44:24.148
4417	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Suspended	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.151
4418	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.154
4419	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.157
4420	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.159
4421	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.162
4422	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.166
4423	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.169
4424	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.172
4425	1145	I. Konate	https://media.api-sports.io/football/players/1145.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Knee Injury	1208191	2024-12-22 16:30:00	2024	2026-02-12 08:44:24.175
4426	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.178
4427	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.181
4428	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.184
4429	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.189
4430	617	Ederson	https://media.api-sports.io/football/players/617.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.193
4431	41621	M. Nunes	https://media.api-sports.io/football/players/41621.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.204
4432	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.207
4433	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.211
4434	894	A. Young	https://media.api-sports.io/football/players/894.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Yellow Cards	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.214
4435	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Knee Injury	1208198	2024-12-26 12:30:00	2024	2026-02-12 08:44:24.217
4436	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.22
4437	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.223
4438	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.225
4439	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.23
4440	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.234
4441	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Knock	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.237
4442	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.239
4443	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.243
4444	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.248
4445	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Knee Injury	1208193	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.251
4446	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.253
4447	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.257
4448	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.26
4449	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.264
4450	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.266
4451	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.269
4452	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.272
4453	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.274
4454	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.278
4455	1934	S. Berge	https://media.api-sports.io/football/players/1934.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Ankle Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.281
4456	1161	E. Smith Rowe	https://media.api-sports.io/football/players/1161.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Leg Injury	1208196	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.282
4457	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208199	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.285
4458	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208199	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.287
4459	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208199	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.29
4460	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208199	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.293
4461	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Injury	1208199	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.295
4462	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208199	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.297
4463	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.299
4464	6056	N. Dominguez	https://media.api-sports.io/football/players/6056.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Yellow Cards	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.302
4465	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.304
4466	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.306
4467	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.308
4468	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.31
4469	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.313
4470	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.318
4471	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Injury	1208200	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.321
4472	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208201	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.324
4473	665	M. Cornet	https://media.api-sports.io/football/players/665.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Loan agreement	1208201	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.327
4474	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208201	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.33
4475	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208201	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.333
4476	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208201	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.335
4477	1646	L. Paqueta	https://media.api-sports.io/football/players/1646.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Yellow Cards	1208201	2024-12-26 15:00:00	2024	2026-02-12 08:44:24.337
4478	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.339
4479	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.342
4480	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.344
4481	2056	P. Sarabia	https://media.api-sports.io/football/players/2056.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Calf Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.346
4482	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.348
4483	18947	M. Lemina	https://media.api-sports.io/football/players/18947.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Muscle Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.351
4484	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.354
4485	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.357
4486	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.361
4487	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208202	2024-12-26 17:30:00	2024	2026-02-12 08:44:24.366
4488	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.371
4489	1145	I. Konate	https://media.api-sports.io/football/players/1145.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Knee Injury	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.374
4490	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.377
4491	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.38
4492	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.382
4493	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.385
4494	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.387
4495	18788	J. Vardy	https://media.api-sports.io/football/players/18788.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Knock	1208197	2024-12-26 20:00:00	2024	2026-02-12 08:44:24.39
4496	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.393
4497	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.395
4498	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.397
4499	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Toe Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.4
4500	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.403
4501	1469	D. Welbeck	https://media.api-sports.io/football/players/1469.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.406
4502	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.409
4503	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.412
4504	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.415
4505	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.418
4506	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.421
4507	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.423
4508	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knock	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.425
4509	36922	S. van den Berg	https://media.api-sports.io/football/players/36922.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Groin Injury	1208195	2024-12-27 19:30:00	2024	2026-02-12 08:44:24.427
4510	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.429
4511	645	R. Sterling	https://media.api-sports.io/football/players/645.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.432
4512	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.434
4513	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.438
4514	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.441
4515	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.445
4516	19558	S. Morsy	https://media.api-sports.io/football/players/19558.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Yellow Cards	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.448
4517	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.45
4518	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.453
4519	2752	M. Luongo	https://media.api-sports.io/football/players/2752.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Illness	1208194	2024-12-27 20:15:00	2024	2026-02-12 08:44:24.455
4520	3428	J. Ayew	https://media.api-sports.io/football/players/3428.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Yellow Cards	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.457
4521	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.46
4522	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.463
4523	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.465
4524	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.467
4525	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.47
4526	8694	W. Faes	https://media.api-sports.io/football/players/8694.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.472
4527	283290	K. McAteer	https://media.api-sports.io/football/players/283290.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Knock	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.475
4528	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.477
4529	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.479
4530	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.481
4531	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.484
4532	617	Ederson	https://media.api-sports.io/football/players/617.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.487
4533	41621	M. Nunes	https://media.api-sports.io/football/players/41621.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208209	2024-12-29 14:30:00	2024	2026-02-12 08:44:24.489
4534	67971	M. Guehi	https://media.api-sports.io/football/players/67971.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Yellow Cards	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.491
4535	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.493
4536	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.495
4537	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.497
4538	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.499
4539	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.501
4540	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knock	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.503
4541	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208205	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.506
4542	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.507
4543	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.509
4544	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Calf Injury	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.511
4545	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Knee Injury	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.513
4546	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.516
4547	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.518
4548	19305	R. Yates	https://media.api-sports.io/football/players/19305.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Yellow Cards	1208206	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.52
4549	1934	S. Berge	https://media.api-sports.io/football/players/1934.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.522
4550	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.524
4551	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.526
4552	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.528
4553	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.53
4554	792	J. Kluivert	https://media.api-sports.io/football/players/792.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Yellow Cards	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.532
4555	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.534
4556	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.536
4557	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.538
4558	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.54
4559	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208207	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.542
4560	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.544
4561	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.546
4562	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.548
4563	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.551
4564	19235	D. Spence	https://media.api-sports.io/football/players/19235.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Red Card	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.553
4565	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.554
4566	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.556
4567	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.558
4568	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.561
4569	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.563
4570	2056	P. Sarabia	https://media.api-sports.io/football/players/2056.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Calf Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.565
4571	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.567
4572	18947	M. Lemina	https://media.api-sports.io/football/players/18947.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Muscle Injury	1208211	2024-12-29 15:00:00	2024	2026-02-12 08:44:24.569
4573	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.571
4574	2997	L. Fabianski	https://media.api-sports.io/football/players/2997.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Head Injury	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.573
4575	2476	G. Rodriguez	https://media.api-sports.io/football/players/2476.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Yellow Cards	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.575
4576	1243	T. Soucek	https://media.api-sports.io/football/players/1243.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Yellow Cards	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.578
4577	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.581
4578	30410	F. Chiesa	https://media.api-sports.io/football/players/30410.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Inactive	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.583
4579	1145	I. Konate	https://media.api-sports.io/football/players/1145.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Knee Injury	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.585
4580	1096	D. Szoboszlai	https://media.api-sports.io/football/players/1096.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Yellow Cards	1208212	2024-12-29 17:15:00	2024	2026-02-12 08:44:24.587
4581	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Yellow Cards	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.589
4582	13489	J. Duran	https://media.api-sports.io/football/players/13489.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Red Card	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.591
4583	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knock	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.593
4584	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.595
4585	1469	D. Welbeck	https://media.api-sports.io/football/players/1469.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.598
4586	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.599
4587	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Toe Injury	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.601
4588	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Muscle Injury	1208203	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.603
4589	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.605
4590	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.607
4591	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.609
4592	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Hamstring Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.611
4593	2752	M. Luongo	https://media.api-sports.io/football/players/2752.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Illness	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.613
4594	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.615
4595	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.618
4596	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.62
4597	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.622
4598	138935	C. Chukwuemeka	https://media.api-sports.io/football/players/138935.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Illness	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.624
4599	148099	K. Dewsbury-Hall	https://media.api-sports.io/football/players/148099.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Knock	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.626
4600	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Muscle Injury	1208208	2024-12-30 19:45:00	2024	2026-02-12 08:44:24.628
4601	1485	B. Fernandes	https://media.api-sports.io/football/players/1485.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Red Card	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.63
4602	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.633
4603	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.635
4604	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.638
4605	51494	M. Ugarte	https://media.api-sports.io/football/players/51494.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Yellow Cards	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.64
4606	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.642
4607	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.644
4608	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.646
4609	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.648
4610	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Injury	1208210	2024-12-30 20:00:00	2024	2026-02-12 08:44:24.65
4611	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.652
4612	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.655
4613	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.657
4614	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.659
4615	18917	B. Mee	https://media.api-sports.io/football/players/18917.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.661
4616	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.663
4617	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Knock	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.665
4618	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.667
4619	645	R. Sterling	https://media.api-sports.io/football/players/645.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.669
4620	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.671
4621	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208204	2025-01-01 17:30:00	2024	2026-02-12 08:44:24.674
4622	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Yellow Cards	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.677
4623	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.68
4624	380690	M. Moore	https://media.api-sports.io/football/players/380690.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Illness	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.682
4625	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.684
4626	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.686
4627	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.689
4628	204039	D. Udogie	https://media.api-sports.io/football/players/204039.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.691
4629	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.693
4630	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.695
4631	18932	F. Forster	https://media.api-sports.io/football/players/18932.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Health problems	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.697
4632	2855	E. Krafth	https://media.api-sports.io/football/players/2855.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Shoulder Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.7
4633	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.702
4634	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.704
4635	2806	F. Schar	https://media.api-sports.io/football/players/2806.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Yellow Cards	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.956
4636	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208221	2025-01-04 12:30:00	2024	2026-02-12 08:44:24.959
4637	21090	Diego Carlos	https://media.api-sports.io/football/players/21090.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Ankle Injury	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.961
4638	13489	J. Duran	https://media.api-sports.io/football/players/13489.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Red Card	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.964
4639	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knock	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.966
4640	19170	M. Rogers	https://media.api-sports.io/football/players/19170.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Yellow Cards	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.968
4641	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.97
4642	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.973
4643	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.975
4644	283290	K. McAteer	https://media.api-sports.io/football/players/283290.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knock	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.976
4645	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.979
4646	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.981
4647	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208214	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.984
4648	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.986
4649	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.988
4650	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.99
4651	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.993
4652	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.995
4653	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:24.998
4654	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:25
4655	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.003
4656	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.005
4657	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208213	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.008
4658	19720	T. Chalobah	https://media.api-sports.io/football/players/19720.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Loan agreement	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.01
4659	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.013
4660	18806	W. Hughes	https://media.api-sports.io/football/players/18806.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Ankle Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.017
4661	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.02
4662	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.022
4663	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.024
4664	148099	K. Dewsbury-Hall	https://media.api-sports.io/football/players/148099.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knock	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.026
4665	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.029
4666	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.032
4667	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.035
4668	138935	C. Chukwuemeka	https://media.api-sports.io/football/players/138935.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Illness	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.038
4669	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Muscle Injury	1208216	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.047
4670	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.049
4671	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.051
4672	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.053
4673	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.055
4674	617	Ederson	https://media.api-sports.io/football/players/617.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.058
4675	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.06
4676	19428	J. Bowen	https://media.api-sports.io/football/players/19428.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.062
4677	2997	L. Fabianski	https://media.api-sports.io/football/players/2997.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Head Injury	1208219	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.065
4678	105971	G. Bazunu	https://media.api-sports.io/football/players/105971.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.067
4679	336585	M. Fernandes	https://media.api-sports.io/football/players/336585.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Yellow Cards	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.07
4680	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knock	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.072
4681	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.075
4682	19733	F. Downes	https://media.api-sports.io/football/players/19733.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.077
4683	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.08
4684	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.083
4685	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Groin Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.085
4686	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.087
4687	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.09
4688	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.092
4689	18917	B. Mee	https://media.api-sports.io/football/players/18917.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.095
4690	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.097
4691	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208220	2025-01-04 15:00:00	2024	2026-02-12 08:44:25.1
4692	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.103
4693	278370	D. Gomez	https://media.api-sports.io/football/players/278370.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Inactive	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.106
4694	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.109
4695	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.111
4696	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.114
4697	1469	D. Welbeck	https://media.api-sports.io/football/players/1469.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.117
4698	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.12
4699	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.122
4700	645	R. Sterling	https://media.api-sports.io/football/players/645.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.125
4701	38746	J. Timber	https://media.api-sports.io/football/players/38746.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Yellow Cards	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.127
4702	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.131
4703	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208215	2025-01-04 17:30:00	2024	2026-02-12 08:44:25.134
4704	1934	S. Berge	https://media.api-sports.io/football/players/1934.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.136
4705	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.138
4706	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.14
4707	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.142
4708	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.144
4709	20167	J. Donacien	https://media.api-sports.io/football/players/20167.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.147
4710	8794	G. Hirst	https://media.api-sports.io/football/players/8794.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.15
4711	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.152
4712	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Hamstring Injury	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.155
4713	2752	M. Luongo	https://media.api-sports.io/football/players/2752.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Illness	1208217	2025-01-05 14:00:00	2024	2026-02-12 08:44:25.158
4714	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208218	2025-01-05 16:30:00	2024	2026-02-12 08:44:25.16
4715	1096	D. Szoboszlai	https://media.api-sports.io/football/players/1096.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Illness	1208218	2025-01-05 16:30:00	2024	2026-02-12 08:44:25.162
4716	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208218	2025-01-05 16:30:00	2024	2026-02-12 08:44:25.164
4717	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208218	2025-01-05 16:30:00	2024	2026-02-12 08:44:25.166
4718	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Illness	1208218	2025-01-05 16:30:00	2024	2026-02-12 08:44:25.169
4719	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208218	2025-01-05 16:30:00	2024	2026-02-12 08:44:25.171
4720	1165	M. Cunha	https://media.api-sports.io/football/players/1165.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Suspended	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.173
4721	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.175
4722	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.177
4723	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.179
4724	41606	Toti	https://media.api-sports.io/football/players/41606.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.182
4725	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.184
4726	275170	Danilo	https://media.api-sports.io/football/players/275170.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.186
4727	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208222	2025-01-06 20:00:00	2024	2026-02-12 08:44:25.189
4728	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.191
4729	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.194
4730	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.197
4731	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.199
4732	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.201
4733	382925	R. Trevitt	https://media.api-sports.io/football/players/382925.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Calf Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.203
4734	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.205
4735	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.207
4736	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.21
4737	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208224	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.212
4738	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.213
4739	270507	C. Casadei	https://media.api-sports.io/football/players/270507.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Coach's decision	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.216
4740	2933	B. Chilwell	https://media.api-sports.io/football/players/2933.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Coach's decision	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.218
4741	148099	K. Dewsbury-Hall	https://media.api-sports.io/football/players/148099.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knock	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.22
4742	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.222
4743	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.225
4744	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.228
4745	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.232
4746	2273	K. Arrizabalaga	https://media.api-sports.io/football/players/2273.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Loan agreement	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.238
4747	152856	Evanilson	https://media.api-sports.io/football/players/152856.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Foot Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.24
4748	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.243
4749	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.246
4750	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.248
4751	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.25
4752	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.252
4753	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208230	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.255
4754	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.258
4755	19428	J. Bowen	https://media.api-sports.io/football/players/19428.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.26
4756	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.262
4757	138	J. Todibo	https://media.api-sports.io/football/players/138.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Injury	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.265
4758	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Injury	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.268
4759	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.27
4760	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208229	2025-01-14 19:30:00	2024	2026-02-12 08:44:25.273
4761	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208228	2025-01-14 20:00:00	2024	2026-02-12 08:44:25.276
4762	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208228	2025-01-14 20:00:00	2024	2026-02-12 08:44:25.278
4763	51617	D. Nunez	https://media.api-sports.io/football/players/51617.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Yellow Cards	1208228	2025-01-14 20:00:00	2024	2026-02-12 08:44:25.281
4764	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.284
4765	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.288
4766	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.29
4767	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.292
4768	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.296
4769	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Calf Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.299
4770	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.301
4771	19191	J. McGinn	https://media.api-sports.io/football/players/19191.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.303
4772	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.305
4773	21090	Diego Carlos	https://media.api-sports.io/football/players/21090.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Ankle Injury	1208225	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.308
4774	1135	O. Edouard	https://media.api-sports.io/football/players/1135.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Loan agreement	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.31
4775	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.314
4776	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.317
4777	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.32
4778	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.323
4779	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.326
4780	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.328
4781	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.331
4782	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208227	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.333
4783	18778	H. Barnes	https://media.api-sports.io/football/players/18778.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.335
4784	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.338
4785	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.341
4786	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.343
4787	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.345
4788	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.348
4789	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.35
4790	41606	Toti	https://media.api-sports.io/football/players/41606.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.353
4791	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208231	2025-01-15 19:30:00	2024	2026-02-12 08:44:25.356
4792	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.36
4793	313236	E. Nwaneri	https://media.api-sports.io/football/players/313236.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.363
4794	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.366
4795	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.369
4796	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.372
4797	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Muscle Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.375
4798	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Concussion	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.377
4799	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.381
4800	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.383
4801	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.386
4802	204039	D. Udogie	https://media.api-sports.io/football/players/204039.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.388
4803	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.391
4804	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Muscle Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.394
4805	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.397
4806	18932	F. Forster	https://media.api-sports.io/football/players/18932.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Health problems	1208223	2025-01-15 20:00:00	2024	2026-02-12 08:44:25.399
4807	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.402
4808	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.404
4809	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.406
4810	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Hamstring Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.408
4811	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.41
4812	278370	D. Gomez	https://media.api-sports.io/football/players/278370.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Inactive	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.412
4813	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.414
4814	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.417
4815	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.419
4816	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.421
4817	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208226	2025-01-16 19:30:00	2024	2026-02-12 08:44:25.423
4818	886	D. Dalot	https://media.api-sports.io/football/players/886.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Red Card	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.426
4819	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.429
4820	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.431
4821	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.433
4822	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.436
4823	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.438
4824	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knock	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.441
4825	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208232	2025-01-16 20:00:00	2024	2026-02-12 08:44:25.443
4826	18778	H. Barnes	https://media.api-sports.io/football/players/18778.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.446
4827	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.449
4828	18911	N. Pope	https://media.api-sports.io/football/players/18911.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.452
4829	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.455
4830	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.457
4831	152856	Evanilson	https://media.api-sports.io/football/players/152856.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Foot Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.46
4832	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.462
4833	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.465
4834	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.467
4835	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.47
4836	363333	J. Soler	https://media.api-sports.io/football/players/363333.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	International duty	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.473
4837	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.475
4838	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.478
4839	20093	J. Hill	https://media.api-sports.io/football/players/20093.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Thigh Injury	1208240	2025-01-18 12:30:00	2024	2026-02-12 08:44:25.481
4840	1119	K. Ajer	https://media.api-sports.io/football/players/1119.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.483
4841	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.486
4842	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.489
4843	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.492
4844	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.494
4845	382925	R. Trevitt	https://media.api-sports.io/football/players/382925.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Calf Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.497
4846	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.499
4847	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208234	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.502
4848	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.505
4849	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.508
4850	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.511
4851	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.513
4852	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.515
4853	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.518
4854	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208238	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.521
4855	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.524
4856	19428	J. Bowen	https://media.api-sports.io/football/players/19428.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.527
4857	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.529
4858	138	J. Todibo	https://media.api-sports.io/football/players/138.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Injury	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.531
4859	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Hamstring Injury	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.534
4860	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.536
4861	2490	J. Lerma	https://media.api-sports.io/football/players/2490.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Illness	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.539
4862	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.541
4863	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208242	2025-01-18 15:00:00	2024	2026-02-12 08:44:25.544
4864	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.546
4865	313236	E. Nwaneri	https://media.api-sports.io/football/players/313236.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Muscle Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.549
4866	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.551
4867	22090	W. Saliba	https://media.api-sports.io/football/players/22090.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.553
4868	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.556
4869	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.558
4870	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Questionable	Muscle Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.56
4871	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.562
4872	21090	Diego Carlos	https://media.api-sports.io/football/players/21090.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Ankle Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.564
4873	19191	J. McGinn	https://media.api-sports.io/football/players/19191.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.567
4874	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208233	2025-01-18 17:30:00	2024	2026-02-12 08:44:25.569
4875	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.571
4876	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.573
4877	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.575
4878	895	J. Garner	https://media.api-sports.io/football/players/895.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Lower Back Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.577
4879	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.579
4880	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.581
4881	863	R. Bentancur	https://media.api-sports.io/football/players/863.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Concussion	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.584
4882	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.586
4883	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.588
4884	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.591
4885	204039	D. Udogie	https://media.api-sports.io/football/players/204039.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.593
4886	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.595
4887	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Muscle Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.597
4888	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.598
4889	18968	Y. Bissouma	https://media.api-sports.io/football/players/18968.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Calf Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.601
4890	129711	B. Johnson	https://media.api-sports.io/football/players/129711.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Calf Injury	1208236	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.602
4891	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.605
4892	889	V. Lindelof	https://media.api-sports.io/football/players/889.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.607
4893	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.609
4894	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.611
4895	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.613
4896	328225	B. Gruda	https://media.api-sports.io/football/players/328225.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.615
4897	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.617
4898	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.619
4899	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.621
4900	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.623
4901	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Ankle Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.626
4902	305730	J. Hinshelwood	https://media.api-sports.io/football/players/305730.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208239	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.627
4903	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Foot Injury	1208241	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.629
4904	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knock	1208241	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.632
4905	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208241	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.634
4906	304317	T. Dibling	https://media.api-sports.io/football/players/304317.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Ankle Injury	1208241	2025-01-19 14:00:00	2024	2026-02-12 08:44:25.637
4907	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.64
4908	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.642
4909	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Loan agreement	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.645
4910	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.647
4911	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.649
4912	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.651
4913	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Ankle Injury	1208237	2025-01-19 16:30:00	2024	2026-02-12 08:44:25.653
4914	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.656
4915	270507	C. Casadei	https://media.api-sports.io/football/players/270507.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Coach's decision	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.658
4916	2933	B. Chilwell	https://media.api-sports.io/football/players/2933.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Coach's decision	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.661
4917	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.663
4918	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.666
4919	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.668
4920	152953	L. Colwill	https://media.api-sports.io/football/players/152953.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.67
4921	5996	E. Fernandez	https://media.api-sports.io/football/players/5996.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.672
4922	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Thigh Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.674
4923	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.677
4924	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.679
4925	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.682
4926	41606	Toti	https://media.api-sports.io/football/players/41606.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.685
4927	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knee Injury	1208235	2025-01-20 20:00:00	2024	2026-02-12 08:44:25.688
4928	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.69
4929	152856	Evanilson	https://media.api-sports.io/football/players/152856.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Foot Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.693
4930	20093	J. Hill	https://media.api-sports.io/football/players/20093.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.696
4931	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.697
4932	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.699
4933	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.701
4934	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.703
4935	363333	J. Soler	https://media.api-sports.io/football/players/363333.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	International duty	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.705
4936	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.708
4937	22149	I. Sangare	https://media.api-sports.io/football/players/22149.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.71
4938	2298	C. Hudson-Odoi	https://media.api-sports.io/football/players/2298.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Muscle Injury	1208243	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.712
4939	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.714
4940	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.717
4941	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.718
4942	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.72
4943	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.723
4944	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.725
4945	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.728
4946	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.73
4947	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.733
4948	284500	T. Iroegbunam	https://media.api-sports.io/football/players/284500.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.735
4949	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208245	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.737
4950	2678	Diogo Jota	https://media.api-sports.io/football/players/2678.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Muscle Injury	1208248	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.739
4951	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208248	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.741
4952	293	C. Jones	https://media.api-sports.io/football/players/293.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Muscle Injury	1208248	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.743
4953	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208248	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.745
4954	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208248	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.747
4955	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208248	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.749
4956	304317	T. Dibling	https://media.api-sports.io/football/players/304317.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.752
4957	263177	A. Gronbaek	https://media.api-sports.io/football/players/263177.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Coach's decision	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.754
4958	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knock	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.756
4959	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.758
4960	199837	K. Sulemana	https://media.api-sports.io/football/players/199837.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.761
4961	20355	A. Ramsdale	https://media.api-sports.io/football/players/20355.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.763
4962	18778	H. Barnes	https://media.api-sports.io/football/players/18778.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.765
4963	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.768
4964	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208250	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.77
4965	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.772
4966	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.775
4967	18947	M. Lemina	https://media.api-sports.io/football/players/18947.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Illness	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.778
4968	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.78
4969	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.783
4970	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.785
4971	47311	M. Merino	https://media.api-sports.io/football/players/47311.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.787
4972	37127	M. Odegaard	https://media.api-sports.io/football/players/37127.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Illness	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.79
4973	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.792
4974	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.795
4975	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208252	2025-01-25 15:00:00	2024	2026-02-12 08:44:25.797
4976	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.801
4977	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.803
4978	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.806
4979	1422	J. Doku	https://media.api-sports.io/football/players/1422.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.807
4980	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.81
4981	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.812
4982	270507	C. Casadei	https://media.api-sports.io/football/players/270507.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Coach's decision	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.814
4983	2933	B. Chilwell	https://media.api-sports.io/football/players/2933.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Coach's decision	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.817
4984	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.819
4985	583	Joao Felix	https://media.api-sports.io/football/players/583.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Personal Reasons	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.821
4986	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.825
4987	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.827
4988	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208249	2025-01-25 17:30:00	2024	2026-02-12 08:44:25.829
4989	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.831
4990	1440	R. Holding	https://media.api-sports.io/football/players/1440.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Coach's decision	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.834
4991	311157	Matheus Franca	https://media.api-sports.io/football/players/311157.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Muscle Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.837
4992	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.839
4993	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Groin Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.841
4994	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.843
4995	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.846
4996	342022	M. Kayode	https://media.api-sports.io/football/players/342022.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Coach's decision	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.848
4997	19789	E. Pinnock	https://media.api-sports.io/football/players/19789.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.851
4998	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.853
4999	382925	R. Trevitt	https://media.api-sports.io/football/players/382925.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Calf Injury	1208246	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.855
5000	129711	B. Johnson	https://media.api-sports.io/football/players/129711.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.857
5001	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.859
5002	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.862
5003	204039	D. Udogie	https://media.api-sports.io/football/players/204039.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.863
5004	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.866
5005	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Muscle Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.868
5006	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Thigh Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.871
5007	19235	D. Spence	https://media.api-sports.io/football/players/19235.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Knock	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.873
5008	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Thigh Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.875
5009	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.878
5010	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.88
5011	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.882
5012	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.884
5013	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Thigh Injury	1208251	2025-01-26 14:00:00	2024	2026-02-12 08:44:25.886
5014	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.889
5015	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.89
5016	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Thigh Injury	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.893
5017	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.894
5018	19428	J. Bowen	https://media.api-sports.io/football/players/19428.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.896
5019	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.898
5020	1445	K. Mavropanos	https://media.api-sports.io/football/players/1445.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Red Card	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.9
5021	138	J. Todibo	https://media.api-sports.io/football/players/138.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Injury	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.902
5022	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Hamstring Injury	1208244	2025-01-26 16:30:00	2024	2026-02-12 08:44:25.905
5023	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208247	2025-01-26 19:00:00	2024	2026-02-12 08:44:25.907
5024	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208247	2025-01-26 19:00:00	2024	2026-02-12 08:44:25.909
5025	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208247	2025-01-26 19:00:00	2024	2026-02-12 08:44:25.911
5026	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208247	2025-01-26 19:00:00	2024	2026-02-12 08:44:25.914
5027	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208247	2025-01-26 19:00:00	2024	2026-02-12 08:44:25.916
5028	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208247	2025-01-26 19:00:00	2024	2026-02-12 08:44:25.918
5029	2298	C. Hudson-Odoi	https://media.api-sports.io/football/players/2298.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Muscle Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.921
5030	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.922
5031	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.924
5032	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.926
5033	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.928
5034	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.931
5035	92993	M. Wieffer	https://media.api-sports.io/football/players/92993.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.933
5036	46731	P. Estupinan	https://media.api-sports.io/football/players/46731.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Injury	1208261	2025-02-01 12:30:00	2024	2026-02-12 08:44:25.936
5037	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.939
5038	152856	Evanilson	https://media.api-sports.io/football/players/152856.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Foot Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.942
5039	20093	J. Hill	https://media.api-sports.io/football/players/20093.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.944
5040	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.947
5041	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.949
5042	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.951
5043	363333	J. Soler	https://media.api-sports.io/football/players/363333.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	International duty	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.953
5044	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.956
5045	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Thigh Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.958
5046	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Hamstring Injury	1208253	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.96
5047	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.961
5048	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.963
5049	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.965
5050	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.967
5051	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.969
5052	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.972
5053	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.974
5054	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.977
5055	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.98
5056	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.982
5057	18786	W. Ndidi	https://media.api-sports.io/football/players/18786.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Thigh Injury	1208257	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.985
5058	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.987
5059	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.989
5060	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.991
5061	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.993
5062	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.996
5063	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:25.998
5064	19248	N. Wood	https://media.api-sports.io/football/players/19248.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208258	2025-02-01 15:00:00	2024	2026-02-12 08:44:26
5065	18778	H. Barnes	https://media.api-sports.io/football/players/18778.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208260	2025-02-01 15:00:00	2024	2026-02-12 08:44:26.002
5066	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208260	2025-02-01 15:00:00	2024	2026-02-12 08:44:26.004
5067	2939	C. Wilson	https://media.api-sports.io/football/players/2939.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Thigh Injury	1208260	2025-02-01 15:00:00	2024	2026-02-12 08:44:26.006
5068	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208260	2025-02-01 15:00:00	2024	2026-02-12 08:44:26.008
5069	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208260	2025-02-01 15:00:00	2024	2026-02-12 08:44:26.01
5070	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Thigh Injury	1208260	2025-02-01 15:00:00	2024	2026-02-12 08:44:26.012
5071	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.014
5072	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.016
5073	195103	Joao Gomes	https://media.api-sports.io/football/players/195103.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Red Card	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.019
5074	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.021
5075	2032	J. S. Larsen	https://media.api-sports.io/football/players/2032.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.023
5076	18947	M. Lemina	https://media.api-sports.io/football/players/18947.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Illness	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.026
5077	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.027
5078	157912	B. Traore	https://media.api-sports.io/football/players/157912.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knee Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.029
5079	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.031
5080	19179	T. Mings	https://media.api-sports.io/football/players/19179.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Knee Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.034
5081	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.035
5082	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Calf Injury	1208262	2025-02-01 17:30:00	2024	2026-02-12 08:44:26.038
5083	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.041
5084	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.043
5085	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.045
5086	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.048
5087	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.05
5088	129711	B. Johnson	https://media.api-sports.io/football/players/129711.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.053
5089	18784	J. Maddison	https://media.api-sports.io/football/players/18784.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.055
5090	336564	W. Odobert	https://media.api-sports.io/football/players/336564.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.057
5091	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.06
5092	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.062
5093	204039	D. Udogie	https://media.api-sports.io/football/players/204039.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.065
5094	31354	G. Vicario	https://media.api-sports.io/football/players/31354.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Broken ankle	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.067
5095	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Muscle Injury	1208255	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.069
5096	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.072
5097	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.074
5098	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.078
5099	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.08
5100	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.082
5101	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.084
5102	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Calf Injury	1208259	2025-02-02 14:00:00	2024	2026-02-12 08:44:26.087
5103	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.089
5104	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.091
5105	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.096
5106	19959	B. White	https://media.api-sports.io/football/players/19959.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.099
5107	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.101
5108	567	R. Dias	https://media.api-sports.io/football/players/567.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.104
5109	1422	J. Doku	https://media.api-sports.io/football/players/1422.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.106
5110	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.109
5111	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Leg Injury	1208254	2025-02-02 16:30:00	2024	2026-02-12 08:44:26.111
5112	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.113
5113	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.115
5114	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.118
5115	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.12
5116	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.122
5117	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.124
5118	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.126
5119	138	J. Todibo	https://media.api-sports.io/football/players/138.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.128
5120	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Hamstring Injury	1208256	2025-02-03 20:00:00	2024	2026-02-12 08:44:26.13
5121	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.133
5122	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.136
5123	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.138
5124	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.141
5125	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.142
5126	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.144
5127	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.146
5128	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208166	2025-02-12 19:30:00	2024	2026-02-12 08:44:26.149
5129	46731	P. Estupinan	https://media.api-sports.io/football/players/46731.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.152
5130	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.154
5131	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.157
5132	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.159
5133	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.161
5134	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.164
5135	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Back Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.167
5136	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.169
5137	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.172
5138	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.174
5139	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.176
5140	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.179
5141	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.181
5142	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208264	2025-02-14 20:00:00	2024	2026-02-12 08:44:26.184
5143	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.186
5144	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.19
5145	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.192
5146	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.195
5147	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.197
5148	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.2
5149	127769	G. Martinelli	https://media.api-sports.io/football/players/127769.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.202
5150	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.206
5151	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208267	2025-02-15 12:30:00	2024	2026-02-12 08:44:26.209
5152	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.212
5153	19298	M. Cash	https://media.api-sports.io/football/players/19298.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.215
5154	19354	E. Konsa	https://media.api-sports.io/football/players/19354.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.217
5155	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.219
5156	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.222
5157	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.224
5158	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.226
5159	19541	C. Walton	https://media.api-sports.io/football/players/19541.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Muscle Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.228
5160	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Ankle Injury	1208263	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.231
5161	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208266	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.233
5162	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208266	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.235
5163	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208266	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.238
5164	8598	T. Awoniyi	https://media.api-sports.io/football/players/8598.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Broken nose	1208266	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.24
5165	10373	Carlos Miguel	https://media.api-sports.io/football/players/10373.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208266	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.242
5166	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.244
5167	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.247
5168	414385	C. Echeverri	https://media.api-sports.io/football/players/414385.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	International duty	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.249
5169	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.251
5170	19187	J. Grealish	https://media.api-sports.io/football/players/19187.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.254
5171	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.256
5172	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.258
5173	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Knee Injury	1208269	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.26
5174	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.262
5175	19733	F. Downes	https://media.api-sports.io/football/players/19733.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Knock	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.265
5176	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.267
5177	144729	T. Harwood-Bellis	https://media.api-sports.io/football/players/144729.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Ankle Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.269
5178	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.272
5179	18940	J. Stephens	https://media.api-sports.io/football/players/18940.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Calf Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.273
5180	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.275
5181	152856	Evanilson	https://media.api-sports.io/football/players/152856.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Foot Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.277
5182	20093	J. Hill	https://media.api-sports.io/football/players/20093.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.279
5183	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.281
5184	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.283
5185	363333	J. Soler	https://media.api-sports.io/football/players/363333.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	International duty	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.285
5186	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208270	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.288
5187	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.29
5188	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.292
5189	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.294
5190	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.296
5191	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.298
5192	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.3
5193	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208272	2025-02-15 15:00:00	2024	2026-02-12 08:44:26.302
5194	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.304
5195	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.306
5196	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Calf Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.309
5197	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.311
5198	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.313
5199	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.315
5200	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.318
5201	18805	A. Doucoure	https://media.api-sports.io/football/players/18805.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Red Card	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.32
5202	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.322
5203	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.324
5204	18592	I. Ndiaye	https://media.api-sports.io/football/players/18592.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.327
5205	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208265	2025-02-15 17:30:00	2024	2026-02-12 08:44:26.329
5206	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.332
5207	293	C. Jones	https://media.api-sports.io/football/players/293.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Red Card	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.334
5208	247	C. Gakpo	https://media.api-sports.io/football/players/247.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.337
5209	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.339
5210	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.341
5211	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.344
5212	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.346
5213	2032	J. S. Larsen	https://media.api-sports.io/football/players/2032.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.349
5214	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208268	2025-02-16 14:00:00	2024	2026-02-12 08:44:26.351
5215	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.354
5216	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.357
5217	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.359
5218	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.362
5219	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Lacking Match Fitness	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.365
5220	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Thigh Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.367
5221	50132	A. Bayindir	https://media.api-sports.io/football/players/50132.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.37
5222	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.373
5223	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.375
5224	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.378
5225	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.38
5226	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.382
5227	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.385
5228	51494	M. Ugarte	https://media.api-sports.io/football/players/51494.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knock	1208271	2025-02-16 16:30:00	2024	2026-02-12 08:44:26.388
5229	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.39
5230	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.393
5231	19354	E. Konsa	https://media.api-sports.io/football/players/19354.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.396
5232	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.399
5233	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.401
5234	983	L. Bailey	https://media.api-sports.io/football/players/983.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.403
5235	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.407
5236	247	C. Gakpo	https://media.api-sports.io/football/players/247.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Injury	1208305	2025-02-19 19:30:00	2024	2026-02-12 08:44:26.41
5237	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.413
5238	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.415
5239	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.418
5240	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.42
5241	19760	J. Justin	https://media.api-sports.io/football/players/19760.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.423
5242	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.425
5243	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.427
5244	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.431
5245	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.434
5246	36922	S. van den Berg	https://media.api-sports.io/football/players/36922.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208279	2025-02-21 20:00:00	2024	2026-02-12 08:44:26.436
5247	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.439
5248	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.441
5249	330412	Chermiti	https://media.api-sports.io/football/players/330412.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.443
5250	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.446
5251	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.448
5252	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.451
5253	18592	I. Ndiaye	https://media.api-sports.io/football/players/18592.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.453
5254	138417	N. Patterson	https://media.api-sports.io/football/players/138417.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.456
5255	50132	A. Bayindir	https://media.api-sports.io/football/players/50132.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.459
5256	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.461
5257	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.464
5258	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.467
5259	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.47
5260	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.472
5261	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208276	2025-02-22 12:30:00	2024	2026-02-12 08:44:26.474
5262	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.477
5263	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.479
5264	127769	G. Martinelli	https://media.api-sports.io/football/players/127769.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.481
5265	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.484
5266	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.488
5267	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.49
5268	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.493
5269	1646	L. Paqueta	https://media.api-sports.io/football/players/1646.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Ankle Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.495
5270	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.499
5271	1231	V. Coufal	https://media.api-sports.io/football/players/1231.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Thigh Injury	1208274	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.501
5272	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.504
5273	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.506
5274	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.509
5275	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.511
5276	135068	E. Agbadou	https://media.api-sports.io/football/players/135068.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.514
5277	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.517
5278	282770	R. Gomes	https://media.api-sports.io/football/players/282770.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.52
5279	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.524
5280	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.527
5281	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.53
5282	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208273	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.534
5283	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208277	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.536
5284	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208277	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.538
5285	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208277	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.54
5286	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208277	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.543
5287	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208277	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.546
5288	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Calf Injury	1208277	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.548
5289	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.551
5290	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.557
5291	70747	J. Enciso	https://media.api-sports.io/football/players/70747.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.562
5292	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.564
5293	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Red Card	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.566
5294	19541	C. Walton	https://media.api-sports.io/football/players/19541.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Muscle Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.569
5295	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.571
5296	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.573
5297	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.575
5298	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.578
5299	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Lacking Match Fitness	1208278	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.581
5300	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.583
5301	144729	T. Harwood-Bellis	https://media.api-sports.io/football/players/144729.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.585
5302	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.587
5303	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.59
5304	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Back Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.592
5305	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.594
5306	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.597
5307	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.599
5308	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208282	2025-02-22 15:00:00	2024	2026-02-12 08:44:26.601
5309	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.603
5310	21998	A. Disasi	https://media.api-sports.io/football/players/21998.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Loan agreement	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.606
5311	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.61
5312	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.612
5313	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.615
5314	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.617
5315	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.619
5316	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.621
5317	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.624
5318	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.626
5319	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.629
5320	136723	N. Madueke	https://media.api-sports.io/football/players/136723.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.631
5321	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208275	2025-02-22 17:30:00	2024	2026-02-12 08:44:26.634
5322	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208281	2025-02-23 14:00:00	2024	2026-02-12 08:44:26.636
5323	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208281	2025-02-23 14:00:00	2024	2026-02-12 08:44:26.638
5324	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Knee Injury	1208281	2025-02-23 14:00:00	2024	2026-02-12 08:44:26.641
5325	10373	Carlos Miguel	https://media.api-sports.io/football/players/10373.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208281	2025-02-23 14:00:00	2024	2026-02-12 08:44:26.643
5326	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.645
5327	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.647
5328	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.65
5329	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.651
5330	1100	E. Haaland	https://media.api-sports.io/football/players/1100.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Questionable	Knee Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.654
5331	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.656
5332	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208280	2025-02-23 16:30:00	2024	2026-02-12 08:44:26.658
5333	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Back Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.66
5334	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.662
5335	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.664
5336	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.666
5337	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.668
5338	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.67
5339	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.673
5340	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.674
5341	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.676
5342	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.678
5343	161671	I. Zabarnyi	https://media.api-sports.io/football/players/161671.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Red Card	1208284	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.68
5344	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.684
5345	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.686
5346	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Calf Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.688
5347	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.69
5348	1904	B. Kamara	https://media.api-sports.io/football/players/1904.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.692
5349	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.695
5350	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Foot Injury	1208289	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.697
5351	135068	E. Agbadou	https://media.api-sports.io/football/players/135068.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.699
5352	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.701
5353	282770	R. Gomes	https://media.api-sports.io/football/players/282770.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Groin Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.704
5354	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.706
5355	925	G. Guedes	https://media.api-sports.io/football/players/925.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.708
5356	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Thigh Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.712
5357	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.714
5358	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.717
5359	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.72
5360	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.722
5361	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.724
5362	1161	E. Smith Rowe	https://media.api-sports.io/football/players/1161.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Ankle Injury	1208288	2025-02-25 19:30:00	2024	2026-02-12 08:44:26.727
5363	95	B. Badiashile	https://media.api-sports.io/football/players/95.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.729
5364	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.732
5365	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.734
5366	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.736
5367	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.739
5368	136723	N. Madueke	https://media.api-sports.io/football/players/136723.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.743
5369	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.746
5370	19720	T. Chalobah	https://media.api-sports.io/football/players/19720.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Back Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.749
5371	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Lacking Match Fitness	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.752
5372	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.755
5373	295	A. Lallana	https://media.api-sports.io/football/players/295.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.757
5374	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.761
5375	270508	L. Ugochukwu	https://media.api-sports.io/football/players/270508.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Loan agreement	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.767
5376	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208290	2025-02-25 20:15:00	2024	2026-02-12 08:44:26.77
5377	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.774
5378	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.777
5379	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.779
5380	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Groin Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.781
5381	30407	C. Norgaard	https://media.api-sports.io/football/players/30407.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Concussion	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.785
5382	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.787
5383	36922	S. van den Berg	https://media.api-sports.io/football/players/36922.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.789
5384	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.792
5385	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.794
5386	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Calf Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.797
5387	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.8
5388	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.802
5389	18592	I. Ndiaye	https://media.api-sports.io/football/players/18592.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208283	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.805
5390	50132	A. Bayindir	https://media.api-sports.io/football/players/50132.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.808
5391	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.81
5392	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.813
5393	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.816
5394	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.819
5395	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.821
5396	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.823
5397	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.825
5398	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.828
5399	70747	J. Enciso	https://media.api-sports.io/football/players/70747.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.83
5400	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.833
5401	19541	C. Walton	https://media.api-sports.io/football/players/19541.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Muscle Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.835
5402	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Knee Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.838
5403	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Calf Injury	1208292	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.841
5404	10373	Carlos Miguel	https://media.api-sports.io/football/players/10373.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.843
5405	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.845
5406	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.848
5407	313245	M. Lewis-Skelly	https://media.api-sports.io/football/players/313245.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Red Card	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.85
5408	127769	G. Martinelli	https://media.api-sports.io/football/players/127769.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.852
5409	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.855
5410	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208285	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.858
5411	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Muscle Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.86
5412	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.862
5413	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.864
5414	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.867
5415	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.87
5416	152849	M. van de Ven	https://media.api-sports.io/football/players/152849.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Lacking Match Fitness	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.873
5417	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.875
5418	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.878
5419	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.88
5420	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208286	2025-02-26 19:30:00	2024	2026-02-12 08:44:26.884
5421	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208291	2025-02-26 20:15:00	2024	2026-02-12 08:44:26.887
5422	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208291	2025-02-26 20:15:00	2024	2026-02-12 08:44:26.89
5423	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208291	2025-02-26 20:15:00	2024	2026-02-12 08:44:26.892
5424	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208291	2025-02-26 20:15:00	2024	2026-02-12 08:44:26.894
5425	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Knee Injury	1208291	2025-02-26 20:15:00	2024	2026-02-12 08:44:26.897
5426	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.899
5427	1231	V. Coufal	https://media.api-sports.io/football/players/1231.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Thigh Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.901
5428	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.903
5429	1646	L. Paqueta	https://media.api-sports.io/football/players/1646.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Ankle Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.906
5430	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.907
5431	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.91
5432	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.912
5433	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Thigh Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.915
5434	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208287	2025-02-27 20:00:00	2024	2026-02-12 08:44:26.917
5435	10373	Carlos Miguel	https://media.api-sports.io/football/players/10373.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208299	2025-03-08 12:30:00	2024	2026-02-12 08:44:26.92
5436	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208299	2025-03-08 12:30:00	2024	2026-02-12 08:44:26.922
5437	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208299	2025-03-08 12:30:00	2024	2026-02-12 08:44:26.925
5438	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208299	2025-03-08 12:30:00	2024	2026-02-12 08:44:26.928
5439	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208299	2025-03-08 12:30:00	2024	2026-02-12 08:44:26.93
5440	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208299	2025-03-08 12:30:00	2024	2026-02-12 08:44:26.933
5441	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Back Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.936
5442	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.939
5443	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.942
5444	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Red Card	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.945
5445	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.949
5446	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.951
5447	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.955
5448	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Questionable	Knee Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.957
5449	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.959
5450	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.961
5451	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.964
5452	18753	A. Traore	https://media.api-sports.io/football/players/18753.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Ankle Injury	1208294	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.966
5453	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.969
5454	18806	W. Hughes	https://media.api-sports.io/football/players/18806.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Yellow Cards	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.972
5455	25927	J. Mateta	https://media.api-sports.io/football/players/25927.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.974
5456	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.977
5457	18847	J. Ward	https://media.api-sports.io/football/players/18847.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Calf Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.979
5458	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.981
5459	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.983
5460	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.985
5461	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.988
5462	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.99
5463	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208296	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.992
5464	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.994
5465	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Thigh Injury	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.997
5466	162590	T. Morton	https://media.api-sports.io/football/players/162590.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Shoulder Injury	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:26.999
5467	247	C. Gakpo	https://media.api-sports.io/football/players/247.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Knock	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:27.002
5468	19719	J. Bree	https://media.api-sports.io/football/players/19719.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:27.004
5469	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Calf Injury	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:27.007
5470	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:27.01
5471	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208297	2025-03-08 15:00:00	2024	2026-02-12 08:44:27.012
5472	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.014
5473	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.017
5474	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.019
5475	36922	S. van den Berg	https://media.api-sports.io/football/players/36922.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.021
5476	746	M. Asensio	https://media.api-sports.io/football/players/746.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.023
5477	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Calf Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.025
5478	19599	E. Martinez	https://media.api-sports.io/football/players/19599.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.027
5479	162714	A. Onana	https://media.api-sports.io/football/players/162714.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Thigh Injury	1208293	2025-03-08 17:30:00	2024	2026-02-12 08:44:27.03
5480	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.033
5481	1165	M. Cunha	https://media.api-sports.io/football/players/1165.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Red Card	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.036
5482	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.039
5483	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.041
5484	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.043
5485	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Ankle Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.046
5486	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.048
5487	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.051
5488	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.056
5489	18592	I. Ndiaye	https://media.api-sports.io/football/players/18592.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208302	2025-03-08 20:00:00	2024	2026-02-12 08:44:27.059
5490	422780	A. Anselmino	https://media.api-sports.io/football/players/422780.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.062
5491	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.065
5492	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.067
5493	19545	R. James	https://media.api-sports.io/football/players/19545.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Illness	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.069
5494	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.071
5495	136723	N. Madueke	https://media.api-sports.io/football/players/136723.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.074
5496	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.076
5497	161907	M. Gusto	https://media.api-sports.io/football/players/161907.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.079
5498	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.081
5499	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.083
5500	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208295	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.085
5501	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.087
5502	30435	D. Kulusevski	https://media.api-sports.io/football/players/30435.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Foot Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.089
5503	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.092
5504	164	B. Davies	https://media.api-sports.io/football/players/164.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Muscle Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.094
5505	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.096
5506	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.098
5507	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Leg Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.101
5508	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.103
5509	161671	I. Zabarnyi	https://media.api-sports.io/football/players/161671.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Red Card	1208300	2025-03-09 14:00:00	2024	2026-02-12 08:44:27.105
5510	50132	A. Bayindir	https://media.api-sports.io/football/players/50132.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.107
5511	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.109
5512	382452	P. Dorgu	https://media.api-sports.io/football/players/382452.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Red Card	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.112
5513	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Muscle Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.114
5514	2931	T. Heaton	https://media.api-sports.io/football/players/2931.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.117
5515	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.12
5516	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.122
5517	19220	M. Mount	https://media.api-sports.io/football/players/19220.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.124
5518	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.126
5519	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Hamstring Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.129
5520	51494	M. Ugarte	https://media.api-sports.io/football/players/51494.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Knock	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.131
5521	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.135
5522	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.137
5523	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.14
5524	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208298	2025-03-09 16:30:00	2024	2026-02-12 08:44:27.144
5525	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.146
5526	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Leg Injury	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.148
5527	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.152
5528	1231	V. Coufal	https://media.api-sports.io/football/players/1231.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Thigh Injury	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.154
5529	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.156
5530	138787	A. Gordon	https://media.api-sports.io/football/players/138787.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Red Card	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.159
5531	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.161
5532	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208301	2025-03-10 20:00:00	2024	2026-02-12 08:44:27.163
5533	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.165
5534	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.168
5535	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.17
5536	18592	I. Ndiaye	https://media.api-sports.io/football/players/18592.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.174
5537	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.178
5538	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.18
5539	1231	V. Coufal	https://media.api-sports.io/football/players/1231.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Thigh Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.184
5540	25391	N. Fullkrug	https://media.api-sports.io/football/players/25391.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Leg Injury	1208306	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.186
5541	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.188
5542	20007	C. Chaplin	https://media.api-sports.io/football/players/20007.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.191
5543	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.194
5544	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.197
5545	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.199
5546	19182	A. Tuanzebe	https://media.api-sports.io/football/players/19182.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.202
5547	10373	Carlos Miguel	https://media.api-sports.io/football/players/10373.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208308	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.204
5548	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.207
5549	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.209
5550	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Leg Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.214
5551	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.216
5552	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.218
5553	18963	L. Dunk	https://media.api-sports.io/football/players/18963.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Back Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.221
5554	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.226
5555	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.23
5556	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.234
5557	19030	M. O'Riley	https://media.api-sports.io/football/players/19030.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.236
5558	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.24
5559	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208310	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.243
5560	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Concussion	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.245
5561	19719	J. Bree	https://media.api-sports.io/football/players/19719.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Thigh Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.248
5562	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Calf Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.251
5563	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Groin Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.254
5564	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.256
5565	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.258
5566	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.261
5567	1165	M. Cunha	https://media.api-sports.io/football/players/1165.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Red Card	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.263
5568	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.265
5569	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.268
5570	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208312	2025-03-15 15:00:00	2024	2026-02-12 08:44:27.273
5571	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.275
5572	6610	M. Senesi	https://media.api-sports.io/football/players/6610.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Thigh Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.278
5573	18869	A. Smith	https://media.api-sports.io/football/players/18869.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Calf Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.28
5574	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.283
5575	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.286
5576	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.289
5577	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.291
5578	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Inactive	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.294
5579	342022	M. Kayode	https://media.api-sports.io/football/players/342022.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Inactive	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.296
5580	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208303	2025-03-15 17:30:00	2024	2026-02-12 08:44:27.298
5581	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.301
5582	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.304
5583	1460	B. Saka	https://media.api-sports.io/football/players/1460.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Thigh Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.306
5584	645	R. Sterling	https://media.api-sports.io/football/players/645.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Loan agreement	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.31
5585	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.313
5586	422780	A. Anselmino	https://media.api-sports.io/football/players/422780.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.315
5587	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.317
5588	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.32
5589	136723	N. Madueke	https://media.api-sports.io/football/players/136723.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.324
5590	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.326
5591	152982	C. Palmer	https://media.api-sports.io/football/players/152982.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Illness	1208304	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.328
5592	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Yellow Cards	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.33
5593	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Thigh Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.333
5594	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.335
5595	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.338
5596	25287	K. Danso	https://media.api-sports.io/football/players/25287.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.341
5597	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.343
5598	30435	D. Kulusevski	https://media.api-sports.io/football/players/30435.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Foot Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.346
5599	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208307	2025-03-16 13:30:00	2024	2026-02-12 08:44:27.349
5600	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.352
5601	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.354
5602	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.357
5603	50132	A. Bayindir	https://media.api-sports.io/football/players/50132.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.36
5604	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.363
5605	382452	P. Dorgu	https://media.api-sports.io/football/players/382452.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Red Card	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.366
5606	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Lower Back Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.369
5607	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.371
5608	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.373
5609	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.375
5610	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Foot Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.377
5611	2935	H. Maguire	https://media.api-sports.io/football/players/2935.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Hamstring Injury	1208309	2025-03-16 19:00:00	2024	2026-02-12 08:44:27.379
5612	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.382
5613	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.385
5614	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.387
5615	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.39
5616	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.393
5617	657	K. Tete	https://media.api-sports.io/football/players/657.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Knee Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.396
5618	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208314	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.398
5619	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208317	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.402
5620	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208317	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.404
5621	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208317	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.407
5622	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208317	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.411
5623	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208317	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.414
5624	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208317	2025-04-01 18:45:00	2024	2026-02-12 08:44:27.417
5625	18931	C. Wood	https://media.api-sports.io/football/players/18931.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Hip Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.419
5626	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.422
5627	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Lower Back Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.425
5628	402329	A. Heaven	https://media.api-sports.io/football/players/402329.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.428
5629	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.431
5630	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.434
5631	891	L. Shaw	https://media.api-sports.io/football/players/891.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208316	2025-04-01 19:00:00	2024	2026-02-12 08:44:27.436
5632	792	J. Kluivert	https://media.api-sports.io/football/players/792.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.439
5633	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.442
5634	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Ankle Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.446
5635	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.449
5636	51051	J. Araujo	https://media.api-sports.io/football/players/51051.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Thigh Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.452
5637	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.455
5638	19119	L. Davis	https://media.api-sports.io/football/players/19119.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Inactive	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.46
5639	284428	O. Hutchinson	https://media.api-sports.io/football/players/284428.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Inactive	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.463
5640	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.465
5641	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.468
5642	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208313	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.471
5643	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.474
5644	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.477
5645	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.481
5646	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.483
5647	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.486
5648	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.488
5649	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.491
5650	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.494
5651	983	L. Bailey	https://media.api-sports.io/football/players/983.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Knock	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.496
5652	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Knee Injury	1208315	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.499
5653	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.501
5654	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.503
5655	1100	E. Haaland	https://media.api-sports.io/football/players/1100.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.506
5656	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.511
5657	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.516
5658	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.519
5659	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.523
5660	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208319	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.526
5661	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.528
5662	138787	A. Gordon	https://media.api-sports.io/football/players/138787.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Red Card	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.532
5663	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.534
5664	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.536
5665	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.539
5666	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.541
5667	19346	R. Henry	https://media.api-sports.io/football/players/19346.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Thigh Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.543
5668	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Inactive	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.546
5669	47438	M. Jensen	https://media.api-sports.io/football/players/47438.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Illness	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.548
5670	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208320	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.55
5671	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Calf Injury	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.552
5672	130421	W. Smallbone	https://media.api-sports.io/football/players/130421.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Groin Injury	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.555
5673	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.557
5674	45078	R. Stewart	https://media.api-sports.io/football/players/45078.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Thigh Injury	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.559
5675	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.561
5676	18806	W. Hughes	https://media.api-sports.io/football/players/18806.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Yellow Cards	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.564
5677	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.566
5678	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Calf Injury	1208321	2025-04-02 18:45:00	2024	2026-02-12 08:44:27.568
5679	283	T. Alexander-Arnold	https://media.api-sports.io/football/players/283.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Ankle Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.569
5680	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Concussion	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.572
5681	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.574
5682	162590	T. Morton	https://media.api-sports.io/football/players/162590.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Shoulder Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.576
5683	180317	C. Bradley	https://media.api-sports.io/football/players/180317.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Thigh Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.579
5684	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.58
5685	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.584
5686	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.586
5687	18929	D. McNeil	https://media.api-sports.io/football/players/18929.png	Everton	https://media.api-sports.io/football/teams/45.png	Questionable	Knee Injury	1208322	2025-04-02 19:00:00	2024	2026-02-12 08:44:27.589
5688	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.591
5689	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Health problems	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.593
5690	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.596
5691	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Muscle Injury	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.599
5692	25287	K. Danso	https://media.api-sports.io/football/players/25287.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.601
5693	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.603
5694	30435	D. Kulusevski	https://media.api-sports.io/football/players/30435.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Foot Injury	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.605
5695	2413	Richarlison	https://media.api-sports.io/football/players/2413.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Calf Injury	1208318	2025-04-03 19:00:00	2024	2026-02-12 08:44:27.607
5696	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.61
5697	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.612
5698	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.614
5699	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.617
5700	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.619
5701	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.622
5702	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.624
5703	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208326	2025-04-05 11:30:00	2024	2026-02-12 08:44:27.627
5704	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.629
5705	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.631
5706	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Calf Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.633
5707	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.636
5708	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.639
5709	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.641
5710	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.644
5711	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.647
5712	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.649
5713	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.651
5714	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208325	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.654
5715	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.656
5716	284428	O. Hutchinson	https://media.api-sports.io/football/players/284428.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.659
5717	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.662
5718	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.665
5719	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.667
5720	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.669
5721	1165	M. Cunha	https://media.api-sports.io/football/players/1165.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Red Card	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.672
5722	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.674
5723	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.677
5724	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208328	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.679
5725	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.681
5726	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.683
5727	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.685
5728	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.688
5729	19245	M. Tavernier	https://media.api-sports.io/football/players/19245.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Ankle Injury	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.691
5730	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.694
5731	792	J. Kluivert	https://media.api-sports.io/football/players/792.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Injury	1208332	2025-04-05 14:00:00	2024	2026-02-12 08:44:27.697
5732	983	L. Bailey	https://media.api-sports.io/football/players/983.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Knock	1208323	2025-04-05 16:30:00	2024	2026-02-12 08:44:27.699
5733	2287	R. Barkley	https://media.api-sports.io/football/players/2287.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Knee Injury	1208323	2025-04-05 16:30:00	2024	2026-02-12 08:44:27.702
5734	2771	O. Aina	https://media.api-sports.io/football/players/2771.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Calf Injury	1208323	2025-04-05 16:30:00	2024	2026-02-12 08:44:27.704
5735	18931	C. Wood	https://media.api-sports.io/football/players/18931.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Hip Injury	1208323	2025-04-05 16:30:00	2024	2026-02-12 08:44:27.707
5736	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.709
5737	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.711
5738	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.714
5739	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Inactive	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.716
5740	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.718
5741	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Health problems	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.721
5742	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208324	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.723
5743	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208327	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.725
5744	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208327	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.727
5745	283	T. Alexander-Arnold	https://media.api-sports.io/football/players/283.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Ankle Injury	1208327	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.729
5746	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208327	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.73
5747	280	Alisson	https://media.api-sports.io/football/players/280.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Questionable	Concussion	1208327	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.733
5748	25287	K. Danso	https://media.api-sports.io/football/players/25287.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208331	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.735
5749	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208331	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.737
5750	30435	D. Kulusevski	https://media.api-sports.io/football/players/30435.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Foot Injury	1208331	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.739
5751	19733	F. Downes	https://media.api-sports.io/football/players/19733.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Yellow Cards	1208331	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.742
5752	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Calf Injury	1208331	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.744
5753	284264	J. Larios	https://media.api-sports.io/football/players/284264.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Lacking Match Fitness	1208331	2025-04-06 13:00:00	2024	2026-02-12 08:44:27.746
5754	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.748
5755	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Lower Back Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.75
5756	402329	A. Heaven	https://media.api-sports.io/football/players/402329.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.752
5757	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.754
5758	284322	K. Mainoo	https://media.api-sports.io/football/players/284322.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.756
5759	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.759
5760	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.761
5761	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.763
5762	1100	E. Haaland	https://media.api-sports.io/football/players/1100.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.765
5763	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.786
5764	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208330	2025-04-06 15:30:00	2024	2026-02-12 08:44:27.788
5765	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.791
5766	405905	N. Opoku	https://media.api-sports.io/football/players/405905.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Broken Leg	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.793
5767	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.796
5768	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.798
5769	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.801
5770	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.804
5771	138787	A. Gordon	https://media.api-sports.io/football/players/138787.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Questionable	Groin Injury	1208329	2025-04-07 19:00:00	2024	2026-02-12 08:44:27.807
5772	5	M. Akanji	https://media.api-sports.io/football/players/5.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Muscle Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.809
5773	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.812
5774	631	P. Foden	https://media.api-sports.io/football/players/631.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.814
5775	1100	E. Haaland	https://media.api-sports.io/football/players/1100.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.816
5776	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.819
5777	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.821
5778	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.823
5779	402640	R. Esse	https://media.api-sports.io/football/players/402640.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Illness	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.825
5780	67971	M. Guehi	https://media.api-sports.io/football/players/67971.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Red Card	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.827
5781	1468	E. Nketiah	https://media.api-sports.io/football/players/1468.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Red Card	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.829
5782	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.831
5783	50999	M. Turner	https://media.api-sports.io/football/players/50999.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Illness	1208338	2025-04-12 11:30:00	2024	2026-02-12 08:44:27.833
5784	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.836
5785	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.838
5786	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.84
5787	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.842
5788	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.845
5789	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Shoulder Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.847
5790	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.849
5791	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.851
5792	38695	J. P. van Hecke	https://media.api-sports.io/football/players/38695.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Red Card	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.854
5793	311334	F. Buonanotte	https://media.api-sports.io/football/players/311334.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Loan agreement	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.856
5794	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.858
5795	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.86
5796	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.863
5797	8694	W. Faes	https://media.api-sports.io/football/players/8694.png	Leicester	https://media.api-sports.io/football/teams/46.png	Questionable	Injury	1208335	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.865
5798	2771	O. Aina	https://media.api-sports.io/football/players/2771.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Calf Injury	1208340	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.867
5799	8598	T. Awoniyi	https://media.api-sports.io/football/players/8598.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Hamstring Injury	1208340	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.869
5800	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208340	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.87
5801	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208340	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.872
5802	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208340	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.874
5803	19733	F. Downes	https://media.api-sports.io/football/players/19733.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Yellow Cards	1208341	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.877
5804	263177	A. Gronbaek	https://media.api-sports.io/football/players/263177.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Muscle Injury	1208341	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.879
5805	18918	C. Taylor	https://media.api-sports.io/football/players/18918.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Knock	1208341	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.881
5806	983	L. Bailey	https://media.api-sports.io/football/players/983.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Questionable	Knock	1208341	2025-04-12 14:00:00	2024	2026-02-12 08:44:27.883
5807	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.885
5808	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.887
5809	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.89
5810	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.892
5811	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.895
5812	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.897
5813	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.9
5814	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.902
5815	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208334	2025-04-12 16:30:00	2024	2026-02-12 08:44:27.904
5816	291476	D. D. Fofana	https://media.api-sports.io/football/players/291476.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knee Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.906
5817	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.908
5818	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.91
5819	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.912
5820	282125	R. Lavia	https://media.api-sports.io/football/players/282125.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.913
5821	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.915
5822	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.917
5823	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.919
5824	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.921
5825	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.923
5826	284428	O. Hutchinson	https://media.api-sports.io/football/players/284428.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Hamstring Injury	1208336	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.925
5827	283	T. Alexander-Arnold	https://media.api-sports.io/football/players/283.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Ankle Injury	1208337	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.927
5828	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208337	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.929
5829	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208337	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.931
5830	18813	A. Cresswell	https://media.api-sports.io/football/players/18813.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Muscle Injury	1208337	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.934
5831	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208337	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.936
5832	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.938
5833	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.94
5834	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.943
5835	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.945
5836	449245	Pedro Lima	https://media.api-sports.io/football/players/449245.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Ankle Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.948
5837	25287	K. Danso	https://media.api-sports.io/football/players/25287.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.95
5838	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208342	2025-04-13 13:00:00	2024	2026-02-12 08:44:27.952
5839	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.954
5840	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.957
5841	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.959
5842	1463	J. Willock	https://media.api-sports.io/football/players/1463.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Contusion	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.962
5843	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.965
5844	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.971
5845	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Lower Back Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.975
5846	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.978
5847	526	A. Onana	https://media.api-sports.io/football/players/526.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Coach's decision	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.98
5848	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208339	2025-04-13 15:30:00	2024	2026-02-12 08:44:27.984
5849	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208333	2025-04-14 19:00:00	2024	2026-02-12 08:44:27.987
5850	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208333	2025-04-14 19:00:00	2024	2026-02-12 08:44:27.99
5851	792	J. Kluivert	https://media.api-sports.io/football/players/792.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Injury	1208333	2025-04-14 19:00:00	2024	2026-02-12 08:44:27.992
5852	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Questionable	Hamstring Injury	1208333	2025-04-14 19:00:00	2024	2026-02-12 08:44:27.995
5853	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208333	2025-04-14 19:00:00	2024	2026-02-12 08:44:27.997
5854	19221	H. Wilson	https://media.api-sports.io/football/players/19221.png	Fulham	https://media.api-sports.io/football/teams/36.png	Questionable	Ankle Injury	1208333	2025-04-14 19:00:00	2024	2026-02-12 08:44:28
5855	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208311	2025-04-16 18:30:00	2024	2026-02-12 08:44:28.002
5856	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208311	2025-04-16 18:30:00	2024	2026-02-12 08:44:28.005
5857	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208311	2025-04-16 18:30:00	2024	2026-02-12 08:44:28.008
5858	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208311	2025-04-16 18:30:00	2024	2026-02-12 08:44:28.011
5859	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208311	2025-04-16 18:30:00	2024	2026-02-12 08:44:28.014
5860	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.016
5861	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.019
5862	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.021
5863	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.023
5864	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.026
5865	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.029
5866	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.031
5867	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.034
5868	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.036
5869	537	J. Veltman	https://media.api-sports.io/football/players/537.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.038
5870	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208344	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.04
5871	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208345	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.043
5872	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208345	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.045
5873	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208345	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.047
5874	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208345	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.049
5875	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208345	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.052
5876	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.054
5877	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.057
5878	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.059
5879	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.061
5880	617	Ederson	https://media.api-sports.io/football/players/617.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Groin Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.063
5881	1100	E. Haaland	https://media.api-sports.io/football/players/1100.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.066
5882	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.068
5883	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208346	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.07
5884	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208352	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.072
5885	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208352	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.074
5886	263177	A. Gronbaek	https://media.api-sports.io/football/players/263177.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Muscle Injury	1208352	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.076
5887	18918	C. Taylor	https://media.api-sports.io/football/players/18918.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Knock	1208352	2025-04-19 14:00:00	2024	2026-02-12 08:44:28.079
5888	46815	P. Torres	https://media.api-sports.io/football/players/46815.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Coach's decision	1208343	2025-04-19 16:30:00	2024	2026-02-12 08:44:28.081
5889	38734	S. Botman	https://media.api-sports.io/football/players/38734.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208343	2025-04-19 16:30:00	2024	2026-02-12 08:44:28.083
5890	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208343	2025-04-19 16:30:00	2024	2026-02-12 08:44:28.085
5891	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208343	2025-04-19 16:30:00	2024	2026-02-12 08:44:28.088
5892	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208347	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.091
5893	291476	D. D. Fofana	https://media.api-sports.io/football/players/291476.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knee Injury	1208347	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.094
5894	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208347	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.096
5895	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208347	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.1
5896	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208347	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.102
5897	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208347	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.104
5898	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.107
5899	284428	O. Hutchinson	https://media.api-sports.io/football/players/284428.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Hamstring Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.109
5900	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.111
5901	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.113
5902	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.116
5903	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.118
5904	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.12
5905	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.122
5906	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.124
5907	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.126
5908	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.127
5909	2289	Jorginho	https://media.api-sports.io/football/players/2289.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Chest Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.13
5910	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208348	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.132
5911	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.134
5912	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.136
5913	402329	A. Heaven	https://media.api-sports.io/football/players/402329.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.138
5914	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.139
5915	70100	J. Zirkzee	https://media.api-sports.io/football/players/70100.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Hamstring Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.142
5916	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.144
5917	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.146
5918	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.149
5919	19143	S. Johnstone	https://media.api-sports.io/football/players/19143.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.151
5920	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.153
5921	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.155
5922	20665	J. Bellegarde	https://media.api-sports.io/football/players/20665.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knock	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.157
5923	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Muscle Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.159
5924	449245	Pedro Lima	https://media.api-sports.io/football/players/449245.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Ankle Injury	1208350	2025-04-20 13:00:00	2024	2026-02-12 08:44:28.161
5925	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208349	2025-04-20 15:30:00	2024	2026-02-12 08:44:28.163
5926	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208349	2025-04-20 15:30:00	2024	2026-02-12 08:44:28.165
5927	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208349	2025-04-20 15:30:00	2024	2026-02-12 08:44:28.166
5928	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208349	2025-04-20 15:30:00	2024	2026-02-12 08:44:28.169
5929	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208351	2025-04-21 19:00:00	2024	2026-02-12 08:44:28.171
5930	186	Son Heung-Min	https://media.api-sports.io/football/players/186.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Foot Injury	1208351	2025-04-21 19:00:00	2024	2026-02-12 08:44:28.173
5931	2771	O. Aina	https://media.api-sports.io/football/players/2771.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Calf Injury	1208351	2025-04-21 19:00:00	2024	2026-02-12 08:44:28.174
5932	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208358	2025-04-22 19:00:00	2024	2026-02-12 08:44:28.177
5933	617	Ederson	https://media.api-sports.io/football/players/617.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Groin Injury	1208358	2025-04-22 19:00:00	2024	2026-02-12 08:44:28.179
5934	1100	E. Haaland	https://media.api-sports.io/football/players/1100.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208358	2025-04-22 19:00:00	2024	2026-02-12 08:44:28.181
5935	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208358	2025-04-22 19:00:00	2024	2026-02-12 08:44:28.183
5936	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208358	2025-04-22 19:00:00	2024	2026-02-12 08:44:28.185
5937	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.188
5938	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.19
5939	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.192
5940	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.194
5941	2289	Jorginho	https://media.api-sports.io/football/players/2289.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Chest Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.197
5942	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.2
5943	2933	B. Chilwell	https://media.api-sports.io/football/players/2933.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Illness	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.203
5944	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.206
5945	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.209
5946	126949	C. Richards	https://media.api-sports.io/football/players/126949.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Red Card	1208354	2025-04-23 19:00:00	2024	2026-02-12 08:44:28.211
5947	291476	D. D. Fofana	https://media.api-sports.io/football/players/291476.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knee Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.213
5948	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.216
5949	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.218
5950	161907	M. Gusto	https://media.api-sports.io/football/players/161907.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.22
5951	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.223
5952	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.226
5953	138822	A. Broja	https://media.api-sports.io/football/players/138822.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Loan agreement	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.228
5954	18766	D. Calvert-Lewin	https://media.api-sports.io/football/players/18766.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Muscle Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.231
5955	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.234
5956	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.237
5957	2936	J. Tarkowski	https://media.api-sports.io/football/players/2936.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208356	2025-04-26 11:30:00	2024	2026-02-12 08:44:28.24
5958	7600	Igor	https://media.api-sports.io/football/players/7600.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.242
5959	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Red Card	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.244
5960	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.247
5961	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.249
5962	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.251
5963	19265	A. Webster	https://media.api-sports.io/football/players/19265.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.254
5964	38695	J. P. van Hecke	https://media.api-sports.io/football/players/38695.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Head Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.256
5965	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Inactive	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.258
5966	129643	E. Ferguson	https://media.api-sports.io/football/players/129643.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Loan agreement	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.261
5967	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.264
5968	2869	E. Alvarez	https://media.api-sports.io/football/players/2869.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Back Injury	1208355	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.266
5969	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.268
5970	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.27
5971	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.272
5972	19119	L. Davis	https://media.api-sports.io/football/players/19119.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Red Card	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.274
5973	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.277
5974	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.279
5975	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.281
5976	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.283
5977	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.285
5978	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.287
5979	19152	C. Townsend	https://media.api-sports.io/football/players/19152.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208359	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.289
5980	263177	A. Gronbaek	https://media.api-sports.io/football/players/263177.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Muscle Injury	1208361	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.291
5981	18918	C. Taylor	https://media.api-sports.io/football/players/18918.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Knock	1208361	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.293
5982	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208361	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.295
5983	195106	Rodrigo Muniz	https://media.api-sports.io/football/players/195106.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Inactive	1208361	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.297
5984	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.299
5985	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.3
5986	19143	S. Johnstone	https://media.api-sports.io/football/players/19143.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.302
5987	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.305
5988	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.307
5989	449245	Pedro Lima	https://media.api-sports.io/football/players/449245.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Ankle Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.309
5990	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.312
5991	879	S. Mavididi	https://media.api-sports.io/football/players/879.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.314
5992	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.316
5993	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208362	2025-04-26 14:00:00	2024	2026-02-12 08:44:28.319
5994	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.322
5995	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.324
5996	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.326
5997	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.33
5998	886	D. Dalot	https://media.api-sports.io/football/players/886.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.333
5999	157997	A. Diallo	https://media.api-sports.io/football/players/157997.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.335
6000	402329	A. Heaven	https://media.api-sports.io/football/players/402329.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.338
6001	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.34
6002	70100	J. Zirkzee	https://media.api-sports.io/football/players/70100.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Hamstring Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.343
6003	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208353	2025-04-27 13:00:00	2024	2026-02-12 08:44:28.345
6004	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208357	2025-04-27 15:30:00	2024	2026-02-12 08:44:28.348
6005	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208357	2025-04-27 15:30:00	2024	2026-02-12 08:44:28.352
6006	186	Son Heung-Min	https://media.api-sports.io/football/players/186.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Foot Injury	1208357	2025-04-27 15:30:00	2024	2026-02-12 08:44:28.354
6007	380492	E. da Silva Moreira	https://media.api-sports.io/football/players/380492.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Ankle Injury	1208360	2025-05-01 18:30:00	2024	2026-02-12 08:44:28.356
6008	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208360	2025-05-01 18:30:00	2024	2026-02-12 08:44:28.359
6009	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208360	2025-05-01 18:30:00	2024	2026-02-12 08:44:28.363
6010	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208360	2025-05-01 18:30:00	2024	2026-02-12 08:44:28.365
6011	25073	V. Janelt	https://media.api-sports.io/football/players/25073.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208360	2025-05-01 18:30:00	2024	2026-02-12 08:44:28.369
6012	196156	I. Thiago	https://media.api-sports.io/football/players/196156.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208360	2025-05-01 18:30:00	2024	2026-02-12 08:44:28.371
6013	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.374
6014	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.376
6015	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.379
6016	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.381
6017	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.384
6018	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.386
6019	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.389
6020	19143	S. Johnstone	https://media.api-sports.io/football/players/19143.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Injury	1208371	2025-05-02 19:00:00	2024	2026-02-12 08:44:28.391
6021	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208364	2025-05-03 11:30:00	2024	2026-02-12 08:44:28.394
6022	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208364	2025-05-03 11:30:00	2024	2026-02-12 08:44:28.396
6023	195106	Rodrigo Muniz	https://media.api-sports.io/football/players/195106.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Achilles Tendon Injury	1208364	2025-05-03 11:30:00	2024	2026-02-12 08:44:28.398
6024	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.401
6025	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.403
6026	2936	J. Tarkowski	https://media.api-sports.io/football/players/2936.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.405
6027	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.408
6028	19119	L. Davis	https://media.api-sports.io/football/players/19119.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Red Card	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.411
6029	18823	B. Johnson	https://media.api-sports.io/football/players/18823.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Red Card	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.414
6030	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.417
6031	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.42
6032	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.422
6033	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.425
6034	19152	C. Townsend	https://media.api-sports.io/football/players/19152.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.427
6035	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208369	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.43
6036	311334	F. Buonanotte	https://media.api-sports.io/football/players/311334.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Head Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.433
6037	19004	B. De Cordova-Reid	https://media.api-sports.io/football/players/19004.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.435
6038	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.437
6039	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Groin Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.439
6040	879	S. Mavididi	https://media.api-sports.io/football/players/879.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.441
6041	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.443
6042	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.446
6043	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208370	2025-05-03 14:00:00	2024	2026-02-12 08:44:28.448
6044	157052	R. Calafiori	https://media.api-sports.io/football/players/157052.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.45
6045	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.452
6046	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.454
6047	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.456
6048	2289	Jorginho	https://media.api-sports.io/football/players/2289.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Chest Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.459
6049	912	Neto	https://media.api-sports.io/football/players/912.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Loan agreement	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.461
6050	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.463
6051	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.466
6052	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.468
6053	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208363	2025-05-03 16:30:00	2024	2026-02-12 08:44:28.47
6054	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.472
6055	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.474
6056	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.476
6057	25073	V. Janelt	https://media.api-sports.io/football/players/25073.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.478
6058	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.48
6059	886	D. Dalot	https://media.api-sports.io/football/players/886.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.483
6060	402329	A. Heaven	https://media.api-sports.io/football/players/402329.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.485
6061	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.487
6062	70100	J. Zirkzee	https://media.api-sports.io/football/players/70100.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Hamstring Injury	1208365	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.49
6063	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.492
6064	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.494
6065	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.496
6066	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.499
6067	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.502
6068	18894	J. Lascelles	https://media.api-sports.io/football/players/18894.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.504
6069	18941	M. Targett	https://media.api-sports.io/football/players/18941.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208366	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.506
6070	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.51
6071	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.512
6072	2869	E. Alvarez	https://media.api-sports.io/football/players/2869.png	West Ham	https://media.api-sports.io/football/teams/48.png	Questionable	Back Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.515
6073	347316	L. Bergvall	https://media.api-sports.io/football/players/347316.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.517
6074	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.519
6075	186	Son Heung-Min	https://media.api-sports.io/football/players/186.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Foot Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.521
6076	18784	J. Maddison	https://media.api-sports.io/football/players/18784.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Knee Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.524
6077	18883	D. Solanke	https://media.api-sports.io/football/players/18883.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Questionable	Thigh Injury	1208372	2025-05-04 13:00:00	2024	2026-02-12 08:44:28.527
6078	291476	D. D. Fofana	https://media.api-sports.io/football/players/291476.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knee Injury	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.53
6079	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.534
6080	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.536
6081	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.539
6082	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.542
6083	269	C. Nkunku	https://media.api-sports.io/football/players/269.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Knock	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.546
6084	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208367	2025-05-04 15:30:00	2024	2026-02-12 08:44:28.549
6085	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208368	2025-05-05 19:00:00	2024	2026-02-12 08:44:28.551
6086	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208368	2025-05-05 19:00:00	2024	2026-02-12 08:44:28.554
6087	50999	M. Turner	https://media.api-sports.io/football/players/50999.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Loan agreement	1208368	2025-05-05 19:00:00	2024	2026-02-12 08:44:28.557
6088	2298	C. Hudson-Odoi	https://media.api-sports.io/football/players/2298.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Thigh Injury	1208368	2025-05-05 19:00:00	2024	2026-02-12 08:44:28.56
6089	380492	E. da Silva Moreira	https://media.api-sports.io/football/players/380492.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Ankle Injury	1208368	2025-05-05 19:00:00	2024	2026-02-12 08:44:28.563
6090	2920	T. Castagne	https://media.api-sports.io/football/players/2920.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.566
6091	2823	S. Lukic	https://media.api-sports.io/football/players/2823.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.569
6092	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.572
6093	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.575
6094	195106	Rodrigo Muniz	https://media.api-sports.io/football/players/195106.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Achilles Tendon Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.578
6095	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.581
6096	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.584
6097	2936	J. Tarkowski	https://media.api-sports.io/football/players/2936.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Hamstring Injury	1208374	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.586
6098	126791	N. Broadhead	https://media.api-sports.io/football/players/126791.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.588
6099	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.592
6100	19119	L. Davis	https://media.api-sports.io/football/players/19119.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Red Card	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.595
6101	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.597
6102	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.6
6103	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.612
6104	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Ankle Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.616
6105	19152	C. Townsend	https://media.api-sports.io/football/players/19152.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.62
6106	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.622
6107	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.625
6108	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Hamstring Injury	1208375	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.628
6109	18861	N. Ake	https://media.api-sports.io/football/players/18861.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Ankle Injury	1208380	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.63
6110	278133	O. Bobb	https://media.api-sports.io/football/players/278133.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208380	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.633
6111	44	Rodri	https://media.api-sports.io/football/players/44.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Knee Injury	1208380	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.637
6112	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208380	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.64
6113	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.642
6114	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.645
6115	19143	S. Johnstone	https://media.api-sports.io/football/players/19143.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.647
6116	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.65
6117	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.653
6118	24888	Hwang Hee-Chan	https://media.api-sports.io/football/players/24888.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Muscle Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.656
6119	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Red Card	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.66
6120	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.664
6121	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.667
6122	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.669
6123	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208382	2025-05-10 14:00:00	2024	2026-02-12 08:44:28.672
6124	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208373	2025-05-10 16:30:00	2024	2026-02-12 08:44:28.675
6125	284797	D. Ouattara	https://media.api-sports.io/football/players/284797.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208373	2025-05-10 16:30:00	2024	2026-02-12 08:44:28.678
6126	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208373	2025-05-10 16:30:00	2024	2026-02-12 08:44:28.68
6127	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208373	2025-05-10 16:30:00	2024	2026-02-12 08:44:28.683
6128	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208373	2025-05-10 16:30:00	2024	2026-02-12 08:44:28.685
6129	2926	Y. Tielemans	https://media.api-sports.io/football/players/2926.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Injury	1208373	2025-05-10 16:30:00	2024	2026-02-12 08:44:28.688
6130	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.691
6131	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.693
6132	18941	M. Targett	https://media.api-sports.io/football/players/18941.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.695
6133	422780	A. Anselmino	https://media.api-sports.io/football/players/422780.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Muscle Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.697
6134	291476	D. D. Fofana	https://media.api-sports.io/football/players/291476.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knee Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.7
6135	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.703
6136	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.705
6137	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.709
6138	269	C. Nkunku	https://media.api-sports.io/football/players/269.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knock	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.711
6139	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Muscle Injury	1208378	2025-05-11 11:00:00	2024	2026-02-12 08:44:28.715
6140	284400	T. Collyer	https://media.api-sports.io/football/players/284400.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Leg Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.717
6141	886	D. Dalot	https://media.api-sports.io/football/players/886.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.72
6142	402329	A. Heaven	https://media.api-sports.io/football/players/402329.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Ankle Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.723
6143	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.726
6144	70100	J. Zirkzee	https://media.api-sports.io/football/players/70100.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Hamstring Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.729
6145	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.732
6146	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.734
6147	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208377	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.737
6148	2298	C. Hudson-Odoi	https://media.api-sports.io/football/players/2298.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Thigh Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.739
6149	363695	Murillo	https://media.api-sports.io/football/players/363695.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Thigh Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.741
6150	380492	E. da Silva Moreira	https://media.api-sports.io/football/players/380492.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Ankle Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.743
6151	19004	B. De Cordova-Reid	https://media.api-sports.io/football/players/19004.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.745
6152	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.747
6153	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Groin Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.749
6154	879	S. Mavididi	https://media.api-sports.io/football/players/879.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.751
6155	18771	R. Pereira	https://media.api-sports.io/football/players/18771.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.754
6156	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.757
6157	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208379	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.759
6158	347316	L. Bergvall	https://media.api-sports.io/football/players/347316.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208381	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.762
6159	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208381	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.765
6160	18784	J. Maddison	https://media.api-sports.io/football/players/18784.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208381	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.768
6161	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208381	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.77
6162	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208381	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.772
6163	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Ankle Injury	1208381	2025-05-11 13:15:00	2024	2026-02-12 08:44:28.775
6164	284	J. Gomez	https://media.api-sports.io/football/players/284.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Hamstring Injury	1208376	2025-05-11 15:30:00	2024	2026-02-12 08:44:28.777
6165	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208376	2025-05-11 15:30:00	2024	2026-02-12 08:44:28.779
6166	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208376	2025-05-11 15:30:00	2024	2026-02-12 08:44:28.782
6167	978	K. Havertz	https://media.api-sports.io/football/players/978.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208376	2025-05-11 15:30:00	2024	2026-02-12 08:44:28.784
6168	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208376	2025-05-11 15:30:00	2024	2026-02-12 08:44:28.786
6169	19192	J. Ramsey	https://media.api-sports.io/football/players/19192.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Red Card	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.788
6170	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.79
6171	2926	Y. Tielemans	https://media.api-sports.io/football/players/2926.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Muscle Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.792
6172	347316	L. Bergvall	https://media.api-sports.io/football/players/347316.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.795
6173	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.797
6174	30435	D. Kulusevski	https://media.api-sports.io/football/players/30435.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.799
6175	18784	J. Maddison	https://media.api-sports.io/football/players/18784.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.801
6176	162552	D. Scarlett	https://media.api-sports.io/football/players/162552.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Groin Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.803
6177	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Hamstring Injury	1208384	2025-05-16 18:30:00	2024	2026-02-12 08:44:28.806
6178	291476	D. D. Fofana	https://media.api-sports.io/football/players/291476.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knee Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.808
6179	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.81
6180	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Red Card	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.812
6181	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.815
6182	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.817
6183	269	C. Nkunku	https://media.api-sports.io/football/players/269.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Knock	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.819
6184	18	J. Sancho	https://media.api-sports.io/football/players/18.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Loan agreement	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.821
6185	392270	M. Guiu	https://media.api-sports.io/football/players/392270.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Questionable	Muscle Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.824
6186	886	D. Dalot	https://media.api-sports.io/football/players/886.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Calf Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.826
6187	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.828
6188	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.83
6189	70100	J. Zirkzee	https://media.api-sports.io/football/players/70100.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Hamstring Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.832
6190	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.835
6191	18772	J. Evans	https://media.api-sports.io/football/players/18772.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Questionable	Muscle Injury	1208387	2025-05-16 19:15:00	2024	2026-02-12 08:44:28.836
6192	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.839
6193	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.841
6194	2936	J. Tarkowski	https://media.api-sports.io/football/players/2936.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Hamstring Injury	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.843
6195	18873	R. Fraser	https://media.api-sports.io/football/players/18873.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Injury	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.845
6196	263177	A. Gronbaek	https://media.api-sports.io/football/players/263177.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.847
6197	18918	C. Taylor	https://media.api-sports.io/football/players/18918.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Groin Injury	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.849
6198	171	K. Walker-Peters	https://media.api-sports.io/football/players/171.png	Southampton	https://media.api-sports.io/football/teams/41.png	Questionable	Illness	1208389	2025-05-18 11:00:00	2024	2026-02-12 08:44:28.852
6199	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208392	2025-05-18 13:15:00	2024	2026-02-12 08:44:28.853
6200	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208392	2025-05-18 13:15:00	2024	2026-02-12 08:44:28.855
6201	8598	T. Awoniyi	https://media.api-sports.io/football/players/8598.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Surgery	1208392	2025-05-18 13:15:00	2024	2026-02-12 08:44:28.857
6202	380492	E. da Silva Moreira	https://media.api-sports.io/football/players/380492.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Questionable	Ankle Injury	1208392	2025-05-18 13:15:00	2024	2026-02-12 08:44:28.859
6203	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.862
6204	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.864
6205	25073	V. Janelt	https://media.api-sports.io/football/players/25073.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Ankle Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.865
6206	44871	A. Hickey	https://media.api-sports.io/football/players/44871.png	Brentford	https://media.api-sports.io/football/teams/55.png	Questionable	Hamstring Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.867
6207	2920	T. Castagne	https://media.api-sports.io/football/players/2920.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.869
6208	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.871
6209	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.873
6210	195106	Rodrigo Muniz	https://media.api-sports.io/football/players/195106.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Achilles Tendon Injury	1208385	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.875
6211	19004	B. De Cordova-Reid	https://media.api-sports.io/football/players/19004.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.878
6212	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.88
6213	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Groin Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.883
6214	879	S. Mavididi	https://media.api-sports.io/football/players/879.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.885
6215	20079	H. Souttar	https://media.api-sports.io/football/players/20079.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Ankle Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.887
6216	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.89
6217	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.892
6218	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.894
6219	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.896
6220	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.898
6221	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.899
6222	17579	S. Szmodics	https://media.api-sports.io/football/players/17579.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Ankle Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.902
6223	19152	C. Townsend	https://media.api-sports.io/football/players/19152.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Questionable	Thigh Injury	1208390	2025-05-18 14:00:00	2024	2026-02-12 08:44:28.905
6224	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.907
6225	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.909
6226	47311	M. Merino	https://media.api-sports.io/football/players/47311.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Red Card	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.911
6227	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.913
6228	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.915
6229	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.918
6230	18941	M. Targett	https://media.api-sports.io/football/players/18941.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.921
6231	169	K. Trippier	https://media.api-sports.io/football/players/169.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Calf Injury	1208383	2025-05-18 15:30:00	2024	2026-02-12 08:44:28.924
6232	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208386	2025-05-19 19:00:00	2024	2026-02-12 08:44:28.926
6233	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208386	2025-05-19 19:00:00	2024	2026-02-12 08:44:28.928
6234	296	J. Milner	https://media.api-sports.io/football/players/296.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Thigh Injury	1208386	2025-05-19 19:00:00	2024	2026-02-12 08:44:28.931
6235	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208386	2025-05-19 19:00:00	2024	2026-02-12 08:44:28.933
6236	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.935
6237	67971	M. Guehi	https://media.api-sports.io/football/players/67971.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Concussion	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.938
6238	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.94
6239	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Head Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.942
6240	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.945
6241	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.947
6242	19143	S. Johnstone	https://media.api-sports.io/football/players/19143.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.95
6243	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.953
6244	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.956
6245	1590	J. Sa	https://media.api-sports.io/football/players/1590.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Coach's decision	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.959
6246	144732	T. Doyle	https://media.api-sports.io/football/players/144732.png	Wolves	https://media.api-sports.io/football/teams/39.png	Questionable	Knock	1208388	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.961
6247	266657	Savinho	https://media.api-sports.io/football/players/266657.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Coach's decision	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.964
6248	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.966
6249	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.968
6250	284797	D. Ouattara	https://media.api-sports.io/football/players/284797.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.973
6251	304853	A. Scott	https://media.api-sports.io/football/players/304853.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Jaw injury	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.975
6252	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.978
6253	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208391	2025-05-20 19:00:00	2024	2026-02-12 08:44:28.98
6254	1125	R. Christie	https://media.api-sports.io/football/players/1125.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.982
6255	18872	L. Cook	https://media.api-sports.io/football/players/18872.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Red Card	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.985
6256	284797	D. Ouattara	https://media.api-sports.io/football/players/284797.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Groin Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.988
6257	37161	L. Sinisterra	https://media.api-sports.io/football/players/37161.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Hamstring Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.99
6258	47499	E. Unal	https://media.api-sports.io/football/players/47499.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	Missing Fixture	Knee Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.992
6259	19004	B. De Cordova-Reid	https://media.api-sports.io/football/players/19004.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.995
6260	303467	I. Fatawu	https://media.api-sports.io/football/players/303467.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Knee Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.997
6261	15870	M. Hermansen	https://media.api-sports.io/football/players/15870.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Groin Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:28.999
6262	879	S. Mavididi	https://media.api-sports.io/football/players/879.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Muscle Injury	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.001
6263	182	H. Winks	https://media.api-sports.io/football/players/182.png	Leicester	https://media.api-sports.io/football/teams/46.png	Missing Fixture	Coach's decision	1208393	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.003
6264	2920	T. Castagne	https://media.api-sports.io/football/players/2920.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Ankle Injury	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.006
6265	727	R. Nelson	https://media.api-sports.io/football/players/727.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Hamstring Injury	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.008
6266	19480	H. Reed	https://media.api-sports.io/football/players/19480.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Calf Injury	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.01
6267	195106	Rodrigo Muniz	https://media.api-sports.io/football/players/195106.png	Fulham	https://media.api-sports.io/football/teams/36.png	Missing Fixture	Achilles Tendon Injury	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.013
6268	19187	J. Grealish	https://media.api-sports.io/football/players/19187.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Coach's decision	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.015
6269	2291	M. Kovacic	https://media.api-sports.io/football/players/2291.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Red Card	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.017
6270	626	J. Stones	https://media.api-sports.io/football/players/626.png	Manchester City	https://media.api-sports.io/football/teams/50.png	Missing Fixture	Thigh Injury	1208394	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.019
6271	20089	W. Burns	https://media.api-sports.io/football/players/20089.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.021
6272	616	A. Muric	https://media.api-sports.io/football/players/616.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Shoulder Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.023
6273	19365	C. Ogbene	https://media.api-sports.io/football/players/19365.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.026
6274	19130	K. Phillips	https://media.api-sports.io/football/players/19130.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Calf Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.028
6275	138931	J. Philogene	https://media.api-sports.io/football/players/138931.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Knee Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.031
6276	19152	C. Townsend	https://media.api-sports.io/football/players/19152.png	Ipswich	https://media.api-sports.io/football/teams/57.png	Missing Fixture	Thigh Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.033
6277	18819	M. Antonio	https://media.api-sports.io/football/players/18819.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Broken Leg	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.036
6278	37724	C. Summerville	https://media.api-sports.io/football/players/37724.png	West Ham	https://media.api-sports.io/football/teams/48.png	Missing Fixture	Hamstring Injury	1208395	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.038
6279	6716	A. Mac Allister	https://media.api-sports.io/football/players/6716.png	Liverpool	https://media.api-sports.io/football/teams/40.png	Missing Fixture	Rest	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.04
6280	3339	C. Doucoure	https://media.api-sports.io/football/players/3339.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.043
6281	67971	M. Guehi	https://media.api-sports.io/football/players/67971.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Concussion	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.046
6282	278898	C. Riad	https://media.api-sports.io/football/players/278898.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Knee Injury	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.049
6283	288102	A. Wharton	https://media.api-sports.io/football/players/288102.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Missing Fixture	Head Injury	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.051
6284	2933	B. Chilwell	https://media.api-sports.io/football/players/2933.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Illness	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.054
6285	18862	N. Clyne	https://media.api-sports.io/football/players/18862.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	Questionable	Illness	1208396	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.057
6286	2467	L. Martinez	https://media.api-sports.io/football/players/2467.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208397	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.061
6287	342970	L. Yoro	https://media.api-sports.io/football/players/342970.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knock	1208397	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.064
6288	532	M. de Ligt	https://media.api-sports.io/football/players/532.png	Manchester United	https://media.api-sports.io/football/teams/33.png	Missing Fixture	Knee Injury	1208397	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.066
6289	909	M. Rashford	https://media.api-sports.io/football/players/909.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	Missing Fixture	Hamstring Injury	1208397	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.068
6290	284492	L. Hall	https://media.api-sports.io/football/players/284492.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Foot Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.07
6291	723	Joelinton	https://media.api-sports.io/football/players/723.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Knee Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.073
6292	18941	M. Targett	https://media.api-sports.io/football/players/18941.png	Newcastle	https://media.api-sports.io/football/teams/34.png	Missing Fixture	Thigh Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.075
6293	17661	J. Branthwaite	https://media.api-sports.io/football/players/17661.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Hamstring Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.077
6294	18758	S. Coleman	https://media.api-sports.io/football/players/18758.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Thigh Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.079
6295	15884	J. Lindstrom	https://media.api-sports.io/football/players/15884.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Groin Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.081
6296	24882	O. Mangala	https://media.api-sports.io/football/players/24882.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Knee Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.083
6297	2936	J. Tarkowski	https://media.api-sports.io/football/players/2936.png	Everton	https://media.api-sports.io/football/teams/45.png	Missing Fixture	Hamstring Injury	1208398	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.085
6298	8598	T. Awoniyi	https://media.api-sports.io/football/players/8598.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Surgery	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.087
6299	380492	E. da Silva Moreira	https://media.api-sports.io/football/players/380492.png	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	Missing Fixture	Ankle Injury	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.09
6300	422780	A. Anselmino	https://media.api-sports.io/football/players/422780.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Thigh Injury	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.092
6301	22094	W. Fofana	https://media.api-sports.io/football/players/22094.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.095
6302	283058	N. Jackson	https://media.api-sports.io/football/players/283058.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Red Card	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.097
6303	329347	O. Kellyman	https://media.api-sports.io/football/players/329347.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Hamstring Injury	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.099
6304	63577	M. Mudryk	https://media.api-sports.io/football/players/63577.png	Chelsea	https://media.api-sports.io/football/teams/49.png	Missing Fixture	Suspended	1208399	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.102
6305	2999	J. Bednarek	https://media.api-sports.io/football/players/2999.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Knee Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.105
6306	263177	A. Gronbaek	https://media.api-sports.io/football/players/263177.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Achilles Tendon Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.107
6307	144729	T. Harwood-Bellis	https://media.api-sports.io/football/players/144729.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Ankle Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.109
6308	171	K. Walker-Peters	https://media.api-sports.io/football/players/171.png	Southampton	https://media.api-sports.io/football/teams/41.png	Missing Fixture	Illness	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.111
6309	22224	Gabriel	https://media.api-sports.io/football/players/22224.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Hamstring Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.114
6310	643	Gabriel Jesus	https://media.api-sports.io/football/players/643.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.116
6311	22090	W. Saliba	https://media.api-sports.io/football/players/22090.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.119
6312	38746	J. Timber	https://media.api-sports.io/football/players/38746.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Ankle Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.121
6313	2597	T. Tomiyasu	https://media.api-sports.io/football/players/2597.png	Arsenal	https://media.api-sports.io/football/teams/42.png	Missing Fixture	Knee Injury	1208400	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.124
6314	347316	L. Bergvall	https://media.api-sports.io/football/players/347316.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Ankle Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.126
6315	162498	R. Dragusin	https://media.api-sports.io/football/players/162498.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.129
6316	30435	D. Kulusevski	https://media.api-sports.io/football/players/30435.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.131
6317	18784	J. Maddison	https://media.api-sports.io/football/players/18784.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Knee Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.133
6318	30776	C. Romero	https://media.api-sports.io/football/players/30776.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Toe Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.135
6319	162552	D. Scarlett	https://media.api-sports.io/football/players/162552.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Groin Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.138
6320	186	Son Heung-Min	https://media.api-sports.io/football/players/186.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Foot Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.14
6321	1166	T. Werner	https://media.api-sports.io/football/players/1166.png	Tottenham	https://media.api-sports.io/football/teams/47.png	Missing Fixture	Thigh Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.142
6322	10329	Joao Pedro	https://media.api-sports.io/football/players/10329.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Personal Reasons	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.145
6323	1361	F. Kadioglu	https://media.api-sports.io/football/players/1361.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Toe Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.147
6324	138815	T. Lamptey	https://media.api-sports.io/football/players/138815.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.149
6325	18973	S. March	https://media.api-sports.io/football/players/18973.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Knee Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.152
6326	90590	G. Rutter	https://media.api-sports.io/football/players/90590.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Ankle Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.154
6327	18960	J. Steele	https://media.api-sports.io/football/players/18960.png	Brighton	https://media.api-sports.io/football/teams/51.png	Missing Fixture	Hand Injury	1208401	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.156
6328	380653	L. Chiwome	https://media.api-sports.io/football/players/380653.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.159
6329	144732	T. Doyle	https://media.api-sports.io/football/players/144732.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knock	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.161
6330	385726	E. Gonzalez	https://media.api-sports.io/football/players/385726.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.164
6331	19143	S. Johnstone	https://media.api-sports.io/football/players/19143.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.166
6332	7722	S. Kalajdzic	https://media.api-sports.io/football/players/7722.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.168
6333	195717	Y. Mosquera	https://media.api-sports.io/football/players/195717.png	Wolves	https://media.api-sports.io/football/teams/39.png	Missing Fixture	Knee Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.171
6334	153066	F. Carvalho	https://media.api-sports.io/football/players/153066.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Shoulder Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.173
6335	19362	J. Dasilva	https://media.api-sports.io/football/players/19362.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Knee Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.175
6336	25073	V. Janelt	https://media.api-sports.io/football/players/25073.png	Brentford	https://media.api-sports.io/football/teams/55.png	Missing Fixture	Heel Injury	1208402	2025-05-25 15:00:00	2024	2026-02-12 08:44:29.177
\.


--
-- Data for Name: epl_players; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epl_players (id, api_id, name, firstname, lastname, age, nationality, photo, team, team_logo, team_id, epl_position, number, goals, assists, yellow_cards, red_cards, appearances, minutes, rating, injured, season, last_updated) FROM stdin;
41	83	A. Danjuma	Arnaut	Danjuma Adam Groeneveld	28	Netherlands	https://media.api-sports.io/football/players/83.png	Everton	https://media.api-sports.io/football/teams/45.png	45	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.27
42	105	F. Ballo-Touré	Fodé	Ballo-Touré	28	Senegal	https://media.api-sports.io/football/players/105.png	Fulham	https://media.api-sports.io/football/teams/36.png	36	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.273
43	172	D. Alli	Bamidele Jermaine	Alli	29	England	https://media.api-sports.io/football/players/172.png	Everton	https://media.api-sports.io/football/teams/45.png	45	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.276
44	2699	S. Ghoddos	Sayed Saman	Ghoddos	32	Iran	https://media.api-sports.io/football/players/2699.png	Brentford	https://media.api-sports.io/football/teams/55.png	55	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.278
45	18765	André Gomes	André Filipe	Tavares Gomes	32	Portugal	https://media.api-sports.io/football/players/18765.png	Everton	https://media.api-sports.io/football/teams/45.png	45	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.28
46	18853	J. Riedewald	Jaïro Jocquim	Riedewald	29	Netherlands	https://media.api-sports.io/football/players/18853.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.282
47	19073	B. Godfrey	Benjamin Matthew	Godfrey	27	England	https://media.api-sports.io/football/players/19073.png	Everton	https://media.api-sports.io/football/teams/45.png	45	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.284
48	19145	T. Adarabioyo	Abdul-Nasir Oluwatosin	Oluwadoyinsolami Adarabioyo	28	England	https://media.api-sports.io/football/players/19145.png	Fulham	https://media.api-sports.io/football/teams/36.png	36	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.287
49	19364	N. Maupay	Neal	Maupay	29	France	https://media.api-sports.io/football/players/19364.png	Brentford	https://media.api-sports.io/football/teams/55.png	55	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.29
50	19657	M. Rodák	Marek	Rodák	29	Slovakia	https://media.api-sports.io/football/players/19657.png	Fulham	https://media.api-sports.io/football/teams/36.png	36	Goalkeeper	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.293
51	19744	K. Jackson	Kayden Pastel Dunn	Jackson	31	England	https://media.api-sports.io/football/players/19744.png	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.296
52	20224	A. Lonergan	Andrew Michael	Lonergan	42	England	https://media.api-sports.io/football/players/20224.png	Everton	https://media.api-sports.io/football/teams/45.png	45	Goalkeeper	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.297
53	44803	D. Ball	Dominic Martin	Ball	30	England	https://media.api-sports.io/football/players/44803.png	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.3
54	127605	N. Ferguson	Nathan Kirk-Patrick	Ferguson	24	England	https://media.api-sports.io/football/players/127605.png	Crystal Palace	https://media.api-sports.io/football/teams/52.png	52	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.302
55	135775	Ansu Fati	Anssumane	Fati Vieira	23	Spain	https://media.api-sports.io/football/players/135775.png	Brighton	https://media.api-sports.io/football/teams/51.png	51	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.304
56	138822	A. Broja	Armando	Broja	24	Albania	https://media.api-sports.io/football/players/138822.png	Fulham	https://media.api-sports.io/football/teams/36.png	36	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.306
57	153422	E. Brierley	Ethan Craig	Brierley	22	England	https://media.api-sports.io/football/players/153422.png	Brentford	https://media.api-sports.io/football/teams/55.png	55	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.308
58	153425	L. Dobbin	Lewis Norman	Dobbin	22	England	https://media.api-sports.io/football/players/153425.png	Everton	https://media.api-sports.io/football/teams/45.png	45	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.31
59	284500	T. Iroegbunam	Timothy Emeka	Iroegbunam	22	England	https://media.api-sports.io/football/players/284500.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.312
60	348263	C. Stewart	Cameron Jack	Stewart	22	England	https://media.api-sports.io/football/players/348263.png	Ipswich	https://media.api-sports.io/football/teams/57.png	57	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.315
61	133	C. Lenglet	Clément Nicolas Laurent	Lenglet	30	France	https://media.api-sports.io/football/players/133.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.446
62	190	Cédric Soares	Cédric Ricardo	Alves Soares	34	Portugal	https://media.api-sports.io/football/players/190.png	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.49
63	786	N. Zaniolo	Nicolò	Zaniolo	26	Italy	https://media.api-sports.io/football/players/786.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.493
64	1452	Mohamed Elneny	Mohamed Naser	Elsayed Elneny	33	Egypt	https://media.api-sports.io/football/players/1452.png	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.501
65	19263	L. Kelly	Lloyd Casius	Kelly	27	England	https://media.api-sports.io/football/players/19263.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.509
66	19356	E. Marcondes	Emiliano	Marcondes Camargo Hansen	30	Denmark	https://media.api-sports.io/football/players/19356.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.516
67	19804	K. Moore	Kieffer Roberto Francisco	Moore	33	Wales	https://media.api-sports.io/football/players/19804.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Attacker	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.526
68	20110	S. Baptiste	Shandon Harkeem	Baptiste	27	Grenada	https://media.api-sports.io/football/players/20110.png	Brentford	https://media.api-sports.io/football/teams/55.png	55	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.531
69	30765	I. Radu	Ionuț Andrei	Radu	28	Romania	https://media.api-sports.io/football/players/30765.png	Bournemouth	https://media.api-sports.io/football/teams/35.png	35	Goalkeeper	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.537
70	138937	F. Marschall	Filip	Marschall	22	England	https://media.api-sports.io/football/players/138937.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Goalkeeper	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.541
71	278123	S. Revan	Sebastian	Revan	22	England	https://media.api-sports.io/football/players/278123.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.544
72	281975	Val Adedokun	Val	Adedokun	22	Republic of Ireland	https://media.api-sports.io/football/players/281975.png	Brentford	https://media.api-sports.io/football/teams/55.png	55	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.547
73	284502	James Lannin-Sweet	James	Lannin-Sweet	22	England	https://media.api-sports.io/football/players/284502.png	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.55
74	284540	Mauro Bandeira	Mauro	Gomes Bandeira	22	Portugal	https://media.api-sports.io/football/players/284540.png	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.553
75	294638	Finley Munroe	Finley	Munroe	20	England	https://media.api-sports.io/football/players/294638.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.555
76	309501	A. Cozier-Duberry	Amario	Cozier-Duberry	20	England	https://media.api-sports.io/football/players/309501.png	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.558
77	309505	R. Walters	Reuell	Walters	21	England	https://media.api-sports.io/football/players/309505.png	Arsenal	https://media.api-sports.io/football/teams/42.png	42	Defender	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.56
78	329347	O. Kellyman	Omari Jamian	Kellyman	20	England	https://media.api-sports.io/football/players/329347.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Midfielder	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.565
79	349288	Vincent Angelini	Vincent	Angelini	22	Scotland	https://media.api-sports.io/football/players/349288.png	Brentford	https://media.api-sports.io/football/teams/55.png	55	Goalkeeper	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.568
80	455010	L. Emery	Lander	Emery	22	Spain	https://media.api-sports.io/football/players/455010.png	Aston Villa	https://media.api-sports.io/football/teams/66.png	66	Goalkeeper	\N	0	0	0	0	0	0	\N	f	2024	2026-02-12 08:44:20.571
\.


--
-- Data for Name: epl_standings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epl_standings (id, team_id, team_name, team_logo, rank, points, played, won, drawn, lost, goals_for, goals_against, goal_diff, form, season, last_updated) FROM stdin;
24	49	Chelsea	https://media.api-sports.io/football/teams/49.png	4	69	38	20	9	9	64	43	21	WWLWW	2024	2026-02-12 15:07:02.088
25	34	Newcastle	https://media.api-sports.io/football/teams/34.png	5	66	38	20	6	12	68	47	21	LLWDW	2024	2026-02-12 15:07:02.094
26	66	Aston Villa	https://media.api-sports.io/football/teams/66.png	6	66	38	19	9	10	58	51	7	LWWWL	2024	2026-02-12 15:07:02.1
21	40	Liverpool	https://media.api-sports.io/football/teams/40.png	1	84	38	25	9	4	86	41	45	DLDLW	2024	2026-02-12 15:07:01.99
22	42	Arsenal	https://media.api-sports.io/football/teams/42.png	2	74	38	20	14	4	69	34	35	WWDLD	2024	2026-02-12 15:07:02.002
23	50	Manchester City	https://media.api-sports.io/football/teams/50.png	3	71	38	21	8	9	72	44	28	WWDWW	2024	2026-02-12 15:07:02.081
27	65	Nottingham Forest	https://media.api-sports.io/football/teams/65.png	7	65	38	19	8	11	58	46	12	LWDDL	2024	2026-02-12 15:07:02.104
28	51	Brighton	https://media.api-sports.io/football/teams/51.png	8	61	38	16	13	9	66	59	7	WWWDW	2024	2026-02-12 15:07:02.108
29	35	Bournemouth	https://media.api-sports.io/football/teams/35.png	9	56	38	15	11	12	58	46	12	WLLWD	2024	2026-02-12 15:07:02.113
30	55	Brentford	https://media.api-sports.io/football/teams/55.png	10	56	38	16	8	14	66	57	9	DLWWW	2024	2026-02-12 15:07:02.118
31	36	Fulham	https://media.api-sports.io/football/teams/36.png	11	54	38	15	9	14	54	54	0	LWLLW	2024	2026-02-12 15:07:02.122
32	52	Crystal Palace	https://media.api-sports.io/football/teams/52.png	12	53	38	13	14	11	51	51	0	DWWDD	2024	2026-02-12 15:07:02.126
33	45	Everton	https://media.api-sports.io/football/teams/45.png	13	48	38	11	15	12	42	44	-2	WWWDL	2024	2026-02-12 15:07:02.13
34	48	West Ham	https://media.api-sports.io/football/teams/48.png	14	43	38	11	10	17	46	62	-16	WLWDL	2024	2026-02-12 15:07:02.138
35	33	Manchester United	https://media.api-sports.io/football/teams/33.png	15	42	38	11	9	18	44	54	-10	WLLLD	2024	2026-02-12 15:07:02.147
36	39	Wolves	https://media.api-sports.io/football/teams/39.png	16	42	38	12	6	20	54	69	-15	DLLLW	2024	2026-02-12 15:07:02.151
37	47	Tottenham	https://media.api-sports.io/football/teams/47.png	17	38	38	11	5	22	64	65	-1	LLLDL	2024	2026-02-12 15:07:02.155
38	46	Leicester	https://media.api-sports.io/football/teams/46.png	18	25	38	6	7	25	33	80	-47	LWDWL	2024	2026-02-12 15:07:02.16
39	57	Ipswich	https://media.api-sports.io/football/teams/57.png	19	22	38	4	10	24	36	82	-46	LLLDL	2024	2026-02-12 15:07:02.164
40	41	Southampton	https://media.api-sports.io/football/teams/41.png	20	12	38	2	6	30	26	86	-60	LLDLL	2024	2026-02-12 15:07:02.171
\.


--
-- Data for Name: epl_sync_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epl_sync_log (id, endpoint, synced_at, record_count) FROM stdin;
6	standings	2026-02-12 08:44:15.967471	20
7	fixtures	2026-02-12 08:44:20.135938	380
8	players_page_1	2026-02-12 08:44:20.318088	20
9	players_page_2	2026-02-12 08:44:20.575174	20
10	injuries	2026-02-12 08:44:29.180059	3168
11	fixtures	2026-02-12 13:00:11.883292	380
12	standings	2026-02-12 15:07:02.176783	20
\.


--
-- Data for Name: lineups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lineups (id, user_id, card_ids, captain_id) FROM stdin;
1	54644807	[19, 18, 17, 16, 15]	19
\.


--
-- Data for Name: player_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.player_cards (id, player_id, owner_id, rarity, level, xp, last_5_scores, for_sale, price, acquired_at, serial_id, serial_number, max_supply, decisive_score) FROM stdin;
10	5	\N	rare	1	100	[52, 60, 65, 55, 62]	t	25	2026-02-12 07:20:45.292778	BSX-001	1	100	35
11	12	\N	common	1	0	[60, 30, 88, 12, 12]	f	0	2026-02-12 07:22:57.857752	RXX-002	2	0	35
12	24	\N	common	1	0	[36, 27, 14, 19, 12]	f	0	2026-02-12 07:22:57.865459	MNX-001	1	0	35
13	16	\N	common	1	0	[59, 85, 14, 33, 83]	f	0	2026-02-12 07:22:57.870773	LYX-001	1	0	35
14	15	\N	common	1	0	[55, 43, 88, 35, 40]	f	0	2026-02-12 07:22:57.874728	KMX-002	2	0	35
15	19	54644807	common	1	0	[66, 30, 16, 89, 32]	f	0	2026-02-12 07:22:57.878309	TCX-001	1	0	35
16	4	54644807	common	1	0	[10, 37, 52, 80, 59]	f	0	2026-02-12 07:22:57.882541	ABX-001	1	0	35
17	3	54644807	common	1	0	[86, 28, 47, 61, 77]	f	0	2026-02-12 07:22:57.887715	VVD-001	1	0	35
18	13	54644807	common	1	0	[45, 35, 27, 13, 37]	f	0	2026-02-12 07:22:57.89127	JBX-002	2	0	35
19	7	54644807	common	1	0	[44, 62, 14, 21, 38]	f	0	2026-02-12 07:22:57.895552	EHX-002	2	0	35
1	15	\N	legendary	5	500	[88, 92, 75, 95, 90]	t	250	2026-02-12 07:20:45.205836	KMX-001	1	5	35
2	7	\N	legendary	4	400	[85, 90, 78, 88, 92]	t	200	2026-02-12 07:20:45.222905	EHX-001	1	5	35
3	6	\N	unique	3	300	[72, 80, 85, 68, 77]	t	120	2026-02-12 07:20:45.244937	KDB-001	1	1	35
4	13	\N	unique	3	300	[65, 78, 82, 70, 85]	t	100	2026-02-12 07:20:45.249977	JBX-001	1	1	35
5	14	\N	unique	2	200	[70, 75, 60, 88, 72]	t	90	2026-02-12 07:20:45.252506	VJX-001	1	1	35
6	8	\N	rare	2	200	[60, 72, 55, 80, 65]	t	45	2026-02-12 07:20:45.259685	MSX-001	1	100	35
7	2	\N	rare	2	200	[55, 68, 72, 60, 58]	t	35	2026-02-12 07:20:45.269552	BFX-001	1	100	35
8	12	\N	rare	1	100	[50, 62, 58, 70, 55]	t	30	2026-02-12 07:20:45.276164	RXX-001	1	100	35
9	22	\N	rare	1	100	[58, 65, 48, 72, 60]	t	28	2026-02-12 07:20:45.284509	HKX-001	1	100	35
\.


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.players (id, name, team, league, "position", nationality, age, overall, image_url) FROM stdin;
1	Marcus Rashford	Manchester United	Premier League	FWD	England	27	84	/images/player-1.png
2	Bruno Fernandes	Manchester United	Premier League	MID	Portugal	30	88	/images/player-2.png
3	Virgil van Dijk	Liverpool	Premier League	DEF	Netherlands	33	89	/images/player-3.png
4	Alisson Becker	Liverpool	Premier League	GK	Brazil	31	89	/images/player-4.png
5	Bukayo Saka	Arsenal	Premier League	FWD	England	23	87	/images/player-5.png
6	Kevin De Bruyne	Manchester City	Premier League	MID	Belgium	33	91	/images/player-6.png
7	Erling Haaland	Manchester City	Premier League	FWD	Norway	24	91	/images/player-1.png
8	Mohamed Salah	Liverpool	Premier League	FWD	Egypt	32	89	/images/player-5.png
9	Phil Foden	Manchester City	Premier League	MID	England	24	87	/images/player-2.png
10	Declan Rice	Arsenal	Premier League	MID	England	26	86	/images/player-6.png
11	William Saliba	Arsenal	Premier League	DEF	France	24	86	/images/player-3.png
12	Rodri	Manchester City	Premier League	MID	Spain	28	90	/images/player-6.png
13	Jude Bellingham	Real Madrid	La Liga	MID	England	21	89	/images/player-2.png
14	Vinicius Jr	Real Madrid	La Liga	FWD	Brazil	24	90	/images/player-5.png
15	Kylian Mbappe	Real Madrid	La Liga	FWD	France	26	92	/images/player-1.png
16	Lamine Yamal	Barcelona	La Liga	FWD	Spain	17	83	/images/player-5.png
17	Pedri	Barcelona	La Liga	MID	Spain	22	87	/images/player-6.png
18	Robert Lewandowski	Barcelona	La Liga	FWD	Poland	36	88	/images/player-1.png
19	Thibaut Courtois	Real Madrid	La Liga	GK	Belgium	32	89	/images/player-4.png
20	Antonio Rudiger	Real Madrid	La Liga	DEF	Germany	31	85	/images/player-3.png
21	Florian Wirtz	Bayer Leverkusen	Bundesliga	MID	Germany	21	87	/images/player-2.png
22	Harry Kane	Bayern Munich	Bundesliga	FWD	England	31	90	/images/player-1.png
23	Jamal Musiala	Bayern Munich	Bundesliga	MID	Germany	21	86	/images/player-6.png
24	Manuel Neuer	Bayern Munich	Bundesliga	GK	Germany	38	86	/images/player-4.png
25	Lautaro Martinez	Inter Milan	Serie A	FWD	Argentina	27	88	/images/player-1.png
26	Hakan Calhanoglu	Inter Milan	Serie A	MID	Turkey	30	85	/images/player-2.png
27	Alessandro Bastoni	Inter Milan	Serie A	DEF	Italy	25	86	/images/player-3.png
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
MX9VaH3FIFLEZXeamDuh9n9psnKCOV3r	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-20T12:48:02.371Z", "httpOnly": true, "originalMaxAge": 604800000}, "passport": {"user": {"claims": {"aud": "3ba0ced3-434b-438c-b89d-9cd8f0b57381", "exp": 1770990482, "iat": 1770986882, "iss": "https://replit.com/oidc", "sub": "54644807", "email": "zjondreangermund@gmail.com", "at_hash": "7KSNBFV8-Nj_76-7XVprJQ", "username": "zjondre", "auth_time": 1770880973, "last_name": "Angermund", "first_name": "Zjondre", "email_verified": true}, "expires_at": 1770990482, "access_token": "o5TNU2n7iph6OTPnxPJEdUhXk7LTm_5RHN9AGiZ9e0n", "refresh_token": "KFehCrqgiVAebMC3GYY2x1x0oRz0l9w7McJKnfDyDMI"}}}	2026-02-20 13:19:36
\.


--
-- Data for Name: swap_offers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.swap_offers (id, offerer_user_id, receiver_user_id, offered_card_id, requested_card_id, top_up_amount, top_up_direction, status, created_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, user_id, type, amount, description, created_at, payment_method, external_transaction_id) FROM stdin;
1	54644807	deposit	100	Welcome bonus - $100 starter funds	2026-02-12 07:23:17.019351	\N	\N
2	54644807	deposit	92	Deposited N$100.00 via EFT (N$8.00 fee)	2026-02-12 14:15:50.6058	eft	\N
\.


--
-- Data for Name: user_onboarding; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_onboarding (id, user_id, completed, pack_cards, selected_cards) FROM stdin;
1	54644807	t	[[11, 12, 13], [14, 15, 16], [17, 18, 19]]	[19, 18, 17, 16, 15]
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, first_name, last_name, profile_image_url, created_at, updated_at) FROM stdin;
54644807	zjondreangermund@gmail.com	Zjondre	Angermund	\N	2026-02-12 07:22:53.883549	2026-02-12 07:22:53.883549
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, user_id, balance, locked_balance) FROM stdin;
1	54644807	192	0
\.


--
-- Data for Name: withdrawal_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.withdrawal_requests (id, user_id, amount, fee, net_amount, payment_method, bank_name, account_holder, account_number, iban, swift_code, ewallet_provider, ewallet_id, status, admin_notes, reviewed_at, created_at) FROM stdin;
\.


--
-- Name: competition_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competition_entries_id_seq', 1, true);


--
-- Name: competitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competitions_id_seq', 4, true);


--
-- Name: epl_fixtures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.epl_fixtures_id_seq', 1140, true);


--
-- Name: epl_injuries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.epl_injuries_id_seq', 6336, true);


--
-- Name: epl_players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.epl_players_id_seq', 80, true);


--
-- Name: epl_standings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.epl_standings_id_seq', 64, true);


--
-- Name: epl_sync_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.epl_sync_log_id_seq', 12, true);


--
-- Name: lineups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lineups_id_seq', 1, true);


--
-- Name: player_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.player_cards_id_seq', 19, true);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.players_id_seq', 27, true);


--
-- Name: swap_offers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.swap_offers_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transactions_id_seq', 2, true);


--
-- Name: user_onboarding_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_onboarding_id_seq', 1, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.wallets_id_seq', 1, true);


--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.withdrawal_requests_id_seq', 1, false);


--
-- Name: competition_entries competition_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_entries
    ADD CONSTRAINT competition_entries_pkey PRIMARY KEY (id);


--
-- Name: competitions competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_pkey PRIMARY KEY (id);


--
-- Name: epl_fixtures epl_fixtures_api_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_fixtures
    ADD CONSTRAINT epl_fixtures_api_id_unique UNIQUE (api_id);


--
-- Name: epl_fixtures epl_fixtures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_fixtures
    ADD CONSTRAINT epl_fixtures_pkey PRIMARY KEY (id);


--
-- Name: epl_injuries epl_injuries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_injuries
    ADD CONSTRAINT epl_injuries_pkey PRIMARY KEY (id);


--
-- Name: epl_players epl_players_api_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_players
    ADD CONSTRAINT epl_players_api_id_unique UNIQUE (api_id);


--
-- Name: epl_players epl_players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_players
    ADD CONSTRAINT epl_players_pkey PRIMARY KEY (id);


--
-- Name: epl_standings epl_standings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_standings
    ADD CONSTRAINT epl_standings_pkey PRIMARY KEY (id);


--
-- Name: epl_standings epl_standings_team_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_standings
    ADD CONSTRAINT epl_standings_team_id_unique UNIQUE (team_id);


--
-- Name: epl_sync_log epl_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epl_sync_log
    ADD CONSTRAINT epl_sync_log_pkey PRIMARY KEY (id);


--
-- Name: lineups lineups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lineups
    ADD CONSTRAINT lineups_pkey PRIMARY KEY (id);


--
-- Name: lineups lineups_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lineups
    ADD CONSTRAINT lineups_user_id_unique UNIQUE (user_id);


--
-- Name: player_cards player_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_pkey PRIMARY KEY (id);


--
-- Name: player_cards player_cards_serial_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_serial_id_unique UNIQUE (serial_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: swap_offers swap_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_offers
    ADD CONSTRAINT swap_offers_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding user_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding user_onboarding_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_user_id_unique UNIQUE (user_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: competition_entries competition_entries_competition_id_competitions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_entries
    ADD CONSTRAINT competition_entries_competition_id_competitions_id_fk FOREIGN KEY (competition_id) REFERENCES public.competitions(id);


--
-- Name: competition_entries competition_entries_prize_card_id_player_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_entries
    ADD CONSTRAINT competition_entries_prize_card_id_player_cards_id_fk FOREIGN KEY (prize_card_id) REFERENCES public.player_cards(id);


--
-- Name: competition_entries competition_entries_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_entries
    ADD CONSTRAINT competition_entries_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lineups lineups_captain_id_player_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lineups
    ADD CONSTRAINT lineups_captain_id_player_cards_id_fk FOREIGN KEY (captain_id) REFERENCES public.player_cards(id);


--
-- Name: lineups lineups_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lineups
    ADD CONSTRAINT lineups_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: player_cards player_cards_owner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: player_cards player_cards_player_id_players_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_cards
    ADD CONSTRAINT player_cards_player_id_players_id_fk FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: swap_offers swap_offers_offered_card_id_player_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_offers
    ADD CONSTRAINT swap_offers_offered_card_id_player_cards_id_fk FOREIGN KEY (offered_card_id) REFERENCES public.player_cards(id);


--
-- Name: swap_offers swap_offers_offerer_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_offers
    ADD CONSTRAINT swap_offers_offerer_user_id_users_id_fk FOREIGN KEY (offerer_user_id) REFERENCES public.users(id);


--
-- Name: swap_offers swap_offers_receiver_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_offers
    ADD CONSTRAINT swap_offers_receiver_user_id_users_id_fk FOREIGN KEY (receiver_user_id) REFERENCES public.users(id);


--
-- Name: swap_offers swap_offers_requested_card_id_player_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_offers
    ADD CONSTRAINT swap_offers_requested_card_id_player_cards_id_fk FOREIGN KEY (requested_card_id) REFERENCES public.player_cards(id);


--
-- Name: transactions transactions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_onboarding user_onboarding_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: wallets wallets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: withdrawal_requests withdrawal_requests_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict gr9feHcAXtWNK80W7Ik5qeyYLjt9hZSdb3jE5GrBRO3d0iBF7jU0snig1hJd8K1

