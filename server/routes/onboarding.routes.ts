import type { Express, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { buildFplPlayerIndex, fplPlayerFullName, fplPlayerPosition, strongPlayerNameMatch } from "../services/fplPlayerIdentity.js";
import { ensureRealLifeLoanPolicySchema } from "../services/realLifeLoanMonitoring.js";
import { db } from "../db.js";
import { auditLogs, playerCards, userOnboarding } from "../../shared/schema.js";

interface RegisterOnboardingRoutesDeps {
  requireAuth: any;
  storage: any;
  fplApi: any;
  getOnboardingConfig?: () => {
    signupPacksEnabled: boolean;
    requireTeamName: boolean;
    teamNameMinLength: number;
    onboardingEntryPath: string;
    starterChecklistLabel: string;
    packLabels: string[];
  };
}

type CommunityChatMessage = {
  id: number;
  userId: string;
  teamName: string;
  avatarUrl: string | null;
  message: string;
  createdAt: string;
  isOwn?: boolean;
};

const communityChatClients = new Set<Response>();
const lastCommunityChatPostAt = new Map<string, number>();
let communityChatSchemaPromise: Promise<void> | null = null;

function rowsOf(result: any): any[] {
  if (Array.isArray(result?.rows)) return result.rows;
  return Array.isArray(result) ? result : [];
}

function normalizeManagerTeamName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 30);
}

function normalizeManagerTeamNameKey(value: unknown) {
  return normalizeManagerTeamName(value).toLocaleLowerCase("en");
}

function sanitizeCommunityMessage(value: unknown) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function toCommunityChatMessage(row: any, currentUserId?: string): CommunityChatMessage {
  const userId = String(row?.userId ?? row?.user_id ?? "");
  const createdAtValue = row?.createdAt ?? row?.created_at ?? new Date();
  const createdAt = createdAtValue instanceof Date ? createdAtValue.toISOString() : String(createdAtValue);
  return {
    id: Number(row?.id || 0),
    userId,
    teamName: String(row?.teamName ?? row?.team_name ?? "Arena Manager"),
    avatarUrl: row?.avatarUrl ?? row?.avatar_url ?? null,
    message: String(row?.message || ""),
    createdAt,
    ...(currentUserId ? { isOwn: userId === currentUserId } : {}),
  };
}

function broadcastCommunityChatMessage(message: CommunityChatMessage) {
  const payload = `event: community-message\ndata: ${JSON.stringify(message)}\n\n`;
  for (const client of communityChatClients) {
    try {
      client.write(payload);
    } catch {
      communityChatClients.delete(client);
    }
  }
}

function ensureCommunityChatSchema() {
  if (!communityChatSchemaPromise) {
    communityChatSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.community_chat_messages (
          id bigserial PRIMARY KEY,
          user_id varchar(255) NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
          message text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS community_chat_messages_created_at_idx
        ON app.community_chat_messages (created_at DESC, id DESC)
      `);
    })().catch((error) => {
      communityChatSchemaPromise = null;
      throw error;
    });
  }
  return communityChatSchemaPromise;
}

async function ensureUniqueTeamNameIndex() {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_manager_team_name_unique_ci
    ON app.users (lower(regexp_replace(btrim(manager_team_name), '[[:space:]]+', ' ', 'g')))
    WHERE manager_team_name IS NOT NULL AND btrim(manager_team_name) <> ''
  `);
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizePackPosition(pos: string) {
  const p = (pos || "").toLowerCase().trim();
  if (p === "gk") return "GK";
  if (p === "def") return "DEF";
  if (p === "mid") return "MID";
  if (p === "fwd") return "FWD";
  if (p.includes("goal")) return "GK";
  if (p.includes("def")) return "DEF";
  if (p.includes("mid")) return "MID";
  if (p.includes("for") || p.includes("strik") || p.includes("att")) return "FWD";
  return "MID";
}

export function registerOnboardingRoutes(app: Express, deps: RegisterOnboardingRoutesDeps) {
  const { requireAuth, storage, fplApi } = deps;
  const getOnboardingConfig = () =>
    deps.getOnboardingConfig?.() ?? {
      signupPacksEnabled: true,
      requireTeamName: true,
      teamNameMinLength: 3,
      onboardingEntryPath: "/onboarding",
      starterChecklistLabel: "Choose starter players",
      packLabels: ["Goalkeepers", "Defenders", "Midfielders", "Forwards", "Wildcards"],
    };

  void ensureCommunityChatSchema().catch((error) => console.warn("Community chat schema ensure failed:", error));
  void ensureUniqueTeamNameIndex().catch((error) => console.warn("Team-name unique index ensure failed; route-level uniqueness remains active:", error));

  // STARTER_CURRENT_PL_ELIGIBILITY_V1: stale FPL rows must not override
  // confirmed departures or real-life loans outside the Premier League.
  const loadStarterEligibility = async () => {
    const bootstrap = await fplApi.bootstrap();
    if (!Array.isArray(bootstrap?.elements) || bootstrap.elements.length < 300 || bootstrap?.teams?.length < 18) {
      throw new Error("Current Premier League roster is unavailable. Please try again shortly.");
    }
    await ensureRealLifeLoanPolicySchema();
    const now = new Date();
    const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    const [departures, loans] = await Promise.all([
      db.execute(sql`
        with pl_teams as (
          select home_team_id as id from app.api_football_fixtures where league_id=39 and season=${season}
          union select away_team_id from app.api_football_fixtures where league_id=39 and season=${season}
        ), latest as (
          select distinct on (api_player_id) api_player_id, player_name, from_team_id, to_team_id
          from app.api_football_transfers where transfer_date >= make_date(${season}, 6, 1)
          order by api_player_id, transfer_date desc, updated_at desc
        )
        select latest.player_name as name from latest
        join pl_teams source on source.id=latest.from_team_id
        left join pl_teams destination on destination.id=latest.to_team_id
        where destination.id is null
      `),
      db.execute(sql`select p.id, p.fpl_id as "fplId", p.code, p.name, p.team, p.position
        from app.players p join app.real_life_player_loans l on l.app_player_id=p.id
        where l.active=true`),
    ]);
    const index = buildFplPlayerIndex(bootstrap);
    const loanElements = new Set(rowsOf(loans).map((player: any) => Number(index.resolve(player)?.id || 0)));
    const teams = new Map<number, any>(bootstrap.teams.map((team: any) => [Number(team.id), team]));
    const eligibleElement = (element: any) => {
      if (!element || !teams.has(Number(element.team)) || String(element.status || "").toLowerCase() === "u") return false;
      if (loanElements.has(Number(element.id))) return false;
      const identity = { name: fplPlayerFullName(element), webName: element.web_name,
        team: teams.get(Number(element.team))?.name, position: fplPlayerPosition(element) };
      return !rowsOf(departures).some((departure: any) => strongPlayerNameMatch(identity.name, departure.name));
    };
    const eligiblePlayer = (player: any) => {
      if (!player) return false;
      if (rowsOf(loans).some((loan: any) => Number(loan.id) === Number(player.id))) return false;
      return eligibleElement(index.resolve(player));
    };
    return { eligibleElement, eligiblePlayer };
  };

  const validStarterOffer = async (ob: any) => {
    if (ob?.completed) return true;
    if (ob?.packCards?.length !== 5 || ob.packCards.some((pack: any) => !Array.isArray(pack) || pack.length !== 3)) return false;
    const eligibility = await loadStarterEligibility();
    const players = await Promise.all(ob.packCards.flat().map((id: number) => storage.getPlayer(id)));
    return players.every(eligibility.eligiblePlayer);
  };

  const getOnboardingPlayerPool = async () => {
    // FAIR_STARTER_DRAFT_V1
    // Draw Starter Draft offers from the complete CURRENT Premier League/FPL
    // player list before touching the local player table. This avoids the old
    // starts/minutes/top-120 and matchday-team bias that made the same popular
    // players appear disproportionately often for new signups.
    const [fplPlayers, bootstrap] = await Promise.all([
      fplApi.getPlayers(),
      fplApi.bootstrap(),
    ]);

    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const teamMap = new Map<number, any>(teams.map((t: any) => [Number(t.id), t] as [number, any]));
    const currentTeamIds = new Set<number>(teams.map((team: any) => Number(team.id)).filter((id: number) => Number.isFinite(id) && id > 0));
    const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

    const eligibility = await loadStarterEligibility();
    const currentPlayers = (Array.isArray(fplPlayers) ? fplPlayers : []).filter((player: any) => {
      const teamId = Number(player?.team);
      const elementType = Number(player?.element_type);
      return currentTeamIds.has(teamId) && Boolean(positionMap[elementType]) && eligibility.eligibleElement(player);
    });

    const byPosition = {
      GK: currentPlayers.filter((player: any) => Number(player.element_type) === 1),
      DEF: currentPlayers.filter((player: any) => Number(player.element_type) === 2),
      MID: currentPlayers.filter((player: any) => Number(player.element_type) === 3),
      FWD: currentPlayers.filter((player: any) => Number(player.element_type) === 4),
    };

    if (byPosition.GK.length < 3 || byPosition.DEF.length < 3 || byPosition.MID.length < 3 || byPosition.FWD.length < 3) {
      console.warn("Starter Draft cannot build a full offer from the current Premier League player list", {
        gk: byPosition.GK.length,
        def: byPosition.DEF.length,
        mid: byPosition.MID.length,
        fwd: byPosition.FWD.length,
      });
      return [];
    }

    // Every current player in the relevant position pool has the same chance
    // of being drawn. Choose the four required rows first, then draw three
    // wildcards from every remaining current Premier League player.
    const requiredPlayers = [
      ...shuffle(byPosition.GK).slice(0, 3),
      ...shuffle(byPosition.DEF).slice(0, 3),
      ...shuffle(byPosition.MID).slice(0, 3),
      ...shuffle(byPosition.FWD).slice(0, 3),
    ];
    const usedFplIds = new Set<number>(requiredPlayers.map((player: any) => Number(player.id)));
    const wildcardPlayers = shuffle(currentPlayers.filter((player: any) => !usedFplIds.has(Number(player.id)))).slice(0, 3);
    const candidates = [...requiredPlayers, ...wildcardPlayers];

    if (candidates.length !== 15) {
      console.warn("Starter Draft did not produce exactly 15 unique current-player candidates", { count: candidates.length });
      return [];
    }

    const existingPlayers = await storage.getPlayers();
    const mapKey = (name: string, team: string, pos: string) => name.toLowerCase() + "::" + team.toLowerCase() + "::" + pos;
    const existingMap = new Map<string, any>();
    existingPlayers.forEach((p: any) => existingMap.set(mapKey(String(p.name), String(p.team), String(p.position)), p));

    const ensurePlayer = async (fplPlayer: any) => {
      const teamName = String(teamMap.get(Number(fplPlayer.team))?.name || "Unknown");
      const position = positionMap[Number(fplPlayer.element_type)] || "MID";
      const fullName = (String(fplPlayer.first_name || "").trim() + " " + String(fplPlayer.second_name || "").trim()).trim() || String(fplPlayer.web_name || "Unknown");
      const key = mapKey(fullName, teamName, position);
      const photoUrl = fplApi.playerPhotoUrl(fplPlayer, 250);
      const fplId = Number(fplPlayer.id || 0) || null;
      const code = Number(fplPlayer.code || 0) || null;
      const photo = String(fplPlayer.photo || "").trim() || null;
      const webName = String(fplPlayer.web_name || "").trim() || null;
      const decorateCurrentPlayer = (player: any) => ({
        ...player,
        name: fullName,
        team: teamName,
        league: "Premier League",
        position,
        fplId,
        code,
        photo,
        webName,
        imageUrl: photoUrl,
        verifiedImageUrl: photoUrl,
        imageCandidates: [photoUrl],
        identityVerified: true,
        identitySource: "fpl",
      });

      const existing = existingMap.get(key);
      if (existing) return decorateCurrentPlayer(existing);

      const overall = Math.max(55, Math.min(95, Math.round(Number(fplPlayer.now_cost || 50) + 30)));
      const created = await storage.createPlayer({
        name: fullName,
        team: teamName,
        league: "Premier League",
        position,
        nationality: "Unknown",
        age: 24,
        overall,
        imageUrl: photoUrl,
        fplId,
        code,
        photo,
        webName,
        status: String(fplPlayer.status || "a"),
        news: String(fplPlayer.news || ""),
        nowCost: Number(fplPlayer.now_cost || 0) / 10,
        selectedByPercent: Number(fplPlayer.selected_by_percent || 0),
        totalPoints: Number(fplPlayer.total_points || 0),
        form: Number(fplPlayer.form || 0),
        syncedAt: new Date(),
      } as any);
      const decorated = decorateCurrentPlayer(created);
      existingMap.set(key, decorated);
      return decorated;
    };

    const result: any[] = [];
    for (const player of candidates) result.push(await ensurePlayer(player));
    return result;
  };

  const buildPackCards = (playersPool: any[]) => {
    const gkPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "GK"));
    const defPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "DEF"));
    const midPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "MID"));
    const fwdPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "FWD"));
    const gk = gkPool.slice(0, 3);
    const def = defPool.slice(0, 3);
    const mid = midPool.slice(0, 3);
    const fwd = fwdPool.slice(0, 3);
    const used = new Set<number>([...gk, ...def, ...mid, ...fwd].map((p: any) => Number(p.id)));
    const wildcard = shuffle(playersPool.filter((p: any) => !used.has(Number(p.id)))).slice(0, 3);
    if (gk.length < 3 || def.length < 3 || mid.length < 3 || fwd.length < 3 || wildcard.length < 3) return null;
    return [gk.map((p: any) => p.id), def.map((p: any) => p.id), mid.map((p: any) => p.id), fwd.map((p: any) => p.id), wildcard.map((p: any) => p.id)];
  };

  // SIGNUP_OFFER_RACE_FIX_V1
  // GET /offers and POST /create-offer used to race during first signup and
  // both attempted INSERTs for the same user. Keep offer creation idempotent:
  // the first valid 5x3 offer wins and every concurrent caller reuses it.
  const persistStarterOffer = async (userId: string, packCards: number[][]) => {
    await db
      .insert(userOnboarding)
      .values({ userId, completed: false, packCards, selectedCards: [] } as any)
      .onConflictDoNothing({ target: userOnboarding.userId });

    let current = await storage.getOnboarding(userId);
    const hasCompleteOffer = Boolean(
      current?.packCards?.length === 5 &&
      current.packCards.every((pack: number[]) => Array.isArray(pack) && pack.length === 3),
    );

    if (!current?.completed && (!hasCompleteOffer || !await validStarterOffer(current))) {
      await storage.updateOnboarding(userId, { packCards, selectedCards: [] } as any);
      current = await storage.getOnboarding(userId);
    }

    if (!current) throw new Error("Starter offer could not be persisted");
    return current;
  };

  const ensureStarterCards = async (tx: any, userId: string, selectedPlayerIds: number[]) => {
    const existingCards = await tx
      .select({ id: playerCards.id, playerId: playerCards.playerId })
      .from(playerCards)
      .where(and(eq(playerCards.ownerId, userId), eq(playerCards.rarity, "common")));
    const existingCommonByPlayerId = new Map<number, number>(
      existingCards.map((card: any) => [Number(card.playerId), Number(card.id)]),
    );

    const granted: number[] = [];
    const skipped: number[] = [];
    const cardIds: number[] = [];

    for (const playerId of selectedPlayerIds) {
      const existingCardId = existingCommonByPlayerId.get(Number(playerId));
      if (existingCardId) {
        skipped.push(Number(playerId));
        cardIds.push(existingCardId);
        continue;
      }

      const [created] = await tx.insert(playerCards).values({
        playerId,
        ownerId: userId,
        rarity: "common",
        level: 1,
        xp: 0,
        decisiveScore: 35,
        forSale: false,
        price: 0,
      } as any).returning({ id: playerCards.id });
      if (!created?.id) throw new Error(`Starter card could not be minted for selected player ${playerId}`);
      existingCommonByPlayerId.set(Number(playerId), Number(created.id));
      granted.push(Number(playerId));
      cardIds.push(Number(created.id));
    }

    return { granted, skipped, cardIds, kept: selectedPlayerIds.length };
  };

  app.patch("/api/user/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const managerTeamName = normalizeManagerTeamName(req.body?.managerTeamName);
      const normalizedTeamNameKey = normalizeManagerTeamNameKey(managerTeamName);
      if (managerTeamName.length < getOnboardingConfig().teamNameMinLength) return res.status(400).json({ message: "Team name is too short" });

      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.createUser({
          id: userId,
          email: req.user?.email || req.user?.claims?.email || "",
          name: req.user?.name || req.user?.claims?.name || "",
          avatarUrl: req.user?.avatarUrl || req.user?.photo || req.user?.claims?.picture || "",
        } as any);
      }

      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${normalizedTeamNameKey}))`);
        const duplicate = rowsOf(await tx.execute(sql`
          SELECT id
          FROM app.users
          WHERE id <> ${userId}
            AND lower(regexp_replace(btrim(manager_team_name), '[[:space:]]+', ' ', 'g')) = ${normalizedTeamNameKey}
          LIMIT 1
        `))[0];
        if (duplicate) {
          const conflict: any = new Error("That team name is already registered");
          conflict.status = 409;
          conflict.code = "TEAM_NAME_TAKEN";
          throw conflict;
        }
        await tx.execute(sql`
          UPDATE app.users
          SET manager_team_name = ${managerTeamName}, updated_at = now()
          WHERE id = ${userId}
        `);
      });

      const updated = await storage.getUser(userId);
      return res.json(updated || { ...user, managerTeamName });
    } catch (error: any) {
      if (error?.status === 409 || error?.code === "TEAM_NAME_TAKEN" || error?.code === "23505") {
        return res.status(409).json({ code: "TEAM_NAME_TAKEN", message: "That team name is already registered. Please choose another name." });
      }
      console.error("Profile update failed:", error);
      return res.status(500).json({ message: error?.message || "Failed to update profile" });
    }
  });

  app.get("/api/community-chat/messages", requireAuth, async (req: any, res) => {
    try {
      await ensureCommunityChatSchema();
      const userId = String(req.authUserId || "");
      const limit = Math.max(10, Math.min(80, Number(req.query?.limit || 50) || 50));
      const before = Math.max(0, Number(req.query?.before || 0) || 0);
      const result = before > 0
        ? await db.execute(sql`
            SELECT m.id, m.user_id AS "userId", m.message, m.created_at AS "createdAt",
              COALESCE(NULLIF(btrim(u.manager_team_name), ''), NULLIF(btrim(u.name), ''), split_part(COALESCE(u.email, ''), '@', 1), 'Arena Manager') AS "teamName",
              u.avatar_url AS "avatarUrl"
            FROM app.community_chat_messages m
            JOIN app.users u ON u.id = m.user_id
            WHERE m.id < ${before}
            ORDER BY m.id DESC
            LIMIT ${limit}
          `)
        : await db.execute(sql`
            SELECT m.id, m.user_id AS "userId", m.message, m.created_at AS "createdAt",
              COALESCE(NULLIF(btrim(u.manager_team_name), ''), NULLIF(btrim(u.name), ''), split_part(COALESCE(u.email, ''), '@', 1), 'Arena Manager') AS "teamName",
              u.avatar_url AS "avatarUrl"
            FROM app.community_chat_messages m
            JOIN app.users u ON u.id = m.user_id
            ORDER BY m.id DESC
            LIMIT ${limit}
          `);
      const messages = rowsOf(result).map((row) => toCommunityChatMessage(row, userId)).reverse();
      res.setHeader("Cache-Control", "private, no-store");
      return res.json({ messages });
    } catch (error: any) {
      console.error("Community chat fetch failed:", error);
      return res.status(500).json({ message: "Failed to load community chat" });
    }
  });

  app.post("/api/community-chat/messages", requireAuth, async (req: any, res) => {
    try {
      await ensureCommunityChatSchema();
      const userId = String(req.authUserId || "");
      const message = sanitizeCommunityMessage(req.body?.message);
      if (!message) return res.status(400).json({ message: "Message cannot be empty" });
      if (message.length > 280) return res.status(400).json({ message: "Message must be 280 characters or fewer" });

      const now = Date.now();
      const lastPostAt = lastCommunityChatPostAt.get(userId) || 0;
      if (now - lastPostAt < 1800) return res.status(429).json({ message: "Please wait before sending another message" });
      lastCommunityChatPostAt.set(userId, now);

      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.createUser({
          id: userId,
          email: req.user?.email || req.user?.claims?.email || "",
          name: req.user?.name || req.user?.claims?.name || "",
          avatarUrl: req.user?.avatarUrl || req.user?.photo || req.user?.claims?.picture || "",
        } as any);
      }

      const inserted = rowsOf(await db.execute(sql`
        INSERT INTO app.community_chat_messages (user_id, message)
        VALUES (${userId}, ${message})
        RETURNING id
      `))[0];
      const messageId = Number(inserted?.id || 0);
      const row = rowsOf(await db.execute(sql`
        SELECT m.id, m.user_id AS "userId", m.message, m.created_at AS "createdAt",
          COALESCE(NULLIF(btrim(u.manager_team_name), ''), NULLIF(btrim(u.name), ''), split_part(COALESCE(u.email, ''), '@', 1), 'Arena Manager') AS "teamName",
          u.avatar_url AS "avatarUrl"
        FROM app.community_chat_messages m
        JOIN app.users u ON u.id = m.user_id
        WHERE m.id = ${messageId}
        LIMIT 1
      `))[0];
      const chatMessage = toCommunityChatMessage(row, userId);
      const { isOwn: _isOwn, ...broadcastMessage } = chatMessage;
      broadcastCommunityChatMessage(broadcastMessage);
      return res.status(201).json({ message: chatMessage });
    } catch (error: any) {
      console.error("Community chat post failed:", error);
      return res.status(500).json({ message: "Failed to send community message" });
    }
  });

  app.get("/api/community-chat/stream", requireAuth, async (_req: any, res: Response) => {
    try {
      await ensureCommunityChatSchema();
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.write("retry: 5000\n\nevent: ready\ndata: {}\n\n");
      communityChatClients.add(res);

      const heartbeat = setInterval(() => {
        try {
          res.write(`event: ping\ndata: ${Date.now()}\n\n`);
        } catch {
          clearInterval(heartbeat);
          communityChatClients.delete(res);
        }
      }, 25000);

      res.on("close", () => {
        clearInterval(heartbeat);
        communityChatClients.delete(res);
      });
    } catch (error) {
      console.error("Community chat stream failed:", error);
      if (!res.headersSent) res.status(500).json({ message: "Failed to connect to community chat" });
    }
  });

  app.get("/api/onboarding/config", requireAuth, async (_req: any, res) => res.json(getOnboardingConfig()));

  app.get("/api/onboarding/status", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) return res.json({ completed: true });
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);
      res.json({ completed: ob?.completed ?? false });
    } catch (error: any) {
      console.error("Onboarding status failed:", error);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  app.post("/api/onboarding/create-offer", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) return res.status(403).json({ message: "Signup starter packs are currently disabled by admin" });
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);
      if (ob?.completed) return res.json({ packCards: ob.packCards || [], completed: true });
      if (await validStarterOffer(ob)) return res.json({ packCards: ob.packCards });

      const allPlayers = await getOnboardingPlayerPool();
      if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
        return res.status(400).json({ message: "Not enough players in database. Seeding may have failed or player table is still empty.", count: allPlayers?.length ?? 0 });
      }
      const packCards = buildPackCards(allPlayers);
      if (!packCards) return res.status(400).json({ message: "Not enough players per position" });

      const persisted = await persistStarterOffer(String(userId), packCards);
      return res.json({ packCards: persisted.packCards || packCards, completed: Boolean(persisted.completed) });
    } catch (error: any) {
      console.error("Onboarding/create-offer failed:", error);
      return res.status(500).json({ message: "Failed to create onboarding packs" });
    }
  });

  app.get("/api/onboarding/offers", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) return res.status(403).json({ message: "Signup starter packs are currently disabled by admin", config });
      const userId = req.authUserId;
      let ob = await storage.getOnboarding(userId);

      if (!await validStarterOffer(ob)) {
        const allPlayers = await getOnboardingPlayerPool();
        if (!Array.isArray(allPlayers) || allPlayers.length < 15) return res.status(404).json({ message: "No offer found. Create offer first." });
        const packCards = buildPackCards(allPlayers);
        if (!packCards) return res.status(404).json({ message: "No offer found. Create offer first." });
        ob = await persistStarterOffer(String(userId), packCards);
      }

      const offeredPlayerIds = ob?.packCards?.flat() || [];
      const offeredPlayers = await Promise.all(offeredPlayerIds.map((id: number | null) => (id ? storage.getPlayer(id) : Promise.resolve(undefined))));
      const players = offeredPlayers.filter(Boolean);
      res.json({ packCards: ob?.packCards || [], offeredPlayerIds, players, selectedCards: ob?.selectedCards ?? [], completed: ob?.completed ?? false, config });
    } catch (error: any) {
      console.error("Fetch offers failed:", error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  app.post("/api/onboarding/choose", requireAuth, async (req: any, res) => {
    try {
      const config = getOnboardingConfig();
      if (!config.signupPacksEnabled) return res.status(403).json({ message: "Signup starter packs are currently disabled by admin" });
      const userId = req.authUserId;
      const selected: number[] = req.body?.selectedPlayerIds ?? [];

      if (!Array.isArray(selected) || selected.length !== 5) return res.status(400).json({ message: "Select exactly 5 cards" });
      if (selected.some((id) => !Number.isSafeInteger(id) || id <= 0)) return res.status(400).json({ message: "Selections must contain valid player IDs" });
      if (new Set(selected).size !== 5) return res.status(400).json({ message: "Duplicate selections not allowed" });

      const eligibility = await loadStarterEligibility();
      const result = await db.transaction(async (tx: any) => {
        // Serialize repeated confirmations and keep the visible selection,
        // minted cards, completion flag, and audit evidence in one transaction.
        const ob = rowsOf(await tx.execute(sql`
          select completed, pack_cards as "packCards", selected_cards as "selectedCards"
          from app.user_onboarding
          where user_id = ${userId}
          for update
        `))[0];

        if (!ob?.packCards?.length) return { error: "No offer exists. Create offer first." };
        if (ob.completed) {
          return { success: true, kept: 5, alreadyCompleted: true, selectedPlayerIds: ob.selectedCards || [] };
        }

        const offeredSet = new Set<number>(ob.packCards.flat().map(Number));
        for (const id of selected) {
          if (!offeredSet.has(id)) return { error: "Selection includes an invalid card" };
        }

        for (const pack of ob.packCards as number[][]) {
          const packPlayerIds = new Set(pack.map(Number));
          const selectedInPack = selected.filter((id) => packPlayerIds.has(id));
          if (selectedInPack.length !== 1) return { error: "Select exactly 1 player from each pack" };
        }

        // Persist the lineup in pack order: GK, DEF, MID, FWD, Utility. The
        // request order is not trusted because Sets and client interactions can
        // otherwise leave a valid selection unusable for tournament entry.
        const orderedSelected = (ob.packCards as number[][]).map((pack) => {
          const packPlayerIds = new Set(pack.map(Number));
          return selected.find((id) => packPlayerIds.has(id))!;
        });

        const selectedPlayers = rowsOf(await tx.execute(sql`
          select id, name, team, position, fpl_id as "fplId", code, web_name as "webName"
          from app.players where id in (${sql.join(orderedSelected.map((id) => sql`${id}`), sql`, `)})
          for share
        `));
        if (selectedPlayers.length !== 5 || !selectedPlayers.every(eligibility.eligiblePlayer)) {
          return { error: "A selected player has left the Premier League. Refresh your starter offer and choose again." };
        }
        const grantResult = await ensureStarterCards(tx, userId, orderedSelected);
        const [updated] = await tx.update(userOnboarding)
          .set({ selectedCards: orderedSelected, completed: true } as any)
          .where(eq(userOnboarding.userId, userId))
          .returning({ userId: userOnboarding.userId });
        if (!updated?.userId) throw new Error("Could not persist the confirmed starter-card selection");

        const lineupCardIds = JSON.stringify(grantResult.cardIds);
        const captainId = grantResult.cardIds[3] || grantResult.cardIds[0];
        await tx.execute(sql`
          INSERT INTO app.lineups (user_id, card_ids, captain_id)
          VALUES (${userId}, ${lineupCardIds}::jsonb, ${captainId})
          ON CONFLICT (user_id) DO UPDATE
            SET card_ids=excluded.card_ids, captain_id=excluded.captain_id
        `);

        await tx.insert(auditLogs).values({
          userId,
          action: "onboarding.starter_selection_confirmed",
          meta: {
            selectedPlayerIds: orderedSelected,
            starterCardIds: grantResult.cardIds,
            mintedPlayerIds: grantResult.granted,
            existingPlayerIds: grantResult.skipped,
            lineupCardIds: grantResult.cardIds,
            lineupOrder: ["GK", "DEF", "MID", "FWD", "UTILITY"],
          },
        } as any);

        return { success: true, ...grantResult, selectedPlayerIds: orderedSelected, kept: 5 };
      });

      if ("error" in result && result.error) return res.status(400).json({ message: result.error });
      return res.json(result);
    } catch (error: any) {
      console.error("Choose cards failed:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });
}
