--
-- PostgreSQL database dump
--

\restrict rWBTRDLXhAbRxrFsySB6ef7MO9oneReWwl07IHlSreacHhxtkvQNOu8rioRhJbA

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
-- Data for Name: competitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.competitions OVERRIDING SYSTEM VALUE VALUES (1, 'Common Cup - GW1', 'common', 0, 'open', 1, '2026-02-12 08:13:18.304', '2026-02-15 23:59:59.999', 'rare', '2026-02-12 08:13:18.30697');
INSERT INTO public.competitions OVERRIDING SYSTEM VALUE VALUES (2, 'Rare Championship - GW1', 'rare', 20, 'open', 1, '2026-02-12 08:13:18.304', '2026-02-15 23:59:59.999', 'unique', '2026-02-12 08:13:18.312328');
INSERT INTO public.competitions OVERRIDING SYSTEM VALUE VALUES (3, 'Common Cup - GW2', 'common', 0, 'open', 2, '2026-02-15 23:59:59.999', '2026-02-22 23:59:59.999', 'rare', '2026-02-12 08:13:18.317043');
INSERT INTO public.competitions OVERRIDING SYSTEM VALUE VALUES (4, 'Rare Championship - GW2', 'rare', 20, 'open', 2, '2026-02-15 23:59:59.999', '2026-02-22 23:59:59.999', 'unique', '2026-02-12 08:13:18.320821');


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (1, 'Marcus Rashford', 'Manchester United', 'Premier League', 'FWD', 'England', 27, 84, '/images/player-1.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (2, 'Bruno Fernandes', 'Manchester United', 'Premier League', 'MID', 'Portugal', 30, 88, '/images/player-2.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (3, 'Virgil van Dijk', 'Liverpool', 'Premier League', 'DEF', 'Netherlands', 33, 89, '/images/player-3.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (4, 'Alisson Becker', 'Liverpool', 'Premier League', 'GK', 'Brazil', 31, 89, '/images/player-4.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (5, 'Bukayo Saka', 'Arsenal', 'Premier League', 'FWD', 'England', 23, 87, '/images/player-5.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (6, 'Kevin De Bruyne', 'Manchester City', 'Premier League', 'MID', 'Belgium', 33, 91, '/images/player-6.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (7, 'Erling Haaland', 'Manchester City', 'Premier League', 'FWD', 'Norway', 24, 91, '/images/player-1.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (8, 'Mohamed Salah', 'Liverpool', 'Premier League', 'FWD', 'Egypt', 32, 89, '/images/player-5.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (9, 'Phil Foden', 'Manchester City', 'Premier League', 'MID', 'England', 24, 87, '/images/player-2.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (10, 'Declan Rice', 'Arsenal', 'Premier League', 'MID', 'England', 26, 86, '/images/player-6.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (11, 'William Saliba', 'Arsenal', 'Premier League', 'DEF', 'France', 24, 86, '/images/player-3.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (12, 'Rodri', 'Manchester City', 'Premier League', 'MID', 'Spain', 28, 90, '/images/player-6.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (13, 'Jude Bellingham', 'Real Madrid', 'La Liga', 'MID', 'England', 21, 89, '/images/player-2.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (14, 'Vinicius Jr', 'Real Madrid', 'La Liga', 'FWD', 'Brazil', 24, 90, '/images/player-5.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (15, 'Kylian Mbappe', 'Real Madrid', 'La Liga', 'FWD', 'France', 26, 92, '/images/player-1.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (16, 'Lamine Yamal', 'Barcelona', 'La Liga', 'FWD', 'Spain', 17, 83, '/images/player-5.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (17, 'Pedri', 'Barcelona', 'La Liga', 'MID', 'Spain', 22, 87, '/images/player-6.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (18, 'Robert Lewandowski', 'Barcelona', 'La Liga', 'FWD', 'Poland', 36, 88, '/images/player-1.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (19, 'Thibaut Courtois', 'Real Madrid', 'La Liga', 'GK', 'Belgium', 32, 89, '/images/player-4.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (20, 'Antonio Rudiger', 'Real Madrid', 'La Liga', 'DEF', 'Germany', 31, 85, '/images/player-3.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (21, 'Florian Wirtz', 'Bayer Leverkusen', 'Bundesliga', 'MID', 'Germany', 21, 87, '/images/player-2.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (22, 'Harry Kane', 'Bayern Munich', 'Bundesliga', 'FWD', 'England', 31, 90, '/images/player-1.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (23, 'Jamal Musiala', 'Bayern Munich', 'Bundesliga', 'MID', 'Germany', 21, 86, '/images/player-6.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (24, 'Manuel Neuer', 'Bayern Munich', 'Bundesliga', 'GK', 'Germany', 38, 86, '/images/player-4.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (25, 'Lautaro Martinez', 'Inter Milan', 'Serie A', 'FWD', 'Argentina', 27, 88, '/images/player-1.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (26, 'Hakan Calhanoglu', 'Inter Milan', 'Serie A', 'MID', 'Turkey', 30, 85, '/images/player-2.png');
INSERT INTO public.players OVERRIDING SYSTEM VALUE VALUES (27, 'Alessandro Bastoni', 'Inter Milan', 'Serie A', 'DEF', 'Italy', 25, 86, '/images/player-3.png');


--
-- Name: competitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competitions_id_seq', 4, true);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.players_id_seq', 27, true);


--
-- PostgreSQL database dump complete
--

\unrestrict rWBTRDLXhAbRxrFsySB6ef7MO9oneReWwl07IHlSreacHhxtkvQNOu8rioRhJbA

