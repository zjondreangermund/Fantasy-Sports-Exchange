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
import { authConfigurationError, googleAuthEnabled, isReplit, useMockAuth } from "./auth-config.js";
import { registerRetentionRoutes } from "./routes/retention.routes.js";
import { registerTournamentCreatorRoutes } from "./routes/tournamentCreator.routes.js";
import { registerUserTournamentRoutes } from "./routes/userTournaments.routes.js";
import { buildRealFplPointFeed } from "./services/liveFplFeed.js";
import { economyConfigPayload, rankCompetitionEntries } from "./services/tournamentRules.js";
import { PRIZE_CATALOG, RARITY_MARGIN_MULTIPLIERS, getActivePrizeForEntries, getEntryFeeForRarity } from "./services/prizeEngine.js";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL).split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const scoreUpdater = new ScoreUpdateService(storage as any);
const SEASON_KEY = "2026-27";
const SEASON_START = Date.UTC(2026, 6, 1);
const SEASON_END = Date.UTC(2027, 6, 1);

type CompetitionRow = any;

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
function normalizeEmail(value: unknown): string { return String(value || "").trim().toLowerCase(); }
function rowsOf(result: any): any[] { return Array.isArray(result?.rows) ? result.rows : []; }
function normalizePin(raw: unknown) { return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function fallbackGameweekKickoff(gameWeek: number) { const start = new Date("2026-08-14T19:00:00+02:00"); start.setDate(start.getDate() + (Math.max(1, Number(gameWeek) || 1) - 1) * 7); return start; }
function inSeason(date: Date) { const t = date.getTime(); return Number.isFinite(t) && t >= SEASON_START && t < SEASON_END; }
async function firstFixtureKickoffForGameweek(gameWeek: number): Promise<Date | null> {
  try {
    const fixtures = await fplApi.fixtures();
    const kickoffs = (Array.isArray(fixtures) ? fixtures : []).filter((fixture: any) => Number(fixture?.event) === Number(gameWeek) && fixture?.kickoff_time).map((fixture: any) => new Date(String(fixture.kickoff_time))).filter((date) => inSeason(date)).sort((a, b) => a.getTime() - b.getTime());
    return kickoffs[0] || null;
  } catch (error) { console.warn("FPL fixture cutoff unavailable; using 26/27 fallback:", error); return null; }
}
async function getCompetitionSubmissionCloseAt(comp: CompetitionRow) {
  const gw = Number(comp?.gameWeek ?? comp?.game_week ?? 1) || 1;
  const fplKickoff = await firstFixtureKickoffForGameweek(gw);
  if (fplKickoff) return fplKickoff;
  const manual = new Date(String(comp?.startDate || comp?.start_date || ""));
  if (inSeason(manual)) return manual;
  return fallbackGameweekKickoff(gw);
}
async function getUserEmailForAdmin(req: any): Promise<string> {
  const requestEmail = normalizeEmail(req.user?.email || req.user?.claims?.email);
  if (requestEmail) return requestEmail;
  const userId = String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
  if (!userId) return "";
  try { return normalizeEmail((await storage.getUser(userId))?.email); } catch { return ""; }
}
async function isAdminRequest(req: any): Promise<boolean> {
  const userId = String(req.authUserId || "");
  if (!userId) return false;
  const requestEmail = await getUserEmailForAdmin(req);
  return ADMIN_USER_IDS.includes(userId) || Boolean(requestEmail && ADMIN_EMAILS.includes(requestEmail));
}

export async function requireAuth(req: any, res: any, next: any) {
  if (useMockAuth) {
    const mockUserId = String(process.env.MOCK_USER_ID || "").trim();
    if (!mockUserId) return res.status(503).json({ message: "Mock authentication is not configured" });
    req.authUserId = mockUserId;
    if (!req.user) req.user = { id: mockUserId, claims: { sub: mockUserId }, firstName: process.env.MOCK_FIRST_NAME || "Mock", lastName: process.env.MOCK_LAST_NAME || "User", email: process.env.MOCK_EMAIL || "admin@local.test" };
    return next();
  }
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  const userId = user.claims?.sub || user.id;
  if (!userId) return res.status(401).json({ message: "Invalid user identity" });
  req.authUserId = String(userId);
  try { const userRecord = await storage.getUser(String(userId)); if (userRecord?.isBanned) return res.status(403).json({ message: "Account is banned" }); } catch {}
  return next();
}
export async function isAdmin(req: any, res: any, next: any) {
  if (!req.authUserId) return res.status(401).json({ message: "Unauthorized" });
  if (!(await isAdminRequest(req))) return res.status(403).json({ message: "Admin access required" });
  return next();
}

function normalizeCompetitionRow(row: any) {
  if (!row) return row;
  const rarity = String(row.tier || row.rarity || "common").toLowerCase();
  const entryFee = Number(row.entryFee ?? row.entry_fee ?? getEntryFeeForRarity(rarity));
  const entryCount = Number(row.entryCount ?? row.entry_count ?? 0);
  const ladderState = getActivePrizeForEntries(rarity, entryCount);
  const activePrize = ladderState.activePrize;
  const nextPrize = ladderState.nextPrize;
  const displayPrize = activePrize || nextPrize;
  return {
    ...row,
    entryFee,
    entryCount,
    maxEntries: row.maxEntries ?? row.max_entries ?? null,
    joinPin: row.joinPin ?? row.join_pin ?? null,
    prizePoolTotal: Number(row.prizePoolTotal ?? row.prize_pool_total ?? 0),
    platformFeeTotal: Number(row.platformFeeTotal ?? row.platform_fee_total ?? 0),
    prizeType: row.prizeType ?? row.prize_type ?? "goods",
    prizeDescription: displayPrize?.title || row.prizeDescription || row.prize_description || "Prize Vault ladder",
    prizeKey: displayPrize?.key || row.prizeKey || row.prize_key || null,
    prizeValue: displayPrize?.value || 0,
    prizeUnlockTarget: displayPrize?.unlockTarget || 0,
    requiredEntrants: displayPrize?.requiredEntrants || 0,
    currentEntrantRevenue: toMoney(entryCount * entryFee),
    prizeUnlocked: Boolean(activePrize),
    activePrize,
    nextPrize,
    entrantsToNext: ladderState.entrantsToNext,
    marginMultiplier: RARITY_MARGIN_MULTIPLIERS[rarity as keyof typeof RARITY_MARGIN_MULTIPLIERS] || 1.8,
    ladderRarity: rarity,
    season: SEASON_KEY,
  };
}

async function loadCompetitions(): Promise<any[]> {
  const { db } = await import("./db.js");
  const result = await db.execute(sql`
    select c.id, c.name, c.tier::text as tier, coalesce(c.entry_fee,0)::float as "entryFee",
      c.status::text as status, c.game_week as "gameWeek", c.start_date as "startDate", c.end_date as "endDate",
      c.prize_card_rarity::text as "prizeCardRarity", c.created_at as "createdAt",
      c.created_by_user_id, c.join_pin, c.visibility, c.max_entries,
      coalesce(c.platform_fee_rate, .2)::float as "platformFeeRate",
      coalesce(c.platform_fee_total, 0)::float as "platformFeeTotal",
      coalesce(c.prize_pool_total, 0)::float as "prizePoolTotal",
      coalesce(c.prize_type, 'goods') as "prizeType",
      c.prize_description as "prizeDescription",
      c.prize_key as "prizeKey"
    from app.competitions c order by c.game_week asc, c.id asc
  `);
  return rowsOf(result);
}
function allowedTier(raw: unknown) { const tier = String(raw || "common").toLowerCase(); return ["common", "rare", "epic", "unique", "legendary"].includes(tier) ? tier : "common"; }
function allowedStatus(raw: unknown) { const status = String(raw || "open").toLowerCase(); return ["open", "upcoming", "closed", "active"].includes(status) ? status : "open"; }
function allowedPrizeType(raw: unknown) { const type = String(raw || "goods").toLowerCase(); return ["cash_pool", "goods", "goods_plus_cash", "packs", "sponsor_prize"].includes(type) ? type : "goods"; }

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  try { await seedCompetitions(); } catch (error) { console.warn("Could not auto-seed tournaments:", error); }
  await registerAuthModeRoutes(app, { isReplit, useMockAuth, googleAuthEnabled, authConfigurationError, setupAuth, registerReplitAuthRoutes: registerAuthRoutes, passport });
  registerCardsRoutes(app, { requireAuth, storage });
  registerOnboardingRoutes(app, { requireAuth, storage, fplApi });
  registerMarketplaceRoutes(app, { requireAuth });
  registerRetentionRoutes(app, { requireAuth, storage });
  registerAdminRoutes(app, { requireAuth, isAdmin, isAdminUser: isAdminRequest });
  registerAuctionsRoutes(app, { requireAuth });
  registerTournamentCreatorRoutes(app, { requireAuth });
  registerUserTournamentRoutes(app, { requireAuth });

  app.get("/api/live/point-feed", async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));
      res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=10");
      return res.json(await buildRealFplPointFeed(limit));
    } catch (error) {
      console.error("Real FPL point feed failed:", error);
      return res.json([]);
    }
  });

  const ensureRuntimeSchema = async () => {
    try {
      const { db } = await import("./db.js");
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS created_by_user_id varchar(255)`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS join_pin text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public'`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS max_entries integer`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS platform_fee_rate real DEFAULT 0.2`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS platform_fee_total real DEFAULT 0`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_pool_total real DEFAULT 0`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_type text DEFAULT 'goods'`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_description text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competitions ADD COLUMN IF NOT EXISTS prize_key text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.competition_entries ADD COLUMN IF NOT EXISTS tiebreak_meta jsonb DEFAULT '{}'::jsonb`);
    } catch (error) { console.warn("Runtime schema ensure failed:", error); }
  };
  await ensureRuntimeSchema();

  app.get("/api/economy/config", (_req, res) => res.json({ ...economyConfigPayload(), season: SEASON_KEY }));
  app.get("/api/admin/prizes", requireAuth, isAdmin, (_req, res) => res.json({ prizes: PRIZE_CATALOG }));

  app.post("/api/admin/competitions", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const name = String(req.body?.name || "").trim();
      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek || 1)));
      if (!name) return res.status(400).json({ message: "Tournament name required" });
      const requestedStatus = String(req.body?.status || "open").toLowerCase();
      if (requestedStatus === "completed") return res.status(400).json({ message: "Use the settlement action to complete a tournament" });
      const tier = allowedTier(req.body?.tier);
      const status = allowedStatus(requestedStatus);
      const entryFee = toMoney(req.body?.entryFee || getEntryFeeForRarity(tier));
      const maxEntries = Number(req.body?.maxEntries || 0) > 1 ? Number(req.body.maxEntries) : null;
      const visibility = String(req.body?.visibility || "public") === "private" ? "private" : "public";
      const prizeType = allowedPrizeType(req.body?.prizeType || "goods");
      const prizeDescription = String(req.body?.prizeDescription || "Prize Vault ladder").trim();
      const prizeKey = String(req.body?.prizeKey || "ladder").trim();
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : fallbackGameweekKickoff(gameWeek);
      const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(startDate.getTime() + 3 * 86400000);
      const pin = visibility === "private" ? normalizePin(Math.random().toString(36).slice(2, 8).toUpperCase()) : null;
      const result = await db.execute(sql`insert into app.competitions (name, tier, entry_fee, status, game_week, start_date, end_date, prize_card_rarity, created_by_user_id, join_pin, visibility, max_entries, platform_fee_rate, platform_fee_total, prize_pool_total, prize_type, prize_description, prize_key) values (${name}, ${tier}, ${entryFee}, ${status}, ${gameWeek}, ${startDate}, ${endDate}, ${tier === "common" ? "rare" : tier}, ${req.authUserId}, ${pin}, ${visibility}, ${maxEntries}, 0.2, 0, 0, ${prizeType}, ${prizeDescription}, ${prizeKey}) returning *`);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null });
    } catch (error: any) { console.error("Failed to create admin tournament:", error); return res.status(500).json({ message: error?.message || "Failed to create tournament" }); }
  });

  app.patch("/api/admin/competitions/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Valid tournament required" });
      const name = String(req.body?.name || "").trim();
      const gameWeek = Math.max(1, Math.min(38, Number(req.body?.gameWeek || 1)));
      if (!name) return res.status(400).json({ message: "Tournament name required" });
      const requestedStatus = String(req.body?.status || "open").toLowerCase();
      if (requestedStatus === "completed") return res.status(400).json({ message: "Use the settlement action to complete a tournament" });
      const tier = allowedTier(req.body?.tier);
      const status = allowedStatus(requestedStatus);
      const entryFee = toMoney(req.body?.entryFee || getEntryFeeForRarity(tier));
      const maxEntries = Number(req.body?.maxEntries || 0) > 1 ? Number(req.body.maxEntries) : null;
      const visibility = String(req.body?.visibility || "public") === "private" ? "private" : "public";
      const prizeType = allowedPrizeType(req.body?.prizeType || "goods");
      const prizeDescription = String(req.body?.prizeDescription || "Prize Vault ladder").trim();
      const prizeKey = String(req.body?.prizeKey || "ladder").trim();
      const startDate = req.body?.startDate ? new Date(String(req.body.startDate)) : fallbackGameweekKickoff(gameWeek);
      const endDate = req.body?.endDate ? new Date(String(req.body.endDate)) : new Date(startDate.getTime() + 3 * 86400000);
      const result = await db.execute(sql`update app.competitions set name=${name}, tier=${tier}, entry_fee=${entryFee}, status=${status}, game_week=${gameWeek}, start_date=${startDate}, end_date=${endDate}, prize_card_rarity=${tier === "common" ? "rare" : tier}, visibility=${visibility}, max_entries=${maxEntries}, prize_type=${prizeType}, prize_description=${prizeDescription}, prize_key=${prizeKey} where id=${id} returning *`);
      return res.json({ success: true, tournament: rowsOf(result)[0] || null });
    } catch (error: any) { console.error("Failed to update admin tournament:", error); return res.status(500).json({ message: error?.message || "Failed to update tournament" }); }
  });

  app.get("/api/user", requireAuth, async (req: any, res) => { const user = await storage.getUser(req.authUserId); if (!user) return res.status(404).json({ message: "User not found" }); return res.json(user); });
  app.get("/api/wallet", requireAuth, async (req: any, res) => { let wallet = await storage.getWallet(req.authUserId); if (!wallet) wallet = await storage.createWallet({ userId: req.authUserId, balance: 0, lockedBalance: 0 } as any); return res.json(wallet); });
  app.get("/api/lineup", requireAuth, async (req: any, res) => { const lineup = await storage.getLineup(req.authUserId); const cards = await Promise.all((Array.isArray(lineup?.cardIds) ? lineup!.cardIds : []).map((id: number) => storage.getPlayerCardWithPlayer(Number(id), req.authUserId))); return res.json({ lineup: lineup || { cardIds: [] }, cards: cards.filter(Boolean) }); });
  app.post("/api/lineup", requireAuth, async (req: any, res) => { const ids = Array.isArray(req.body?.cardIds) ? req.body.cardIds.map(Number).filter((id: number) => Number.isFinite(id)) : []; if (ids.length !== 5) return res.status(400).json({ message: "Exactly 5 cards required" }); const captainId = Number(req.body?.captainId || ids[0]); return res.json(await storage.createOrUpdateLineup(req.authUserId, ids, captainId)); });

  app.get("/api/competitions", async (req, res) => {
    try {
      const status = String(req.query.status || "");
      const tier = String(req.query.tier || "");
      let competitions = await loadCompetitions();
      if (status) competitions = competitions.filter((c: any) => c.status === status);
      if (tier) competitions = competitions.filter((c: any) => c.tier === tier);
      const rows = await Promise.all(competitions.map(async (comp: any) => {
        const rawEntries = await storage.getCompetitionEntries(comp.id);
        const ranked = await rankCompetitionEntries(storage, rawEntries);
        const entries = await Promise.all(ranked.map(async (entry: any) => { const user = await storage.getUser(entry.userId); return { ...entry, userName: user?.managerTeamName || user?.name || user?.email || "Manager" }; }));
        const submissionClosesAt = await getCompetitionSubmissionCloseAt(comp);
        const normalized = normalizeCompetitionRow({ ...comp, entryCount: entries.length });
        return { ...normalized, submissionClosesAt, entryOpen: comp.status === "open" && Date.now() < new Date(submissionClosesAt).getTime(), entries, entryCount: entries.length, winner: comp.status === "completed" && entries[0] ? { userId: entries[0].userId, userName: entries[0].userName, totalScore: Number(entries[0].totalScore || 0), prizeAmount: Number(entries[0].prizeAmount || 0), prizeCardId: entries[0].prizeCardId || null, tiebreak: entries[0].tiebreak || null } : null };
      }));
      return res.json(rows);
    } catch (error: any) { console.error("Failed to fetch competitions:", error); return res.status(500).json({ message: "Failed to fetch tournaments" }); }
  });

  app.get("/api/competitions/my-entries", requireAuth, async (req: any, res) => res.json(await storage.getUserCompetitions(req.authUserId)));

  console.log("🚀 Starting automatic score update service...");
  scoreUpdater.startAutoUpdates();
  return httpServer;
}
