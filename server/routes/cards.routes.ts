import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { seedDatabase } from "../seed.js";
import { fplApi } from "../services/fplApi.js";
import {
  calculatePlayerScore,
  mapFplStatsToPlayerStats,
} from "../services/scoring.js";
import { db } from "../db.js";
import { auditLogs, transactions } from "../../shared/schema.js";
import { getMarketplaceFloorPrice, isMarketplaceTradableRarity } from "../../shared/card-economy.js";

interface RegisterCardsRoutesDeps {
  requireAuth: any;
  storage: any;
}

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);

function normalizeLookupText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function lastScoresFallback(card: any) {
  const values = Array.isArray(card?.last5Scores) ? card.last5Scores.map((v: any) => Number(v || 0)) : [];
  const padded = [...values];
  while (padded.length < 10) padded.unshift(0);
  return padded.slice(-10).map((points, index) => ({
    gameweek: index + 1,
    opponent: `GW${index + 1}`,
    points,
    minutes: 0,
    goals: 0,
    assists: 0,
    kickoffTime: null,
    wasHome: false,
  }));
}

function safeClientEvent(raw: unknown) {
  return String(raw || "").trim().replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "client_event";
}

async function isAdminUserForAudit(storage: any, req: any) {
  const userId = String(req.authUserId || "");
  if (!userId) return false;
  if (ADMIN_USER_IDS.includes(userId)) return true;
  try {
    const user = await storage.getUser(userId);
    const email = String(user?.email || req.user?.email || req.user?.claims?.email || "").trim().toLowerCase();
    return Boolean(email && ADMIN_EMAILS.includes(email));
  } catch {
    return false;
  }
}

export function registerCardsRoutes(app: Express, deps: RegisterCardsRoutesDeps) {
  const { requireAuth, storage } = deps;

  const ensureStarterPlayersAvailable = async () => {
    let playerCount = 0;
    try {
      playerCount = Number(await storage.getPlayerCount());
    } catch (error) {
      console.warn("Could not read player count before starter grant:", error);
    }
    if (playerCount > 0) return playerCount;
    try {
      console.log("No players available for starter grant. Running seed repair now...");
      await seedDatabase();
      playerCount = Number(await storage.getPlayerCount());
    } catch (error) {
      console.warn("Starter player seed repair failed:", error);
    }
    return playerCount;
  };

  const ensureStarterCards = async (userId: string) => {
    const existing = await storage.getUserCards(userId);
    if (existing.length > 0) return existing;
    const playerCount = await ensureStarterPlayersAvailable();
    if (!playerCount || playerCount <= 0) {
      console.warn(`Starter grant skipped for ${userId}: no players available`);
      return existing;
    }
    let starterPlayers = await storage.getRandomPlayers(12);
    if (!Array.isArray(starterPlayers) || starterPlayers.length === 0) starterPlayers = await storage.getPlayers();
    if (!Array.isArray(starterPlayers) || starterPlayers.length === 0) {
      console.warn(`Starter grant skipped for ${userId}: player query returned empty`);
      return existing;
    }
    let createdCount = 0;
    for (const player of starterPlayers) {
      if (createdCount >= 5) break;
      const playerId = Number(player?.id);
      if (!Number.isFinite(playerId) || playerId <= 0) continue;
      try {
        await storage.createPlayerCard({ playerId, ownerId: userId, rarity: "common", level: 1, xp: 0, decisiveScore: 35, last5Scores: [0, 0, 0, 0, 0], forSale: false, price: 0 } as any);
        createdCount++;
      } catch (error) {
        console.warn(`Starter card grant skipped player ${playerId} for ${userId}:`, error);
      }
    }
    const granted = await storage.getUserCards(userId);
    if (granted.length === 0) console.warn(`Starter grant produced 0 cards for ${userId}; created attempts: ${createdCount}; candidates: ${starterPlayers.length}`);
    else console.log(`Starter grant ready for ${userId}: ${granted.length} cards`);
    return granted;
  };

  const sendUserCards = async (req: any, res: any) => {
    try {
      const userId = req.authUserId;
      const cards = await ensureStarterCards(userId);
      const [bootstrap, liveData] = await Promise.all([fplApi.bootstrap().catch(() => null), fplApi.getLiveGameweek().catch(() => null)]);
      const teams = Array.isArray((bootstrap as any)?.teams) ? (bootstrap as any).teams : [];
      const elements = Array.isArray((bootstrap as any)?.elements) ? (bootstrap as any).elements : [];
      const liveElements = Array.isArray((liveData as any)?.elements) ? (liveData as any).elements : [];
      const teamNameById = new Map<number, string>();
      for (const team of teams) teamNameById.set(Number(team.id), normalizeLookupText(String(team.name || team.short_name || "")));
      const elementByNameTeam = new Map<string, any>();
      const addElementCandidate = (name: string, teamNorm: string, element: any) => {
        const nameNorm = normalizeLookupText(name);
        if (!nameNorm || !teamNorm) return;
        const key = `${nameNorm}::${teamNorm}`;
        if (!elementByNameTeam.has(key)) elementByNameTeam.set(key, element);
      };
      for (const element of elements) {
        const teamNorm = teamNameById.get(Number(element.team)) || "";
        addElementCandidate(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim(), teamNorm, element);
        addElementCandidate(String(element.web_name || ""), teamNorm, element);
      }
      const liveByElementId = new Map<number, any>();
      for (const liveElement of liveElements) liveByElementId.set(Number(liveElement.id), liveElement);
      const enrichedCards = cards.map((card: any) => {
        const player = card.player as any;
        if (!player) return card;
        const playerName = normalizeLookupText(String(player.name || ""));
        const teamName = normalizeLookupText(String(player.team || ""));
        const matchedElement = elementByNameTeam.get(`${playerName}::${teamName}`) || null;
        const liveElement = matchedElement ? liveByElementId.get(Number(matchedElement.id)) : null;
        let last5Scores = Array.isArray(card.last5Scores) ? card.last5Scores.map((value: any) => Number(value || 0)).slice(0, 5) : [];
        if (liveElement) {
          const mappedStats = mapFplStatsToPlayerStats(liveElement);
          const calculatedScore = calculatePlayerScore(mappedStats, String(player.position || "MID"));
          const latestLiveScore = Number(calculatedScore?.total_score || 0);
          last5Scores = [latestLiveScore, ...last5Scores];
        }
        last5Scores = last5Scores.map((value: any) => Number(value || 0)).slice(0, 5);
        while (last5Scores.length < 5) last5Scores.push(0);
        const totalPoints = last5Scores.reduce((sum: number, value: number) => sum + Number(value || 0), 0);
        const averageScore = last5Scores.length ? Math.round(totalPoints / last5Scores.length) : Number(player?.overall || card.decisiveScore || 0);
        return { ...card, decisiveScore: averageScore, totalPoints, last5Scores, player: { ...player, overall: averageScore } };
      });
      return res.json({ cards: enrichedCards });
    } catch (error: any) {
      console.error("Fetch my cards failed:", error);
      return res.status(500).json({ message: "Failed to fetch my cards" });
    }
  };

  app.post("/api/audit/client-event", requireAuth, async (req: any, res: any) => {
    try {
      const userId = String(req.authUserId || "");
      const event = safeClientEvent(req.body?.event);
      const path = String(req.body?.path || "").slice(0, 250);
      const meta = { event, path, title: String(req.body?.title || "").slice(0, 200), ts: req.body?.ts || null, userAgent: String(req.headers["user-agent"] || "").slice(0, 240), ip: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").slice(0, 120) };
      await db.insert(auditLogs).values({ userId, action: `client.${event}`, meta } as any);
      return res.json({ success: true });
    } catch (error) {
      console.warn("Client audit event failed:", error);
      return res.json({ success: false });
    }
  });

  app.get("/api/admin/audit-events", requireAuth, async (req: any, res: any) => {
    try {
      if (!(await isAdminUserForAudit(storage, req))) return res.status(403).json({ message: "Admin access required" });
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)));
      const userId = String(req.query.userId || "").trim();
      const action = String(req.query.action || "").trim();
      const userPattern = userId ? `%${userId}%` : "%%";
      const actionPattern = action ? `%${action}%` : "%%";
      const result = await db.execute(sql`
        select l.id, l.user_id as "userId", u.email as "userEmail", coalesce(u.name, concat_ws(' ', u.first_name, u.last_name)) as "userName", l.action, l.meta, l.created_at as "createdAt"
        from app.audit_logs l
        left join app.users u on u.id = l.user_id
        where (${userId} = '' or l.user_id ilike ${userPattern} or coalesce(u.email, '') ilike ${userPattern})
          and (${action} = '' or l.action ilike ${actionPattern})
        order by l.created_at desc nulls last, l.id desc
        limit ${limit}
      `);
      const rows = Array.isArray((result as any)?.rows) ? (result as any).rows : [];
      return res.json({ auditEvents: rows, limit, filters: { userId, action } });
    } catch (error: any) {
      console.error("Failed to fetch audit events:", error);
      return res.status(500).json({ message: "Failed to fetch audit events" });
    }
  });

  app.get("/api/cards/my", requireAuth, sendUserCards);
  app.get("/api/user/cards", requireAuth, sendUserCards);

  app.get("/api/cards/:cardId/profile", requireAuth, async (req: any, res: any) => {
    try {
      const userId = String(req.authUserId || "");
      const cardId = Number(req.params.cardId);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });
      const userCards = await storage.getUserCards(userId);
      const card = userCards.find((item: any) => Number(item.id) === cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      const player = card.player || {};
      const [lastSaleTransaction] = await db
        .select({ grossAmount: transactions.grossAmount, amount: transactions.amount })
        .from(transactions)
        .where(and(eq(transactions.type, "sale" as any), sql`${transactions.description} ilike ${`%card:${cardId}%`}`))
        .orderBy(desc(transactions.createdAt))
        .limit(1);
      const lastSaleValue = Number(lastSaleTransaction?.grossAmount || lastSaleTransaction?.amount || 0) || null;
      const bootstrap = await fplApi.bootstrap();
      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
      const teamNameById = new Map<number, string>();
      const teamShortById = new Map<number, string>();
      for (const team of teams) {
        teamNameById.set(Number(team.id), normalizeLookupText(String(team.name || team.short_name || "")));
        teamShortById.set(Number(team.id), String(team.short_name || team.name || `T${team.id}`));
      }
      const playerName = normalizeLookupText(String(player.name || ""));
      const teamName = normalizeLookupText(String(player.team || ""));
      const matchedElement = elements.find((element: any) => {
        const elementTeam = teamNameById.get(Number(element.team)) || "";
        const fullName = normalizeLookupText(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim());
        const webName = normalizeLookupText(String(element.web_name || ""));
        return elementTeam === teamName && (fullName === playerName || webName === playerName || fullName.includes(playerName) || playerName.includes(webName));
      });
      if (!matchedElement) {
        return res.json({ source: "card-fallback", player: { name: player.name, team: player.team, position: player.position, imageUrl: player.imageUrl }, last10: lastScoresFallback(card), stats: { matchesPlayed: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, totalPoints: Number(card.totalPoints || 0), selectedBy: null, value: lastSaleValue } });
      }
      const summary = await fplApi.playerSummary(Number(matchedElement.id));
      const history = Array.isArray(summary?.history) ? summary.history : [];
      const last10 = history.slice(-10).map((row: any) => ({ gameweek: Number(row.round || row.event || 0), opponent: teamShortById.get(Number(row.opponent_team)) || `T${row.opponent_team}`, points: Number(row.total_points || 0), minutes: Number(row.minutes || 0), goals: Number(row.goals_scored || 0), assists: Number(row.assists || 0), kickoffTime: row.kickoff_time || null, wasHome: Boolean(row.was_home) }));
      return res.json({ source: "fpl-live", fplElementId: Number(matchedElement.id), player: { name: `${matchedElement.first_name || ""} ${matchedElement.second_name || ""}`.trim() || player.name, webName: matchedElement.web_name, team: player.team, position: player.position, imageUrl: fplApi.playerPhotoUrl(matchedElement, 250), status: matchedElement.status, news: matchedElement.news || "" }, last10: last10.length ? last10 : lastScoresFallback(card), stats: { matchesPlayed: Number(matchedElement.starts || 0), minutes: Number(matchedElement.minutes || 0), goals: Number(matchedElement.goals_scored || 0), assists: Number(matchedElement.assists || 0), cleanSheets: Number(matchedElement.clean_sheets || 0), yellowCards: Number(matchedElement.yellow_cards || 0), redCards: Number(matchedElement.red_cards || 0), bonus: Number(matchedElement.bonus || 0), totalPoints: Number(matchedElement.total_points || 0), selectedBy: matchedElement.selected_by_percent, value: lastSaleValue } });
    } catch (error: any) {
      console.error("Failed to fetch card profile:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch card profile" });
    }
  });

  app.post("/api/marketplace/list", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const cardId = Number(req.body?.cardId);
      const price = toMoney(req.body?.price);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });
      const card = await storage.getPlayerCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (String(card.ownerId || "") !== userId) return res.status(403).json({ message: "You do not own this card" });
      if (!isMarketplaceTradableRarity(String(card.rarity))) return res.status(400).json({ message: "Common cards cannot be sold" });
      const floor = getMarketplaceFloorPrice(String(card.rarity));
      if (floor > 0 && price < floor) return res.status(400).json({ message: `Minimum price for ${card.rarity} cards is N$${floor}` });
      await storage.updatePlayerCard(cardId, { forSale: true, price } as any);
      return res.json({ success: true, cardId, price });
    } catch (error: any) {
      console.error("Failed to list marketplace card:", error);
      return res.status(500).json({ message: error?.message || "Failed to list card" });
    }
  });

  app.post("/api/marketplace/cancel/:cardId", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const cardId = Number(req.params.cardId);
      if (!Number.isInteger(cardId) || cardId <= 0) return res.status(400).json({ message: "Valid cardId required" });
      const card = await storage.getPlayerCard(cardId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (String(card.ownerId || "") !== userId) return res.status(403).json({ message: "You do not own this card" });
      await storage.updatePlayerCard(cardId, { forSale: false, price: 0 } as any);
      return res.json({ success: true, cardId });
    } catch (error: any) {
      console.error("Failed to cancel marketplace listing:", error);
      return res.status(500).json({ message: error?.message || "Failed to cancel listing" });
    }
  });
}
