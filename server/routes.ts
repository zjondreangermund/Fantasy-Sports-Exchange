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
import { economyConfigPayload, rankCompetitionEntries } from "./services/tournamentRules.js";
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
import {
  getCompetitionRewardIntegrity,
  repairCompetitionRewards,
} from "./services/tournamentRewards.js";
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
    console.error("Email notification failed:", error);
    return { sent: false, reason: "exception" };
  }
}
