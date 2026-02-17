--
-- PostgreSQL database dump
--

\restrict eWBjVQLhVRtgJRM2fYnDFjvliu75WCv6m444KQQjdp9KdxrxQOge7RyqTo77VOa

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
-- Data for Name: player_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (10, 5, NULL, 'rare', 1, 100, '[52, 60, 65, 55, 62]', true, 25, '2026-02-12 07:20:45.292778', 'BSX-001', 1, 100, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (11, 12, NULL, 'common', 1, 0, '[60, 30, 88, 12, 12]', false, 0, '2026-02-12 07:22:57.857752', 'RXX-002', 2, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (12, 24, NULL, 'common', 1, 0, '[36, 27, 14, 19, 12]', false, 0, '2026-02-12 07:22:57.865459', 'MNX-001', 1, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (13, 16, NULL, 'common', 1, 0, '[59, 85, 14, 33, 83]', false, 0, '2026-02-12 07:22:57.870773', 'LYX-001', 1, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (14, 15, NULL, 'common', 1, 0, '[55, 43, 88, 35, 40]', false, 0, '2026-02-12 07:22:57.874728', 'KMX-002', 2, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (15, 19, '54644807', 'common', 1, 0, '[66, 30, 16, 89, 32]', false, 0, '2026-02-12 07:22:57.878309', 'TCX-001', 1, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (16, 4, '54644807', 'common', 1, 0, '[10, 37, 52, 80, 59]', false, 0, '2026-02-12 07:22:57.882541', 'ABX-001', 1, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (17, 3, '54644807', 'common', 1, 0, '[86, 28, 47, 61, 77]', false, 0, '2026-02-12 07:22:57.887715', 'VVD-001', 1, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (18, 13, '54644807', 'common', 1, 0, '[45, 35, 27, 13, 37]', false, 0, '2026-02-12 07:22:57.89127', 'JBX-002', 2, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (19, 7, '54644807', 'common', 1, 0, '[44, 62, 14, 21, 38]', false, 0, '2026-02-12 07:22:57.895552', 'EHX-002', 2, 0, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (1, 15, NULL, 'legendary', 5, 500, '[88, 92, 75, 95, 90]', true, 250, '2026-02-12 07:20:45.205836', 'KMX-001', 1, 5, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (2, 7, NULL, 'legendary', 4, 400, '[85, 90, 78, 88, 92]', true, 200, '2026-02-12 07:20:45.222905', 'EHX-001', 1, 5, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (3, 6, NULL, 'unique', 3, 300, '[72, 80, 85, 68, 77]', true, 120, '2026-02-12 07:20:45.244937', 'KDB-001', 1, 1, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (4, 13, NULL, 'unique', 3, 300, '[65, 78, 82, 70, 85]', true, 100, '2026-02-12 07:20:45.249977', 'JBX-001', 1, 1, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (5, 14, NULL, 'unique', 2, 200, '[70, 75, 60, 88, 72]', true, 90, '2026-02-12 07:20:45.252506', 'VJX-001', 1, 1, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (6, 8, NULL, 'rare', 2, 200, '[60, 72, 55, 80, 65]', true, 45, '2026-02-12 07:20:45.259685', 'MSX-001', 1, 100, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (7, 2, NULL, 'rare', 2, 200, '[55, 68, 72, 60, 58]', true, 35, '2026-02-12 07:20:45.269552', 'BFX-001', 1, 100, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (8, 12, NULL, 'rare', 1, 100, '[50, 62, 58, 70, 55]', true, 30, '2026-02-12 07:20:45.276164', 'RXX-001', 1, 100, 35);
INSERT INTO public.player_cards OVERRIDING SYSTEM VALUE VALUES (9, 22, NULL, 'rare', 1, 100, '[58, 65, 48, 72, 60]', true, 28, '2026-02-12 07:20:45.284509', 'HKX-001', 1, 100, 35);


--
-- Name: player_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.player_cards_id_seq', 19, true);


--
-- PostgreSQL database dump complete
--

\unrestrict eWBjVQLhVRtgJRM2fYnDFjvliu75WCv6m444KQQjdp9KdxrxQOge7RyqTo77VOa

