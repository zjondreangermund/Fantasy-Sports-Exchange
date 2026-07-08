import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import { sql } from "drizzle-orm";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedCompetitions } from "./seed.js";
import { fplApi } from "./services/fplApi.js";
import { ScoreUpdateService } from "./services/scoreUpdater.js";
import { registerCardsRoutes } from "./routes/cards.routes.js";
import { registerOnboardingRoutes } from "./routes/onboarding.routes.js";
import { registerMarketplaceRoutes } from "./routes/marketplace.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";
import { registerAuctionsRoutes } from "./routes/auctions.routes.js";
import { registerAuthModeRoutes } from "./routes/auth.routes.js";
import { registerRetentionRoutes } from "./routes/retention.routes.js";
import { registerTournamentCreatorRoutes } from "./routes/tournamentCreator.routes.js";
import { registerUserTournamentRoutes } from "./routes/userTournaments.routes.js";
import { economyConfigPayload, rankCompetitionEntries } from "./services/tournamentRules.js";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const isReplit = Boolean(process.env.REPL_ID);
const useMockAuth = process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);
const scoreUpdater = new ScoreUpdateService(storage as any);

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

async function getUserEmailForAdmin(req: any): Promise<string> {
  const requestEmail = normalizeEmail(req.user?.email || req.user?.claims?.email);
  if (requestEmail) return requestEmail;
  const userId = String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
  if (!userId) return "";
  try {
    const userRecord = await storage.getUser(userId);
    return normalizeEmail(userRecord?.email);
  } catch {
    return "";
  }
}

async function isAdminRequest(req: any): Promise<boolean> {
  const userId = String(req.authUserId || "");
  if (!userId) return false;
  const requestEmail = await getUserEmailForAdmin(req);
  return ADMIN_USER_IDS.includes(userId) || Boolean(requestEmail && ADMIN_EMAILS.includes(requestEmail));
}

export async function requireAuth(req: any, res: any, next: any) {
  if (useMockAuth) {
    const mockUserId = process.env.MOCK_USER_ID || "test-user-1";
    req.authUserId = mockUserId;
    if (!req.user) {
      req.user = {
        id: mockUserId,
        claims: { sub: mockUserId },
        firstName: process.env.MOCK_FIRST_NAME || "Mock",
        lastName: process.env.MOCK_LAST_NAME || "User",
        email: process.env.MOCK_EMAIL || "admin@local.test",
      };
    }
    return next();
  }
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const userId = user.claims?.sub || user.id;
  if (!userId) return res.status(401).json({ message: "Invalid user identity" });
  req.authUserId = String(userId);
  try {
    const userRecord = await storage.getUser(String(userId));
    if (userRecord?.isBanned) return res.status(403).json({ message: "Account is banned" });
  } catch {}
  return next();
}

export async function isAdmin(req: any, res: any, next: any) {
  if (!req.authUserId) return res.status(401).json({ message: "Unauthorized" });
  if (!(await isAdminRequest(req))) return res.status(403).json({ message: "Admin access required" });
  return next();
}

function normalizeCompetitionRow(row: any) {
  if (!row) return row;
  return {
    ...row,
    entryFee: Number(row.entryFee ?? row.entry_fee ?? 0),
    entryCount: Number(row.entryCount ?? row.entry_count ?? 0),
    maxEntries: row.maxEntries ?? row.max_entries ?? null,
    joinPin: row.joinPin ?? row.join_pin ?? null,
    prizePoolTotal: Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0),
    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),
    prizeType: row.prizeType ?? row.prize_type ?? "cash_pool",
    prizeDescription: row.prizeDescription ?? row.prize_description ?? null,
  };
}

async function getCompetitionSubmissionCloseAt(comp: any) {
  return comp?.startDate || comp?.start_date || new Date();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  try { await seedCompetitions(); } catch (error) { console.warn("Could not auto-seed tournaments:", error); }

  await registerAuthModeRoutes(app, { isReplit, useMockAuth, setupAuth, registerReplitAuthRoutes: registerAuthRoutes, passport });
  registerCardsRoutes(app, { requireAuth, storage });
  registerOnboardingRoutes(app, { requireAuth, storage, fplApi });
  registerMarketplaceRoutes(app, { requireAuth });
  registerRetentionRoutes(app, { requireAuth, storage });
  registerAdminRoutes(app, { requireAuth, isAdmin, isAdminUser: isAdminRequest });
  registerAuctionsRoutes(app, { requireAuth });
  registerTournamentCreatorRoutes(app, { requireAuth });
  registerUserTournamentRoutes(app, { requireAuth });

  const ensureRuntimeSchema = async () => {
    try {
      const { db } = await import("./db.js");
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_type text DEFAULT 'cash_pool'`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_description text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competition_entries ADD COLUMN IF NOT EXISTS tiebreak_meta jsonb DEFAULT '{}'::jsonb`);
    } catch (error) {
      console.warn("Runtime schema ensure failed:", error);
    }
  };
  await ensureRuntimeSchema();

  app.get("/api/economy/config", (_req, res) => res.json(economyConfigPayload()));

  app.get("/api/user", requireAuth, async (req: any, res) => {
    const user = await storage.getUser(req.authUserId);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  });

  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    let wallet = await storage.getWallet(req.authUserId);
    if (!wallet) wallet = await storage.createWallet({ userId: req.authUserId, balance: 0, lockedBalance: 0 } as any);
    return res.json(wallet);
  });

  app.get("/api/lineup", requireAuth, async (req: any, res) => {
    const lineup = await storage.getLineup(req.authUserId);
    const cards = await Promise.all((Array.isArray(lineup?.cardIds) ? lineup!.cardIds : []).map((id: number) => storage.getPlayerCardWithPlayer(Number(id), req.authUserId)));
    return res.json({ lineup: lineup || { cardIds: [] }, cards: cards.filter(Boolean) });
  });

  app.post("/api/lineup", requireAuth, async (req: any, res) => {
    const ids = Array.isArray(req.body?.cardIds) ? req.body.cardIds.map(Number).filter((id: number) => Number.isFinite(id)) : [];
    if (ids.length !== 5) return res.status(400).json({ message: "Exactly 5 cards required" });
    const captainId = Number(req.body?.captainId || ids[0]);
    const lineup = await storage.createOrUpdateLineup(req.authUserId, ids, captainId);
    return res.json(lineup);
  });

  app.get("/api/competitions", async (req, res) => {
    try {
      const status = String(req.query.status || "");
      const tier = String(req.query.tier || "");
      let competitions = await storage.getCompetitions();
      if (status) competitions = competitions.filter((c: any) => c.status === status);
      if (tier) competitions = competitions.filter((c: any) => c.tier === tier);
      const rows = await Promise.all(competitions.map(async (comp: any) => {
        const rawEntries = await storage.getCompetitionEntries(comp.id);
        const ranked = await rankCompetitionEntries(storage, rawEntries);
        const entries = await Promise.all(ranked.map(async (entry: any) => {
          const user = await storage.getUser(entry.userId);
          return { ...entry, userName: user?.managerTeamName || user?.name || user?.email || "Manager", userImage: user?.avatarUrl || null };
        }));
        const submissionClosesAt = await getCompetitionSubmissionCloseAt(comp);
        const normalized = normalizeCompetitionRow(comp);
        return {
          ...normalized,
          submissionClosesAt,
          entryOpen: comp.status === "open" && Date.now() < new Date(submissionClosesAt).getTime(),
          entries,
          entryCount: entries.length,
          winner: comp.status === "completed" && entries[0] ? {
            userId: entries[0].userId,
            userName: entries[0].userName,
            totalScore: Number(entries[0].totalScore || 0),
            prizeAmount: Number(entries[0].prizeAmount || 0),
            prizeCardId: entries[0].prizeCardId || null,
            tiebreak: entries[0].tiebreak || null,
          } : null,
        };
      }));
      return res.json(rows);
    } catch (error: any) {
      console.error("Failed to fetch competitions:", error);
      return res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/competitions/my-entries", requireAuth, async (req: any, res) => {
    const entries = await storage.getUserCompetitions(req.authUserId);
    return res.json(entries);
  });

  app.post("/api/competitions/join", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const competitionId = Number(req.body?.competitionId);
      const cardIds = Array.isArray(req.body?.cardIds) ? req.body.cardIds.map(Number).filter((id: number) => Number.isFinite(id)) : [];
      const captainId = Number(req.body?.captainId || cardIds[0]);
      if (!competitionId || cardIds.length !== 5 || new Set(cardIds).size !== 5) return res.status(400).json({ message: "Tournament ID and exactly 5 different card IDs required" });
      const competition = await storage.getCompetition(competitionId);
      if (!competition) return res.status(404).json({ message: "Tournament not found" });
      if (competition.status !== "open") return res.status(400).json({ message: "Tournament is not open for entries" });
      const existing = await storage.getCompetitionEntry(competitionId, userId);
      if (existing) return res.status(400).json({ message: "Already entered this tournament" });
      const cards = await Promise.all(cardIds.map((id: number) => storage.getPlayerCardWithPlayer(id, userId)));
      if (cards.some((card: any) => !card || card.ownerId !== userId)) return res.status(403).json({ message: "You don't own all selected cards" });
      const expectedRarity = String(competition.tier || "common").toLowerCase();
      if (cards.some((card: any) => String(card?.rarity || "common").toLowerCase() !== expectedRarity)) return res.status(400).json({ message: `${competition.tier} tournaments only accept ${competition.tier} cards.` });
      if (cards.some((card: any) => card?.forSale)) return res.status(400).json({ message: "Cannot use marketplace-listed cards." });
      const playerIds = cards.map((card: any) => Number(card?.playerId));
      if (new Set(playerIds).size !== playerIds.length) return res.status(400).json({ message: "Lineup must use 5 different players" });
      const positions = cards.map((card: any) => card?.player?.position);
      if (!positions.includes("GK") || !positions.includes("DEF") || !positions.includes("MID") || !positions.includes("FWD")) return res.status(400).json({ message: "Invalid lineup: must have 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility player" });
      const entryFee = toMoney(competition.entryFee || 0);
      const wallet = await storage.getWallet(userId);
      if (entryFee > 0 && (!wallet || Number(wallet.balance || 0) < entryFee)) return res.status(400).json({ message: "Insufficient balance for entry fee" });
      if (entryFee > 0) {
        await storage.updateWalletBalance(userId, -entryFee);
        await storage.createTransaction({ userId, type: "entry_fee" as any, amount: -entryFee, description: `Entered tournament: ${competition.name}` } as any);
      }
      const entry = await storage.createCompetitionEntry({ competitionId, userId, lineupCardIds: cardIds, captainId, totalScore: 0 } as any);
      return res.json({ success: true, message: "Successfully joined tournament", entryId: entry.id });
    } catch (error: any) {
      console.error("Failed to join competition:", error);
      return res.status(500).json({ message: error?.message || "Failed to join tournament" });
    }
  });

  app.post("/api/admin/competitions/settle/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = Number(req.params.id);
      const competition = await storage.getCompetition(competitionId);
      if (!competition) return res.status(404).json({ message: "Tournament not found" });
      if (competition.status === "completed") return res.status(400).json({ message: "Tournament already settled" });
      const entries = await storage.getCompetitionEntries(competitionId);
      const ranked = await rankCompetitionEntries(storage, entries);
      const totalPrizePool = toMoney(entries.length * Number(competition.entryFee || 0));
      const payoutPercentages = [0.6, 0.3, 0.1];
      for (let i = 0; i < ranked.length; i += 1) {
        const entry = ranked[i];
        await storage.updateCompetitionEntry(entry.id, {
          rank: i + 1,
          prizeAmount: toMoney(totalPrizePool * (payoutPercentages[i] || 0)),
          tiebreakMeta: entry.tiebreak || {},
        } as any);
      }
      await storage.updateCompetition(competitionId, { status: "completed" } as any);
      return res.json({ success: true, message: "Tournament settled with Arena v2 tiebreak rules", winner: ranked[0] || null, winnersCount: Math.min(3, ranked.length) });
    } catch (error: any) {
      console.error("Failed to settle competition:", error);
      return res.status(500).json({ message: error?.message || "Failed to settle tournament" });
    }
  });

  console.log("🚀 Starting automatic score update service...");
  scoreUpdater.startAutoUpdates();
  return httpServer;
}
