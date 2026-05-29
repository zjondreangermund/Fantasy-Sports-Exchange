import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedDatabase, seedCompetitions } from "./seed.js";
import { fplApi } from "./services/fplApi.js";
import { fetchSorarePlayer } from "./services/sorare.js";
import { MAJOR_LEAGUES, getMajorLeagueFixtures, getMajorLeagueInjuries, getMajorLeagueLiveGames, getMajorLeaguePlayers, getMajorLeagueStandings } from "./services/majorLeagueApi.js";
import { ScoreUpdateService } from "./services/scoreUpdater.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats } from "./services/scoring.js";
import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { sql } from "drizzle-orm";
import { registerCardsRoutes } from "./routes/cards.routes.js";
import { registerOnboardingRoutes } from "./routes/onboarding.routes.js";
import { registerMarketplaceRoutes } from "./routes/marketplace.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";
import { registerAuctionsRoutes } from "./routes/auctions.routes.js";
import { registerAuthModeRoutes } from "./routes/auth.routes.js";
import { registerRetentionRoutes } from "./routes/retention.routes.js";
import {
  creditWalletWithLedger,
  createPendingWithdrawalWithHold,
  createTrustedWithdrawal,
  enterCompetitionWithFee,
  applyMarketplaceTradeLedger,
  getWalletIntegrityReport,
  processWalletDeposit,
  repairMissingWalletsFromLedger,
} from "./services/walletLedger.js";
import { getCompetitionRewardIntegrity, repairCompetitionRewards } from "./services/tournamentRewards.js";
import {
  getCardStatus,
  getDepositBreakdown,
  getWithdrawalBreakdown,
  isMainCompetitionEligible,
  MIN_WITHDRAWAL_AMOUNT,
  normalizeRarityTier,
  TOURNAMENT_ENTRY_BY_RARITY,
  getMarketplaceFloorPrice,
  isMarketplaceTradableRarity,
} from "../shared/card-economy.js";

// ✅ Google auth (Passport) – relies on session/passport middleware being set up in server entry file
import passport from "passport";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const playerMergeCache = new Map<string, { expiresAt: number; value: any }>();

function normalizePlayerName(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when deployed on Replit (has REPL_ID). Use Replit Auth there. */
const isReplit = Boolean(process.env.REPL_ID);

/** True when we want to skip real auth (e.g. Railway/Vercel/local dev without real auth). */
const useMockAuth =
  process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);

const CURRENCY_SYMBOL = "N$";

function toMoney(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function formatMoney(amount: unknown): string {
  return `${CURRENCY_SYMBOL}${toMoney(amount).toFixed(2)}`;
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
  const idAllowed = ADMIN_USER_IDS.includes(userId);
  const emailAllowed = Boolean(requestEmail) && ADMIN_EMAILS.includes(requestEmail);
  return idAllowed || emailAllowed;
}

// Initialize score updater service
const scoreUpdater = new ScoreUpdateService(storage as any);

/**
 * Base authentication middleware
 * Attaches req.authUserId for all protected routes
 */
export async function requireAuth(req: any, res: any, next: any) {
  // MOCK AUTH MODE (dev only)
  if (useMockAuth) {
    const mockUserId = process.env.MOCK_USER_ID || "test-user-1";
    req.authUserId = mockUserId;

    // Helpful for code paths that expect req.user
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

  req.authUserId = userId;

  try {
    const userRecord = await storage.getUser(String(userId));
    if (userRecord?.isBanned) {
      return res.status(403).json({ message: "Account is banned" });
    }
  } catch (error) {
    console.warn("Failed to validate user ban status:", error);
  }

  next();
}

/**
 * Admin middleware (must be used AFTER requireAuth)
 */
export async function isAdmin(req: any, res: any, next: any) {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const allowed = await isAdminRequest(req);

  if (!allowed) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
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

function getCurrentSeasonBoundsUtc() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startYear = now.getUTCMonth() >= 6 ? year : year - 1;
  const seasonStart = Date.UTC(startYear, 6, 1, 0, 0, 0, 0);
  const seasonEnd = Date.UTC(startYear + 1, 6, 1, 0, 0, 0, 0);
  return { seasonStart, seasonEnd };
}

function isFixtureInCurrentSeason(fixture: any) {
  if (!fixture?.kickoff_time) return false;
  const t = new Date(String(fixture.kickoff_time)).getTime();
  if (!Number.isFinite(t)) return false;
  const { seasonStart, seasonEnd } = getCurrentSeasonBoundsUtc();
  return t >= seasonStart && t < seasonEnd;
}

function isFixtureLikelyFinished(fixture: any) {
  if (fixture?.finished) return true;
  const started = Boolean(fixture?.started);
  const minutes = Number(fixture?.minutes || 0);
  const kickoffTs = fixture?.kickoff_time ? new Date(String(fixture.kickoff_time)).getTime() : 0;
  const elapsedMs = kickoffTs > 0 ? Date.now() - kickoffTs : 0;
  if (!started) return false;
  return minutes >= 90 || elapsedMs >= 3 * 60 * 60 * 1000;
}

async function sendEmailNotification(to: string, subject: string, html: string) {
  const recipient = String(to || "").trim();
  if (!recipient) return { sent: false, reason: "missing-recipient" };

  const from = process.env.NOTIFY_FROM_EMAIL || "FantasyFC <notifications@fantasyfc.local>";
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.log(`[email:skip] RESEND_API_KEY missing; would send to ${recipient}: ${subject}`);
    return { sent: false, reason: "missing-config" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Resend email failed:", response.status, text);
      return { sent: false, reason: `resend-${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("Email send error:", error);
    return { sent: false, reason: "exception" };
  }
}

function normalizeWithdrawalDestination(paymentMethod: string, data: any): string {
  const method = String(paymentMethod || "bank_transfer").toLowerCase().trim();
  if (method === "ewallet" || method === "mobile_money") {
    const provider = String(data?.ewalletProvider || "").toLowerCase().trim();
    const id = String(data?.ewalletId || "").toLowerCase().trim();
    return `${method}:${provider}:${id}`;
  }

  const bankName = String(data?.bankName || "").toLowerCase().trim();
  const accountHolder = String(data?.accountHolder || "").toLowerCase().trim();
  const accountNumber = String(data?.accountNumber || "").toLowerCase().replace(/\s+/g, "");
  const iban = String(data?.iban || "").toLowerCase().replace(/\s+/g, "");
  return `${method}:${bankName}:${accountHolder}:${accountNumber}:${iban}`;
}

function isHttpImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseMaxAge(cacheControl?: string | null): number | null {
  if (!cacheControl) return null;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

type ImageOutputFormat = "webp" | "png" | "jpeg";

function parseImageFormat(value: unknown): ImageOutputFormat | null {
  const format = String(value || "").toLowerCase().trim();
  if (format === "webp") return "webp";
  if (format === "png") return "png";
  if (format === "jpeg" || format === "jpg") return "jpeg";
  return null;
}

function parseImageWidth(value: unknown): number | null {
  const width = Number(value);
  if (!Number.isFinite(width)) return null;
  return Math.max(96, Math.min(1024, Math.round(width)));
}

async function transformImageBuffer(
  input: Buffer,
  contentType: string,
  options: { width?: number | null; format?: ImageOutputFormat | null },
): Promise<{ buffer: Buffer; contentType: string }> {
  const requestedWidth = options.width ?? null;
  const requestedFormat = options.format ?? null;
  if (!requestedWidth && !requestedFormat) {
    return { buffer: input, contentType };
  }

  try {
    const runtimeImport = new Function("m", "return import(m)") as (moduleName: string) => Promise<any>;
    const sharpModule = await runtimeImport("sharp");
    const sharpFactory = (sharpModule as any).default || sharpModule;
    let pipeline = sharpFactory(input, { failOn: "none" });

    if (requestedWidth) {
      pipeline = pipeline.resize({
        width: requestedWidth,
        fit: "cover",
        position: "attention",
        withoutEnlargement: true,
      });
    }

    if (requestedFormat === "webp") {
      pipeline = pipeline.webp({ quality: 78, effort: 4 });
      return { buffer: await pipeline.toBuffer(), contentType: "image/webp" };
    }
    if (requestedFormat === "png") {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
      return { buffer: await pipeline.toBuffer(), contentType: "image/png" };
    }
    if (requestedFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
      return { buffer: await pipeline.toBuffer(), contentType: "image/jpeg" };
    }

    return { buffer: await pipeline.toBuffer(), contentType };
  } catch {
    // Keep passthrough behavior when image processing is unavailable.
    return { buffer: input, contentType };
  }
}

function normalizeLookupText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const LIVE_CHAT_MAX_MESSAGES = 200;
const liveChatMessagesStore: Array<{
  id: string;
  userId: string;
  userName: string;
  text: string;
  replyToMessageId?: string;
  replyToUserId?: string;
  replyToUserName?: string;
  replyToText?: string;
  createdAt: string;
}> = [];

const livePointReasons = [
  "Goal",
  "Assist",
  "Clean Sheet",
  "Big Chance Created",
  "Key Pass",
  "Penalty Save",
  "Yellow Card",
  "Red Card",
];

const livePointTeams = [
  "Arsenal",
  "Liverpool",
  "Chelsea",
  "Manchester City",
  "Manchester United",
  "Tottenham",
  "Newcastle",
  "Aston Villa",
];

const livePointFeedStore: Array<{
  id: string;
  gameId: number;
  team: string;
  delta: number;
  reason: string;
  createdAt: string;
}> = [];

let livePointLastGeneratedAt = 0;

function pushLivePointEvent() {
  const now = Date.now();
  if (now - livePointLastGeneratedAt < 20_000) return;
  livePointLastGeneratedAt = now;

  const team = livePointTeams[Math.floor(Math.random() * livePointTeams.length)] || "Premier League";
  const reason = livePointReasons[Math.floor(Math.random() * livePointReasons.length)] || "Action";
  const signedDelta = Math.random() > 0.2 ? Math.ceil(Math.random() * 8) : -Math.ceil(Math.random() * 5);

  livePointFeedStore.push({
    id: randomUUID(),
    gameId: Math.floor(Math.random() * 10_000) + 1,
    team,
    delta: signedDelta,
    reason,
    createdAt: new Date().toISOString(),
  });

  while (livePointFeedStore.length > 250) {
    livePointFeedStore.shift();
  }
}

function encodeReferralCode(userId: string): string {
  return Buffer.from(String(userId), "utf8").toString("base64url");
}

function decodeReferralCode(code: string): string {
  try {
    return Buffer.from(String(code || ""), "base64url").toString("utf8").trim();
  } catch {
    return "";
  }
}

async function grantReferralRewardCard(userId: string): Promise<number | null> {
  const allPlayers = await storage.getPlayers();
  if (!Array.isArray(allPlayers) || allPlayers.length === 0) return null;

  const userCards = await storage.getUserCards(userId);
  const ownedCommonIds = new Set(
    (Array.isArray(userCards) ? userCards : [])
      .filter((card: any) => card?.rarity === "common")
      .map((card: any) => Number(card.playerId)),
  );

  const candidates = allPlayers
    .filter((player: any) => !ownedCommonIds.has(Number(player.id)))
    .map((player: any) => Number(player.id))
    .filter((id: number) => Number.isFinite(id) && id > 0);

  if (candidates.length === 0) return null;

  const selectedPlayerId = candidates[Math.floor(Math.random() * candidates.length)] as number;
  const createdCard = await storage.createPlayerCard({
    playerId: selectedPlayerId,
    ownerId: userId,
    rarity: "common",
    level: 1,
    xp: 0,
    decisiveScore: 35,
    forSale: false,
    price: 0,
  } as any);

  return Number(createdCard.id);
}

function extractPhotoCode(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromPng = raw.match(/\/p(\d+)\.(png|jpg|jpeg|webp)(\?.*)?$/i);
  if (fromPng?.[1]) return fromPng[1];
  const fromJpg = raw.match(/^(\d+)\.jpg$/i);
  if (fromJpg?.[1]) return fromJpg[1];
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  return digitsOnly;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  try {
    await seedCompetitions();
  } catch (error) {
    console.warn("Could not auto-seed tournaments:", error);
  }

  // ----------------
  // AUTH ROUTES
  // ----------------

  await registerAuthModeRoutes(app, {
    isReplit,
    useMockAuth,
    setupAuth,
    registerReplitAuthRoutes: registerAuthRoutes,
    passport,
  });

  // ----------------
  // --- API ROUTES ---
  // ----------------

  registerCardsRoutes(app, { requireAuth, storage });
  registerOnboardingRoutes(app, { requireAuth, storage, fplApi });
  registerMarketplaceRoutes(app, { requireAuth });
  registerRetentionRoutes(app, { requireAuth, storage });
  registerAdminRoutes(app, {
    requireAuth,
    isAdmin,
    isAdminUser: isAdminRequest,
  });

  app.get("/api/image-proxy", async (req, res) => {
    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl || !isHttpImageUrl(rawUrl)) {
      return res.status(400).json({ message: "Invalid image URL" });
    }

    try {
      const isPremierLeagueUrl = /resources\.premierleague\.com/i.test(rawUrl);
      const upstream = await fetch(rawUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          ...(isPremierLeagueUrl ? { Referer: "https://www.premierleague.com" } : {}),
        },
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({ message: "Upstream image fetch failed" });
      }

      const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
      if (!contentType.startsWith("image/")) {
        return res.status(415).json({ message: "Upstream response is not an image" });
      }

      const cacheFromSource = parseMaxAge(upstream.headers.get("cache-control"));
      const safeMaxAge = Math.max(300, Math.min(cacheFromSource ?? 21600, 86400));

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Vary", "Origin");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", `public, max-age=${safeMaxAge}`);

      const arrayBuffer = await upstream.arrayBuffer();
      return res.status(200).send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Image proxy failed:", error);
      return res.status(502).json({ message: "Image proxy error" });
    }
  });

  const trafficWindowMs = 60 * 60 * 1000;
  const onlineWindowMs = 10 * 60 * 1000;
  const requestEvents: Array<{
    ts: number;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    userId?: string;
  }> = [];
  const userLastSeen = new Map<string, number>();

  const normalizeTrafficPath = (path: string) =>
    String(path || "")
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":uuid");

  const getClientIp = (req: any) => {
    const forwarded = String(req.headers?.["x-forwarded-for"] || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (forwarded.length > 0) return forwarded[0];
    return String(req.ip || req.socket?.remoteAddress || "");
  };

  const writeAuditLog = async (
    actorUserId: string,
    action: string,
    meta: Record<string, any> = {},
  ) => {
    try {
      const { db } = await import("./db.js");
      const { auditLogs } = await import("../shared/schema.js");
      await db.insert(auditLogs).values({
        userId: actorUserId,
        action,
        meta,
      } as any);
    } catch (error) {
      console.warn("Failed to write audit log:", error);
    }
  };

  const pruneTraffic = () => {
    const now = Date.now();
    while (requestEvents.length > 0 && now - requestEvents[0].ts > trafficWindowMs) {
      requestEvents.shift();
    }
    userLastSeen.forEach((ts, userId) => {
      if (now - ts > onlineWindowMs) {
        userLastSeen.delete(userId);
      }
    });
  };

  app.use((req: any, res, next) => {
    if (!String(req.path || "").startsWith("/api")) return next();
    const startedAt = Date.now();
    const method = String(req.method || "GET").toUpperCase();
    const normalizedPath = normalizeTrafficPath(String(req.path || ""));

    res.on("finish", () => {
      const now = Date.now();
      const userId =
        req?.authUserId ||
        req?.user?.claims?.sub ||
        req?.user?.id ||
        undefined;

      requestEvents.push({
        ts: now,
        method,
        path: normalizedPath,
        status: Number(res.statusCode || 0),
        durationMs: Math.max(0, now - startedAt),
        userId: userId ? String(userId) : undefined,
      });

      if (userId) {
        userLastSeen.set(String(userId), now);
      }

      pruneTraffic();
    });

    next();
  });

  let autoWithdrawEnabled = true;

  const processEligibleAutoWithdrawals = async () => {
    if (!autoWithdrawEnabled) return;
    try {
      const { db } = await import("./db.js");
      const { withdrawalRequests, wallets, transactions } = await import("../shared/schema.js");
      const { and, eq, lte, sql } = await import("drizzle-orm");

      const eligible = await db
  .select()
  .from(withdrawalRequests)
  .where(
    and(
      eq(withdrawalRequests.status, "pending" as any),
      eq(withdrawalRequests.destinationVerified, true),
      lte(withdrawalRequests.releaseAfter, new Date()),
    ),
  );

      for (const withdrawal of eligible) {
        await db.transaction(async (tx) => {
          const [fresh] = await tx
            .select()
            .from(withdrawalRequests)
            .where(eq(withdrawalRequests.id, withdrawal.id))
            .for("update");

          if (!fresh || fresh.status !== "pending" || !fresh.destinationVerified) return;

          await tx
            .update(wallets)
            .set({ lockedBalance: sql`${wallets.lockedBalance} - ${fresh.amount}` } as any)
            .where(eq(wallets.userId, fresh.userId));

          await tx.insert(transactions).values({
            userId: fresh.userId,
            type: "withdrawal",
            amount: -fresh.amount,
            grossAmount: fresh.amount,
            feeAmount: fresh.fee,
            netAmount: fresh.netAmount,
            sourceType: "withdrawal",
            status: "completed",
            description: `Withdrawal auto-approved: ${fresh.netAmount} (fee: ${fresh.fee})`,
          } as any);

          await tx
            .update(withdrawalRequests)
            .set({
              status: "paid",
              adminNotes: "Auto-approved after 24h destination hold + email verification",
              reviewedAt: new Date(),
              verificationToken: null,
            } as any)
            .where(eq(withdrawalRequests.id, fresh.id));
        });
      }
    } catch (error) {
      const code = (error as any)?.code;
      if (code === "42703" || code === "42P01") {
        autoWithdrawEnabled = false;
        console.warn("Auto-withdraw disabled until DB schema is updated:", error);
        return;
      }
      console.error("Auto-withdrawal processing failed:", error);
    }
  };

  const ensureRuntimeSchema = async () => {
    try {
      const { db } = await import("./db.js");
      const { sql } = await import("drizzle-orm");

      await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS destination_key text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS destination_verified boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS verification_token text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.withdrawal_requests ADD COLUMN IF NOT EXISTS release_after timestamp`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS gross_amount real DEFAULT 0`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS fee_amount real DEFAULT 0`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS net_amount real DEFAULT 0`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.transactions ADD COLUMN IF NOT EXISTS source_type text DEFAULT ''`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.notifications (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id varchar(255) NOT NULL REFERENCES app.users(id),
          type text NOT NULL DEFAULT 'system',
          title text NOT NULL,
          message text NOT NULL,
          read boolean NOT NULL DEFAULT false,
          created_at timestamp DEFAULT now()
        )
      `);

      await db.execute(sql`ALTER TABLE IF EXISTS app.users ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.users ADD COLUMN IF NOT EXISTS ban_reason text`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.users ADD COLUMN IF NOT EXISTS banned_at timestamp`);
      await db.execute(sql`ALTER TABLE IF EXISTS app.users ADD COLUMN IF NOT EXISTS banned_by varchar(255)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.referrals (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          referrer_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          referred_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          reward_card_id integer REFERENCES app.player_cards(id),
          created_at timestamp DEFAULT now(),
          UNIQUE (referrer_user_id, referred_user_id),
          UNIQUE (referred_user_id)
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.competition_reward_claims (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          entry_id integer NOT NULL UNIQUE REFERENCES app.competition_entries(id),
          user_id varchar(255) NOT NULL REFERENCES app.users(id),
          competition_id integer NOT NULL REFERENCES app.competitions(id),
          prize_amount real NOT NULL DEFAULT 0,
          prize_card_id integer REFERENCES app.player_cards(id),
          claimed_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.pack_auctions (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          seller_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          rarity text NOT NULL,
          card_ids jsonb NOT NULL,
          status text NOT NULL DEFAULT 'live',
          start_price real NOT NULL DEFAULT 0,
          reserve_price real NOT NULL DEFAULT 0,
          buy_now_price real,
          min_increment real NOT NULL DEFAULT 1,
          starts_at timestamp,
          ends_at timestamp,
          created_at timestamp DEFAULT now()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app.pack_auction_bids (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          pack_auction_id integer NOT NULL REFERENCES app.pack_auctions(id),
          bidder_user_id varchar(255) NOT NULL REFERENCES app.users(id),
          amount real NOT NULL,
          created_at timestamp DEFAULT now()
        )
      `);
    } catch (error) {
      console.warn("Runtime schema ensure failed:", error);
    }
  };

  await ensureRuntimeSchema();

  // User Profile
  app.get("/api/user", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (e: any) {
      console.error("Get user:", e);
      res.status(500).json({ message: e?.message || "Failed to get user" });
    }
  });

  app.patch("/api/user/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { managerTeamName, name, email, avatarUrl } = req.body;
      
      const updates: Partial<any> = {};
      if (managerTeamName !== undefined) updates.managerTeamName = managerTeamName;
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      
      const updated = await storage.updateUser(userId, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(updated);
    } catch (e: any) {
      console.error("Update user profile:", e);
      res.status(500).json({ message: e?.message || "Failed to update profile" });
    }
  });

  app.get("/api/referrals/me", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const code = encodeReferralCode(userId);
      const publicBase = String(process.env.PUBLIC_BASE_URL || "").trim();
      const fallback = `${req.protocol}://${req.get("host") || ""}`;
      const base = publicBase || fallback;
      const url = `${base.replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}`;
      return res.json({ code, url });
    } catch (error: any) {
      console.error("Failed to get referral code:", error);
      return res.status(500).json({ message: "Failed to get referral code" });
    }
  });

  app.get("/api/referrals/history", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "").trim();
      const { db } = await import("./db.js");

      const rows = await db.execute(sql`
        SELECT
          r.id,
          r.referred_user_id,
          r.reward_card_id,
          r.created_at,
          u.name AS referred_name,
          u.email AS referred_email
        FROM app.referrals r
        LEFT JOIN app.users u ON u.id = r.referred_user_id
        WHERE r.referrer_user_id = ${userId}
        ORDER BY r.created_at DESC
      `);

      const referrals = Array.isArray((rows as any)?.rows) ? (rows as any).rows : [];
      const enriched = await Promise.all(
        referrals.map(async (row: any) => {
          const rewardCardId = row?.reward_card_id == null ? null : Number(row.reward_card_id);
          const rewardCard = rewardCardId ? await storage.getPlayerCardWithPlayer(rewardCardId, userId) : null;
          return {
            id: Number(row.id),
            referredUserId: String(row.referred_user_id || ""),
            referredName: String(row.referred_name || "").trim() || "Manager",
            referredEmail: String(row.referred_email || "").trim() || null,
            rewardCardId,
            rewardCard,
            createdAt: row.created_at,
          };
        }),
      );

      return res.json({
        referrals: enriched,
        totalReferrals: enriched.length,
        rewardsGranted: enriched.filter((item) => Number(item.rewardCardId || 0) > 0).length,
      });
    } catch (error: any) {
      console.error("Failed to fetch referral history:", error);
      return res.status(500).json({ message: "Failed to fetch referral history" });
    }
  });

  app.post("/api/referrals/claim", requireAuth, async (req: any, res) => {
    try {
      const referredUserId = String(req.authUserId || "").trim();
      const rawCode = String(req.body?.code || "").trim();
      if (!rawCode) {
        return res.status(400).json({ message: "Referral code required" });
      }

      const referrerUserId = decodeReferralCode(rawCode);
      if (!referrerUserId) {
        return res.status(400).json({ message: "Invalid referral code" });
      }
      if (referrerUserId === referredUserId) {
        return res.status(400).json({ message: "You cannot refer yourself" });
      }

      const referrer = await storage.getUser(referrerUserId);
      if (!referrer) {
        return res.status(404).json({ message: "Referrer account not found" });
      }

      const { db } = await import("./db.js");
      const existingRows = await db.execute(sql`
        SELECT id, reward_card_id
        FROM app.referrals
        WHERE referred_user_id = ${referredUserId}
        LIMIT 1
      `);
      const existing = Array.isArray((existingRows as any)?.rows) ? (existingRows as any).rows[0] : null;
      if (existing) {
        return res.json({ success: true, alreadyClaimed: true, rewardCardId: existing.reward_card_id ?? null });
      }

      const rewardCardId = await grantReferralRewardCard(referrerUserId);

      await db.execute(sql`
        INSERT INTO app.referrals (referrer_user_id, referred_user_id, reward_card_id)
        VALUES (${referrerUserId}, ${referredUserId}, ${rewardCardId})
        ON CONFLICT (referred_user_id) DO NOTHING
      `);

      return res.json({ success: true, alreadyClaimed: false, rewardCardId });
    } catch (error: any) {
      console.error("Failed to claim referral:", error);
      return res.status(500).json({ message: "Failed to claim referral" });
    }
  });

  app.get("/api/live-chat/messages", requireAuth, async (req: any, res) => {
    try {
      const limit = Math.max(1, Math.min(80, Number(req.query.limit || 40) || 40));
      return res.json(liveChatMessagesStore.slice(-limit));
    } catch (error: any) {
      console.error("Failed to fetch live chat messages:", error);
      return res.status(500).json({ message: "Failed to fetch chat" });
    }
  });

  app.post("/api/live-chat/messages", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const user = await storage.getUser(userId);
      const text = String(req.body?.text || "").trim().slice(0, 280);
      if (!text) {
        return res.status(400).json({ message: "Message text is required" });
      }

      const replyToMessageId = String(req.body?.replyToMessageId || "").trim();
      const replyTo = replyToMessageId
        ? liveChatMessagesStore.find((message) => message.id === replyToMessageId)
        : undefined;

      const message = {
        id: randomUUID(),
        userId,
        userName: String(user?.name || user?.firstName || user?.email || "Manager"),
        text,
        createdAt: new Date().toISOString(),
        ...(replyTo
          ? {
              replyToMessageId: replyTo.id,
              replyToUserId: replyTo.userId,
              replyToUserName: replyTo.userName,
              replyToText: replyTo.text,
            }
          : {}),
      };

      liveChatMessagesStore.push(message);
      while (liveChatMessagesStore.length > LIVE_CHAT_MAX_MESSAGES) {
        liveChatMessagesStore.shift();
      }

      try {
        const { db } = await import("./db.js");
        const { notifications, users } = await import("../shared/schema.js");
        const { eq, sql: drizzleSql } = await import("drizzle-orm");

        const recipients = new Set<string>();

        if (replyTo?.userId && replyTo.userId !== userId) {
          recipients.add(String(replyTo.userId));
        }

        const mentionMatches = String(text)
          .match(/@([a-zA-Z0-9_.-]{2,40})/g)
          ?.map((value) => value.slice(1).toLowerCase()) || [];
        const mentionHandles = Array.from(new Set(mentionMatches));

        for (const handle of mentionHandles) {
          const [mentioned] = await db
            .select({ id: users.id })
            .from(users)
            .where(
              drizzleSql`lower(coalesce(${users.name}, '')) = ${handle} or lower(coalesce(${users.firstName}, '')) = ${handle}`,
            )
            .limit(1);

          if (mentioned?.id && String(mentioned.id) !== userId) {
            recipients.add(String(mentioned.id));
          }
        }

        for (const recipientId of Array.from(recipients)) {
          const title = "New chat mention";
          const body = `${message.userName}: ${String(text).slice(0, 180)}`;

          await db.insert(notifications).values({
            userId: recipientId,
            type: "system",
            title,
            message: body,
            read: false,
          } as any);
        }
      } catch (notifyError) {
        console.warn("Live chat notify failed:", notifyError);
      }

      return res.status(201).json(message);
    } catch (error: any) {
      console.error("Failed to send live chat message:", error);
      return res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/live/point-feed", requireAuth, async (req: any, res) => {
    try {
      pushLivePointEvent();
      const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));
      return res.json(livePointFeedStore.slice(-limit));
    } catch (error: any) {
      console.error("Failed to fetch point feed:", error);
      return res.status(500).json({ message: "Failed to fetch point feed" });
    }
  });

  app.get("/api/live/hub", requireAuth, async (_req: any, res) => {
    try {
      pushLivePointEvent();
      const [liveGames, listings, competitions] = await Promise.all([
        fplApi.getLiveGames().catch(() => []),
        storage.getMarketplaceListings().catch(() => []),
        storage.getCompetitions().catch(() => []),
      ]);

      const { db } = await import("./db.js");
      const { transactions } = await import("../shared/schema.js");
      const recentTransactions = await db
        .select()
        .from(transactions)
        .orderBy(sql`${transactions.createdAt} desc`)
        .limit(40);

      const recentSales = recentTransactions
        .filter((tx: any) => String(tx.type) === "purchase")
        .slice(0, 8)
        .map((tx: any) => ({
          id: tx.id,
          userId: tx.userId,
          amount: Number(tx.amount || 0),
          description: String(tx.description || ""),
          createdAt: tx.createdAt,
        }));

      return res.json({
        updatedAt: new Date().toISOString(),
        liveMatches: Array.isArray(liveGames) ? liveGames.length : 0,
        activeListings: Array.isArray(listings) ? listings.length : 0,
        liveCompetitions: (Array.isArray(competitions) ? competitions : []).filter((c: any) => String(c.status) === "active" || String(c.status) === "open").length,
        pointFeed: livePointFeedStore.slice(-8),
        chatHighlights: liveChatMessagesStore.slice(-6),
        recentSales,
      });
    } catch (error: any) {
      console.error("Failed to build live hub feed:", error);
      return res.status(500).json({ message: "Failed to build live hub feed" });
    }
  });

  app.post("/api/ai/help", requireAuth, async (req: any, res) => {
    try {
      const message = String(req.body?.message || "").trim().toLowerCase();
      if (!message) {
        return res.status(400).json({ message: "Question is required" });
      }

      const userId = String(req.authUserId || "");
      const cards = await storage.getUserCards(userId);
      const rarityCount = (Array.isArray(cards) ? cards : []).reduce((acc: Record<string, number>, card: any) => {
        const rarity = String(card?.rarity || "common").toLowerCase();
        acc[rarity] = (acc[rarity] || 0) + 1;
        return acc;
      }, {});

      let answer = "Focus on building a full 5-card lineup with one GK, DEF, MID, and FWD before entering tournaments.";
      if (message.includes("rare")) {
        answer = `For rare tournaments, only rare cards are allowed. You currently have ${rarityCount.rare || 0} rare cards.`;
      } else if (message.includes("lineup") || message.includes("team")) {
        answer = "A valid lineup needs exactly 5 cards with role coverage: GK, DEF, MID, FWD, plus one utility slot.";
      } else if (message.includes("auction") || message.includes("market")) {
        answer = "Auction and marketplace entries work best when you keep tournament cards unlocked and list duplicates or upgrades.";
      } else if (message.includes("referral") || message.includes("invite")) {
        answer = "Share your referral link from your account. Each successful signup gives the referrer one random common card they do not own yet.";
      }

      return res.json({ answer });
    } catch (error: any) {
      console.error("AI help failed:", error);
      return res.status(500).json({ message: "Failed to generate help response" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { db } = await import("./db.js");
      const { notifications } = await import("../shared/schema.js");
      const { eq, desc, and, sql } = await import("drizzle-orm");

      const items = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(100);

      const [unread] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

      res.json({ notifications: items, unreadCount: Number(unread?.count || 0) });
    } catch (error: any) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const notificationId = parseInt(req.params.id, 10);
      if (!Number.isFinite(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }

      const { db } = await import("./db.js");
      const { notifications } = await import("../shared/schema.js");
      const { and, eq } = await import("drizzle-orm");

      const [updated] = await db
        .update(notifications)
        .set({ read: true } as any)
        .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to mark notification read:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { db } = await import("./db.js");
      const { notifications } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");

      await db
        .update(notifications)
        .set({ read: true } as any)
        .where(eq(notifications.userId, userId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to mark notifications read:", error);
      res.status(500).json({ message: "Failed to update notifications" });
    }
  });

  app.get("/api/epl/standings", async (_req, res) => {
    try {
      const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixtures()]);
      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];

      const computedTable = new Map<number, {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        points: number;
      }>();

      teams.forEach((team: any) => {
        computedTable.set(Number(team.id), {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        });
      });

      (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
        if (!isFixtureInCurrentSeason(fixture)) return;
        if (!isFixtureLikelyFinished(fixture)) return;
        const homeId = Number(fixture.team_h);
        const awayId = Number(fixture.team_a);
        const homeGoals = Number(fixture.team_h_score ?? 0);
        const awayGoals = Number(fixture.team_a_score ?? 0);

        const home = computedTable.get(homeId);
        const away = computedTable.get(awayId);
        if (!home || !away) return;

        home.played += 1;
        away.played += 1;
        home.goalsFor += homeGoals;
        home.goalsAgainst += awayGoals;
        away.goalsFor += awayGoals;
        away.goalsAgainst += homeGoals;

        if (homeGoals > awayGoals) {
          home.won += 1;
          away.lost += 1;
          home.points += 3;
        } else if (homeGoals < awayGoals) {
          away.won += 1;
          home.lost += 1;
          away.points += 3;
        } else {
          home.drawn += 1;
          away.drawn += 1;
          home.points += 1;
          away.points += 1;
        }
      });

      const standings = teams
        .map((team: any) => ({
          position: Number(team.position) || 0,
          rank: Number(team.position) || 0,
          teamId: Number(team.id) || 0,
          teamName: String(team.name || "Unknown"),
          played: computedTable.get(Number(team.id))?.played ?? 0,
          won: computedTable.get(Number(team.id))?.won ?? 0,
          drawn: computedTable.get(Number(team.id))?.drawn ?? 0,
          lost: computedTable.get(Number(team.id))?.lost ?? 0,
          goalsFor: computedTable.get(Number(team.id))?.goalsFor ?? 0,
          goalsAgainst: computedTable.get(Number(team.id))?.goalsAgainst ?? 0,
          goalDifference:
            (computedTable.get(Number(team.id))?.goalsFor ?? 0) -
            (computedTable.get(Number(team.id))?.goalsAgainst ?? 0),
          goalDiff:
            (computedTable.get(Number(team.id))?.goalsFor ?? 0) -
            (computedTable.get(Number(team.id))?.goalsAgainst ?? 0),
          points: computedTable.get(Number(team.id))?.points ?? 0,
          form: String(team.form || "").replace(/\s+/g, ""),
          teamLogo: "",
          logo: "",
        }))
        .sort((a: any, b: any) => {
          if (b.points !== a.points) return b.points - a.points;
          if ((b.goalDiff ?? 0) !== (a.goalDiff ?? 0)) return (b.goalDiff ?? 0) - (a.goalDiff ?? 0);
          return b.goalsFor - a.goalsFor;
        })
        .map((team: any, idx: number) => ({ ...team, rank: idx + 1, position: idx + 1 }));

      res.json(standings);
    } catch (e: any) {
      console.error("EPL standings:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch standings" });
    }
  });

  app.get("/api/epl/fixtures", async (req, res) => {
    try {
      const status = String(req.query.status || "").toLowerCase().trim();
      const [fixtures, bootstrap] = await Promise.all([fplApi.fixtures(), fplApi.bootstrap()]);

      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const teamMap = new Map(teams.map((t: any) => [Number(t.id), t]));

      let filtered = (Array.isArray(fixtures) ? fixtures : []).filter((f: any) => isFixtureInCurrentSeason(f));
      if (status) {
        if (status === "upcoming" || status === "scheduled") {
          filtered = filtered.filter((f: any) => !isFixtureLikelyFinished(f) && !f.started);
        } else if (status === "live" || status === "inplay") {
          filtered = filtered.filter((f: any) => f.started && !isFixtureLikelyFinished(f));
        } else if (status === "finished" || status === "ft") {
          filtered = filtered.filter((f: any) => isFixtureLikelyFinished(f));
        }
      }

      if (status === "finished" || status === "ft") {
        const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter((f: any) => {
          const kickoff = f?.kickoff_time ? new Date(String(f.kickoff_time)).getTime() : 0;
          return Number.isFinite(kickoff) && kickoff >= recentCutoff;
        });
      }

      const normalized = filtered
        .map((fixture: any) => {
          const homeTeam = teamMap.get(Number(fixture.team_h)) as any;
          const awayTeam = teamMap.get(Number(fixture.team_a)) as any;

          const statusCode = isFixtureLikelyFinished(fixture) ? "FT" : fixture.started ? "LIVE" : "NS";

          return {
            id: Number(fixture.id),
            gameweek: Number(fixture.event) || undefined,
            round: Number(fixture.event) || undefined,
            homeTeam: String(homeTeam?.name || `Team ${fixture.team_h}`),
            awayTeam: String(awayTeam?.name || `Team ${fixture.team_a}`),
            homeTeamId: Number(fixture.team_h),
            awayTeamId: Number(fixture.team_a),
            status: statusCode,
            kickoffTime: fixture.kickoff_time || undefined,
            matchDate: fixture.kickoff_time || undefined,
            homeTeamLogo: "",
            awayTeamLogo: "",
            homeGoals: fixture.team_h_score ?? null,
            awayGoals: fixture.team_a_score ?? null,
            elapsed: Number(fixture.minutes) || 0,
            venue: "",
          };
        })
        .sort((a: any, b: any) => {
          const ta = a.matchDate ? new Date(a.matchDate).getTime() : 0;
          const tb = b.matchDate ? new Date(b.matchDate).getTime() : 0;
          if (status === "finished" || status === "ft") return tb - ta;
          return ta - tb;
        });

      res.json(normalized);
    } catch (e: any) {
      console.error("EPL fixtures:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch fixtures" });
    }
  });

  app.get("/api/epl/players", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "100"), 10)));

      const search = String(req.query.search || "").toLowerCase().trim();
      const position = String(req.query.position || "").trim(); // optional: GK/DEF/MID/FWD
      const todayOnly = String(req.query.today || "").toLowerCase() === "1" || String(req.query.today || "").toLowerCase() === "true";

      const [players, bootstrap, fixtures] = await Promise.all([
        fplApi.getPlayers(),
        fplApi.bootstrap(),
        fplApi.fixtures(),
      ]);

      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const teamMap = new Map(teams.map((t: any) => [Number(t.id), t]));

      const positionMap: Record<number, string> = {
        1: "Goalkeeper",
        2: "Defender",
        3: "Midfielder",
        4: "Attacker",
      };

      const today = new Date();
      const isSameUtcDay = (dateStr: string) => {
        const d = new Date(dateStr);
        return (
          d.getUTCFullYear() === today.getUTCFullYear() &&
          d.getUTCMonth() === today.getUTCMonth() &&
          d.getUTCDate() === today.getUTCDate()
        );
      };

      const todayTeamIds = new Set<number>();
      if (todayOnly) {
        (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
          if (fixture?.kickoff_time && isSameUtcDay(String(fixture.kickoff_time))) {
            todayTeamIds.add(Number(fixture.team_h));
            todayTeamIds.add(Number(fixture.team_a));
          }
        });
      }

      const normalizedPlayers = (Array.isArray(players) ? players : []).map((p: any) => {
        const team = teamMap.get(Number(p.team)) as any;
        const photoUrl = fplApi.playerPhotoUrl(p, 250);

        return {
          id: Number(p.id),
          name: String(p.web_name || `${p.first_name || ""} ${p.second_name || ""}`.trim() || "Unknown"),
          firstname: p.first_name || "",
          lastname: p.second_name || "",
          firstName: p.first_name || "",
          lastName: p.second_name || "",
          rating: Number(p.form || 0),
          goals: Number(p.goals_scored || 0),
          assists: Number(p.assists || 0),
          appearances: Number(p.starts || 0),
          minutes: Number(p.minutes || 0),
          position: positionMap[Number(p.element_type)] || "Midfielder",
          team: team?.name || "Unknown",
          club: team?.name || "Unknown",
          teamLogo: "",
          clubLogo: "",
          photo: photoUrl,
          photoUrl,
          imageUrl: photoUrl,
          nationality: "",
          age: 0,
          stats: p,
          _teamId: Number(p.team),
        };
      });

      let filtered = normalizedPlayers;

      if (todayOnly) {
        filtered = filtered.filter((p: any) => todayTeamIds.has(Number(p._teamId)));
      }

      if (search) {
        filtered = filtered.filter((p: any) => String(p.name || "").toLowerCase().includes(search) || String(p.team || "").toLowerCase().includes(search));
      }

      if (position) {
        const pos = position.toUpperCase();
        const map: Record<string, string> = {
          GK: "GOALKEEPER",
          DEF: "DEFENDER",
          MID: "MIDFIELDER",
          FWD: "ATTACKER",
        };
        const wanted = map[pos] || pos;

        filtered = filtered.filter((p: any) => String(p.position || "").toUpperCase() === wanted);
      }

      const total = filtered.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const pageItems = filtered.slice(start, end).map((p: any) => {
        const { _teamId, ...clean } = p;
        return clean;
      });

      res.json({
        response: pageItems,
        results: pageItems.length,
        paging: { current: page, total: Math.max(1, Math.ceil(total / limit)) },
        total,
      });
    } catch (e: any) {
      console.error("EPL players:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch players" });
    }
  });

  /**
   * Proxy endpoint for a single FPL player (prevents CORS issues from browser clients).
   */
  app.get("/api/proxy/fpl/player/:fplId", async (req, res) => {
    try {
      const fplId = Number(req.params.fplId || 0);
      if (!fplId) return res.status(400).json({ message: "Invalid fplId" });

      const bootstrap = await fplApi.bootstrap();
      const player = (Array.isArray((bootstrap as any)?.elements) ? (bootstrap as any).elements : []).find(
        (item: any) => Number(item.id) === fplId,
      );
      if (!player) return res.status(404).json({ message: "Player not found in FPL" });

      const team = (Array.isArray((bootstrap as any)?.teams) ? (bootstrap as any).teams : []).find(
        (item: any) => Number(item.id) === Number(player.team),
      );

      return res.json({
        id: Number(player.id),
        firstName: String(player.first_name || ""),
        lastName: String(player.second_name || ""),
        name: `${String(player.first_name || "").trim()} ${String(player.second_name || "").trim()}`.trim() || String(player.web_name || "Unknown"),
        teamName: String(team?.name || ""),
        teamCode: String(team?.short_name || ""),
        totalPoints: Number(player.total_points || 0),
        influence: Number(player.influence || 0),
        ictIndex: Number(player.ict_index || 0),
        form: Number(player.form || 0),
        price: Number(player.now_cost || 0) / 10,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch FPL player" });
    }
  });

  /**
   * Proxy endpoint that matches API-Football player info to an FPL player by name+team.
   * Uses short-lived cache to reduce upstream traffic and prepare for future Postgres caching.
   */
  app.get("/api/proxy/api-football/by-fpl/:fplId", async (req, res) => {
    try {
      const fplId = Number(req.params.fplId || 0);
      if (!fplId) return res.status(400).json({ message: "Invalid fplId" });

      const cacheKey = `api-football:fpl:${fplId}`;
      const cached = playerMergeCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.value);
      }

      const apiKey = String(process.env.API_FOOTBALL_KEY || "").trim();
      if (!apiKey) {
        const fallback = { photo: "", nationality: "", flag: "", matched: false };
        playerMergeCache.set(cacheKey, { value: fallback, expiresAt: Date.now() + 30 * 60 * 1000 });
        return res.json(fallback);
      }

      const bootstrap = await fplApi.bootstrap();
      const fplPlayer = (Array.isArray((bootstrap as any)?.elements) ? (bootstrap as any).elements : []).find(
        (item: any) => Number(item.id) === fplId,
      );
      if (!fplPlayer) return res.status(404).json({ message: "Player not found in FPL" });
      const fplTeam = (Array.isArray((bootstrap as any)?.teams) ? (bootstrap as any).teams : []).find(
        (item: any) => Number(item.id) === Number(fplPlayer.team),
      );

      const fullName = `${String(fplPlayer.first_name || "").trim()} ${String(fplPlayer.second_name || "").trim()}`.trim();
      const lastName = String(fplPlayer.second_name || fplPlayer.web_name || "").trim();
      const searchTerm = encodeURIComponent(lastName || fullName);
      const season = new Date().getUTCFullYear();
      const url = `https://v3.football.api-sports.io/players?league=39&season=${season}&search=${searchTerm}`;

      const response = await fetch(url, {
        headers: {
          "x-apisports-key": apiKey,
        },
      });
      if (!response.ok) {
        return res.status(502).json({ message: "Failed to fetch API-Football player" });
      }

      const json = (await response.json()) as any;
      const candidates = Array.isArray(json?.response) ? json.response : [];
      const normalizedName = normalizePlayerName(fullName || String(fplPlayer.web_name || ""));
      const normalizedTeam = normalizePlayerName(String(fplTeam?.name || ""));

      const best = candidates
        .map((entry: any) => {
          const playerName = normalizePlayerName(String(entry?.player?.name || ""));
          const teamName = normalizePlayerName(String(entry?.statistics?.[0]?.team?.name || ""));
          let score = 0;
          if (playerName === normalizedName) score += 3;
          if (playerName.includes(normalizedName) || normalizedName.includes(playerName)) score += 2;
          if (teamName && normalizedTeam && teamName.includes(normalizedTeam)) score += 2;
          return { score, entry };
        })
        .sort((a: any, b: any) => b.score - a.score)[0]?.entry;

      const payload = {
        photo: String(best?.player?.photo || ""),
        nationality: String(best?.player?.nationality || ""),
        flag: String(best?.player?.birth?.country ? "" : best?.player?.nationality || ""),
        matched: Boolean(best),
      };

      playerMergeCache.set(cacheKey, { value: payload, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
      return res.json(payload);
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch API-Football proxy" });
    }
  });

  app.get("/api/epl/injuries", async (_req, res) => {
    try {
      const data = await fplApi.getInjuries();
      const injuries = (Array.isArray(data) ? data : []).map((inj: any, index: number) => ({
        id: index + 1,
        playerId: Number(inj.playerId) || 0,
        playerName: String(inj.name || "Unknown"),
        playerPhoto: "",
        status: String(inj.status || "unknown"),
        expectedReturn: String(inj.news || "TBD"),
      }));

      res.json(injuries);
    } catch (e: any) {
      console.error("EPL injuries:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch injuries" });
    }
  });

  // Live Games Endpoint
  app.get("/api/epl/live-games", async (_req, res) => {
    try {
      const liveGames = await fplApi.getLiveGames();
      res.json(liveGames);
    } catch (e: any) {
      console.error("EPL live games:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch live games" });
    }
  });

  app.get("/api/leagues/meta", async (_req, res) => {
    const hasApiFootball = Boolean(process.env.API_FOOTBALL_KEY);
    const leagues = Object.entries(MAJOR_LEAGUES).map(([key, league]) => ({
      key,
      ...league,
      provider: key === "premier-league" ? "fpl" : "api-football",
      liveEnabled: key === "premier-league" ? true : hasApiFootball,
    }));
    return res.json({ leagues, hasApiFootball });
  });

  app.get("/api/leagues/:leagueKey/standings", async (req: any, res) => {
    try {
      const leagueKey = String(req.params.leagueKey || "").toLowerCase();
      if (leagueKey === "premier-league") {
        const [bootstrap, fixtures] = await Promise.all([fplApi.bootstrap(), fplApi.fixtures()]);
        const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
        const computedTable = new Map<number, { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }>();
        teams.forEach((team: any) => computedTable.set(Number(team.id), { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }));
        (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
          if (!isFixtureInCurrentSeason(fixture) || !isFixtureLikelyFinished(fixture)) return;
          const homeId = Number(fixture.team_h);
          const awayId = Number(fixture.team_a);
          const homeGoals = Number(fixture.team_h_score ?? 0);
          const awayGoals = Number(fixture.team_a_score ?? 0);
          const home = computedTable.get(homeId);
          const away = computedTable.get(awayId);
          if (!home || !away) return;
          home.played += 1; away.played += 1;
          home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
          away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
          if (homeGoals > awayGoals) { home.won += 1; away.lost += 1; home.points += 3; }
          else if (homeGoals < awayGoals) { away.won += 1; home.lost += 1; away.points += 3; }
          else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
        });
        const standings = teams
          .map((team: any) => ({
            position: 0, rank: 0, teamId: Number(team.id), teamName: String(team.name || "Unknown"), played: computedTable.get(Number(team.id))?.played ?? 0,
            won: computedTable.get(Number(team.id))?.won ?? 0, drawn: computedTable.get(Number(team.id))?.drawn ?? 0, lost: computedTable.get(Number(team.id))?.lost ?? 0,
            goalsFor: computedTable.get(Number(team.id))?.goalsFor ?? 0, goalsAgainst: computedTable.get(Number(team.id))?.goalsAgainst ?? 0,
            goalDifference: (computedTable.get(Number(team.id))?.goalsFor ?? 0) - (computedTable.get(Number(team.id))?.goalsAgainst ?? 0),
            goalDiff: (computedTable.get(Number(team.id))?.goalsFor ?? 0) - (computedTable.get(Number(team.id))?.goalsAgainst ?? 0),
            points: computedTable.get(Number(team.id))?.points ?? 0, form: String(team.form || "").replace(/\s+/g, ""), teamLogo: "", logo: "",
          }))
          .sort((a: any, b: any) => (b.points - a.points) || ((b.goalDiff ?? 0) - (a.goalDiff ?? 0)) || (b.goalsFor - a.goalsFor))
          .map((row: any, idx: number) => ({ ...row, rank: idx + 1, position: idx + 1 }));
        return res.json(standings);
      }
      if (!(leagueKey in MAJOR_LEAGUES)) return res.status(400).json({ message: "Unsupported league" });
      const data = await getMajorLeagueStandings(leagueKey as any);
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch standings" });
    }
  });

  app.get("/api/leagues/:leagueKey/fixtures", async (req: any, res) => {
    try {
      const leagueKey = String(req.params.leagueKey || "").toLowerCase();
      const status = String(req.query.status || "").toLowerCase();
      if (leagueKey === "premier-league") {
        const [fixtures, bootstrap] = await Promise.all([fplApi.fixtures(), fplApi.bootstrap()]);
        const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
        const teamMap = new Map<number, any>(teams.map((t: any) => [Number(t.id), t]));
        let filtered = (Array.isArray(fixtures) ? fixtures : []).filter((f: any) => isFixtureInCurrentSeason(f));
        if (status === "upcoming") filtered = filtered.filter((f: any) => !isFixtureLikelyFinished(f) && !f.started);
        else if (status === "live") filtered = filtered.filter((f: any) => f.started && !isFixtureLikelyFinished(f));
        else if (status === "finished") filtered = filtered.filter((f: any) => isFixtureLikelyFinished(f));
        const normalized = filtered.map((fixture: any) => ({
          id: Number(fixture.id || 0),
          matchId: Number(fixture.id || 0),
          date: fixture.kickoff_time || null,
          kickoffTime: fixture.kickoff_time || null,
          status: isFixtureLikelyFinished(fixture) ? "FT" : fixture.started ? "LIVE" : "NS",
          homeTeam: { id: Number(fixture.team_h || 0), name: String(teamMap.get(Number(fixture.team_h))?.name || "Home"), logo: "", score: Number(fixture.team_h_score ?? 0) },
          awayTeam: { id: Number(fixture.team_a || 0), name: String(teamMap.get(Number(fixture.team_a))?.name || "Away"), logo: "", score: Number(fixture.team_a_score ?? 0) },
          venue: "",
        }));
        return res.json(normalized);
      }
      if (!(leagueKey in MAJOR_LEAGUES)) return res.status(400).json({ message: "Unsupported league" });
      const data = await getMajorLeagueFixtures(leagueKey as any, status);
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch fixtures" });
    }
  });

  app.get("/api/leagues/:leagueKey/live-games", async (req: any, res) => {
    try {
      const leagueKey = String(req.params.leagueKey || "").toLowerCase();
      if (leagueKey === "premier-league") {
        const liveGames = await fplApi.getLiveGames();
        return res.json(liveGames);
      }
      if (!(leagueKey in MAJOR_LEAGUES)) return res.status(400).json({ message: "Unsupported league" });
      const data = await getMajorLeagueLiveGames(leagueKey as any);
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch live games" });
    }
  });

  app.get("/api/leagues/:leagueKey/players", async (req: any, res) => {
    try {
      const leagueKey = String(req.params.leagueKey || "").toLowerCase();
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const search = String(req.query.search || "");
      const position = String(req.query.position || "");
      const todayOnly = String(req.query.today || "") === "1";

      if (leagueKey === "premier-league") {
        const [fplPlayers, bootstrap, fixtures] = await Promise.all([fplApi.getPlayers(), fplApi.bootstrap(), fplApi.fixtures()]);
        const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
        const teamMap = new Map<number, any>(teams.map((team: any) => [Number(team.id), team]));
        const positionMap: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
        let normalized = (Array.isArray(fplPlayers) ? fplPlayers : []).map((player: any) => ({
          id: Number(player.id || 0),
          playerId: Number(player.id || 0),
          name: `${String(player.first_name || "").trim()} ${String(player.second_name || "").trim()}`.trim() || String(player.web_name || "Unknown"),
          firstName: String(player.first_name || ""),
          lastName: String(player.second_name || ""),
          age: 0,
          nationality: "",
          team: String(teamMap.get(Number(player.team))?.name || "Unknown"),
          position: positionMap[Number(player.element_type)] || "MID",
          photo: fplApi.playerPhotoUrl(player, 250),
          imageUrl: fplApi.playerPhotoUrl(player, 250),
          rating: Number(player.form || 0),
          appearances: Number(player.starts || 0),
          goals: Number(player.goals_scored || 0),
          assists: Number(player.assists || 0),
          cleanSheets: Number(player.clean_sheets || 0),
          minutes: Number(player.minutes || 0),
          league: "Premier League",
          _teamId: Number(player.team || 0),
        }));
        if (search.trim()) normalized = normalized.filter((p: any) => String(p.name || "").toLowerCase().includes(search.toLowerCase()));
        if (position.trim()) normalized = normalized.filter((p: any) => String(p.position || "").toUpperCase() === position.toUpperCase());
        if (todayOnly) {
          const now = new Date();
          const sameUtcDay = (dateStr: string) => {
            const d = new Date(dateStr);
            return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
          };
          const teamIds = new Set<number>();
          (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
            if (!fixture?.kickoff_time || !sameUtcDay(String(fixture.kickoff_time))) return;
            teamIds.add(Number(fixture.team_h));
            teamIds.add(Number(fixture.team_a));
          });
          normalized = normalized.filter((p: any) => teamIds.has(Number(p._teamId || 0)));
        }
        const start = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, limit));
        const items = normalized.slice(start, start + Math.max(1, limit)).map(({ _teamId, ...clean }: any) => clean);
        return res.json({ response: items, results: items.length, paging: { current: page, total: Math.max(1, Math.ceil(normalized.length / Math.max(1, limit))) }, total: normalized.length });
      }

      if (!(leagueKey in MAJOR_LEAGUES)) return res.status(400).json({ message: "Unsupported league" });
      const items = await getMajorLeaguePlayers(leagueKey as any, { page, limit, search, position });
      return res.json({ response: items, results: items.length, paging: { current: page, total: 1 }, total: items.length });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch players" });
    }
  });

  app.get("/api/leagues/:leagueKey/injuries", async (req: any, res) => {
    try {
      const leagueKey = String(req.params.leagueKey || "").toLowerCase();
      if (leagueKey === "premier-league") {
        const data = await fplApi.getInjuries();
        const injuries = (Array.isArray(data) ? data : []).map((inj: any, index: number) => ({
          id: index + 1,
          playerId: Number(inj.playerId) || 0,
          playerName: String(inj.name || "Unknown"),
          playerPhoto: "",
          status: String(inj.status || "unknown"),
          expectedReturn: String(inj.news || "TBD"),
        }));
        return res.json(injuries);
      }
      if (!(leagueKey in MAJOR_LEAGUES)) return res.status(400).json({ message: "Unsupported league" });
      const data = await getMajorLeagueInjuries(leagueKey as any);
      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ message: error?.message || "Failed to fetch injuries" });
    }
  });

  app.get("/api/sorare/player", async (req, res) => {
    try {
      const firstName = (req.query.firstName as string) || "";
      const lastName = (req.query.lastName as string) || "";
      if (!firstName.trim() || !lastName.trim()) {
        return res.status(400).json({ message: "firstName and lastName required" });
      }
      const player = await fetchSorarePlayer(firstName.trim(), lastName.trim());
      res.json(player ?? null);
    } catch (e: any) {
      console.error("Sorare player:", e);
      res.status(500).json({ message: e?.message || "Failed to fetch Sorare player" });
    }
  });

  // Sync Data Route (warms FPL caches)
  app.post("/api/epl/sync", async (_req, res) => {
    try {
      await Promise.all([fplApi.bootstrap(), fplApi.fixtures()]);
      res.json({ success: true, message: "Data synced successfully" });
    } catch (error: any) {
      console.error("Sync failed:", error);
      res.status(500).json({ message: "Failed to sync data", error: error?.message });
    }
  });

  // -------------------------
  // ✅ CARDS: My Collection
  // -------------------------

  // -------------------------
  // ONBOARDING (5 packs -> 15 cards -> choose 5)
  // -------------------------

  const getTodayTeamNames = async () => {
    const [fixtures, bootstrap] = await Promise.all([fplApi.fixtures(), fplApi.bootstrap()]);
    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const teamMap = new Map<number, string>(
      teams.map((t: any) => [Number(t.id), String(t.name || "")] as [number, string]),
    );

    const now = new Date();
    const sameUtcDay = (dateStr: string) => {
      const d = new Date(dateStr);
      return (
        d.getUTCFullYear() === now.getUTCFullYear() &&
        d.getUTCMonth() === now.getUTCMonth() &&
        d.getUTCDate() === now.getUTCDate()
      );
    };

    const names = new Set<string>();
    (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
      if (!fixture?.kickoff_time || !sameUtcDay(String(fixture.kickoff_time))) return;
      const home = teamMap.get(Number(fixture.team_h));
      const away = teamMap.get(Number(fixture.team_a));
      if (home) names.add(home.toLowerCase());
      if (away) names.add(away.toLowerCase());
    });

    return names;
  };

  const getCompetitionSubmissionCloseAt = async (competition: any): Promise<Date> => {
    const fallback = competition?.startDate ? new Date(competition.startDate) : new Date(Date.now() + 60 * 60 * 1000);
    const targetGw = Number(competition?.gameWeek || 0);
    if (!Number.isFinite(targetGw) || targetGw <= 0) return fallback;

    try {
      const fixtures = await fplApi.fixtures();
      const kickoffCandidates = (Array.isArray(fixtures) ? fixtures : [])
        .filter((fixture: any) => Number(fixture?.event) === targetGw && fixture?.kickoff_time)
        .map((fixture: any) => new Date(String(fixture.kickoff_time)).getTime())
        .filter((value: number) => Number.isFinite(value) && value > 0)
        .sort((a: number, b: number) => a - b);

      if (kickoffCandidates.length === 0) return fallback;

      return new Date(kickoffCandidates[0]);
    } catch {
      return fallback;
    }
  };

  // Serve best available real player photo (same-origin)
app.get("/api/players/:id/photo", async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (!Number.isFinite(playerId)) {
      return res.status(400).json({ message: "Invalid player id" });
    }

    const fallbackPath = path.join(process.cwd(), "dist/public/images/player-1.png");

    try {
      const buffer = await fs.readFile(fallbackPath);

      res.setHeader("Content-Type", "image/png");
      return res.send(buffer);
    } catch {
      return res.status(404).json({ message: "Fallback image missing" });
    }

  } catch (error: any) {
    console.error("Error serving player photo:", error);
    return res.status(500).json({ message: "Failed to serve player photo" });
  }
});

  // -------------------------
  // WALLET ENDPOINTS
  // -------------------------
  
  // Get wallet balance and info
  app.get("/api/wallet", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      
      // Ensure wallet exists
      let wallet = await storage.getWallet(userId);
      if (!wallet) {
        wallet = await storage.createWallet({ userId, balance: 0, lockedBalance: 0 });
      }
      
      res.json({
        balance: wallet.balance || 0,
        lockedBalance: wallet.lockedBalance || 0,
        availableBalance: (wallet.balance || 0) - (wallet.lockedBalance || 0),
        currency: "USD"
      });
    } catch (error: any) {
      console.error("Failed to fetch wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  // Get transaction history
  app.get("/api/wallet/transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
      
      const allTransactions = await storage.getTransactions(userId);
      const total = allTransactions.length;
      const start = (page - 1) * limit;
      const pageItems = allTransactions.slice(start, start + limit);
      
      res.json({
        transactions: pageItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error: any) {
      console.error("Failed to fetch transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get combined wallet info (for wallet page)
  app.get("/api/transactions", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error: any) {
      console.error("Failed to fetch transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Admin: Credit user wallet
  app.post("/api/admin/wallet/credit", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { userId, amount, description } = req.body;
      
      if (!userId || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid userId and positive amount required" });
      }
      
      // Ensure user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Ensure wallet exists
      let wallet = await storage.getWallet(userId);
      if (!wallet) {
        wallet = await storage.createWallet({ userId, balance: 0, lockedBalance: 0 });
      }
      
      const updatedWallet = await creditWalletWithLedger({
        userId,
        amount,
        description: description || `Admin credit: ${amount}`,
      });

      await writeAuditLog(String(req.authUserId || ""), "admin.wallet.credit", {
        targetUserId: userId,
        amount,
        newBalance: updatedWallet.balance || 0,
        ip: getClientIp(req),
      });
      
      res.json({ 
        success: true, 
        message: `Credited ${amount} to user ${userId}`,
        newBalance: updatedWallet.balance || 0
      });
    } catch (error: any) {
      console.error("Failed to credit wallet:", error);
      res.status(500).json({ message: "Failed to credit wallet" });
    }
  });

  app.post("/api/admin/wallet/repair-missing", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const repaired = await repairMissingWalletsFromLedger();

      await writeAuditLog(String(req.authUserId || ""), "admin.wallet.repair_missing", {
        repairedCount: repaired.length,
        repaired,
        ip: getClientIp(req),
      });

      return res.json({ success: true, repairedCount: repaired.length, repaired });
    } catch (error: any) {
      console.error("Failed wallet missing repair:", error);
      return res.status(500).json({ message: "Failed wallet missing repair" });
    }
  });

  app.get("/api/admin/transactions", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
      const userId = String(req.query.userId || "").trim();
      const type = String(req.query.type || "").trim();
      const q = String(req.query.q || "").trim();
      const offset = (page - 1) * limit;

      const { db } = await import("./db.js");
      const { transactions, users } = await import("../shared/schema.js");
      const { and, desc, eq, ilike, sql } = await import("drizzle-orm");

      const conditions: any[] = [];
      if (userId) conditions.push(eq(transactions.userId, userId));
      if (type) conditions.push(eq(transactions.type, type as any));
      if (q) conditions.push(ilike(transactions.description, `%${q}%`));
      const whereClause = conditions.length ? and(...conditions) : undefined;

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(whereClause as any);

      const [summaryRow] = await db
        .select({
          netAmount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
          credits: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
          debits: sql<number>`coalesce(sum(case when ${transactions.amount} < 0 then abs(${transactions.amount}) else 0 end), 0)`,
        })
        .from(transactions)
        .where(whereClause as any);

      const typeBreakdown = await db
        .select({
          type: transactions.type,
          count: sql<number>`count(*)`,
          netAmount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(whereClause as any)
        .groupBy(transactions.type);

      const rows = await db
        .select({
          id: transactions.id,
          userId: transactions.userId,
          type: transactions.type,
          amount: transactions.amount,
          description: transactions.description,
          paymentMethod: transactions.paymentMethod,
          externalTransactionId: transactions.externalTransactionId,
          createdAt: transactions.createdAt,
          userEmail: users.email,
          userName: users.name,
        })
        .from(transactions)
        .leftJoin(users, eq(transactions.userId, users.id))
        .where(whereClause as any)
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset);

      const total = Number(countRow?.count || 0);
      return res.json({
        transactions: rows,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        summary: {
          netAmount: Number(summaryRow?.netAmount || 0),
          credits: Number(summaryRow?.credits || 0),
          debits: Number(summaryRow?.debits || 0),
          byType: typeBreakdown
            .map((row) => ({
              type: row.type,
              count: Number(row.count || 0),
              netAmount: Number(row.netAmount || 0),
            }))
            .sort((a, b) => Math.abs(b.netAmount) - Math.abs(a.netAmount)),
        },
        filters: { userId: userId || null, type: type || null, q: q || null },
      });
    } catch (error: any) {
      console.error("Failed admin transaction explorer:", error);
      return res.status(500).json({ message: "Failed admin transaction explorer" });
    }
  });

  app.get("/api/admin/wallet/integrity", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const report = await getWalletIntegrityReport();
      return res.json(report);
    } catch (error: any) {
      console.error("Failed wallet integrity check:", error);
      return res.status(500).json({ message: "Failed wallet integrity check" });
    }
  });

  app.get("/api/wallet/withdrawals", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const withdrawals = await storage.getUserWithdrawalRequests(userId);
      res.json(withdrawals);
    } catch (error: any) {
      console.error("Failed to fetch withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.post("/api/wallet/deposit", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { amount, paymentMethod, externalTransactionId } = req.body;
      
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      
      const { gross, feeRate, fee, net } = getDepositBreakdown(amount);
      
      // In a real app, you would integrate with a payment processor here
      // For now, just credit the wallet with net amount after fee (dev/testing only)
      
      await processWalletDeposit({
        userId,
        gross,
        fee,
        net,
        feeRate,
        paymentMethod: paymentMethod || "manual",
        externalTransactionId,
        description: `Deposit via ${paymentMethod || "manual"} (gross ${formatMoney(gross)}, fee ${formatMoney(fee)} at ${(feeRate * 100).toFixed(1)}%)`,
      });
      
      res.json({ 
        success: true,
        message: "Deposit processed successfully",
        amount: gross,
        fee,
        netAmount: net,
        feeRate
      });
    } catch (error: any) {
      console.error("Failed to process deposit:", error);
      res.status(500).json({ message: "Failed to process deposit" });
    }
  });

  app.post("/api/wallet/withdraw", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const user = await storage.getUser(userId);
      const { 
        amount, 
        paymentMethod,
        bankName, 
        accountHolder, 
        accountNumber, 
        iban, 
        swiftCode, 
        ewalletProvider, 
        ewalletId 
      } = req.body;
      
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      if (amount < MIN_WITHDRAWAL_AMOUNT) {
        return res.status(400).json({ message: `Minimum withdrawal is ${formatMoney(MIN_WITHDRAWAL_AMOUNT)}` });
      }

      if (!user?.email) {
        return res.status(400).json({ message: "Email required before withdrawing. Please set and verify your email." });
      }

      const method = String(paymentMethod || "bank_transfer").toLowerCase();
      if ((method === "ewallet" || method === "mobile_money") && (!ewalletProvider || !ewalletId)) {
        return res.status(400).json({ message: "Provider and phone/account ID required for mobile withdrawals" });
      }
      if (method !== "ewallet" && method !== "mobile_money" && (!bankName || !accountHolder || !accountNumber)) {
        return res.status(400).json({ message: "Bank name, account holder and account number are required" });
      }
      
      // Check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      const { gross, fee, net, feeRate } = getWithdrawalBreakdown(amount);

      const destinationKey = normalizeWithdrawalDestination(method, {
        bankName,
        accountHolder,
        accountNumber,
        iban,
        ewalletProvider,
        ewalletId,
      });

      const userWithdrawals = await storage.getUserWithdrawalRequests(userId);
      const hasTrustedDestination = userWithdrawals.some(
        (w: any) => w.status === "paid" && String(w.destinationKey || "") === destinationKey,
      );

      if (hasTrustedDestination) {
        const withdrawal = await createTrustedWithdrawal({
          userId,
          gross,
          fee,
          net,
          method,
          bankName,
          accountHolder,
          accountNumber,
          iban,
          swiftCode,
          ewalletProvider,
          ewalletId,
          destinationKey,
        });

        await sendEmailNotification(
          user.email,
          "Withdrawal processed instantly",
          `<p>Your withdrawal of <strong>N$${amount.toFixed(2)}</strong> was auto-approved because it matches a trusted payout destination.</p>`,
        );

        return res.json({
          success: true,
          instant: true,
          message: "Withdrawal processed instantly to your trusted payout destination.",
          withdrawalId: withdrawal.id,
          fee,
          netAmount: net,
          feeRate,
        });
      }

      const releaseAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const verificationToken = randomUUID().replace(/-/g, "");

      const withdrawal = await createPendingWithdrawalWithHold({
        userId,
        gross,
        fee,
        net,
        method,
        bankName,
        accountHolder,
        accountNumber,
        iban,
        swiftCode,
        ewalletProvider,
        ewalletId,
        destinationKey,
        verificationToken,
        releaseAfter,
      });

      const baseUrl = process.env.PUBLIC_BASE_URL || "https://fantasy-sports-exchange-production-b10a.up.railway.app";
      const verifyUrl = `${baseUrl}/api/wallet/withdrawals/verify?token=${verificationToken}`;
      await sendEmailNotification(
        user.email,
        "Confirm payout destination change",
        `<p>We detected a withdrawal to a <strong>new bank/phone destination</strong>.</p><p>Please verify this change: <a href="${verifyUrl}">${verifyUrl}</a></p><p>Funds are held for 24 hours for security.</p>`,
      );
      
      res.json({ 
        success: true,
        message: "New payout destination detected. Funds are locked for 24h pending email verification.",
        withdrawalId: withdrawal.id,
        fee,
        netAmount: net,
        feeRate,
        releaseAfter,
      });
    } catch (error: any) {
      console.error("Failed to process withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.get("/api/wallet/withdrawals/verify", async (req: any, res) => {
    try {
      const token = String(req.query.token || "").trim();
      if (!token) return res.status(400).send("Missing verification token.");

      const { db } = await import("./db.js");
      const { withdrawalRequests } = await import("../shared/schema.js");
      const { and, eq } = await import("drizzle-orm");

      const [withdrawal] = await db
        .select()
        .from(withdrawalRequests)
        .where(and(eq(withdrawalRequests.verificationToken, token), eq(withdrawalRequests.status, "pending" as any)));

      if (!withdrawal) {
        return res.status(404).send("Invalid or expired verification token.");
      }

      await db
        .update(withdrawalRequests)
        .set({ destinationVerified: true, verificationToken: null } as any)
        .where(eq(withdrawalRequests.id, withdrawal.id));

      await processEligibleAutoWithdrawals();
      return res.send("Destination verified successfully. Your withdrawal will be auto-processed after the security hold ends.");
    } catch (error: any) {
      console.error("Failed to verify withdrawal destination:", error);
      return res.status(500).send("Failed to verify destination.");
    }
  });

  // -------------------------
  // MARKETPLACE ENDPOINTS
  // -------------------------
  
  // Get all marketplace listings
  app.get("/api/marketplace", async (req, res) => {
    try {
      const rarity = req.query.rarity as string | undefined;
      const position = req.query.position as string | undefined;
      const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
      const ownerId = req.query.ownerId ? String(req.query.ownerId) : undefined;
      
      let listings = await storage.getMarketplaceListings();
      
      // Apply filters
      if (rarity) {
        listings = listings.filter(card => card.rarity === rarity);
      }
      if (position) {
        listings = listings.filter(card => card.player?.position === position);
      }
      if (minPrice !== undefined) {
        listings = listings.filter(card => (card.price || 0) >= minPrice);
      }
      if (maxPrice !== undefined) {
        listings = listings.filter(card => (card.price || 0) <= maxPrice);
      }
      if (ownerId) {
        listings = listings.filter((card) => String(card.ownerId || "") === ownerId);
      }
      
      res.json(listings);
    } catch (error: any) {
      console.error("Failed to fetch marketplace listings:", error);
      res.status(500).json({ message: "Failed to fetch marketplace listings" });
    }
  });

  // Fixed-price listing mutations are registered in server/routes/marketplace.routes.ts.
  // Keep this section read-only here to avoid duplicate route implementations drifting.

  // -------------------------
  // AUCTION ENDPOINTS
  // -------------------------
  
  // Helper functions for auctions
  async function getAuction(auctionId: number) {
    const { db } = await import("./db.js");
    const { auctions } = await import("../shared/schema.js");
    const { eq } = await import("drizzle-orm");
    
    const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId));
    return auction;
  }
  
  async function getAuctionBids(auctionId: number) {
    const { db } = await import("./db.js");
    const { auctionBids } = await import("../shared/schema.js");
    const { eq, desc } = await import("drizzle-orm");
    
    return db.select().from(auctionBids)
      .where(eq(auctionBids.auctionId, auctionId))
      .orderBy(desc(auctionBids.amount));
  }

  registerAuctionsRoutes(app, {
    requireAuth,
    isAdmin,
    storage,
    getAuction,
    getAuctionBids,
  });
  
  // Get active auctions
  app.get("/api/auctions/active", async (req, res) => {
    try {
      const { db } = await import("./db.js");
      const { auctions, playerCards, players } = await import("../shared/schema.js");
      const { eq, and, or, lte, gte } = await import("drizzle-orm");
      
      const now = new Date();
      
      // Get live auctions (status=live and endAt > now)
      const results = await db
        .select()
        .from(auctions)
        .innerJoin(playerCards, eq(auctions.cardId, playerCards.id))
        .innerJoin(players, eq(playerCards.playerId, players.id))
        .where(
          and(
            eq(auctions.status, "live"),
            gte(auctions.endsAt, now)
          )
        );
      
      const auctionsWithBids = await Promise.all(
        results.map(async (r: any) => {
          const bids = await getAuctionBids(r.auctions.id);
          return {
            ...r.auctions,
            card: { ...r.player_cards, player: r.players },
            bids,
            currentBid: bids[0]?.amount || r.auctions.startPrice,
            bidCount: bids.length,
          };
        })
      );
      
      res.json(auctionsWithBids);
    } catch (error: any) {
      console.error("Failed to fetch active auctions:", error);
      res.status(500).json({ message: "Failed to fetch active auctions" });
    }
  });
  
  // Get specific auction
  app.get("/api/auctions/:id", async (req, res) => {
    try {
      const auctionId = parseInt(req.params.id, 10);
      
      const { db } = await import("./db.js");
      const { auctions, playerCards, players } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");
      
      const [result] = await db
        .select()
        .from(auctions)
        .innerJoin(playerCards, eq(auctions.cardId, playerCards.id))
        .innerJoin(players, eq(playerCards.playerId, players.id))
        .where(eq(auctions.id, auctionId));
      
      if (!result) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      const bids = await getAuctionBids(auctionId);
      
      res.json({
        ...result.auctions,
        card: { ...result.player_cards, player: result.players },
        bids,
        currentBid: bids[0]?.amount || result.auctions.startPrice,
        bidCount: bids.length,
      });
    } catch (error: any) {
      console.error("Failed to fetch auction:", error);
      res.status(500).json({ message: "Failed to fetch auction" });
    }
  });
  
  // Create auction
  app.post("/api/auctions/create", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, startPrice, buyNowPrice, reservePrice, duration } = req.body;
      
      if (!cardId || typeof startPrice !== "number" || startPrice <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive startPrice required" });
      }
      
      // Get the card
      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Verify ownership
      if (card.ownerId !== userId) {
        return res.status(403).json({ message: "You don't own this card" });
      }
      
      // Check if already listed for sale
      if (card.forSale) {
        return res.status(400).json({ message: "Card is already listed for sale. Cancel the listing first." });
      }

      if (String(card.rarity || "common").toLowerCase() === "common") {
        return res.status(400).json({ message: "Only rare, unique, epic, or legendary cards can be auctioned." });
      }
      
      // Set auction times
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + (duration || 86400) * 1000); // default 24 hours
      
      // Create auction
      const { db } = await import("./db.js");
      const { auctions } = await import("../shared/schema.js");
      
      const [auction] = await db.insert(auctions).values({
        cardId,
        sellerUserId: userId,
        status: "live",
        startPrice,
        buyNowPrice: buyNowPrice || null,
        reservePrice: reservePrice || startPrice,
        minIncrement: Math.max(1, startPrice * 0.05), // 5% minimum increment
        startsAt,
        endsAt,
      } as any).returning();
      
      res.json({
        success: true,
        message: "Auction created successfully",
        auction,
      });
    } catch (error: any) {
      console.error("Failed to create auction:", error);
      res.status(500).json({ message: "Failed to create auction" });
    }
  });
  
  // Place bid
  app.post("/api/auctions/:id/bid", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      const bidAmount = toMoney(req.body?.amount);

      if (!Number.isInteger(auctionId) || auctionId <= 0 || bidAmount <= 0) {
        return res.status(400).json({ message: "Valid auction and positive bid amount required" });
      }

      const { db } = await import("./db.js");
      const { auctions, auctionBids, wallets, auditLogs } = await import("../shared/schema.js");
      const { and, eq, desc, sql } = await import("drizzle-orm");

      let bid: any = null;
      await db.transaction(async (tx) => {
        const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
        if (!auction) throw new Error("Auction not found");
        if (auction.status !== "live") throw new Error("Auction is not active");
        if (auction.endsAt && new Date(auction.endsAt) < new Date()) throw new Error("Auction has ended");
        if (String(auction.sellerUserId || "") === String(userId)) throw new Error("Cannot bid on your own auction");

        const [currentBid] = await tx
          .select()
          .from(auctionBids)
          .where(eq(auctionBids.auctionId, auctionId))
          .orderBy(desc(auctionBids.amount))
          .limit(1);

        const currentAmount = toMoney(currentBid?.amount || auction.startPrice || 0);
        const minIncrement = toMoney(auction.minIncrement || 1);
        if (bidAmount < toMoney(currentAmount + minIncrement)) {
          throw new Error(`Bid must be at least ${toMoney(currentAmount + minIncrement)}`);
        }

        if (currentBid && String(currentBid.bidderUserId || "") === String(userId)) {
          const delta = toMoney(bidAmount - toMoney(currentBid.amount || 0));
          if (delta <= 0) throw new Error("Bid must increase your current high bid");

          const [lockedWallet] = await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} - ${delta}`,
              lockedBalance: sql`${wallets.lockedBalance} + ${delta}`,
            } as any)
            .where(and(eq(wallets.userId, userId), sql`${wallets.balance} >= ${delta}`))
            .returning();
          if (!lockedWallet) throw new Error("Insufficient balance");

          [bid] = await tx
            .update(auctionBids)
            .set({ amount: bidAmount } as any)
            .where(eq(auctionBids.id, currentBid.id))
            .returning();
        } else {
          const [lockedWallet] = await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} - ${bidAmount}`,
              lockedBalance: sql`${wallets.lockedBalance} + ${bidAmount}`,
            } as any)
            .where(and(eq(wallets.userId, userId), sql`${wallets.balance} >= ${bidAmount}`))
            .returning();
          if (!lockedWallet) throw new Error("Insufficient balance");

          if (currentBid) {
            const previousAmount = toMoney(currentBid.amount || 0);
            await tx
              .update(wallets)
              .set({
                balance: sql`${wallets.balance} + ${previousAmount}`,
                lockedBalance: sql`${wallets.lockedBalance} - ${previousAmount}`,
              } as any)
              .where(and(eq(wallets.userId, currentBid.bidderUserId), sql`${wallets.lockedBalance} >= ${previousAmount}`));
          }

          [bid] = await tx.insert(auctionBids).values({
            auctionId,
            bidderUserId: userId,
            amount: bidAmount,
          } as any).returning();
        }

        await tx.insert(auditLogs).values({
          userId,
          action: "auction.bid.placed",
          meta: { auctionId, bidId: bid?.id, amount: bidAmount, previousBidderId: currentBid?.bidderUserId || null },
        } as any);
      });

      res.json({
        success: true,
        message: "Bid placed successfully",
        bid,
      });
    } catch (error: any) {
      console.error("Failed to place bid:", error);
      const message = String(error?.message || "Failed to place bid");
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ message });
    }
  });
  
  // Buy now (instant purchase)
  app.post("/api/auctions/:id/buy-now", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      if (!Number.isInteger(auctionId) || auctionId <= 0) {
        return res.status(400).json({ message: "Valid auction required" });
      }

      const { db } = await import("./db.js");
      const { auctions, auctionBids, playerCards, wallets, auditLogs } = await import("../shared/schema.js");
      const { and, desc, eq, sql } = await import("drizzle-orm");

      let purchasedAuction: any = null;
      let tradeLedger: any = null;
      await db.transaction(async (tx) => {
        const [auction] = await tx.select().from(auctions).where(eq(auctions.id, auctionId)).for("update");
        if (!auction) throw new Error("Auction not found");
        if (!auction.buyNowPrice) throw new Error("This auction does not have a buy now price");
        if (auction.status !== "live") throw new Error("Auction is not active");
        if (auction.endsAt && new Date(auction.endsAt) < new Date()) throw new Error("Auction has ended");
        if (String(auction.sellerUserId || "") === String(userId)) throw new Error("Cannot buy your own auction");

        const bids = await tx
          .select()
          .from(auctionBids)
          .where(eq(auctionBids.auctionId, auctionId))
          .orderBy(desc(auctionBids.amount));

        for (const existingBid of bids as any[]) {
          const lockedAmount = toMoney(existingBid.amount || 0);
          if (lockedAmount <= 0) continue;
          await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} + ${lockedAmount}`,
              lockedBalance: sql`${wallets.lockedBalance} - ${lockedAmount}`,
            } as any)
            .where(and(eq(wallets.userId, existingBid.bidderUserId), sql`${wallets.lockedBalance} >= ${lockedAmount}`));
        }

        const price = toMoney(auction.buyNowPrice || 0);
        tradeLedger = await applyMarketplaceTradeLedger(tx, {
          buyerId: userId,
          sellerId: String(auction.sellerUserId || ""),
          cardId: Number(auction.cardId),
          price,
          feeRate: 0,
        });

        const [transferredCard] = await tx
          .update(playerCards)
          .set({ ownerId: userId, forSale: false, price: 0 } as any)
          .where(and(eq(playerCards.id, auction.cardId), eq(playerCards.ownerId, auction.sellerUserId)))
          .returning();
        if (!transferredCard) throw new Error("Auction card was no longer available for transfer");

        const [settledAuction] = await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(and(eq(auctions.id, auctionId), eq(auctions.status, "live")))
          .returning();
        if (!settledAuction) throw new Error("Auction was already settled");
        purchasedAuction = settledAuction;

        await tx.insert(auditLogs).values({
          userId,
          action: "auction.buy_now.completed",
          meta: { auctionId, cardId: auction.cardId, price, refundedBidHolds: bids.length, fee: tradeLedger?.fee || 0 },
        } as any);
      });

      res.json({
        success: true,
        message: "Auction purchased successfully",
        auction: purchasedAuction,
      });
    } catch (error: any) {
      console.error("Failed to buy now:", error);
      const message = String(error?.message || "Failed to buy now");
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ message });
    }
  });
  
  // Cancel auction
  app.post("/api/auctions/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      // Verify ownership
      if (auction.sellerUserId !== userId) {
        return res.status(403).json({ message: "You don't own this auction" });
      }
      
      // Check if there are bids
      const bids = await getAuctionBids(auctionId);
      if (bids.length > 0) {
        return res.status(400).json({ message: "Cannot cancel auction with bids" });
      }
      
      // Cancel auction
      const { db } = await import("./db.js");
      const { auctions } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");
      
      await db
        .update(auctions)
        .set({ status: "cancelled" } as any)
        .where(eq(auctions.id, auctionId));
      
      res.json({
        success: true,
        message: "Auction cancelled successfully",
      });
    } catch (error: any) {
      console.error("Failed to cancel auction:", error);
      res.status(500).json({ message: "Failed to cancel auction" });
    }
  });

  // -------------------------
  // PACK AUCTIONS ENDPOINTS
  // -------------------------

  const getPackAuctionBids = async (packAuctionId: number) => {
    const { db } = await import("./db.js");
    const rows = await db.execute(sql`
      SELECT id, pack_auction_id, bidder_user_id, amount, created_at
      FROM app.pack_auction_bids
      WHERE pack_auction_id = ${packAuctionId}
      ORDER BY amount DESC, created_at ASC
    `);
    return Array.isArray((rows as any)?.rows) ? (rows as any).rows : [];
  };

  app.get("/api/auctions/packs/active", async (_req, res) => {
    try {
      const { db } = await import("./db.js");
      const now = new Date();
      const rows = await db.execute(sql`
        SELECT id, seller_user_id, rarity, card_ids, status, start_price, reserve_price, buy_now_price, min_increment, starts_at, ends_at, created_at
        FROM app.pack_auctions
        WHERE status = 'live' AND (ends_at IS NULL OR ends_at >= ${now})
        ORDER BY created_at DESC
      `);

      const auctions = Array.isArray((rows as any)?.rows) ? (rows as any).rows : [];

      const enriched = await Promise.all(
        auctions.map(async (auction: any) => {
          const cardIds = Array.isArray(auction.card_ids) ? auction.card_ids.map((id: any) => Number(id)) : [];
          const cards = (await Promise.all(cardIds.map((cardId: number) => storage.getPlayerCardWithPlayer(cardId)))).filter(Boolean);
          const bids = await getPackAuctionBids(Number(auction.id));
          const currentBid = Number(bids[0]?.amount || auction.start_price || 0);
          return {
            id: Number(auction.id),
            sellerUserId: String(auction.seller_user_id),
            rarity: String(auction.rarity || "rare"),
            cardIds,
            cards,
            status: String(auction.status || "live"),
            startPrice: Number(auction.start_price || 0),
            reservePrice: Number(auction.reserve_price || 0),
            buyNowPrice: auction.buy_now_price == null ? null : Number(auction.buy_now_price),
            minIncrement: Number(auction.min_increment || 1),
            startsAt: auction.starts_at,
            endsAt: auction.ends_at,
            createdAt: auction.created_at,
            bids,
            currentBid,
            bidCount: bids.length,
          };
        }),
      );

      return res.json(enriched);
    } catch (error: any) {
      console.error("Failed to fetch pack auctions:", error);
      return res.status(500).json({ message: "Failed to fetch pack auctions" });
    }
  });

  app.post("/api/auctions/packs/create", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const rarity = String(req.body?.rarity || "rare").toLowerCase();
      const startPrice = Number(req.body?.startPrice || 0);
      const buyNowPrice = req.body?.buyNowPrice == null ? null : Number(req.body.buyNowPrice);
      const reservePrice = req.body?.reservePrice == null ? startPrice : Number(req.body.reservePrice);
      const duration = Math.max(30 * 60, Number(req.body?.duration || 24 * 60 * 60));
      const requestedCardIds = Array.isArray(req.body?.cardIds)
        ? req.body.cardIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id) && id > 0)
        : [];

      if (!Number.isFinite(startPrice) || startPrice <= 0) {
        return res.status(400).json({ message: "Valid positive startPrice required" });
      }

      const allowedRarities = new Set(["rare", "epic", "legendary", "unique"]);
      if (!allowedRarities.has(rarity)) {
        return res.status(400).json({ message: "Pack auctions support rare, epic, legendary, or unique cards" });
      }

      const ownedCards = await storage.getUserCards(userId);
      const sameRarity = (Array.isArray(ownedCards) ? ownedCards : [])
        .filter((card: any) => String(card?.rarity || "").toLowerCase() === rarity)
        .filter((card: any) => !card?.forSale);

      let selectedCards = sameRarity;
      if (requestedCardIds.length > 0) {
        const requestedSet = new Set(requestedCardIds);
        selectedCards = sameRarity.filter((card: any) => requestedSet.has(Number(card.id)));
      }

      const uniqueByPlayer = new Map<number, any>();
      selectedCards.forEach((card: any) => {
        const playerId = Number(card?.playerId || 0);
        if (!playerId || uniqueByPlayer.has(playerId)) return;
        uniqueByPlayer.set(playerId, card);
      });

      const packCards = Array.from(uniqueByPlayer.values()).slice(0, 5);
      if (packCards.length < 5) {
        return res.status(400).json({ message: "Need 5 cards of the same rarity with different players to create a pack auction" });
      }

      const activeEntries = await storage.getUserCompetitions(userId);
      const blockedCardIds = new Set<number>();
      for (const entry of activeEntries) {
        const comp = await storage.getCompetition(entry.competitionId);
        if (!comp || (comp.status !== "open" && comp.status !== "active")) continue;
        (Array.isArray(entry?.lineupCardIds) ? entry.lineupCardIds : []).forEach((id: number) => blockedCardIds.add(Number(id)));
      }

      const finalCardIds = packCards
        .map((card: any) => Number(card.id))
        .filter((id: number) => !blockedCardIds.has(id));

      if (finalCardIds.length < 5) {
        return res.status(400).json({ message: "Some selected cards are locked in active tournaments" });
      }

      const { db } = await import("./db.js");
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + duration * 1000);
      const minIncrement = Math.max(1, Math.round(startPrice * 0.05 * 100) / 100);

      const created = await db.execute(sql`
        INSERT INTO app.pack_auctions
          (seller_user_id, rarity, card_ids, status, start_price, reserve_price, buy_now_price, min_increment, starts_at, ends_at)
        VALUES
          (${userId}, ${rarity}, ${JSON.stringify(finalCardIds)}::jsonb, 'live', ${startPrice}, ${reservePrice}, ${buyNowPrice}, ${minIncrement}, ${startsAt}, ${endsAt})
        RETURNING id
      `);

      const row = Array.isArray((created as any)?.rows) ? (created as any).rows[0] : null;
      return res.json({ success: true, auctionId: Number(row?.id || 0), cardIds: finalCardIds, endsAt });
    } catch (error: any) {
      console.error("Failed to create pack auction:", error);
      return res.status(500).json({ message: "Failed to create pack auction" });
    }
  });

  app.post("/api/auctions/packs/:id/bid", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const packAuctionId = Number(req.params.id);
      const amount = Number(req.body?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ message: "Valid positive bid amount required" });
      }

      const { db } = await import("./db.js");
      const rows = await db.execute(sql`
        SELECT id, seller_user_id, status, start_price, min_increment, ends_at
        FROM app.pack_auctions
        WHERE id = ${packAuctionId}
        LIMIT 1
      `);
      const auction = Array.isArray((rows as any)?.rows) ? (rows as any).rows[0] : null;
      if (!auction) return res.status(404).json({ message: "Pack auction not found" });
      if (String(auction.status) !== "live") return res.status(400).json({ message: "Pack auction is not active" });
      if (auction.ends_at && new Date(auction.ends_at).getTime() < Date.now()) {
        return res.status(400).json({ message: "Pack auction has ended" });
      }
      if (String(auction.seller_user_id) === userId) {
        return res.status(400).json({ message: "Cannot bid on your own pack auction" });
      }

      const bids = await getPackAuctionBids(packAuctionId);
      const currentAmount = Number(bids[0]?.amount || auction.start_price || 0);
      const minBid = currentAmount + Number(auction.min_increment || 1);
      if (amount < minBid) {
        return res.status(400).json({ message: `Bid must be at least ${minBid.toFixed(2)}` });
      }

      const wallet = await storage.getWallet(userId);
      if (!wallet || Number(wallet.balance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await storage.lockFunds(userId, amount);
      if (bids[0] && String(bids[0].bidder_user_id) !== userId) {
        await storage.unlockFunds(String(bids[0].bidder_user_id), Number(bids[0].amount || 0));
      }

      await db.execute(sql`
        INSERT INTO app.pack_auction_bids (pack_auction_id, bidder_user_id, amount)
        VALUES (${packAuctionId}, ${userId}, ${amount})
      `);

      return res.json({ success: true, message: "Pack bid placed successfully" });
    } catch (error: any) {
      console.error("Failed to place pack bid:", error);
      return res.status(500).json({ message: "Failed to place pack bid" });
    }
  });

  app.post("/api/auctions/packs/:id/buy-now", requireAuth, async (req: any, res) => {
    try {
      const buyerId = String(req.authUserId || "");
      const packAuctionId = Number(req.params.id);
      const { db } = await import("./db.js");

      const rows = await db.execute(sql`
        SELECT id, seller_user_id, card_ids, status, buy_now_price
        FROM app.pack_auctions
        WHERE id = ${packAuctionId}
        LIMIT 1
      `);
      const auction = Array.isArray((rows as any)?.rows) ? (rows as any).rows[0] : null;
      if (!auction) return res.status(404).json({ message: "Pack auction not found" });
      if (String(auction.status) !== "live") return res.status(400).json({ message: "Pack auction is not active" });
      if (String(auction.seller_user_id) === buyerId) return res.status(400).json({ message: "Cannot buy your own pack auction" });
      const buyNowPrice = Number(auction.buy_now_price || 0);
      if (!buyNowPrice || buyNowPrice <= 0) return res.status(400).json({ message: "Pack auction has no buy now price" });

      const wallet = await storage.getWallet(buyerId);
      if (!wallet || Number(wallet.balance || 0) < buyNowPrice) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const cardIds = Array.isArray(auction.card_ids) ? auction.card_ids.map((id: any) => Number(id)) : [];
      if (cardIds.length < 5) return res.status(400).json({ message: "Pack auction payload is invalid" });

      await db.transaction(async (tx: any) => {
        await tx.execute(sql`
          UPDATE app.wallets SET balance = balance - ${buyNowPrice} WHERE user_id = ${buyerId}
        `);
        await tx.execute(sql`
          UPDATE app.wallets SET balance = balance + ${buyNowPrice} WHERE user_id = ${auction.seller_user_id}
        `);

        for (const cardId of cardIds) {
          await tx.execute(sql`
            UPDATE app.player_cards
            SET owner_id = ${buyerId}
            WHERE id = ${cardId}
          `);
        }

        await tx.execute(sql`
          UPDATE app.pack_auctions
          SET status = 'settled'
          WHERE id = ${packAuctionId}
        `);

        await tx.execute(sql`
          INSERT INTO app.transactions (user_id, type, amount, description)
          VALUES (${buyerId}, 'auction_settlement', ${-buyNowPrice}, ${`Pack auction purchase #${packAuctionId}`})
        `);

        await tx.execute(sql`
          INSERT INTO app.transactions (user_id, type, amount, description)
          VALUES (${auction.seller_user_id}, 'auction_settlement', ${buyNowPrice}, ${`Pack auction sale #${packAuctionId}`})
        `);
      });

      return res.json({ success: true, message: "Pack purchased successfully" });
    } catch (error: any) {
      console.error("Failed to buy pack now:", error);
      return res.status(500).json({ message: "Failed to buy pack now" });
    }
  });
  
  // -------------------------
  // COMPETITIONS ENDPOINTS
  // -------------------------
  
  // Get all competitions
  app.get("/api/competitions", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const tier = req.query.tier as string | undefined;
      
      let competitions = await storage.getCompetitions();
      
      // Apply filters
      if (status) {
        competitions = competitions.filter(c => c.status === status);
      }
      if (tier) {
        competitions = competitions.filter(c => c.tier === tier);
      }
      
      // Fetch entries for each competition with user data
      const competitionsWithEntries = await Promise.all(
        competitions.map(async (comp) => {
          const entries = await storage.getCompetitionEntries(comp.id);
          const submissionClosesAt = await getCompetitionSubmissionCloseAt(comp);
          const entryOpen = comp.status === "open" && Date.now() < submissionClosesAt.getTime();
          
          // Enrich entries with user data
          const enrichedEntries = await Promise.all(
            (entries || []).map(async (entry) => {
              const user = await storage.getUser(entry.userId);
              return {
                ...entry,
                userName: user?.name || "Unknown",
                userImage: user?.avatarUrl || null,
              };
            })
          );

          const sortedEntries = enrichedEntries.sort(
            (a: any, b: any) => Number(b.totalScore || 0) - Number(a.totalScore || 0),
          );
          
          return {
            ...comp,
            submissionClosesAt,
            entryOpen,
            entries: sortedEntries,
            entryCount: sortedEntries.length,
            winner:
              comp.status === "completed" && sortedEntries.length > 0
                ? {
                    userId: sortedEntries[0].userId,
                    userName: sortedEntries[0].userName,
                    totalScore: Number(sortedEntries[0].totalScore || 0),
                    prizeAmount: Number(sortedEntries[0].prizeAmount || 0),
                    prizeCardId: sortedEntries[0].prizeCardId || null,
                  }
                : null,
          };
        })
      );
      
      res.json(competitionsWithEntries);
    } catch (error: any) {
      console.error("Failed to fetch competitions:", error);
      res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  // Join a competition
  app.post("/api/competitions/join", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { competitionId, cardIds, captainId } = req.body;
      
      if (!competitionId || !Array.isArray(cardIds) || cardIds.length !== 5) {
        return res.status(400).json({ message: "Tournament ID and exactly 5 card IDs required" });
      }
      if (new Set(cardIds).size !== 5) {
        return res.status(400).json({ message: "Lineup must contain 5 different cards" });
      }
      
      // Get competition
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      // Check if already entered
      const existingEntry = await storage.getCompetitionEntry(competitionId, userId);
      if (existingEntry) {
        return res.status(400).json({ message: "Already entered this tournament" });
      }
      
      // Check competition status
      if (competition.status !== "open") {
        return res.status(400).json({ message: "Tournament is not open for entries" });
      }

      const submissionClosesAt = await getCompetitionSubmissionCloseAt(competition);
      if (Date.now() >= submissionClosesAt.getTime()) {
        return res.status(400).json({
          message: "Lineup submission is closed for this tournament. Deadline is before the first Premier League kickoff of this gameweek.",
          submissionClosesAt,
        });
      }
      
      // Validate lineup (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility)
      const cards = await Promise.all(cardIds.map(id => storage.getPlayerCard(id)));
      
      // Verify ownership
      for (const card of cards) {
        if (!card || card.ownerId !== userId) {
          return res.status(403).json({ message: "You don't own all selected cards" });
        }
      }

      const expectedRarity = String(competition.tier || "common").toLowerCase();
      const mixedRarity = cards.some((card: any) => String(card?.rarity || "common").toLowerCase() !== expectedRarity);
      if (mixedRarity) {
        return res.status(400).json({
          message: `${competition.tier.charAt(0).toUpperCase()}${competition.tier.slice(1)} tournaments only accept ${competition.tier} cards.`,
        });
      }
      
      // Check if any cards are listed for sale
      const listedCards = cards.filter(c => c && c.forSale);
      if (listedCards.length > 0) {
        return res.status(400).json({ 
          message: "Cannot use cards that are listed on the marketplace. Cancel the listings first." 
        });
      }
      
      // Check if any cards are already in an active competition
      const activeEntries = await storage.getUserCompetitions(userId);
      const cardsInActiveComps = new Set<number>();
      
      for (const entry of activeEntries) {
        // Get competition status
        const entryComp = await storage.getCompetition(entry.competitionId);
        if (entryComp && (entryComp.status === "open" || entryComp.status === "active")) {
          // This entry is in an active competition
          if (entry.lineupCardIds) {
            entry.lineupCardIds.forEach((id: number) => cardsInActiveComps.add(id));
          }
        }
      }
      
      const conflictingCards = cardIds.filter(id => cardsInActiveComps.has(id));
      if (conflictingCards.length > 0) {
        return res.status(400).json({ 
          message: "Some cards are already in an active tournament. Each card can only be in one tournament at a time." 
        });
      }
      
      // Check rarity restriction: user can only enter ONE competition per rarity tier
      const userTierEntries = await storage.getUserCompetitions(userId);
      const tierCompIds = new Set<number>();
      
      for (const entry of userTierEntries) {
        const entryComp = await storage.getCompetition(entry.competitionId);
        if (entryComp && entryComp.tier === competition.tier && 
            (entryComp.status === "open" || entryComp.status === "active")) {
          tierCompIds.add(entryComp.id);
        }
      }
      
      if (tierCompIds.size > 0 && !tierCompIds.has(competitionId)) {
        return res.status(400).json({ 
          message: `You can only enter one ${competition.tier} tournament at a time. Complete or wait for your current ${competition.tier} tournament to finish.` 
        });
      }
      
      // Get full card details with players
      const fullCards = await Promise.all(
        cardIds.map(id => storage.getPlayerCardWithPlayer(id, userId))
      );

      const lineupPlayerIds = fullCards.map((card: any) => Number(card?.playerId)).filter((id: number) => Number.isFinite(id) && id > 0);
      if (new Set(lineupPlayerIds).size !== lineupPlayerIds.length) {
        return res.status(400).json({ message: "Lineup must use 5 different players" });
      }
      
      const positions = fullCards.map(c => c?.player?.position).filter(Boolean);
      const hasGK = positions.includes("GK");
      const hasDEF = positions.includes("DEF");
      const hasMID = positions.includes("MID");
      const hasFWD = positions.includes("FWD");
      
      if (!hasGK || !hasDEF || !hasMID || !hasFWD) {
        return res.status(400).json({ 
          message: "Invalid lineup: must have 1 GK, 1 DEF, 1 MID, 1 FWD, and 1 Utility player" 
        });
      }
      
      const entry = await enterCompetitionWithFee({
        competitionId,
        userId,
        lineupCardIds: cardIds,
        captainId: captainId || cardIds[0],
        entryFee: competition.entryFee || 0,
        competitionName: competition.name,
      });
      
      res.json({ 
        success: true, 
        message: "Successfully joined tournament",
        entryId: entry.id
      });
    } catch (error: any) {
      console.error("Failed to join competition:", error);
      const message = String(error?.message || "Failed to join tournament");
      const status = message.includes("Insufficient balance") || message.includes("Already entered") ? 400 : 500;
      res.status(status).json({ message });
    }
  });

  // Get user's competition entries
  app.get("/api/competitions/my-entries", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const entries = await storage.getUserCompetitions(userId);
      res.json(entries);
    } catch (error: any) {
      console.error("Failed to fetch entries:", error);
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  // View a specific participant lineup (only visible after requester has entered this competition)
  app.get("/api/competitions/:competitionId/entries/:entryId/lineup", requireAuth, async (req: any, res) => {
    try {
      const viewerId = req.authUserId;
      const competitionId = parseInt(req.params.competitionId, 10);
      const entryId = parseInt(req.params.entryId, 10);

      if (!Number.isFinite(competitionId) || !Number.isFinite(entryId)) {
        return res.status(400).json({ message: "Invalid tournament or entry id" });
      }

      const viewerEntry = await storage.getCompetitionEntry(competitionId, viewerId);
      if (!viewerEntry) {
        return res.status(403).json({ message: "Enter this tournament to view other lineups" });
      }

      const entries = await storage.getCompetitionEntries(competitionId);
      const targetEntry = entries.find((entry) => entry.id === entryId);
      if (!targetEntry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      const targetUser = await storage.getUser(targetEntry.userId);
      const cardIds = Array.isArray(targetEntry.lineupCardIds) ? targetEntry.lineupCardIds : [];

      const normalize = (text: string) =>
        String(text || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      const [liveData, bootstrap] = await Promise.all([fplApi.getLiveGameweek(), fplApi.bootstrap()]);
      const playerStatsMap = new Map<number, any>();
      (Array.isArray(liveData?.elements) ? liveData.elements : []).forEach((element: any) => {
        const mappedStats = mapFplStatsToPlayerStats(element);
        playerStatsMap.set(Number(element.id), mappedStats);
      });

      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const teamNameById = new Map<number, string>(
        teams.map((t: any) => [Number(t.id), normalize(String(t.name || t.short_name || ""))] as [number, string]),
      );
      const byNameTeam = new Map<string, number>();
      const byWebTeam = new Map<string, number>();
      (Array.isArray(bootstrap?.elements) ? bootstrap.elements : []).forEach((el: any) => {
        const teamNorm = teamNameById.get(Number(el.team)) || "";
        const fullName = normalize(`${String(el.first_name || "")} ${String(el.second_name || "")}`);
        const webName = normalize(String(el.web_name || ""));
        if (teamNorm && fullName) byNameTeam.set(`${fullName}::${teamNorm}`, Number(el.id));
        if (teamNorm && webName) byWebTeam.set(`${webName}::${teamNorm}`, Number(el.id));
      });

      const resolveElementId = (player: any) => {
        const explicit = Number(player?.externalId || 0);
        if (explicit > 0) return explicit;
        const teamNorm = normalize(String(player?.team || ""));
        const nameNorm = normalize(String(player?.name || ""));
        if (!teamNorm || !nameNorm) return 0;
        return byNameTeam.get(`${nameNorm}::${teamNorm}`) || byWebTeam.get(`${nameNorm}::${teamNorm}`) || 0;
      };

      const buildPointsExplanation = (stats: any, position: string) => {
        const minutes = Number(stats?.minutes || 0);
        const goals = Number(stats?.goals_scored || 0);
        const assists = Number(stats?.assists || 0);
        const cleanSheets = Number(stats?.clean_sheets || 0);
        const yellowCards = Number(stats?.yellow_cards || 0);
        const redCards = Number(stats?.red_cards || 0);
        const goalsConceded = Number(stats?.goals_conceded || 0);
        const ownGoals = Number(stats?.own_goals || 0);
        const penaltiesSaved = Number(stats?.penalties_saved || 0);
        const penaltiesMissed = Number(stats?.penalties_missed || 0);
        const saves = Number(stats?.saves || 0);
        const bonus = Number(stats?.bonus || 0);

        const items: Array<{ label: string; value: string }> = [];
        items.push({ label: "Appearance", value: `${minutes} mins` });
        if (goals > 0) items.push({ label: "Goals", value: `${goals}` });
        if (assists > 0) items.push({ label: "Assists", value: `${assists}` });
        if (cleanSheets > 0) items.push({ label: "Clean Sheets", value: `${cleanSheets}` });
        if (position === "GK" && saves > 0) items.push({ label: "Saves", value: `${saves}` });
        if (position === "GK" && penaltiesSaved > 0) items.push({ label: "Penalties Saved", value: `${penaltiesSaved}` });
        if (bonus > 0) items.push({ label: "FPL Bonus", value: `${bonus}` });
        if (goalsConceded > 0 && (position === "GK" || position === "DEF")) items.push({ label: "Goals Conceded", value: `${goalsConceded}` });
        if (yellowCards > 0) items.push({ label: "Yellow Cards", value: `${yellowCards}` });
        if (redCards > 0) items.push({ label: "Red Cards", value: `${redCards}` });
        if (ownGoals > 0) items.push({ label: "Own Goals", value: `${ownGoals}` });
        if (penaltiesMissed > 0) items.push({ label: "Penalties Missed", value: `${penaltiesMissed}` });

        return items;
      };

      const cards = await Promise.all(
        cardIds.map(async (cardId: number) => {
          const card = await storage.getPlayerCard(cardId);
          if (!card) return null;
          const player = await storage.getPlayer(card.playerId);
          if (!player) return null;

          const elementId = resolveElementId(player);
          const stats = elementId ? playerStatsMap.get(elementId) : undefined;
          const score = stats ? calculatePlayerScore(stats, player.position) : null;
          const basePoints = Number(score?.total_score || 0);
          const points = targetEntry.captainId === card.id ? Math.round(basePoints * 1.1) : basePoints;
          const explanation = stats ? buildPointsExplanation(stats, player.position) : [{ label: "Status", value: "No live stats yet" }];

          return {
            ...card,
            player,
            points,
            basePoints,
            captainBonus: targetEntry.captainId === card.id ? Number((points - basePoints).toFixed(1)) : 0,
            pointsBreakdown: {
              decisive: Number(score?.breakdown?.decisive || 0),
              performance: Number(score?.breakdown?.performance || 0),
              penalties: Number(score?.breakdown?.penalties || 0),
              bonus: Number(score?.breakdown?.bonus || 0),
            },
            pointsExplanation: explanation,
          };
        }),
      );

      const validCards = cards.filter(Boolean) as any[];
      const computedBaseTotal = validCards.reduce((sum, card) => sum + Number(card.basePoints || 0), 0);
      const computedCaptainBonus = validCards.reduce((sum, card) => sum + Number(card.captainBonus || 0), 0);
      const computedTotal = validCards.reduce((sum, card) => sum + Number(card.points || 0), 0);

      return res.json({
        entryId: targetEntry.id,
        competitionId,
        userId: targetEntry.userId,
        userName: targetUser?.name || "Unknown",
        userImage: targetUser?.avatarUrl || null,
        captainId: targetEntry.captainId,
        totalScore: targetEntry.totalScore || 0,
        scoreBreakdown: {
          baseTotal: Number(computedBaseTotal.toFixed(1)),
          captainBonus: Number(computedCaptainBonus.toFixed(1)),
          computedTotal: Number(computedTotal.toFixed(1)),
          storedTotal: Number(targetEntry.totalScore || 0),
        },
        cards: validCards,
      });
    } catch (error: any) {
      console.error("Failed to fetch competition lineup:", error);
      return res.status(500).json({ message: "Failed to fetch lineup" });
    }
  });

  // Admin: Settle competition
  app.post("/api/admin/competitions/settle/:id", requireAuth, isAdmin, async (req: any, res) => {
    let settlementLockAcquired = false;
    let settlementLockKey = 0;

    try {
      const competitionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(competitionId) || competitionId <= 0) {
        return res.status(400).json({ message: "Invalid tournament id" });
      }

      const { db } = await import("./db.js");
      settlementLockKey = 910_000 + competitionId;
      const lockResult = await db.execute(sql`SELECT pg_try_advisory_lock(${settlementLockKey}) AS locked`);
      const lockRows = Array.isArray(lockResult) ? lockResult : ((lockResult as any)?.rows || []);
      settlementLockAcquired = Boolean(lockRows[0]?.locked);
      if (!settlementLockAcquired) {
        return res.status(409).json({ message: "Tournament settlement is already running. Please wait for it to finish." });
      }
      
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ message: "Tournament not found" });
      }
      
      if (competition.status === "completed") {
        return res.status(400).json({ message: "Tournament already settled" });
      }
      
      // Get all entries sorted by score
      const entries = await storage.getCompetitionEntries(competitionId);
      const sortedEntries = entries
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

      const { notifications } = await import("../shared/schema.js");
      
      const isRareTier = String(competition.tier || "").toLowerCase() === "rare";
      const totalEntries = entries.length;
      const totalPrizePool = toMoney(totalEntries * Number(competition.entryFee || 0));
      const payoutPercentages = [0.6, 0.3, 0.1];

      const todayTeams = await getTodayTeamNames();
      const allPlayers = await storage.getPlayers();
      const todayPlayers = todayTeams.size
        ? allPlayers.filter((p: any) => todayTeams.has(String(p.team || "").toLowerCase()))
        : [];
      const cardCandidatePool = shuffle(todayPlayers.length > 0 ? todayPlayers : allPlayers);

      const createPrizeCardForUser = async (targetUserId: string, rarity: string): Promise<number | null> => {
        const retryPool = shuffle([...cardCandidatePool, ...allPlayers]);
        for (const p of cardCandidatePool) {
          try {
            const created = await storage.createPlayerCard({
              playerId: p.id,
              ownerId: targetUserId,
              rarity: rarity as any,
              level: 1,
              xp: 0,
              decisiveScore: 35,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
            } as any);
            return created.id;
          } catch {
            continue;
          }
        }
        for (const p of retryPool) {
          try {
            const created = await storage.createPlayerCard({
              playerId: p.id,
              ownerId: targetUserId,
              rarity: rarity as any,
              level: 1,
              xp: 0,
              decisiveScore: 35,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
            } as any);
            return created.id;
          } catch {
            continue;
          }
        }
        return null;
      };

      const getCardRarityForRank = (rank: number): string | null => {
        if (isRareTier) {
          if (rank === 1) return "unique";
          if (totalEntries > 100 && (rank === 4 || rank === 5)) return "rare";
          return null;
        }

        if (rank === 1) {
          return String(competition.prizeCardRarity || "rare").toLowerCase();
        }

        return null;
      };

      let winnerPrizeCardId: number | null = null;
      const prizeCardFailures: Array<{ entryId: number; userId: string; rank: number; rarity: string }> = [];

      for (let i = 0; i < sortedEntries.length; i += 1) {
        const entry = sortedEntries[i];
        const rank = i + 1;
        const payoutPct = payoutPercentages[i] || 0;
        const prizeAmount = toMoney(totalPrizePool * payoutPct);
        const cardRarity = getCardRarityForRank(rank);
        const prizeCardId = cardRarity ? await createPrizeCardForUser(entry.userId, cardRarity) : null;
        if (cardRarity && !prizeCardId) {
          prizeCardFailures.push({ entryId: entry.id, userId: String(entry.userId || ""), rank, rarity: cardRarity });
        }

        await storage.updateCompetitionEntry(entry.id, {
          rank,
          prizeAmount,
          prizeCardId,
        });

        if (rank === 1 && prizeCardId) {
          winnerPrizeCardId = prizeCardId;
        }

        if (prizeAmount > 0 || prizeCardId) {
          const rewardBits: string[] = [];
          if (prizeAmount > 0) rewardBits.push(`${formatMoney(prizeAmount)} cash`);
          if (prizeCardId && cardRarity) rewardBits.push(`${cardRarity.toUpperCase()} card`);
          const rewardText = rewardBits.join(" + ");

          await db.insert(notifications).values({
            userId: entry.userId,
            type: rank === 1 ? "win" : rank === 2 ? "runner_up" : "system",
            title: rank === 1 ? "Congratulations! Rewards ready to claim" : `Tournament rewards ready (Rank ${rank})`,
            message: `You finished #${rank} in ${competition.name}. Claim your reward: ${rewardText}.`,
            read: false,
          } as any);
        }
      }
      
      // Mark competition as completed
      await storage.updateCompetition(competitionId, {
        status: "completed",
      });

      // Reset decisiveScore to 0 for all cards used in this tournament
      // Preserve last5Scores, xp, and level so progression is not lost
      const { playerCards: playerCardsTable } = await import("../shared/schema.js");
      const { inArray: inArrayOp } = await import("drizzle-orm");
      const allLineupCardIds = entries.flatMap((e) =>
        Array.isArray(e.lineupCardIds) ? e.lineupCardIds.map(Number).filter((id) => Number.isFinite(id) && id > 0) : [],
      );
      const uniqueCardIds = Array.from(new Set(allLineupCardIds));
      if (uniqueCardIds.length > 0) {
        await db
          .update(playerCardsTable)
          .set({ decisiveScore: 0 } as any)
          .where(inArrayOp(playerCardsTable.id, uniqueCardIds));
      }

      await writeAuditLog(String(req.authUserId || ""), "admin.competition.settle", {
        competitionId,
        winnersCount: Math.min(3, sortedEntries.length),
        winnerPrizeCardId,
        prizeCardFailuresCount: prizeCardFailures.length,
        prizeCardFailures,
        ip: getClientIp(req),
      });
      
      res.json({ 
        success: true,
        message: "Tournament settled successfully",
        winnersCount: Math.min(3, sortedEntries.length),
        winnerPrizeCardId,
        prizeCardFailuresCount: prizeCardFailures.length,
        prizeCardFailures,
      });
    } catch (error: any) {
      console.error("Failed to settle competition:", error);
      res.status(500).json({ message: "Failed to settle tournament" });
    } finally {
      if (settlementLockAcquired && settlementLockKey > 0) {
        try {
          const { db } = await import("./db.js");
          await db.execute(sql`SELECT pg_advisory_unlock(${settlementLockKey})`);
        } catch (unlockError) {
          console.error("Failed to release settlement advisory lock:", unlockError);
        }
      }
    }
  });

  // Admin: Reward integrity check for a settled competition (Phase 2)
  app.get("/api/admin/competitions/:id/reward-integrity", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = parseInt(req.params.id, 10);
      const report = await getCompetitionRewardIntegrity(competitionId);
      return res.json(report);
    } catch (error: any) {
      const message = String(error?.message || "Failed reward integrity check");
      const status = message.includes("Invalid") ? 400 : message.includes("not found") || message.includes("Tournament not found") ? 404 : 500;
      console.error("Failed reward integrity check:", error);
      return res.status(status).json({ message });
    }
  });

  app.post("/api/admin/competitions/:id/repair-rewards", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = parseInt(req.params.id, 10);
      const result = await repairCompetitionRewards(competitionId);

      await writeAuditLog(String(req.authUserId || ""), "admin.competition.repair_rewards", {
        competitionId,
        repairedCount: result.repairedCount,
        skippedCount: result.skippedCount,
        repaired: result.repaired,
        skipped: result.skipped,
        ip: getClientIp(req),
      });

      return res.json(result);
    } catch (error: any) {
      const message = String(error?.message || "Failed reward repair");
      const status = message.includes("Invalid") || message.includes("must be completed") ? 400 : message.includes("not found") || message.includes("Tournament not found") ? 404 : 500;
      console.error("Failed reward repair:", error);
      return res.status(status).json({ message });
    }
  });

  // -------------------------
  // SCORE MANAGEMENT ENDPOINTS
  // -------------------------
  
  // Admin: Manually trigger score update for all active competitions
  app.post("/api/admin/scores/update-all", requireAuth, isAdmin, async (req: any, res) => {
    try {
      await scoreUpdater.updateAllActiveCompetitions();
      res.json({ success: true, message: "Score update triggered successfully" });
    } catch (error: any) {
      console.error("Failed to update scores:", error);
      res.status(500).json({ message: error.message || "Failed to update scores" });
    }
  });
  
  // Admin: Manually trigger score update for specific competition
  app.post("/api/admin/scores/update/:competitionId", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = parseInt(req.params.competitionId, 10);
      const result = await scoreUpdater.updateCompetition(competitionId);
      res.json({ 
        success: true, 
        message: `Updated ${result.updatedCount} of ${result.totalEntries} entries`,
        ...result
      });
    } catch (error: any) {
      console.error("Failed to update competition scores:", error);
      res.status(500).json({ message: error.message || "Failed to update scores" });
    }
  });
  
  // Admin: Start/stop automatic score updates
  app.post("/api/admin/scores/auto-update", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { enabled } = req.body;
      
      if (enabled) {
        scoreUpdater.startAutoUpdates();
        res.json({ success: true, message: "Automatic score updates enabled (every 5 minutes)" });
      } else {
        scoreUpdater.stopAutoUpdates();
        res.json({ success: true, message: "Automatic score updates disabled" });
      }
    } catch (error: any) {
      console.error("Failed to toggle auto-updates:", error);
      res.status(500).json({ message: error.message || "Failed to toggle auto-updates" });
    }
  });

  app.get("/api/admin/scores/auto-update", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      res.json({ enabled: scoreUpdater.isAutoUpdateEnabled() });
    } catch (error: any) {
      console.error("Failed to fetch auto-update status:", error);
      res.status(500).json({ message: error.message || "Failed to fetch auto-update status" });
    }
  });

  // -------------------------
  // REWARDS ENDPOINTS
  // -------------------------
  
  // Get user's rewards
  app.get("/api/rewards", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const rewards = await storage.getUserRewards(userId);
      const { db } = await import("./db.js");

      let claimedEntryIds = new Set<number>();

      const rows = await db.execute(sql`
        SELECT entry_id
        FROM app.competition_reward_claims
        WHERE user_id = ${userId}
      `);
      const claimRows = Array.isArray((rows as any)?.rows) ? (rows as any).rows : [];
      claimedEntryIds = new Set(
        claimRows
          .map((row: any) => Number(row.entry_id))
          .filter((value: number) => Number.isFinite(value) && value > 0),
      );

      const enriched = await Promise.all(
        rewards.map(async (entry) => {
          const competition = await storage.getCompetition(entry.competitionId);
          const prizeCard = entry.prizeCardId ? await storage.getPlayerCardWithPlayer(entry.prizeCardId, userId) : null;
          return {
            ...entry,
            claimed: claimedEntryIds.has(Number(entry.id)),
            competition,
            prizeCard,
          };
        }),
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("Failed to fetch rewards:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  app.get("/api/rewards/tournament-status", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const { db } = await import("./db.js");

      const rows = await db.execute(sql`
        SELECT
          ce.id AS entry_id,
          ce.competition_id,
          ce.rank,
          ce.prize_amount,
          ce.prize_card_id,
          c.name AS competition_name,
          c.prize_card_rarity,
          c.tier
        FROM app.competition_entries ce
        INNER JOIN app.competitions c ON c.id = ce.competition_id
        LEFT JOIN app.competition_reward_claims rc ON rc.entry_id = ce.id
        WHERE ce.user_id = ${userId}
          AND c.status = 'completed'
          AND (COALESCE(ce.prize_amount, 0) > 0 OR ce.prize_card_id IS NOT NULL)
          AND rc.id IS NULL
        ORDER BY c.end_date DESC NULLS LAST, ce.joined_at DESC
        LIMIT 1
      `);

      const row = Array.isArray((rows as any)?.rows) ? (rows as any).rows[0] : null;
      if (!row) {
        return res.json({ available: false, claimed: false });
      }

      const prizeCardId = row.prize_card_id == null ? null : Number(row.prize_card_id);
      const prizeAmount = toMoney(row.prize_amount || 0);
      const prizeCard = prizeCardId ? await storage.getPlayerCardWithPlayer(prizeCardId, userId) : null;
      const fallbackRarity = String(row.tier || "").toLowerCase() === "rare" && Number(row.rank || 0) === 1
        ? "unique"
        : String(row.prize_card_rarity || "rare").toLowerCase();

      return res.json({
        available: true,
        claimed: false,
        competitionName: String(row.competition_name || "Tournament"),
        competitionId: Number(row.competition_id),
        entryId: Number(row.entry_id),
        rank: Number(row.rank || 0),
        prizeAmount,
        hasMoney: prizeAmount > 0,
        cardId: prizeCardId,
        hasCard: Boolean(prizeCardId),
        rarity: String(prizeCard?.rarity || fallbackRarity || "rare").toLowerCase(),
      });
    } catch (error: any) {
      console.error("Failed to fetch tournament reward status:", error);
      return res.status(500).json({ message: "Failed to fetch tournament reward status" });
    }
  });

  app.post("/api/rewards/tournament-claim", requireAuth, async (req: any, res) => {
    try {
      const userId = String(req.authUserId || "");
      const requestedEntryId = Number(req.body?.entryId || 0);
      const { db } = await import("./db.js");
      const { wallets, transactions, notifications } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");

      const getPendingRewardQuery = requestedEntryId > 0
        ? sql`
            SELECT
              ce.id AS entry_id,
              ce.competition_id,
              ce.rank,
              ce.prize_amount,
              ce.prize_card_id,
              c.name AS competition_name,
              c.prize_card_rarity,
              c.tier
            FROM app.competition_entries ce
            INNER JOIN app.competitions c ON c.id = ce.competition_id
            LEFT JOIN app.competition_reward_claims rc ON rc.entry_id = ce.id
            WHERE ce.user_id = ${userId}
              AND ce.id = ${requestedEntryId}
              AND c.status = 'completed'
              AND (COALESCE(ce.prize_amount, 0) > 0 OR ce.prize_card_id IS NOT NULL)
              AND rc.id IS NULL
            LIMIT 1
          `
        : sql`
            SELECT
              ce.id AS entry_id,
              ce.competition_id,
              ce.rank,
              ce.prize_amount,
              ce.prize_card_id,
              c.name AS competition_name,
              c.prize_card_rarity,
              c.tier
            FROM app.competition_entries ce
            INNER JOIN app.competitions c ON c.id = ce.competition_id
            LEFT JOIN app.competition_reward_claims rc ON rc.entry_id = ce.id
            WHERE ce.user_id = ${userId}
              AND c.status = 'completed'
              AND (COALESCE(ce.prize_amount, 0) > 0 OR ce.prize_card_id IS NOT NULL)
              AND rc.id IS NULL
            ORDER BY c.end_date DESC NULLS LAST, ce.joined_at DESC
            LIMIT 1
          `;

      const rows = await db.execute(getPendingRewardQuery);
      const pending = Array.isArray((rows as any)?.rows) ? (rows as any).rows[0] : null;
      if (!pending) {
        return res.status(404).json({ message: "No claimable tournament reward found" });
      }

      const entryId = Number(pending.entry_id);
      const competitionId = Number(pending.competition_id);
      const rank = Number(pending.rank || 0);
      const prizeAmount = toMoney(pending.prize_amount || 0);
      const prizeCardId = pending.prize_card_id == null ? null : Number(pending.prize_card_id);
      const competitionName = String(pending.competition_name || "Tournament");

      let claimId = 0;

      await db.transaction(async (tx) => {
        const existingClaimRows = await tx.execute(sql`
          SELECT id
          FROM app.competition_reward_claims
          WHERE entry_id = ${entryId}
          LIMIT 1
        `);
        const existingClaim = Array.isArray((existingClaimRows as any)?.rows)
          ? (existingClaimRows as any).rows[0]
          : null;
        if (existingClaim?.id) {
          claimId = Number(existingClaim.id);
          return;
        }

        if (prizeAmount > 0) {
          await tx
            .update(wallets)
            .set({ balance: sql`${wallets.balance} + ${prizeAmount}` } as any)
            .where(eq(wallets.userId, userId));

          await tx.insert(transactions).values({
            userId,
            type: "prize",
            amount: prizeAmount,
            description: `Tournament reward claimed: ${competitionName} (Rank ${rank})`,
          } as any);
        }

        const inserted = await tx.execute(sql`
          INSERT INTO app.competition_reward_claims
            (entry_id, user_id, competition_id, prize_amount, prize_card_id)
          VALUES
            (${entryId}, ${userId}, ${competitionId}, ${prizeAmount}, ${prizeCardId})
          RETURNING id
        `);

        claimId = Number(
          Array.isArray((inserted as any)?.rows) ? (inserted as any).rows?.[0]?.id || 0 : 0,
        );

        const bits: string[] = [];
        if (prizeAmount > 0) bits.push(`${formatMoney(prizeAmount)} cash`);
        if (prizeCardId) bits.push("card reward");

        await tx.insert(notifications).values({
          userId,
          type: rank === 1 ? "win" : "system",
          title: "Congratulations! Reward claimed",
          message: `You claimed your ${competitionName} reward${bits.length ? `: ${bits.join(" + ")}` : ""}.`,
          read: false,
        } as any);
      });

      const prizeCard = prizeCardId ? await storage.getPlayerCardWithPlayer(prizeCardId, userId) : null;
      const fallbackRarity = String(pending.tier || "").toLowerCase() === "rare" && rank === 1
        ? "unique"
        : String(pending.prize_card_rarity || "rare").toLowerCase();

      return res.json({
        success: true,
        claimId,
        competitionId,
        competitionName,
        entryId,
        rank,
        prizeAmount,
        cardId: prizeCardId,
        rarity: String(prizeCard?.rarity || fallbackRarity || "rare").toLowerCase(),
      });
    } catch (error: any) {
      console.error("Failed to claim tournament reward:", error);
      return res.status(500).json({ message: "Failed to claim tournament reward" });
    }
  });

  // -------------------------
  // ADMIN ENDPOINTS
  // -------------------------

  app.post("/api/admin/players/backfill-fpl-photos", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const actorUserId = String(req.authUserId || "");
      const dryRunRaw = String(req.query.dryRun ?? req.body?.dryRun ?? "").toLowerCase();
      const dryRun = dryRunRaw === "1" || dryRunRaw === "true";

      const [bootstrap, existingPlayers] = await Promise.all([fplApi.bootstrap(), storage.getPlayers()]);
      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];

      const teamNameById = new Map<number, string>();
      for (const team of teams) {
        teamNameById.set(Number(team.id), normalizeLookupText(String(team.name || team.short_name || "")));
      }

      const elementByNameTeam = new Map<string, any>();
      const setCandidate = (name: string, teamNorm: string, element: any) => {
        const nameNorm = normalizeLookupText(name);
        if (!nameNorm || !teamNorm) return;
        const key = `${nameNorm}::${teamNorm}`;
        if (!elementByNameTeam.has(key)) elementByNameTeam.set(key, element);
      };

      for (const element of elements) {
        const teamNorm = teamNameById.get(Number(element.team)) || "";
        setCandidate(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim(), teamNorm, element);
        setCandidate(String(element.web_name || ""), teamNorm, element);
      }

      let checked = 0;
      let matched = 0;
      let updated = 0;
      let unchanged = 0;
      let unmatched = 0;

      const { db } = await import("./db.js");
      const { players } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");

      for (const player of existingPlayers) {
        if (normalizeLookupText(String(player.league || "")) !== "premier league") continue;
        checked += 1;

        const key = `${normalizeLookupText(String(player.name || ""))}::${normalizeLookupText(String(player.team || ""))}`;
        const element = elementByNameTeam.get(key);

        if (!element) {
          unmatched += 1;
          continue;
        }

        matched += 1;
        const nextImageUrl = fplApi.playerPhotoUrl(element, 250);
        if (String(player.imageUrl || "") === nextImageUrl) {
          unchanged += 1;
          continue;
        }

        if (!dryRun) {
          await db.update(players).set({ imageUrl: nextImageUrl } as any).where(eq(players.id, player.id));
        }
        updated += 1;
      }

      await writeAuditLog(actorUserId, "admin.players.backfill_fpl_photos", {
        dryRun,
        checked,
        matched,
        updated,
        unchanged,
        unmatched,
        ip: getClientIp(req),
      });

      return res.json({
        success: true,
        dryRun,
        checked,
        matched,
        updated,
        unchanged,
        unmatched,
        message: dryRun
          ? `Dry run complete. ${updated} players would be updated.`
          : `Updated ${updated} players with FPL photos (${matched} matched).`,
      });
    } catch (error: any) {
      console.error("Failed to backfill FPL player photos:", error);
      return res.status(500).json({ message: "Failed to backfill FPL player photos", error: error?.message });
    }
  });

  app.post("/api/admin/players/cache-images", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const actorUserId = String(req.authUserId || "");
      const limit = Math.max(1, Math.min(500, Number(req.body?.limit || req.query.limit || 250)));

      const [bootstrap, existingPlayers] = await Promise.all([fplApi.bootstrap(), storage.getPlayers()]);
      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];

      const teamNameById = new Map<number, string>();
      for (const team of teams) {
        teamNameById.set(Number(team.id), normalizeLookupText(String(team.name || team.short_name || "")));
      }

      const elementByNameTeam = new Map<string, any>();
      const setCandidate = (name: string, teamNorm: string, element: any) => {
        const nameNorm = normalizeLookupText(name);
        if (!nameNorm || !teamNorm) return;
        const key = `${nameNorm}::${teamNorm}`;
        if (!elementByNameTeam.has(key)) elementByNameTeam.set(key, element);
      };

      for (const element of elements) {
        const teamNorm = teamNameById.get(Number(element.team)) || "";
        setCandidate(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim(), teamNorm, element);
        setCandidate(String(element.web_name || ""), teamNorm, element);
      }

      const distPublicPath = path.resolve(process.cwd(), "dist", "public", "player-cache");
      const clientPublicPath = path.resolve(process.cwd(), "client", "public", "player-cache");
      const targetDir = process.env.NODE_ENV === "production" ? distPublicPath : clientPublicPath;
      await fs.mkdir(targetDir, { recursive: true });

      const { db } = await import("./db.js");
      const { players } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");

      const eplPlayers = existingPlayers.filter((player) => normalizeLookupText(String(player.league || "")) === "premier league").slice(0, limit);

      let checked = 0;
      let cached = 0;
      let unchanged = 0;
      let failed = 0;

      for (const player of eplPlayers) {
        checked += 1;

        const key = `${normalizeLookupText(String(player.name || ""))}::${normalizeLookupText(String(player.team || ""))}`;
        const element = elementByNameTeam.get(key);

        const localPath = `/player-cache/${player.id}.png`;
        const localFilePath = path.resolve(targetDir, `${player.id}.png`);

        if (String(player.imageUrl || "") === localPath) {
          unchanged += 1;
          continue;
        }

        const sources = [
          (() => {
            const code = element ? extractPhotoCode(String(element?.photo || "")) : extractPhotoCode(String(player.imageUrl || ""));
            return code ? `https://media.api-sports.io/football/players/${code}.png` : null;
          })(),
          element ? fplApi.playerPhotoUrl(element, 250) : null,
          String(player.imageUrl || "").startsWith("http") ? String(player.imageUrl) : null,
        ].filter(Boolean) as string[];

        let wroteFile = false;
        for (const sourceUrl of sources) {
          try {
            const upstream = await fetch(sourceUrl, {
              headers: {
                "User-Agent": "FantasyFC-ImageCache/1.0",
                Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              },
            });

            if (!upstream.ok) continue;
            const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
            if (!contentType.startsWith("image/")) continue;

            const buffer = Buffer.from(await upstream.arrayBuffer());
            await fs.writeFile(localFilePath, buffer);
            wroteFile = true;
            break;
          } catch {
            continue;
          }
        }

        if (!wroteFile) {
          failed += 1;
          continue;
        }

        await db.update(players).set({ imageUrl: localPath } as any).where(eq(players.id, player.id));
        cached += 1;
      }

      await writeAuditLog(actorUserId, "admin.players.cache_images", {
        checked,
        cached,
        unchanged,
        failed,
        limit,
        ip: getClientIp(req),
      });

      return res.json({
        success: true,
        checked,
        cached,
        unchanged,
        failed,
        message: `Cached ${cached} player images locally (${failed} failed).`,
      });
    } catch (error: any) {
      console.error("Failed to cache player images:", error);
      return res.status(500).json({ message: "Failed to cache player images", error: error?.message });
    }
  });
  
  // Get all users (paginated)
  app.get("/api/admin/users", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
      
      const { db } = await import("./db.js");
      const { users, wallets } = await import("../shared/schema.js");
      const { sql } = await import("drizzle-orm");
      
      // Get all users with their wallets
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          isBanned: users.isBanned,
          banReason: users.banReason,
          bannedAt: users.bannedAt,
          createdAt: users.createdAt,
          balance: wallets.balance,
          lockedBalance: wallets.lockedBalance,
        })
        .from(users)
        .leftJoin(wallets, sql`${users.id} = ${wallets.userId}`);
      
      const total = allUsers.length;
      const start = (page - 1) * limit;
      const pageItems = allUsers.slice(start, start + limit);
      
      res.json({
        users: pageItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/search", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const query = String(req.query.q || "").trim().toLowerCase();
      const { db } = await import("./db.js");
      const { users, wallets } = await import("../shared/schema.js");
      const { sql } = await import("drizzle-orm");

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          isBanned: users.isBanned,
          banReason: users.banReason,
          createdAt: users.createdAt,
          balance: wallets.balance,
          lockedBalance: wallets.lockedBalance,
        })
        .from(users)
        .leftJoin(wallets, sql`${users.id} = ${wallets.userId}`);

      const filtered = query
        ? allUsers.filter((user) =>
            String(user.id || "").toLowerCase().includes(query) ||
            String(user.email || "").toLowerCase().includes(query),
          )
        : allUsers;

      const preview = filtered.slice(0, 25);
      const enriched = await Promise.all(
        preview.map(async (user) => {
          const [cards, txs] = await Promise.all([
            storage.getUserCards(String(user.id)),
            storage.getTransactions(String(user.id)),
          ]);
          return {
            ...user,
            cardsCount: cards.length,
            listingsCount: cards.filter((card) => Boolean(card.forSale)).length,
            purchasesCount: txs.filter((tx) => tx.type === "purchase").length,
          };
        }),
      );

      return res.json({ users: enriched, total: filtered.length });
    } catch (error: any) {
      console.error("Failed to search users:", error);
      return res.status(500).json({ message: "Failed to search users" });
    }
  });

  app.get("/api/admin/users/:id/details", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const userId = String(req.params.id || "").trim();
      if (!userId) {
        return res.status(400).json({ message: "User id is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const [wallet, cards, transactions] = await Promise.all([
        storage.getWallet(userId),
        storage.getUserCards(userId),
        storage.getTransactions(userId),
      ]);

      return res.json({
        user,
        wallet,
        cards,
        listings: cards.filter((card) => Boolean(card.forSale)),
        purchases: transactions.filter((tx) => tx.type === "purchase"),
      });
    } catch (error: any) {
      console.error("Failed to fetch user details:", error);
      return res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  app.post("/api/admin/users/:id/ban", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const targetUserId = String(req.params.id || "").trim();
      const actorUserId = String(req.authUserId || "");
      const reason = String(req.body?.reason || "").trim();

      if (!targetUserId) {
        return res.status(400).json({ message: "User id is required" });
      }
      if (targetUserId === actorUserId) {
        return res.status(400).json({ message: "You cannot ban yourself" });
      }

      const updated = await storage.updateUser(targetUserId, {
        isBanned: true,
        banReason: reason || null,
        bannedAt: new Date(),
        bannedBy: actorUserId,
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      await writeAuditLog(actorUserId, "admin.user.ban", {
        targetUserId,
        reason: reason || null,
        ip: getClientIp(req),
      });

      return res.json({ success: true, message: "User banned successfully" });
    } catch (error: any) {
      console.error("Failed to ban user:", error);
      return res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.post("/api/admin/users/:id/unban", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const targetUserId = String(req.params.id || "").trim();
      const actorUserId = String(req.authUserId || "");

      if (!targetUserId) {
        return res.status(400).json({ message: "User id is required" });
      }

      const updated = await storage.updateUser(targetUserId, {
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
      } as any);

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      await writeAuditLog(actorUserId, "admin.user.unban", {
        targetUserId,
        ip: getClientIp(req),
      });

      return res.json({ success: true, message: "User unbanned successfully" });
    } catch (error: any) {
      console.error("Failed to unban user:", error);
      return res.status(500).json({ message: "Failed to unban user" });
    }
  });
  
  // Get system stats
  app.get("/api/admin/stats", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const { users, playerCards, auctions, competitions, transactions } = await import("../shared/schema.js");
      const { sql } = await import("drizzle-orm");
      
      const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const [cardCount] = await db.select({ count: sql<number>`count(*)` }).from(playerCards);
      const [auctionCount] = await db.select({ count: sql<number>`count(*)` }).from(auctions);
      const [competitionCount] = await db.select({ count: sql<number>`count(*)` }).from(competitions);
      const [transactionCount] = await db.select({ count: sql<number>`count(*)` }).from(transactions);

      const now = Date.now();
      const dayStart = now - 24 * 60 * 60 * 1000;
      const weekStart = now - 7 * 24 * 60 * 60 * 1000;
      const monthStart = now - 30 * 24 * 60 * 60 * 1000;

      const transactionRows = await db
        .select({ userId: transactions.userId, amount: transactions.amount, type: transactions.type, createdAt: transactions.createdAt })
        .from(transactions);

      const signups = await db
        .select({ createdAt: users.createdAt })
        .from(users);

      const uniqueUsersSince = (thresholdMs: number) => {
        const set = new Set<string>();
        for (const row of transactionRows) {
          const createdAtMs = row.createdAt ? new Date(row.createdAt as any).getTime() : 0;
          if (Number.isFinite(createdAtMs) && createdAtMs >= thresholdMs && row.userId) {
            set.add(String(row.userId));
          }
        }
        return set.size;
      };

      const saleRows = transactionRows.filter((row) => row.type === "sale");
      const netToSellers = saleRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0);
      const grossVolume = netToSellers / 0.92;
      const fees = Math.max(0, grossVolume - netToSellers);
      const activeListings = await storage.getMarketplaceListings();
      const errorsLast24h = requestEvents.filter((event) => event.ts >= dayStart && event.status >= 400).length;
      const newSignups24h = signups.filter((row) => {
        const createdAtMs = row.createdAt ? new Date(row.createdAt as any).getTime() : 0;
        return Number.isFinite(createdAtMs) && createdAtMs >= dayStart;
      }).length;
      
      res.json({
        users: userCount.count,
        cards: cardCount.count,
        auctions: auctionCount.count,
        competitions: competitionCount.count,
        transactions: transactionCount.count,
        dau: uniqueUsersSince(dayStart),
        wau: uniqueUsersSince(weekStart),
        mau: uniqueUsersSince(monthStart),
        newSignups24h,
        marketplaceVolume: Number(grossVolume.toFixed(2)),
        marketplaceFees: Number(fees.toFixed(2)),
        activeListings: activeListings.length,
        errorsLast24h,
      });
    } catch (error: any) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/backoffice", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const range = String(req.query.range || "30d").toLowerCase();
      const now = Date.now();
      const rangeMs =
        range === "1d" ? 24 * 60 * 60 * 1000 :
        range === "7d" ? 7 * 24 * 60 * 60 * 1000 :
        range === "90d" ? 90 * 24 * 60 * 60 * 1000 :
        30 * 24 * 60 * 60 * 1000;
      const startMs = now - rangeMs;

      const { db } = await import("./db.js");
      const { users, wallets, playerCards, players, auctions, auctionBids, competitions, competitionEntries, transactions, auditLogs, withdrawalRequests } = await import("../shared/schema.js");
            const safeSelect = async <T>(query: Promise<T>, label: string): Promise<any[]> => {
        try {
          const result = await query;
          return Array.isArray(result) ? result : [];
        } catch (error) {
          console.warn(`Backoffice partial query failed for ${label}:`, error);
          return [];
        }
      };

      const [
        allUsers,
        allWallets,
        allCards,
        allPlayers,
        allAuctions,
        allBids,
        allCompetitions,
        allEntries,
        allTransactions,
        allLogs,
        allWithdrawals,
      ] = await Promise.all([
        safeSelect(db.select().from(users), "users"),
        safeSelect(db.select().from(wallets), "wallets"),
        safeSelect(db.select().from(playerCards), "playerCards"),
        safeSelect(db.select().from(players), "players"),
        safeSelect(db.select().from(auctions), "auctions"),
        safeSelect(db.select().from(auctionBids), "auctionBids"),
        safeSelect(db.select().from(competitions), "competitions"),
        safeSelect(db.select().from(competitionEntries), "competitionEntries"),
        safeSelect(db.select().from(transactions), "transactions"),
        safeSelect(db.select().from(auditLogs), "auditLogs"),
        safeSelect(db.select().from(withdrawalRequests), "withdrawalRequests"),
      ]);

      const playerById = new Map<number, any>(allPlayers.map((p: any) => [Number(p.id), p]));
      const cardById = new Map<number, any>(allCards.map((c: any) => [Number(c.id), c]));
      const cardsByUser = new Map<string, any[]>();
      allCards.forEach((card: any) => {
        const userId = String(card.ownerId || "");
        if (!cardsByUser.has(userId)) cardsByUser.set(userId, []);
        cardsByUser.get(userId)!.push(card);
      });

      const txInRange = allTransactions.filter((tx: any) => {
        const createdAtMs = tx.createdAt ? new Date(tx.createdAt as any).getTime() : 0;
        return Number.isFinite(createdAtMs) && createdAtMs >= startMs;
      });

      const purchaseRows = txInRange.filter((tx: any) => String(tx.type) === "purchase");
      const saleRows = txInRange.filter((tx: any) => String(tx.type) === "sale");
      const entryFeeRows = txInRange.filter((tx: any) => String(tx.type) === "entry_fee");
      const grossVolume = purchaseRows.reduce((sum: number, tx: any) => sum + Math.max(0, Number(tx.amount || 0)), 0);
      const netSellerPayouts = Math.abs(saleRows.reduce((sum: number, tx: any) => sum + Math.min(0, Number(tx.amount || 0)), 0));
      const platformFees = Math.max(0, grossVolume - netSellerPayouts);
      const tournamentFees = entryFeeRows.reduce((sum: number, tx: any) => sum + Math.max(0, Number(tx.amount || 0)), 0);

      const listingsCount = allCards.filter((c: any) => Boolean(c.forSale)).length;
      const auctionsLive = allAuctions.filter((a: any) => String(a.status) === "live").length;
      const competitionsLive = allCompetitions.filter((c: any) => String(c.status) === "active" || String(c.status) === "open").length;
      const withdrawalsPending = allWithdrawals.filter((w: any) => String(w.status) === "pending").length;

      const activeUsers = new Set<string>(txInRange.map((tx: any) => String(tx.userId || ""))).size;
      const totalWalletBalances = allWallets.reduce((sum: number, w: any) => sum + Number(w.balance || 0) + Number(w.lockedBalance || 0), 0);
      const soldCards = saleRows.length;

      const raritySupply = new Map<string, number>();
      const mintedByLeague = new Map<string, number>();
      const topCardsByPrice: Array<{ cardId: number; player: string; rarity: string; amount: number }> = [];
      const cardTrades = new Map<number, { count: number; high: number }>();
      const buyVolumeByUser = new Map<string, number>();
      const sellVolumeByUser = new Map<string, number>();
      const leagueVolume = new Map<string, number>();
      const rarityVolume = new Map<string, number>();

      allCards.forEach((card: any) => {
        const rarity = String(card.rarity || "common");
        raritySupply.set(rarity, (raritySupply.get(rarity) || 0) + 1);
        const league = String(playerById.get(Number(card.playerId))?.league || "Unknown");
        mintedByLeague.set(league, (mintedByLeague.get(league) || 0) + 1);
      });

      purchaseRows.forEach((tx: any) => {
        const desc = String(tx.description || "");
        const cardIdMatch = desc.match(/card\s*#?(\d+)/i);
        const sellerMatch = desc.match(/from\s+([a-zA-Z0-9_-]+)/i);
        const cardId = cardIdMatch ? Number(cardIdMatch[1]) : 0;
        const amount = Number(tx.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) return;
        buyVolumeByUser.set(String(tx.userId || ""), (buyVolumeByUser.get(String(tx.userId || "")) || 0) + amount);
        if (sellerMatch?.[1]) {
          const seller = String(sellerMatch[1]);
          sellVolumeByUser.set(seller, (sellVolumeByUser.get(seller) || 0) + amount);
        }
        if (cardId > 0) {
          const card = cardById.get(cardId);
          const rarity = String(card?.rarity || "unknown");
          rarityVolume.set(rarity, (rarityVolume.get(rarity) || 0) + amount);
          const league = String(playerById.get(Number(card?.playerId || 0))?.league || "Unknown");
          leagueVolume.set(league, (leagueVolume.get(league) || 0) + amount);
          const trade = cardTrades.get(cardId) || { count: 0, high: 0 };
          trade.count += 1;
          trade.high = Math.max(trade.high, amount);
          cardTrades.set(cardId, trade);
          const playerName = String(playerById.get(Number(card?.playerId || 0))?.name || "Unknown");
          topCardsByPrice.push({ cardId, player: playerName, rarity, amount });
        }
      });

      const topSellingRarity = Array.from(rarityVolume.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "n/a";
      const topLeagues = Array.from(leagueVolume.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([league, volume]) => ({ league, volume: Number(volume.toFixed(2)) }));
      const topCards = topCardsByPrice.sort((a, b) => b.amount - a.amount).slice(0, 10);
      const cardsNeverTraded = allCards.filter((card: any) => !cardTrades.has(Number(card.id))).slice(0, 50).map((card: any) => ({
        cardId: Number(card.id),
        player: String(playerById.get(Number(card.playerId))?.name || "Unknown"),
        rarity: String(card.rarity || "common"),
        ownerId: String(card.ownerId || ""),
      }));
      const mostTradedCards = Array.from(cardTrades.entries())
        .map(([cardId, stats]) => ({
          cardId,
          player: String(playerById.get(Number(cardById.get(cardId)?.playerId || 0))?.name || "Unknown"),
          count: stats.count,
          highSale: stats.high,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const cardsByOwner = Array.from(cardsByUser.entries()).map(([userId, cards]) => ({ userId, cards: cards.length })).sort((a, b) => b.cards - a.cards).slice(0, 20);

      const competitionEntriesByUser = new Map<string, number>();
      allEntries.forEach((entry: any) => {
        const userId = String(entry.userId || "");
        competitionEntriesByUser.set(userId, (competitionEntriesByUser.get(userId) || 0) + 1);
      });
      const suspiciousUsers = allUsers
        .map((u: any) => {
          const uid = String(u.id || "");
          const buys = buyVolumeByUser.get(uid) || 0;
          const sells = sellVolumeByUser.get(uid) || 0;
          const cardCount = cardsByUser.get(uid)?.length || 0;
          const flags: string[] = [];
          if (buys > 300000) flags.push("high_buy_volume");
          if (sells > 300000) flags.push("high_sell_volume");
          if (cardCount > 300) flags.push("large_inventory");
          return { userId: uid, flags, buys, sells, cardCount };
        })
        .filter((u) => u.flags.length > 0)
        .slice(0, 20);

      const fmtMap = (map: Map<string, number>, keyLabel: string, valueLabel: string) =>
        Array.from(map.entries()).map(([k, v]) => ({ [keyLabel]: k, [valueLabel]: Number(v.toFixed(2)) }));
      const registrationsOverTime = allUsers
        .map((u: any) => {
          const createdAt = u.createdAt ? new Date(u.createdAt as any) : null;
          const bucket = createdAt ? `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, "0")}` : "unknown";
          return bucket;
        })
        .reduce((acc: Record<string, number>, bucket: string) => {
          acc[bucket] = (acc[bucket] || 0) + 1;
          return acc;
        }, {});

      return res.json({
        range,
        overview: {
          totalUsers: allUsers.length,
          activeUsers,
          totalCardsMinted: allCards.length,
          listedCards: listingsCount,
          soldCards,
          auctionsLive,
          competitionsLive,
          walletBalances: Number(totalWalletBalances.toFixed(2)),
          grossMarketplaceVolume: Number(grossVolume.toFixed(2)),
          netSellerPayouts: Number(netSellerPayouts.toFixed(2)),
          platformFees: Number(platformFees.toFixed(2)),
          tournamentFees: Number(tournamentFees.toFixed(2)),
          withdrawalsPending,
          aiMonitoring: {
            requestsLastHour: requestEvents.length,
            errorsLastHour: requestEvents.filter((event) => event.status >= 400).length,
            onlineUsersLast10Minutes: Array.from(userLastSeen.entries()).filter(([, ts]) => now - ts <= 10 * 60 * 1000).length,
          },
        },
        marketplaceAnalytics: {
          dailyVolume: Number((grossVolume / Math.max(1, rangeMs / (24 * 60 * 60 * 1000))).toFixed(2)),
          weeklyVolume: Number((grossVolume / Math.max(1, rangeMs / (7 * 24 * 60 * 60 * 1000))).toFixed(2)),
          monthlyVolume: Number((grossVolume / Math.max(1, rangeMs / (30 * 24 * 60 * 60 * 1000))).toFixed(2)),
          transactionCount: purchaseRows.length,
          averageSalePrice: Number((grossVolume / Math.max(1, purchaseRows.length)).toFixed(2)),
          topSellingRarity,
          topLeagues,
          topCards,
          topBuyers: fmtMap(buyVolumeByUser, "userId", "volume").sort((a: any, b: any) => b.volume - a.volume).slice(0, 10),
          topSellers: fmtMap(sellVolumeByUser, "userId", "volume").sort((a: any, b: any) => b.volume - a.volume).slice(0, 10),
        },
        cardAnalytics: {
          supplyByRarity: fmtMap(raritySupply, "rarity", "count"),
          mintedByLeague: fmtMap(mintedByLeague, "league", "count"),
          ownershipStates: {
            owned: allCards.length - listingsCount - auctionsLive,
            listed: listingsCount,
            inAuction: allAuctions.filter((a: any) => String(a.status) === "live").length,
          },
          mostTradedCards,
          highestSaleCards: topCards,
          cardsNeverTraded,
          cardsByOwner,
        },
        userAnalytics: {
          registrationsOverTime: Object.entries(registrationsOverTime).map(([bucket, count]) => ({ bucket, count })),
          topBuyers: fmtMap(buyVolumeByUser, "userId", "volume").sort((a: any, b: any) => b.volume - a.volume).slice(0, 10),
          topSellers: fmtMap(sellVolumeByUser, "userId", "volume").sort((a: any, b: any) => b.volume - a.volume).slice(0, 10),
          highestWalletBalances: allWallets
            .map((w: any) => ({ userId: String(w.userId || ""), balance: Number((Number(w.balance || 0) + Number(w.lockedBalance || 0)).toFixed(2)) }))
            .sort((a: any, b: any) => b.balance - a.balance)
            .slice(0, 10),
          mostActiveTraders: fmtMap(
            new Map(
              Array.from(buyVolumeByUser.entries()).map(([k, v]) => [k, v + (sellVolumeByUser.get(k) || 0)]),
            ),
            "userId",
            "activity",
          ).sort((a: any, b: any) => b.activity - a.activity).slice(0, 10),
          mostTournamentEntries: fmtMap(competitionEntriesByUser, "userId", "entries").sort((a: any, b: any) => b.entries - a.entries).slice(0, 10),
          suspiciousActivityFlags: suspiciousUsers,
        },
        entities: {
          cards: allCards.slice(0, 300).map((card: any) => ({
            ...(function () {
              const league = String(playerById.get(Number(card.playerId))?.league || "");
              const status = getCardStatus({ league, hasProgression: Number(card.xp || 0) > 0 || Number(card.level || 0) > 1 });
              return {
                cardStatus: status,
                competitionEligible: isMainCompetitionEligible({ rarity: normalizeRarityTier(String(card.rarity || "common")), status }),
              };
            })(),
            id: card.id,
            player: String(playerById.get(Number(card.playerId))?.name || "Unknown"),
            league: String(playerById.get(Number(card.playerId))?.league || "Unknown"),
            rarity: String(card.rarity || "common"),
            serialNumber: card.serialNumber,
            maxSupply: card.maxSupply,
            ownerId: card.ownerId,
            listingStatus: Boolean(card.forSale),
            auctionStatus: allAuctions.some((a: any) => Number(a.cardId) === Number(card.id) && String(a.status) === "live"),
            highestSale: cardTrades.get(Number(card.id))?.high || 0,
            tradeCount: cardTrades.get(Number(card.id))?.count || 0,
          })),
          users: allUsers.slice(0, 300).map((user: any) => ({
            id: user.id,
            email: user.email,
            profile: user.name,
            wallet: Number((Number(allWallets.find((w: any) => String(w.userId) === String(user.id))?.balance || 0)).toFixed(2)),
            cardsOwned: cardsByUser.get(String(user.id))?.length || 0,
            bidsPlaced: allBids.filter((b: any) => String(b.bidderUserId || "") === String(user.id)).length,
            purchases: purchaseRows.filter((tx: any) => String(tx.userId || "") === String(user.id)).length,
            sales: saleRows.filter((tx: any) => String(tx.userId || "") === String(user.id)).length,
            tournamentEntries: competitionEntriesByUser.get(String(user.id)) || 0,
            adminNotes: null,
          })),
          transactions: purchaseRows.slice(0, 400).map((tx: any) => ({
            id: tx.id,
            buyer: tx.userId,
            seller: String(tx.description || "").match(/from\s+([a-zA-Z0-9_-]+)/i)?.[1] || "unknown",
            card: String(tx.description || "").match(/card\s*#?(\d+)/i)?.[1] || "unknown",
            grossAmount: Number(tx.amount || 0),
            fees: Number((Number(tx.amount || 0) * 0.08).toFixed(2)),
            sellerNet: Number((Number(tx.amount || 0) * 0.92).toFixed(2)),
            timestamp: tx.createdAt,
          })),
          auctions: allAuctions.slice(0, 150).map((auction: any) => {
            const bids = allBids.filter((bid: any) => Number(bid.auctionId) === Number(auction.id));
            const winner = bids.sort((a: any, b: any) => Number(b.amount || 0) - Number(a.amount || 0))[0];
            return {
              id: auction.id,
              seller: auction.sellerUserId,
              bids: bids.length,
              winner: winner?.bidderUserId || null,
              reserve: Number(auction.reservePrice || 0),
              buyNow: Number(auction.buyNowPrice || 0),
              settlement: String(auction.status || ""),
            };
          }),
          tournaments: allCompetitions.slice(0, 150).map((competition: any) => {
            const entries = allEntries.filter((entry: any) => Number(entry.competitionId) === Number(competition.id));
            return {
              id: competition.id,
              name: competition.name,
              participants: entries.length,
              prizePool: Number((Number(competition.entryFee || 0) * entries.length).toFixed(2)),
              feeShare: Number((Number(competition.entryFee || 0) * entries.length * 0.2).toFixed(2)),
              payoutBreakdown: "60/30/10",
              winningLineups: entries.filter((e: any) => Number(e.rank || 99) <= 3).map((e: any) => ({ userId: e.userId, rank: e.rank, score: e.totalScore })),
            };
          }),
          audit: allLogs
            .sort((a: any, b: any) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
            .slice(0, 200)
            .map((log: any) => ({ id: log.id, action: log.action, userId: log.userId, at: log.createdAt, meta: log.meta })),
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch backoffice analytics:", error);
      return res.status(500).json({ message: "Failed to fetch backoffice analytics" });
    }
  });

  app.get("/api/admin/entities", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const entity = String(req.query.entity || "cards").toLowerCase();
      const query = String(req.query.q || "").trim().toLowerCase();
      const league = String(req.query.league || "").trim().toLowerCase();
      const status = String(req.query.status || "").trim().toLowerCase();
      const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

      const { db } = await import("./db.js");
      const { users, playerCards, players, transactions, auctions, auctionBids, competitions, competitionEntries, withdrawalRequests, auditLogs, wallets } = await import("../shared/schema.js");

      const applyQuery = <T extends Record<string, any>>(rows: T[]) =>
        rows.filter((row) => (query ? JSON.stringify(row).toLowerCase().includes(query) : true)).slice(0, limit);

      if (entity === "users") {
        const [uRows, walletRows, cardRows, txRows, entryRows] = await Promise.all([
          db.select().from(users),
          db.select().from(wallets),
          db.select().from(playerCards),
          db.select().from(transactions),
          db.select().from(competitionEntries),
        ]);
        const data = uRows.map((user: any) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          isBanned: user.isBanned,
          walletBalance: Number(walletRows.find((w: any) => String(w.userId) === String(user.id))?.balance || 0),
          cardsOwned: cardRows.filter((card: any) => String(card.ownerId || "") === String(user.id)).length,
          bidsPlaced: 0,
          purchases: txRows.filter((tx: any) => String(tx.userId || "") === String(user.id) && String(tx.type) === "purchase").length,
          sales: txRows.filter((tx: any) => String(tx.userId || "") === String(user.id) && String(tx.type) === "sale").length,
          tournamentEntries: entryRows.filter((entry: any) => String(entry.userId || "") === String(user.id)).length,
        }));
        return res.json({ entity, items: applyQuery(data), total: data.length });
      }

      if (entity === "cards") {
        const [cardRows, playerRows, txRows, auctionRows] = await Promise.all([
          db.select().from(playerCards),
          db.select().from(players),
          db.select().from(transactions),
          db.select().from(auctions),
        ]);
        const playerById = new Map<number, any>(playerRows.map((p: any) => [Number(p.id), p]));
        let data = cardRows.map((card: any) => {
          const player = playerById.get(Number(card.playerId));
          const cardTx = txRows.filter((tx: any) => String(tx.description || "").toLowerCase().includes(`card ${card.id}`));
          const cardStatus = getCardStatus({
            league: String(player?.league || ""),
            hasProgression: Number(card.xp || 0) > 0 || Number(card.level || 0) > 1,
          });
          return {
            id: card.id,
            player: String(player?.name || "Unknown"),
            league: String(player?.league || "Unknown"),
            rarity: card.rarity,
            cardStatus,
            competitionEligible: isMainCompetitionEligible({ rarity: normalizeRarityTier(String(card.rarity || "common")), status: cardStatus }),
            serialNumber: card.serialNumber,
            maxSupply: card.maxSupply,
            ownerId: card.ownerId,
            listed: Boolean(card.forSale),
            inAuction: auctionRows.some((auction: any) => Number(auction.cardId) === Number(card.id) && String(auction.status) === "live"),
            tradeCount: cardTx.length,
          };
        });
        if (league) data = data.filter((card: any) => String(card.league || "").toLowerCase().includes(league));
        if (status === "listed") data = data.filter((card: any) => card.listed);
        if (status === "auction") data = data.filter((card: any) => card.inAuction);
        return res.json({ entity, items: applyQuery(data), total: data.length });
      }

      if (entity === "transactions") {
        const txRows = await db.select().from(transactions);
        let data = txRows.map((tx: any) => ({
          id: tx.id,
          type: tx.type,
          userId: tx.userId,
          amount: Number(tx.amount || 0),
          description: tx.description,
          createdAt: tx.createdAt,
        }));
        if (status) data = data.filter((tx: any) => String(tx.type) === status);
        return res.json({ entity, items: applyQuery(data), total: data.length });
      }

      if (entity === "auctions") {
        const [auctionRows, bidRows] = await Promise.all([db.select().from(auctions), db.select().from(auctionBids)]);
        const data = auctionRows.map((auction: any) => ({
          id: auction.id,
          cardId: auction.cardId,
          sellerUserId: auction.sellerUserId,
          status: auction.status,
          reservePrice: auction.reservePrice,
          buyNowPrice: auction.buyNowPrice,
          bids: bidRows.filter((b: any) => Number(b.auctionId) === Number(auction.id)).length,
          highestBid: Math.max(0, ...bidRows.filter((b: any) => Number(b.auctionId) === Number(auction.id)).map((b: any) => Number(b.amount || 0))),
        }));
        return res.json({ entity, items: applyQuery(data), total: data.length });
      }

      if (entity === "tournaments") {
        const [compRows, entryRows] = await Promise.all([db.select().from(competitions), db.select().from(competitionEntries)]);
        const data = compRows.map((comp: any) => {
          const entries = entryRows.filter((entry: any) => Number(entry.competitionId) === Number(comp.id));
          return {
            id: comp.id,
            name: comp.name,
            tier: comp.tier,
            status: comp.status,
            participants: entries.length,
            prizePool: Number((Number(comp.entryFee || 0) * entries.length).toFixed(2)),
            payoutBreakdown: "60/30/10",
          };
        });
        return res.json({ entity, items: applyQuery(data), total: data.length });
      }

      if (entity === "withdrawals") {
        const data = await db.select().from(withdrawalRequests);
        const normalized = data.map((row: any) => ({
          id: row.id,
          userId: row.userId,
          amount: row.amount,
          fee: row.fee,
          netAmount: row.netAmount,
          status: row.status,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
        }));
        return res.json({ entity, items: applyQuery(normalized), total: normalized.length });
      }

      if (entity === "activity") {
        const rows = await db.select().from(auditLogs);
        const normalized = rows.map((row: any) => ({ id: row.id, action: row.action, userId: row.userId, createdAt: row.createdAt, meta: row.meta }));
        return res.json({ entity, items: applyQuery(normalized), total: normalized.length });
      }

      return res.status(400).json({ message: "Unsupported entity type" });
    } catch (error: any) {
      console.error("Failed to fetch admin entities:", error);
      return res.status(500).json({ message: "Failed to fetch admin entities" });
    }
  });

  app.get("/api/admin/entities/:entity/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const entity = String(req.params.entity || "").toLowerCase();
      const id = String(req.params.id || "");
      const { db } = await import("./db.js");
      const { users, playerCards, players, transactions, auctions, auctionBids, competitions, competitionEntries, withdrawalRequests, auditLogs, wallets } = await import("../shared/schema.js");

      if (entity === "user") {
        const [user] = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);
        if (!user) return res.status(404).json({ message: "User not found" });
        const [wallet] = await db.select().from(wallets).where(sql`${wallets.userId} = ${id}`).limit(1);
        const cards = await db.select().from(playerCards).where(sql`${playerCards.ownerId} = ${id}`);
        const tx = await db.select().from(transactions).where(sql`${transactions.userId} = ${id}`);
        const entries = await db.select().from(competitionEntries).where(sql`${competitionEntries.userId} = ${id}`);
        const withdrawals = await db.select().from(withdrawalRequests).where(sql`${withdrawalRequests.userId} = ${id}`);
        return res.json({ user, wallet, cards, transactions: tx, entries, withdrawals });
      }

      if (entity === "card") {
        const cardId = Number(id);
        const [card] = await db.select().from(playerCards).where(sql`${playerCards.id} = ${cardId}`).limit(1);
        if (!card) return res.status(404).json({ message: "Card not found" });
        const [player] = await db.select().from(players).where(sql`${players.id} = ${card.playerId}`).limit(1);
        const auctionsForCard = await db.select().from(auctions).where(sql`${auctions.cardId} = ${cardId}`);
        const tx = await db.select().from(transactions);
        const saleHistory = tx.filter((row: any) => String(row.description || "").toLowerCase().includes(`card ${cardId}`));
        return res.json({ card, player, auctions: auctionsForCard, saleHistory });
      }

      if (entity === "auction") {
        const auctionId = Number(id);
        const [auction] = await db.select().from(auctions).where(sql`${auctions.id} = ${auctionId}`).limit(1);
        if (!auction) return res.status(404).json({ message: "Auction not found" });
        const bids = await db.select().from(auctionBids).where(sql`${auctionBids.auctionId} = ${auctionId}`);
        return res.json({ auction, bids });
      }

      if (entity === "tournament") {
        const competitionId = Number(id);
        const [competition] = await db.select().from(competitions).where(sql`${competitions.id} = ${competitionId}`).limit(1);
        if (!competition) return res.status(404).json({ message: "Tournament not found" });
        const entries = await db.select().from(competitionEntries).where(sql`${competitionEntries.competitionId} = ${competitionId}`);
        return res.json({ competition, entries });
      }

      if (entity === "transaction") {
        const txId = Number(id);
        const [tx] = await db.select().from(transactions).where(sql`${transactions.id} = ${txId}`).limit(1);
        if (!tx) return res.status(404).json({ message: "Transaction not found" });
        return res.json({ transaction: tx });
      }

      if (entity === "withdrawal") {
        const withdrawalId = Number(id);
        const [withdrawal] = await db.select().from(withdrawalRequests).where(sql`${withdrawalRequests.id} = ${withdrawalId}`).limit(1);
        if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });
        return res.json({ withdrawal });
      }

      if (entity === "activity") {
        const activityId = Number(id);
        const [log] = await db.select().from(auditLogs).where(sql`${auditLogs.id} = ${activityId}`).limit(1);
        if (!log) return res.status(404).json({ message: "Activity log not found" });
        return res.json({ activity: log });
      }

      return res.status(400).json({ message: "Unsupported entity detail type" });
    } catch (error: any) {
      console.error("Failed to fetch admin entity detail:", error);
      return res.status(500).json({ message: "Failed to fetch admin entity detail" });
    }
  });

  app.get("/api/admin/traffic", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      pruneTraffic();
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const tenMinutesMs = 10 * 60 * 1000;

      const reqLastMinute = requestEvents.filter((e) => e.ts >= oneMinuteAgo);
      const reqLastFive = requestEvents.filter((e) => e.ts >= fiveMinutesAgo);

      const routeStats = new Map<string, { count: number; errors: number; totalMs: number }>();
      for (const event of requestEvents) {
        const key = `${event.method} ${event.path}`;
        const prev = routeStats.get(key) || { count: 0, errors: 0, totalMs: 0 };
        prev.count += 1;
        prev.totalMs += event.durationMs;
        if (event.status >= 400) prev.errors += 1;
        routeStats.set(key, prev);
      }

      const topRoutes = Array.from(routeStats.entries())
        .map(([route, data]) => ({
          route,
          count: data.count,
          errorRate: data.count > 0 ? Number(((data.errors / data.count) * 100).toFixed(1)) : 0,
          avgDurationMs: data.count > 0 ? Number((data.totalMs / data.count).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const perMinuteSeries = Array.from({ length: 15 }).map((_, index) => {
        const from = now - (15 - index) * 60 * 1000;
        const to = from + 60 * 1000;
        const count = requestEvents.filter((e) => e.ts >= from && e.ts < to).length;
        return {
          minuteOffset: index - 14,
          count,
        };
      });

      const activeUsers = Array.from(userLastSeen.entries())
        .filter(([, ts]) => now - ts <= tenMinutesMs)
        .map(([userId, ts]) => ({
          userId,
          lastSeenSecondsAgo: Math.max(0, Math.floor((now - ts) / 1000)),
        }))
        .sort((a, b) => a.lastSeenSecondsAgo - b.lastSeenSecondsAgo);

      return res.json({
        windowMinutes: 60,
        requestsLastMinute: reqLastMinute.length,
        requestsLast5Minutes: reqLastFive.length,
        requestsLastHour: requestEvents.length,
        onlineUsersLast10Minutes: activeUsers.length,
        activeUsers,
        topRoutes,
        perMinuteSeries,
      });
    } catch (error: any) {
      console.error("Failed to fetch traffic metrics:", error);
      return res.status(500).json({ message: "Failed to fetch traffic metrics" });
    }
  });

  app.post("/api/admin/marketplace/remove-listing/:cardId", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const cardId = parseInt(req.params.cardId, 10);
      const reason = String(req.body?.reason || "").trim();
      if (!Number.isFinite(cardId)) {
        return res.status(400).json({ message: "Invalid card id" });
      }

      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      if (!card.forSale) {
        return res.status(400).json({ message: "Listing is already inactive" });
      }

      await storage.updatePlayerCard(cardId, { forSale: false, price: 0 });

      await writeAuditLog(String(req.authUserId || ""), "admin.marketplace.remove_listing", {
        cardId,
        ownerId: card.ownerId,
        reason: reason || null,
        ip: getClientIp(req),
      });

      return res.json({ success: true, message: "Listing removed" });
    } catch (error: any) {
      console.error("Failed to remove listing:", error);
      return res.status(500).json({ message: "Failed to remove listing" });
    }
  });

  app.post("/api/admin/competitions", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const {
        name,
        tier,
        entryFee,
        status,
        gameWeek,
        startDate,
        endDate,
        prizeCardRarity,
      } = req.body || {};

      const normalizedName = String(name || "").trim();
      const normalizedTier = String(tier || "common").toLowerCase();
      const normalizedStatus = String(status || "open").toLowerCase();
      const normalizedPrizeRarity = String(prizeCardRarity || "rare").toLowerCase();
      const normalizedEntryFee = Number(entryFee || 0);
      const normalizedGameWeek = Number(gameWeek || 0);
      const start = new Date(startDate);
      const end = new Date(endDate);

      const validTiers = new Set(["common", "rare", "unique", "legendary"]);
      const validStatuses = new Set(["open", "upcoming", "active", "completed"]);
      const validPrizeRarities = new Set(["common", "rare", "unique", "epic", "legendary"]);

      if (!normalizedName) {
        return res.status(400).json({ message: "Tournament name is required" });
      }
      if (!validTiers.has(normalizedTier)) {
        return res.status(400).json({ message: "Invalid tournament tier" });
      }
      if (!validStatuses.has(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid tournament status" });
      }
      if (!validPrizeRarities.has(normalizedPrizeRarity)) {
        return res.status(400).json({ message: "Invalid prize card rarity" });
      }
      if (!Number.isFinite(normalizedEntryFee) || normalizedEntryFee < 0) {
        return res.status(400).json({ message: "Entry fee must be a non-negative number" });
      }
      if (!Number.isFinite(normalizedGameWeek) || normalizedGameWeek < 1) {
        return res.status(400).json({ message: "Game week must be at least 1" });
      }
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        return res.status(400).json({ message: "Invalid start/end dates" });
      }

      const created = await storage.createCompetition({
        name: normalizedName,
        tier: normalizedTier as any,
        entryFee: normalizedEntryFee,
        status: normalizedStatus as any,
        gameWeek: normalizedGameWeek,
        startDate: start,
        endDate: end,
        prizeCardRarity: normalizedPrizeRarity as any,
      } as any);

      await writeAuditLog(String(req.authUserId || ""), "admin.competition.create", {
        competitionId: created.id,
        status: created.status,
        tier: created.tier,
        ip: getClientIp(req),
      });

      return res.json({ success: true, message: "Tournament created successfully", competition: created });
    } catch (error: any) {
      console.error("Failed to create tournament:", error);
      return res.status(500).json({ message: "Failed to create tournament", error: error?.message });
    }
  });

  app.patch("/api/admin/competitions/:id", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const competitionId = parseInt(req.params.id, 10);
      if (!Number.isFinite(competitionId)) {
        return res.status(400).json({ message: "Invalid tournament id" });
      }

      const existing = await storage.getCompetition(competitionId);
      if (!existing) {
        return res.status(404).json({ message: "Tournament not found" });
      }

      const {
        name,
        tier,
        entryFee,
        status,
        gameWeek,
        startDate,
        endDate,
        prizeCardRarity,
      } = req.body || {};

      const updates: any = {};
      const validTiers = new Set(["common", "rare", "unique", "legendary"]);
      const validStatuses = new Set(["open", "upcoming", "active", "completed"]);
      const validPrizeRarities = new Set(["common", "rare", "unique", "epic", "legendary"]);

      if (name !== undefined) {
        const normalizedName = String(name || "").trim();
        if (!normalizedName) return res.status(400).json({ message: "Tournament name cannot be empty" });
        updates.name = normalizedName;
      }
      if (tier !== undefined) {
        const normalizedTier = String(tier || "").toLowerCase();
        if (!validTiers.has(normalizedTier)) return res.status(400).json({ message: "Invalid tournament tier" });
        updates.tier = normalizedTier;
      }
      if (status !== undefined) {
        const normalizedStatus = String(status || "").toLowerCase();
        if (!validStatuses.has(normalizedStatus)) return res.status(400).json({ message: "Invalid tournament status" });
        updates.status = normalizedStatus;
      }
      if (prizeCardRarity !== undefined) {
        const normalizedPrizeRarity = String(prizeCardRarity || "").toLowerCase();
        if (!validPrizeRarities.has(normalizedPrizeRarity)) return res.status(400).json({ message: "Invalid prize card rarity" });
        updates.prizeCardRarity = normalizedPrizeRarity;
      }
      if (entryFee !== undefined) {
        const normalizedEntryFee = Number(entryFee);
        if (!Number.isFinite(normalizedEntryFee) || normalizedEntryFee < 0) {
          return res.status(400).json({ message: "Entry fee must be a non-negative number" });
        }
        updates.entryFee = normalizedEntryFee;
      }
      if (gameWeek !== undefined) {
        const normalizedGameWeek = Number(gameWeek);
        if (!Number.isFinite(normalizedGameWeek) || normalizedGameWeek < 1) {
          return res.status(400).json({ message: "Game week must be at least 1" });
        }
        updates.gameWeek = normalizedGameWeek;
      }

      const nextStart = startDate !== undefined ? new Date(startDate) : new Date(existing.startDate as any);
      const nextEnd = endDate !== undefined ? new Date(endDate) : new Date(existing.endDate as any);
      if (!Number.isFinite(nextStart.getTime()) || !Number.isFinite(nextEnd.getTime()) || nextEnd <= nextStart) {
        return res.status(400).json({ message: "Invalid start/end dates" });
      }
      if (startDate !== undefined) updates.startDate = nextStart;
      if (endDate !== undefined) updates.endDate = nextEnd;

      const updated = await storage.updateCompetition(competitionId, updates);

      await writeAuditLog(String(req.authUserId || ""), "admin.competition.update", {
        competitionId,
        updates: Object.keys(updates),
        ip: getClientIp(req),
      });

      return res.json({ success: true, message: "Tournament updated successfully", competition: updated });
    } catch (error: any) {
      console.error("Failed to update tournament:", error);
      return res.status(500).json({ message: "Failed to update tournament", error: error?.message });
    }
  });

  app.get("/api/admin/marketplace/integrity", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const { playerCards, players, competitionEntries, competitions } = await import("../shared/schema.js");

      const [cardRows, playerRows, entryRows, competitionRows] = await Promise.all([
        db.select().from(playerCards),
        db.select({ id: players.id, name: players.name }).from(players),
        db.select().from(competitionEntries),
        db.select().from(competitions),
      ]);

      const playerIds = new Set((playerRows as any[]).map((player: any) => Number(player.id)));
      const competitionStatusById = new Map((competitionRows as any[]).map((competition: any) => [Number(competition.id), String(competition.status || "")]));
      const activeLineupCardIds = new Set<number>();
      for (const entry of entryRows as any[]) {
        const status = competitionStatusById.get(Number(entry.competitionId));
        if (status !== "open" && status !== "active") continue;
        if (!Array.isArray(entry.lineupCardIds)) continue;
        for (const id of entry.lineupCardIds) {
          const cardId = Number(id);
          if (Number.isFinite(cardId) && cardId > 0) activeLineupCardIds.add(cardId);
        }
      }

      const rows = (cardRows as any[])
        .filter((card: any) => Boolean(card.forSale))
        .map((card: any) => {
          const cardId = Number(card.id || 0);
          const rarity = String(card.rarity || "common").toLowerCase();
          const price = toMoney(card.price || 0);
          const floor = getMarketplaceFloorPrice(rarity);
          const flags = [
            !playerIds.has(Number(card.playerId || 0)) ? "missing_player" : null,
            !card.ownerId ? "missing_owner" : null,
            !isMarketplaceTradableRarity(rarity) ? "untradable_rarity" : null,
            price <= 0 ? "invalid_price" : null,
            floor > 0 && price < floor ? "below_floor" : null,
            activeLineupCardIds.has(cardId) ? "listed_in_active_lineup" : null,
          ].filter(Boolean);

          return {
            cardId,
            playerId: Number(card.playerId || 0),
            ownerId: card.ownerId || null,
            rarity,
            price,
            floor,
            flags,
            status: flags.length ? "review" : "ok",
          };
        });

      const reviewRows = rows.filter((row) => row.status === "review");
      const flagCounts = reviewRows.reduce((acc: Record<string, number>, row) => {
        for (const flag of row.flags) acc[flag] = (acc[flag] || 0) + 1;
        return acc;
      }, {});

      return res.json({
        summary: {
          listingsChecked: rows.length,
          okListings: rows.length - reviewRows.length,
          reviewListings: reviewRows.length,
          flagCounts,
        },
        rows: reviewRows,
      });
    } catch (error: any) {
      console.error("Failed marketplace integrity check:", error);
      return res.status(500).json({ message: "Failed marketplace integrity check" });
    }
  });

  app.post("/api/admin/marketplace/repair-listings", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const { playerCards, competitionEntries, competitions } = await import("../shared/schema.js");
      const { eq, inArray } = await import("drizzle-orm");

      const [cardRows, entryRows, competitionRows] = await Promise.all([
        db.select().from(playerCards),
        db.select().from(competitionEntries),
        db.select().from(competitions),
      ]);

      const competitionStatusById = new Map((competitionRows as any[]).map((competition: any) => [Number(competition.id), String(competition.status || "")]));
      const activeLineupCardIds = new Set<number>();
      for (const entry of entryRows as any[]) {
        const status = competitionStatusById.get(Number(entry.competitionId));
        if (status !== "open" && status !== "active") continue;
        if (!Array.isArray(entry.lineupCardIds)) continue;
        for (const id of entry.lineupCardIds) {
          const cardId = Number(id);
          if (Number.isFinite(cardId) && cardId > 0) activeLineupCardIds.add(cardId);
        }
      }

      const repairCardIds = (cardRows as any[])
        .filter((card: any) => {
          if (!card.forSale) return false;
          const cardId = Number(card.id || 0);
          const rarity = String(card.rarity || "common").toLowerCase();
          const price = toMoney(card.price || 0);
          const floor = getMarketplaceFloorPrice(rarity);
          return !card.ownerId || !isMarketplaceTradableRarity(rarity) || price <= 0 || (floor > 0 && price < floor) || activeLineupCardIds.has(cardId);
        })
        .map((card: any) => Number(card.id || 0))
        .filter((id: number) => Number.isFinite(id) && id > 0);

      if (repairCardIds.length > 0) {
        await db.update(playerCards).set({ forSale: false, price: 0 } as any).where(inArray(playerCards.id, repairCardIds));
      }

      await writeAuditLog(String(req.authUserId || ""), "admin.marketplace.repair_listings", {
        repairedCount: repairCardIds.length,
        cardIds: repairCardIds,
        ip: getClientIp(req),
      });

      return res.json({ success: true, repairedCount: repairCardIds.length, cardIds: repairCardIds });
    } catch (error: any) {
      console.error("Failed marketplace repair:", error);
      return res.status(500).json({ message: "Failed marketplace repair" });
    }
  });

  app.get("/api/admin/cards/integrity", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const { playerCards, players, competitionEntries, competitions, RARITY_SUPPLY } = await import("../shared/schema.js");

      const [cardRows, playerRows, entryRows, competitionRows] = await Promise.all([
        db.select().from(playerCards),
        db.select({ id: players.id, name: players.name }).from(players),
        db.select().from(competitionEntries),
        db.select().from(competitions),
      ]);

      const playerIds = new Set((playerRows as any[]).map((player: any) => Number(player.id)));
      const competitionStatusById = new Map((competitionRows as any[]).map((competition: any) => [Number(competition.id), String(competition.status || "")]));
      const activeLineupCardIds = new Set<number>();
      for (const entry of entryRows as any[]) {
        const status = competitionStatusById.get(Number(entry.competitionId));
        if (status !== "open" && status !== "active") continue;
        if (!Array.isArray(entry.lineupCardIds)) continue;
        for (const id of entry.lineupCardIds) {
          const cardId = Number(id);
          if (Number.isFinite(cardId) && cardId > 0) activeLineupCardIds.add(cardId);
        }
      }

      const serialKeyCounts = new Map<string, number>();
      const supplyCounts = new Map<string, number>();
      for (const card of cardRows as any[]) {
        const playerId = Number(card.playerId || 0);
        const rarity = String(card.rarity || "common").toLowerCase();
        const serialNumber = Number(card.serialNumber || 0);
        if (playerId > 0 && rarity && serialNumber > 0) {
          const serialKey = `${playerId}:${rarity}:${serialNumber}`;
          serialKeyCounts.set(serialKey, (serialKeyCounts.get(serialKey) || 0) + 1);
        }
        if (playerId > 0 && rarity) {
          const supplyKey = `${playerId}:${rarity}`;
          supplyCounts.set(supplyKey, (supplyCounts.get(supplyKey) || 0) + 1);
        }
      }

      const rows = (cardRows as any[]).map((card: any) => {
        const cardId = Number(card.id || 0);
        const playerId = Number(card.playerId || 0);
        const rarity = String(card.rarity || "common").toLowerCase();
        const serialNumber = Number(card.serialNumber || 0);
        const supplyCap = Number((RARITY_SUPPLY as any)[rarity] || 0);
        const supplyCount = Number(supplyCounts.get(`${playerId}:${rarity}`) || 0);
        const serialKey = `${playerId}:${rarity}:${serialNumber}`;
        const duplicateSerial = serialNumber > 0 && Number(serialKeyCounts.get(serialKey) || 0) > 1;
        const flags = [
          !playerIds.has(playerId) ? "missing_player" : null,
          !card.ownerId ? "missing_owner" : null,
          card.forSale && !card.ownerId ? "listed_without_owner" : null,
          card.forSale && Number(card.price || 0) <= 0 ? "listed_without_price" : null,
          card.forSale && activeLineupCardIds.has(cardId) ? "listed_in_active_lineup" : null,
          supplyCap > 0 && (!card.serialId || serialNumber <= 0) ? "missing_limited_serial" : null,
          duplicateSerial ? "duplicate_serial_number" : null,
          supplyCap > 0 && supplyCount > supplyCap ? "supply_cap_exceeded" : null,
        ].filter(Boolean);

        return {
          cardId,
          playerId,
          ownerId: card.ownerId || null,
          rarity,
          serialId: card.serialId || null,
          serialNumber: serialNumber || null,
          maxSupply: Number(card.maxSupply || 0),
          supplyCap,
          supplyCount,
          forSale: Boolean(card.forSale),
          price: Number(card.price || 0),
          flags,
          status: flags.length ? "review" : "ok",
        };
      });

      const reviewRows = rows.filter((row) => row.status === "review");
      const flagCounts = reviewRows.reduce((acc: Record<string, number>, row) => {
        for (const flag of row.flags) acc[flag] = (acc[flag] || 0) + 1;
        return acc;
      }, {});

      return res.json({
        summary: {
          cardsChecked: rows.length,
          okCards: rows.length - reviewRows.length,
          reviewCards: reviewRows.length,
          flagCounts,
        },
        rows: reviewRows,
      });
    } catch (error: any) {
      console.error("Failed card integrity check:", error);
      return res.status(500).json({ message: "Failed card integrity check" });
    }
  });

  app.post("/api/admin/cards/repair-serials", requireAuth, isAdmin, async (req: any, res) => {
    try {
      await storage.backfillSerialIds();
      await writeAuditLog(String(req.authUserId || ""), "admin.cards.repair_serials", {
        ip: getClientIp(req),
      });
      return res.json({ success: true, message: "Card serial repair completed" });
    } catch (error: any) {
      console.error("Failed card serial repair:", error);
      return res.status(500).json({ message: "Failed card serial repair" });
    }
  });

  app.post("/api/admin/cards/grant-today-starters", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const [fplPlayers, bootstrap, fixtures] = await Promise.all([
        fplApi.getPlayers(),
        fplApi.bootstrap(),
        fplApi.fixtures(),
      ]);

      const { db } = await import("./db.js");
      const { users } = await import("../shared/schema.js");
      const usersList = await db.select({ id: users.id }).from(users);

      const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
      const teamMap = new Map<number, any>(
        teams.map((t: any) => [Number(t.id), t] as [number, any]),
      );

      const now = new Date();
      const sameUtcDay = (dateStr: string) => {
        const d = new Date(dateStr);
        return (
          d.getUTCFullYear() === now.getUTCFullYear() &&
          d.getUTCMonth() === now.getUTCMonth() &&
          d.getUTCDate() === now.getUTCDate()
        );
      };

      const todayTeamIds = new Set<number>();
      (Array.isArray(fixtures) ? fixtures : []).forEach((fixture: any) => {
        if (!fixture?.kickoff_time || !sameUtcDay(String(fixture.kickoff_time))) return;
        todayTeamIds.add(Number(fixture.team_h));
        todayTeamIds.add(Number(fixture.team_a));
      });

      if (todayTeamIds.size === 0) {
        return res.status(400).json({ message: "No EPL fixtures found for today." });
      }

      const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = {
        1: "GK",
        2: "DEF",
        3: "MID",
        4: "FWD",
      };

      const starterRarities = ["common", "rare", "unique", "epic", "legendary"] as const;
      const rarityFallbackOrder: Record<string, string[]> = {
        legendary: ["legendary", "epic", "rare", "common"],
        epic: ["epic", "rare", "common"],
        unique: ["unique", "rare", "common"],
        rare: ["rare", "common"],
        common: ["common"],
      };

      const candidates = (Array.isArray(fplPlayers) ? fplPlayers : [])
        .filter((p: any) => todayTeamIds.has(Number(p.team)))
        .sort((a: any, b: any) => {
          const sa = Number(a.starts || 0);
          const sb = Number(b.starts || 0);
          if (sb !== sa) return sb - sa;
          const ma = Number(a.minutes || 0);
          const mb = Number(b.minutes || 0);
          if (mb !== ma) return mb - ma;
          return Number(b.form || 0) - Number(a.form || 0);
        })
        .slice(0, 80);

      if (candidates.length < 5) {
        return res.status(400).json({ message: "Not enough likely starters found for today's fixtures." });
      }

      const existingPlayers = await storage.getPlayers();
      const mapKey = (name: string, team: string, pos: string) => `${name.toLowerCase()}::${team.toLowerCase()}::${pos}`;
      const existingMap = new Map<string, any>();
      existingPlayers.forEach((p: any) => {
        existingMap.set(mapKey(String(p.name), String(p.team), String(p.position)), p);
      });

      const ensurePlayer = async (fplPlayer: any) => {
        const teamName = String(teamMap.get(Number(fplPlayer.team))?.name || "Unknown");
        const position = positionMap[Number(fplPlayer.element_type)] || "MID";
        const fullName = `${String(fplPlayer.first_name || "").trim()} ${String(fplPlayer.second_name || "").trim()}`.trim() || String(fplPlayer.web_name || "Unknown");
        const key = mapKey(fullName, teamName, position);
        const existing = existingMap.get(key);
        if (existing) return existing;

        const photoUrl = fplApi.playerPhotoUrl(fplPlayer, 250);
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
        } as any);

        existingMap.set(key, created);
        return created;
      };

      let minted = 0;
      for (let u = 0; u < usersList.length; u++) {
        const user = usersList[u];
        const local = [...candidates];
        const picked = shuffle(local).slice(0, 5);
        for (let index = 0; index < picked.length; index++) {
          const candidate = picked[index];
          const player = await ensurePlayer(candidate);
          const requestedRarity = starterRarities[index] || "common";
          const rarityTryOrder = rarityFallbackOrder[requestedRarity] || ["common"];

          let created = false;
          for (const rarity of rarityTryOrder) {
            try {
              await storage.createPlayerCard({
                playerId: player.id,
                ownerId: user.id,
                rarity,
                level: 1,
                xp: 0,
                decisiveScore: 35,
                last5Scores: [0, 0, 0, 0, 0],
                forSale: false,
                price: 0,
              } as any);
              minted++;
              created = true;
              break;
            } catch (_e) {
              continue;
            }
          }

          if (!created) {
            await storage.createPlayerCard({
              playerId: player.id,
              ownerId: user.id,
              rarity: "common",
              level: 1,
              xp: 0,
              decisiveScore: 35,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
            } as any);
            minted++;
          }
        }
      }

      return res.json({ success: true, users: usersList.length, minted, message: `Granted 5 mixed-rarity cards each to ${usersList.length} users.` });
    } catch (error: any) {
      console.error("Failed to grant today starter cards:", error);
      return res.status(500).json({ message: "Failed to grant cards", error: error?.message });
    }
  });

  app.post("/api/admin/cards/grant-rarity-samples", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const userId = req.authUserId as string;
      const rarities = ["common", "rare", "unique", "epic", "legendary"] as const;

      const existingCards = await storage.getUserCards(userId);
      const ownedRarities = new Set(existingCards.map((c: any) => String(c.rarity || "common").toLowerCase()));

      const players = await storage.getPlayers();
      const candidates = players
        .filter((p: any) => String(p.imageUrl || "").trim().length > 0)
        .sort((a: any, b: any) => Number(b.overall || 0) - Number(a.overall || 0));

      if (candidates.length === 0) {
        return res.status(400).json({ message: "No players with images available to mint sample cards." });
      }

      let minted = 0;
      const failures: string[] = [];

      for (const rarity of rarities) {
        if (ownedRarities.has(rarity)) continue;

        let created = false;
        for (const player of candidates) {
          try {
            await storage.createPlayerCard({
              playerId: player.id,
              ownerId: userId,
              rarity,
              level: 1,
              xp: 0,
              decisiveScore: 40,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
            } as any);
            minted++;
            created = true;
            break;
          } catch {
            continue;
          }
        }

        if (!created) {
          failures.push(rarity);
        }
      }

      const message = failures.length
        ? `Added ${minted} sample cards. Could not mint: ${failures.join(", ")}`
        : `Added ${minted} sample rarity cards to your collection.`;

      return res.json({ success: true, minted, failures, message });
    } catch (error: any) {
      console.error("Failed to grant rarity samples:", error);
      return res.status(500).json({ message: "Failed to grant rarity samples", error: error?.message });
    }
  });

  app.post("/api/admin/reset-users", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const schema = await import("../shared/schema.js");
      const { sql } = await import("drizzle-orm");

      await db.transaction(async (tx) => {
        await tx.delete(schema.cardLocks);
        await tx.delete(schema.auctionBids);
        await tx.delete(schema.auctions);
        await tx.delete(schema.swapOffers);
        await tx.delete(schema.withdrawalRequests);
        await tx.delete(schema.competitionEntries);
        await tx.delete(schema.lineups);
        await tx.delete(schema.userOnboarding);
        await tx.delete(schema.transactions);
        await tx.delete(schema.wallets);
        await tx.delete(schema.auditLogs);
        await tx.delete(schema.idempotencyKeys);
        try {
          await tx.delete(schema.notifications);
        } catch (error) {
          console.warn("Skipping notifications wipe (table may not exist yet):", error);
        }
        await tx.delete(schema.playerCards);
        await tx.delete(schema.users);
        try {
          await tx.execute(sql`delete from session`);
        } catch (error) {
          console.warn("Skipping session wipe (session table may not exist):", error);
        }
      });

      return res.json({ success: true, message: "All users and user-owned data removed." });
    } catch (error: any) {
      console.error("Failed to reset users:", error);
      return res.status(500).json({ message: "Failed to reset users", error: error?.message });
    }
  });
  
  // Trigger seed data
  app.post("/api/admin/seed", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const { seedDatabase, seedCompetitions } = await import("./seed.js");
      
      await seedDatabase();
      await seedCompetitions();

      await writeAuditLog(String(req.authUserId || ""), "admin.seed.run", {
        ip: getClientIp(req),
      });
      
      res.json({
        success: true,
        message: "Database seeded successfully",
      });
    } catch (error: any) {
      console.error("Failed to seed database:", error);
      res.status(500).json({ message: "Failed to seed database" });
    }
  });
  
  // Get audit logs
  app.get("/api/admin/logs", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "100"), 10)));
      const actionQuery = String(req.query.action || "").trim().toLowerCase();
      
      const { db } = await import("./db.js");
      const { auditLogs } = await import("../shared/schema.js");
      const { desc } = await import("drizzle-orm");
      
      let allLogs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt));

      if (actionQuery) {
        allLogs = allLogs.filter((log) => String(log.action || "").toLowerCase().includes(actionQuery));
      }
      
      const total = allLogs.length;
      const start = (page - 1) * limit;
      const pageItems = allLogs.slice(start, start + limit);
      
      res.json({
        logs: pageItems,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      console.error("Failed to fetch logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });
  
  // Get all withdrawal requests (admin)
  app.get("/api/admin/withdrawals", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      
      let withdrawals;
      if (status === "pending") {
        withdrawals = await storage.getAllPendingWithdrawals();
      } else {
        withdrawals = await storage.getAllWithdrawals();
      }
      
      res.json(withdrawals);
    } catch (error: any) {
      console.error("Failed to fetch withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.get("/api/admin/withdrawals/pending", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const withdrawals = await storage.getAllPendingWithdrawals();
      res.json(withdrawals);
    } catch (error: any) {
      console.error("Failed to fetch pending withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch pending withdrawals" });
    }
  });

  app.get("/api/admin/risk/flags", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(500, Math.max(20, Number(req.query.limit || 200)));
      const { db } = await import("./db.js");
      const { auditLogs } = await import("../shared/schema.js");
      const { desc, sql } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(auditLogs)
        .where(sql`${auditLogs.action} like 'risk.%'`)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
      res.json(rows);
    } catch (error: any) {
      console.error("Failed to fetch risk flags:", error);
      res.status(500).json({ message: "Failed to fetch risk flags" });
    }
  });

  app.get("/api/admin/risk/users", requireAuth, isAdmin, async (_req: any, res) => {
    try {
      const { db } = await import("./db.js");
      const { auditLogs, users, transactions } = await import("../shared/schema.js");
      const { desc, sql } = await import("drizzle-orm");
      const [riskLogs, allUsers, txRows] = await Promise.all([
        db.select().from(auditLogs).where(sql`${auditLogs.action} like 'risk.%'`).orderBy(desc(auditLogs.createdAt)).limit(5000),
        db.select().from(users),
        db.select().from(transactions).where(sql`${transactions.status} in ('failed','rejected')`).orderBy(desc(transactions.createdAt)).limit(5000),
      ]);

      const riskByUser = new Map<string, { score: number; flags: Set<string>; recent: any[] }>();
      const addRisk = (userId: string, points: number, flag: string, meta: any) => {
        if (!userId) return;
        const row = riskByUser.get(userId) || { score: 0, flags: new Set<string>(), recent: [] };
        row.score += points;
        row.flags.add(flag);
        if (row.recent.length < 5) row.recent.push(meta);
        riskByUser.set(userId, row);
      };

      for (const log of riskLogs as any[]) {
        const userId = String(log.userId || "");
        const action = String(log.action || "");
        addRisk(userId, action.includes("blocked") ? 40 : action.includes("wash") ? 35 : 20, action, log.meta || {});
        const buyerId = String((log.meta as any)?.buyerId || "");
        const sellerId = String((log.meta as any)?.sellerId || "");
        if (buyerId && buyerId !== userId) addRisk(buyerId, 20, `${action}:buyer`, log.meta || {});
        if (sellerId) addRisk(sellerId, 20, `${action}:seller`, log.meta || {});
      }

      for (const tx of txRows as any[]) {
        const uid = String(tx.userId || "");
        if (!uid) continue;
        addRisk(uid, 6, `tx_${String(tx.status || "").toLowerCase()}`, { txId: tx.id, status: tx.status, sourceType: tx.sourceType });
      }

      const usersById = new Map(allUsers.map((u: any) => [String(u.id), u]));
      const suspiciousUsers = Array.from(riskByUser.entries())
        .map(([userId, data]) => ({
          userId,
          email: usersById.get(userId)?.email || "",
          name: usersById.get(userId)?.name || "",
          riskScore: data.score,
          flags: Array.from(data.flags).slice(0, 10),
          recent: data.recent,
        }))
        .filter((u) => u.riskScore >= 20)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 300);

      res.json(suspiciousUsers);
    } catch (error: any) {
      console.error("Failed to fetch suspicious users:", error);
      res.status(500).json({ message: "Failed to fetch suspicious users" });
    }
  });
  
  // Approve/reject withdrawal request
  app.post("/api/admin/withdrawals/:id/review", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const withdrawalId = parseInt(req.params.id, 10);
      const { status, adminNotes } = req.body;
      
      if (!["paid", "rejected"].includes(status)) {
  return res.status(400).json({ message: "Status must be 'paid' or 'rejected'" });
}
      
      const { db } = await import("./db.js");
      const { withdrawalRequests, wallets, transactions } = await import("../shared/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      
      const [withdrawal] = await db
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, withdrawalId));
      
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal request not found" });
      }
      
      if (String(withdrawal.status) !== "pending") {
  return res.status(400).json({ message: "Withdrawal already processed" });
}
      
      await db.transaction(async (tx) => {
        if (status === "paid") {
          // Funds were moved to locked balance at request time; settle payout now
          await tx
            .update(wallets)
            .set({ lockedBalance: sql`${wallets.lockedBalance} - ${withdrawal.amount}` } as any)
            .where(eq(wallets.userId, withdrawal.userId));
          
          // Create ledger transaction
          await tx.insert(transactions).values({
            userId: withdrawal.userId,
            type: "withdrawal",
            amount: -withdrawal.amount,
            grossAmount: withdrawal.amount,
            feeAmount: withdrawal.fee,
            netAmount: withdrawal.netAmount,
            sourceType: "withdrawal",
            status: "completed",
            description: `Withdrawal paid: ${withdrawal.netAmount} (fee: ${withdrawal.fee})`,
          } as any);
        } else if (status === "rejected") {
          // Return locked funds back to available balance
          await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} + ${withdrawal.amount}`,
              lockedBalance: sql`${wallets.lockedBalance} - ${withdrawal.amount}`,
            } as any)
            .where(eq(wallets.userId, withdrawal.userId));
        }
        
        // Update withdrawal status
        await tx
          .update(withdrawalRequests)
          .set({
            status,
            adminNotes,
            reviewedAt: new Date(),
          } as any)
          .where(eq(withdrawalRequests.id, withdrawalId));
      });

      await writeAuditLog(String(req.authUserId || ""), "admin.withdrawal.review", {
        withdrawalId,
        status,
        ip: getClientIp(req),
      });
      
      res.json({
        success: true,
        message: `Withdrawal ${status}`,
      });
    } catch (error: any) {
      console.error("Failed to review withdrawal:", error);
      res.status(500).json({ message: "Failed to review withdrawal" });
    }
  });

  // -------------------------
  // TRADING ENDPOINTS
  // -------------------------
  
  // Get user's trade offers (sent and received)
  app.get("/api/trades", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const offers = await storage.getUserSwapOffers(userId);
      res.json(offers);
    } catch (error: any) {
      console.error("Failed to fetch trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Create trade offer (card-for-card with optional cash top-up)
  app.post("/api/trades/create", requireAuth, async (req: any, res) => {
    try {
      const offererId = req.authUserId;
      const { offeredCardId, requestedCardId, receiverUserId, topUpAmount } = req.body;
      
      if (!offeredCardId || !requestedCardId || !receiverUserId) {
        return res.status(400).json({ message: "offeredCardId, requestedCardId, and receiverUserId required" });
      }
      
      const { db } = await import("./db.js");
      const { playerCards } = await import("../shared/schema.js");
      const { eq } = await import("drizzle-orm");
      
      // Get both cards
      const [offeredCard] = await db.select().from(playerCards).where(eq(playerCards.id, offeredCardId));
      const [requestedCard] = await db.select().from(playerCards).where(eq(playerCards.id, requestedCardId));
      
      if (!offeredCard || !requestedCard) {
        return res.status(404).json({ message: "One or both cards not found" });
      }
      
      // Verify ownership
      if (offeredCard.ownerId !== offererId) {
        return res.status(403).json({ message: "You don't own the offered card" });
      }
      
      if (requestedCard.ownerId !== receiverUserId) {
        return res.status(400).json({ message: "Receiver doesn't own the requested card" });
      }
      
      // Enforce same rarity rule
      if (offeredCard.rarity !== requestedCard.rarity) {
        return res.status(400).json({ 
          message: `Can only trade same rarity cards (${offeredCard.rarity} ≠ ${requestedCard.rarity})` 
        });
      }
      
      // Can't trade cards that are for sale
      if (offeredCard.forSale || requestedCard.forSale) {
        return res.status(400).json({ message: "Cannot trade cards that are listed for sale" });
      }
      
      // Create trade offer
      const topUp = parseFloat(topUpAmount || 0);
      const topUpDirection = topUp > 0 ? "offerer_to_receiver" : topUp < 0 ? "receiver_to_offerer" : "none";
      
      const offer = await storage.createSwapOffer({
        offererUserId: offererId,
        receiverUserId,
        offeredCardId,
        requestedCardId,
        topUpAmount: Math.abs(topUp),
        topUpDirection,
        status: "pending",
      } as any);
      
      res.json({ 
        success: true, 
        message: "Trade offer sent",
        offer
      });
    } catch (error: any) {
      console.error("Failed to create trade:", error);
      res.status(500).json({ message: error.message || "Failed to create trade" });
    }
  });

  // Accept trade offer
  app.post("/api/trades/:id/accept", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const offerId = parseInt(req.params.id, 10);
      
      const { db } = await import("./db.js");
      const { swapOffers, playerCards, wallets, transactions } = await import("../shared/schema.js");
      const { eq, and, sql } = await import("drizzle-orm");
      
      await db.transaction(async (tx) => {
        const [offer] = await tx.select().from(swapOffers).where(eq(swapOffers.id, offerId)).for("update");
        
        if (!offer) {
          throw new Error("Trade offer not found");
        }
        
        if (offer.receiverUserId !== userId) {
          throw new Error("You are not the receiver of this trade");
        }
        
        if (offer.status !== "pending") {
          throw new Error("Trade already processed");
        }
        
        // Get both cards
        const [offeredCard] = await tx.select().from(playerCards).where(eq(playerCards.id, offer.offeredCardId));
        const [requestedCard] = await tx.select().from(playerCards).where(eq(playerCards.id, offer.requestedCardId));
        
        if (!offeredCard || !requestedCard) {
          throw new Error("One or both cards no longer exist");
        }
        
        // Calculate fee based on lowest market price for this rarity
        const lowestPriceCards = await tx
          .select()
          .from(playerCards)
          .where(and(
            eq(playerCards.rarity, offeredCard.rarity),
            eq(playerCards.forSale, true)
          ))
          .orderBy(playerCards.price)
          .limit(1);
        
        const marketPrice = lowestPriceCards[0]?.price || 100; // Default to 100 if no listings
        const fee = marketPrice * 0.08; // 8% fee based on market price
        
        // Handle cash top-up
        const topUpAmount = offer.topUpAmount || 0;
        if (topUpAmount > 0) {
          const payerId = offer.topUpDirection === "offerer_to_receiver" ? offer.offererUserId : offer.receiverUserId;
          const payeeId = offer.topUpDirection === "offerer_to_receiver" ? offer.receiverUserId : offer.offererUserId;
          
          // Check payer balance
          const [payerWallet] = await tx.select().from(wallets).where(eq(wallets.userId, payerId));
          if (!payerWallet || (payerWallet.balance || 0) < topUpAmount + fee) {
            throw new Error("Insufficient balance for trade (including fee)");
          }
          
          // Transfer cash
          await tx
            .update(wallets)
            .set({ balance: sql`${wallets.balance} - ${topUpAmount + fee}` } as any)
            .where(eq(wallets.userId, payerId));
          
          await tx
            .update(wallets)
            .set({ balance: sql`${wallets.balance} + ${topUpAmount}` } as any)
            .where(eq(wallets.userId, payeeId));
          
          // Create transaction records
          await tx.insert(transactions).values({
            userId: payerId,
            type: "swap_fee",
            amount: -(topUpAmount + fee),
            description: `Trade: paid N$${topUpAmount} + N$${fee.toFixed(2)} fee`,
          } as any);
          
          await tx.insert(transactions).values({
            userId: payeeId,
            type: "swap_fee",
            amount: topUpAmount,
            description: `Trade: received N$${offer.topUpAmount}`,
          } as any);
        } else {
          // No cash top-up, but still charge fee based on market price
          // Fee split between both parties
          const feePerPerson = fee / 2;
          
          for (const traderId of [offer.offererUserId, offer.receiverUserId]) {
            const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, traderId));
            if (!wallet || (wallet.balance || 0) < feePerPerson) {
              throw new Error("Insufficient balance for trade fee");
            }
            
            await tx
              .update(wallets)
              .set({ balance: sql`${wallets.balance} - ${feePerPerson}` } as any)
              .where(eq(wallets.userId, traderId));
            
            await tx.insert(transactions).values({
              userId: traderId,
              type: "swap_fee",
              amount: -feePerPerson,
              description: `Trade fee: N$${feePerPerson.toFixed(2)} (market: N$${marketPrice})`,
            } as any);
          }
        }
        
        // Swap card ownership
        await tx
          .update(playerCards)
          .set({ ownerId: offer.receiverUserId } as any)
          .where(eq(playerCards.id, offer.offeredCardId));
        
        await tx
          .update(playerCards)
          .set({ ownerId: offer.offererUserId } as any)
          .where(eq(playerCards.id, offer.requestedCardId));
        
        // Update offer status
        await tx
          .update(swapOffers)
          .set({ status: "accepted" } as any)
          .where(eq(swapOffers.id, offerId));
      });
      
      res.json({ 
        success: true, 
        message: "Trade completed successfully"
      });
    } catch (error: any) {
      console.error("Failed to accept trade:", error);
      res.status(500).json({ message: error.message || "Failed to accept trade" });
    }
  });

  // Reject trade offer
  app.post("/api/trades/:id/reject", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const offerId = parseInt(req.params.id, 10);
      
      const offer = await storage.getSwapOffer(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Trade offer not found" });
      }
      
      if (offer.receiverUserId !== userId) {
        return res.status(403).json({ message: "You are not the receiver of this trade" });
      }
      
      if (offer.status !== "pending") {
        return res.status(400).json({ message: "Trade already processed" });
      }
      
      await storage.updateSwapOffer(offerId, { status: "rejected" });
      
      res.json({ 
        success: true, 
        message: "Trade offer rejected"
      });
    } catch (error: any) {
      console.error("Failed to reject trade:", error);
      res.status(500).json({ message: "Failed to reject trade" });
    }
  });

  // Cancel trade offer (offerer only)
  app.post("/api/trades/:id/cancel", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const offerId = parseInt(req.params.id, 10);
      
      const offer = await storage.getSwapOffer(offerId);
      if (!offer) {
        return res.status(404).json({ message: "Trade offer not found" });
      }
      
      if (offer.offererUserId !== userId) {
        return res.status(403).json({ message: "You are not the offerer of this trade" });
      }
      
      if (offer.status !== "pending") {
        return res.status(400).json({ message: "Trade already processed" });
      }
      
      await storage.updateSwapOffer(offerId, { status: "cancelled" });
      
      res.json({ 
        success: true, 
        message: "Trade offer cancelled"
      });
    } catch (error: any) {
      console.error("Failed to cancel trade:", error);
      res.status(500).json({ message: "Failed to cancel trade" });
    }
  });

  // -------------------------
  // BURN/MINT FUSION ENDPOINTS
  // -------------------------
  
  // Burn 5 cards of same rarity/player to mint 1 card of higher rarity
  app.post("/api/cards/burn-mint", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardIds } = req.body;
      
      if (!Array.isArray(cardIds) || cardIds.length !== 5) {
        return res.status(400).json({ message: "Exactly 5 cards required for fusion" });
      }
      
      const { db } = await import("./db.js");
      const { playerCards, players } = await import("../shared/schema.js");
      const { eq, and, inArray } = await import("drizzle-orm");
      
      await db.transaction(async (tx) => {
        // Get all cards with lock
        const cards = await tx
          .select()
          .from(playerCards)
          .where(inArray(playerCards.id, cardIds))
          .for("update");
        
        if (cards.length !== 5) {
          throw new Error("One or more cards not found");
        }
        
        // Verify all cards owned by user
        for (const card of cards) {
          if (card.ownerId !== userId) {
            throw new Error("You don't own all these cards");
          }
          if (card.forSale) {
            throw new Error("Cannot burn cards that are listed for sale");
          }
        }
        
        // Verify all same player
        const playerIds = Array.from(new Set(cards.map(c => c.playerId)));
        if (playerIds.length !== 1) {
          throw new Error("All cards must be of the same player");
        }
        
        // Verify all same rarity
        const rarities = Array.from(new Set(cards.map(c => c.rarity)));
        if (rarities.length !== 1) {
          throw new Error("All cards must be the same rarity");
        }
        
        const currentRarity = rarities[0];
        const rarityUpgrade: Record<string, string> = {
          rare: "unique",
          unique: "legendary",
        };
        
        const newRarity = rarityUpgrade[currentRarity];
        if (!newRarity) {
          throw new Error(`Cannot upgrade ${currentRarity} cards (only rare → unique, unique → legendary)`);
        }
        
        // Delete the 5 cards
        await tx.delete(playerCards).where(inArray(playerCards.id, cardIds));
        
        // Create new card with higher rarity
        const [newCard] = await tx.insert(playerCards).values({
          playerId: playerIds[0],
          ownerId: userId,
          rarity: newRarity as any,
          level: 1,
          xp: 0,
          decisiveScore: 35,
          last5Scores: [0, 0, 0, 0, 0],
          forSale: false,
          price: 0,
        } as any).returning();
        
        res.json({
          success: true,
          message: `Fused 5 ${currentRarity} cards into 1 ${newRarity} card!`,
          newCard
        });
      });
    } catch (error: any) {
      console.error("Failed to burn/mint cards:", error);
      res.status(500).json({ message: error.message || "Failed to burn/mint cards" });
    }
  });

  // Get eligible cards for fusion (grouped by player and rarity)
  app.get("/api/cards/fusion-eligible", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      
      const { db } = await import("./db.js");
      const { playerCards, players } = await import("../shared/schema.js");
      const { eq, and, sql } = await import("drizzle-orm");
      
      // Get all user's non-sale cards grouped by player and rarity
      const eligibleGroups = await db
        .select({
          playerId: playerCards.playerId,
          rarity: playerCards.rarity,
          count: sql<number>`count(*)::int`,
          cardIds: sql<number[]>`array_agg(${playerCards.id})`,
        })
        .from(playerCards)
        .where(and(
          eq(playerCards.ownerId, userId),
          eq(playerCards.forSale, false)
        ))
        .groupBy(playerCards.playerId, playerCards.rarity)
        .having(sql`count(*) >= 5`);
      
      // Filter to only rare and unique (can be upgraded)
      const upgradeable = eligibleGroups.filter(g => 
        g.rarity === "rare" || g.rarity === "unique"
      );
      
      res.json(upgradeable);
    } catch (error: any) {
      console.error("Failed to get fusion-eligible cards:", error);
      res.status(500).json({ message: "Failed to get fusion-eligible cards" });
    }
  });

  // -------------------------
  // INITIALIZE SERVICES
  // -------------------------
  
  // Start automatic score updates (every 5 minutes)
  console.log("🚀 Starting automatic score update service...");
  scoreUpdater.startAutoUpdates();

  // Start automatic withdrawal release checks (every minute)
  setInterval(() => {
    processEligibleAutoWithdrawals().catch((error) => {
      console.error("Auto-withdraw interval failed:", error);
    });
  }, 60 * 1000);

  return httpServer;
}
