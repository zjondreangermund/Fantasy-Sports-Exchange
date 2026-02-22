import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth/index.js";
import { seedDatabase, seedCompetitions } from "./seed.js";
import { fplApi } from "./services/fplApi.js";
import { fetchSorarePlayer } from "./services/sorare.js";
import { ScoreUpdateService } from "./services/scoreUpdater.js";
import { calculatePlayerScore, mapFplStatsToPlayerStats } from "./services/scoring.js";
import { randomUUID } from "crypto";

// ✅ Google auth (Passport) – relies on session/passport middleware being set up in server entry file
import passport from "passport";

const DEFAULT_ADMIN_EMAIL = "lbcplaya@gmail.com";
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** True when deployed on Replit (has REPL_ID). Use Replit Auth there. */
const isReplit = Boolean(process.env.REPL_ID);

/** True when we want to skip real auth (e.g. Railway/Vercel/local dev without real auth). */
const useMockAuth =
  process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);

// Initialize score updater service
const scoreUpdater = new ScoreUpdateService(storage as any);

/**
 * Base authentication middleware
 * Attaches req.authUserId for all protected routes
 */
export function requireAuth(req: any, res: any, next: any) {
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
      };
    }

    return next();
  }

  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const userId = user.claims?.sub || user.id;
  if (!userId) return res.status(401).json({ message: "Invalid user identity" });

  req.authUserId = userId;
  next();
}

/**
 * Admin middleware (must be used AFTER requireAuth)
 */
export function isAdmin(req: any, res: any, next: any) {
  const userId = req.authUserId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const requestEmail = String(req.user?.email || req.user?.claims?.email || "").toLowerCase();
  const idAllowed = ADMIN_USER_IDS.includes(userId);
  const emailAllowed = Boolean(requestEmail) && ADMIN_EMAILS.includes(requestEmail);

  if (!idAllowed && !emailAllowed) {
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ----------------
  // AUTH ROUTES
  // ----------------

  if (isReplit) {
    // Replit Auth
    await setupAuth(app);
    registerAuthRoutes(app);
  } else if (useMockAuth) {
    // Mock auth (dev/testing)
    console.log(
      "Using mock auth (Replit not detected; set SESSION_SECRET + Google vars for production auth).",
    );

    app.use((req: any, _res, next) => {
      const mockId = process.env.MOCK_USER_ID;
      if (!mockId) {
        throw new Error("MOCK_USER_ID is required when USE_MOCK_AUTH is enabled");
      }

      req.isAuthenticated = () => true;
      req.user = {
        id: mockId,
        claims: { sub: mockId },
        firstName: process.env.MOCK_FIRST_NAME || "Mock",
        lastName: process.env.MOCK_LAST_NAME || "User",
      };

      // Normalize for the rest of the app
      req.authUserId = mockId;

      next();
    });

    app.get("/api/auth/user", (req: any, res) => res.json(req.user));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
  } else {
    // ✅ Railway/production Google OAuth (non-Replit)
    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (_req, res) => res.redirect("/"),
    );

    app.get("/api/auth/user", (req: any, res) => {
      if (!req.user) return res.status(401).json({ message: "Unauthorized" });
      res.json(req.user);
    });

    app.get("/api/logout", (req: any, res) => {
      req.logout?.(() => {});
      req.session?.destroy(() => {});
      res.clearCookie("connect.sid");
      res.redirect("/");
    });

    app.post("/api/auth/logout", (req: any, res) => {
      req.logout?.(() => {});
      req.session?.destroy(() => {});
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  }

  // ----------------
  // --- API ROUTES ---
  // ----------------

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
            eq(withdrawalRequests.status, "processing" as any),
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

          if (!fresh || fresh.status !== "processing" || !fresh.destinationVerified) return;

          await tx
            .update(wallets)
            .set({ lockedBalance: sql`${wallets.lockedBalance} - ${fresh.amount}` } as any)
            .where(eq(wallets.userId, fresh.userId));

          await tx.insert(transactions).values({
            userId: fresh.userId,
            type: "withdrawal",
            amount: -fresh.amount,
            description: `Withdrawal auto-approved: ${fresh.netAmount} (fee: ${fresh.fee})`,
          } as any);

          await tx
            .update(withdrawalRequests)
            .set({
              status: "completed",
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
        const photoId = typeof p.photo === "string" ? p.photo.replace(".jpg", "") : "";

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
          photo: photoId ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png` : "/images/player-1.png",
          photoUrl: photoId ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png` : "/images/player-1.png",
          imageUrl: photoId ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png` : "/images/player-1.png",
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
  app.get("/api/cards/my", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cards = await storage.getUserCards(userId);
      return res.json({ cards });
    } catch (error: any) {
      console.error("Fetch my cards failed:", error);
      return res.status(500).json({ message: "Failed to fetch my cards" });
    }
  });

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

  const getOnboardingPlayerPool = async () => {
    const [fplPlayers, bootstrap, fixtures] = await Promise.all([
      fplApi.getPlayers(),
      fplApi.bootstrap(),
      fplApi.fixtures(),
    ]);

    const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
    const teamMap = new Map<number, any>(teams.map((t: any) => [Number(t.id), t] as [number, any]));

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
      return [] as any[];
    }

    const positionMap: Record<number, "GK" | "DEF" | "MID" | "FWD"> = {
      1: "GK",
      2: "DEF",
      3: "MID",
      4: "FWD",
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
      });

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

      const photoId = typeof fplPlayer.photo === "string" ? fplPlayer.photo.replace(".jpg", "") : "";
      const overall = Math.max(55, Math.min(95, Math.round(Number(fplPlayer.now_cost || 50) + 30)));

      const created = await storage.createPlayer({
        name: fullName,
        team: teamName,
        league: "Premier League",
        position,
        nationality: "Unknown",
        age: 24,
        overall,
        imageUrl: photoId
          ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png`
          : "/images/player-1.png",
      } as any);

      existingMap.set(key, created);
      return created;
    };

    const result: any[] = [];
    for (const player of candidates.slice(0, 120)) {
      result.push(await ensurePlayer(player));
    }

    return result;
  };

  const buildPackCards = (playersPool: any[]) => {
    const gkPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "GK"));
    const defPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "DEF"));
    const midPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "MID"));
    const fwdPool = shuffle(playersPool.filter((p: any) => normalizePackPosition(p.position) === "FWD"));

    const gk = gkPool.slice(0, 3);
    const def = defPool.slice(0, 3);
    const mid1 = midPool.slice(0, 3);
    const mid2 = midPool.slice(3, 6);
    const fwd = fwdPool.slice(0, 3);

    if (gk.length < 3 || def.length < 3 || mid1.length < 3 || mid2.length < 3 || fwd.length < 3) {
      return null;
    }

    return [
      gk.map((p: any) => p.id),
      def.map((p: any) => p.id),
      mid1.map((p: any) => p.id),
      mid2.map((p: any) => p.id),
      fwd.map((p: any) => p.id),
    ];
  };

  // ✅ Status route (used by App router sometimes)
  app.get("/api/onboarding/status", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);
      res.json({ completed: ob?.completed ?? false });
    } catch (error: any) {
      console.error("Onboarding status failed:", error);
      res.status(500).json({ message: "Failed to fetch onboarding status" });
    }
  });

  // 1) Create offer (3 packs: GK, MID, FWD -> 9 total cards)
  // ✅ UPDATED: auto-seed + better shuffling + retry
  app.post("/api/onboarding/create-offer", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const ob = await storage.getOnboarding(userId);

      if (ob?.completed) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      // If already generated, return existing offer (no re-roll)
      if (ob?.packCards?.length === 5 && ob.packCards.flat().length === 15) {
        return res.json({ packCards: ob.packCards });
      }

      const allPlayers = await getOnboardingPlayerPool();

      if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
        return res.status(400).json({
          message:
            "Not enough players in database. Seeding may have failed or player table is still empty.",
          count: allPlayers?.length ?? 0,
        });
      }

      const packCards = buildPackCards(allPlayers);
      if (!packCards) {
        return res.status(400).json({
          message: "Not enough players per position",
        });
      }

      if (!ob) {
        await storage.createOnboarding({
          userId,
          completed: false,
          packCards,
          selectedCards: [],
        } as any);
      } else {
        await storage.updateOnboarding(
          userId,
          { packCards, selectedCards: [] } as any,
        );
      }

      return res.json({ packCards });
    } catch (error: any) {
      console.error("Onboarding/create-offer failed:", error);
      return res.status(500).json({ message: "Failed to create onboarding packs" });
    }
  });

  // 2) Get offers (pack structure + player details)
  // ✅ UPDATED: auto-create offer if missing so UI never gets stuck
  app.get("/api/onboarding/offers", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      let ob = await storage.getOnboarding(userId);

      // Auto-create offer if none exists
      if (!ob?.packCards?.length) {
        const allPlayers = await getOnboardingPlayerPool();

        if (!Array.isArray(allPlayers) || allPlayers.length < 15) {
          return res
            .status(404)
            .json({ message: "No offer found. Create offer first." });
        }

        const packCards = buildPackCards(allPlayers);
        if (!packCards) {
          return res.status(404).json({ message: "No offer found. Create offer first." });
        }

        if (!ob) {
          await storage.createOnboarding({
            userId,
            completed: false,
            packCards,
            selectedCards: [],
          } as any);
        } else {
          await storage.updateOnboarding(userId, { packCards, selectedCards: [] } as any);
        }

        ob = await storage.getOnboarding(userId);
      }

      const offeredPlayerIds = ob?.packCards?.flat() || [];

      // NOTE: we return players as full objects so the UI can show cards immediately
      const offeredPlayers = await Promise.all(
        offeredPlayerIds.map((id: number | null) => id ? storage.getPlayer(id) : Promise.resolve(undefined)),
      );
      const players = offeredPlayers.filter(Boolean);

      res.json({
        packCards: ob?.packCards || [],
        offeredPlayerIds,
        players,
        selectedCards: ob?.selectedCards ?? [],
        completed: ob?.completed ?? false,
      });
    } catch (error: any) {
      console.error("Fetch offers failed:", error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  // 3) Choose top 5 (mint cards + complete onboarding)
  app.post("/api/onboarding/choose", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const selected: number[] = req.body?.selectedPlayerIds ?? [];

      if (!Array.isArray(selected) || selected.length !== 5) {
        return res.status(400).json({ message: "Select exactly 5 cards" });
      }
      if (new Set(selected).size !== 5) {
        return res.status(400).json({ message: "Duplicate selections not allowed" });
      }

      const ob = await storage.getOnboarding(userId);
      if (!ob?.packCards?.length) {
        return res.status(400).json({ message: "No offer exists. Create offer first." });
      }
      if (ob.completed) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      const offeredSet = new Set(ob.packCards.flat());
      for (const id of selected) {
        if (!offeredSet.has(id)) {
          return res.status(400).json({ message: "Selection includes an invalid card" });
        }
      }

      // Mint 5 common cards
      for (const playerId of selected) {
        await storage.createPlayerCard({
          playerId,
          ownerId: userId,
          rarity: "common",
          level: 1,
          xp: 0,
          decisiveScore: 35,
          forSale: false,
          price: 0,
        } as any);
      }

      await storage.updateOnboarding(userId, {
        selectedCards: selected,
        completed: true,
      } as any);

      res.json({ success: true, kept: 5 });
    } catch (error: any) {
      console.error("Choose cards failed:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // -------------------------
  // USER CARDS / PLAYER DETAILS
  // -------------------------

  // Fetch cards owned by the logged-in user
  app.get("/api/user/cards", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cards = await storage.getUserCards(userId);
      res.json({ cards });
    } catch (error: any) {
      console.error("Failed to fetch user cards:", error);
      res.status(500).json({ message: "Failed to fetch user cards" });
    }
  });

  // Fetch specific player details (for modals/profiles)
  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(Number(req.params.id));
      if (!player) return res.status(404).json({ message: "Player not found" });
      res.json(player);
    } catch (error: any) {
      console.error("Error fetching player:", error);
      res.status(500).json({ message: "Error fetching player" });
    }
  });

  // Lineup endpoints
  app.get("/api/lineup", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      // TODO: Fetch user's current lineup from storage
      res.json({ lineup: { cardIds: [] }, cards: [] });
    } catch (error: any) {
      console.error("Failed to fetch lineup:", error);
      res.status(500).json({ message: "Failed to fetch lineup" });
    }
  });

  app.post("/api/lineup", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardIds } = req.body;
      // TODO: Save user's lineup to storage
      res.json({ message: "Lineup saved" });
    } catch (error: any) {
      console.error("Failed to save lineup:", error);
      res.status(500).json({ message: "Failed to save lineup" });
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
      
      // Credit wallet and create transaction
      await storage.updateWalletBalance(userId, amount);
      await storage.createTransaction({
        userId,
        type: "deposit",
        amount,
        description: description || `Admin credit: ${amount}`,
      });
      
      res.json({ 
        success: true, 
        message: `Credited ${amount} to user ${userId}`,
        newBalance: (wallet.balance || 0) + amount
      });
    } catch (error: any) {
      console.error("Failed to credit wallet:", error);
      res.status(500).json({ message: "Failed to credit wallet" });
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
      
      //Calculate fee (8%)
      const fee = amount * 0.08;
      const netAmount = amount - fee;
      
      // In a real app, you would integrate with a payment processor here
      // For now, just credit the wallet with net amount after fee (dev/testing only)
      
      await storage.updateWalletBalance(userId, netAmount);
      await storage.createTransaction({
        userId,
        type: "deposit",
        amount: netAmount,
        description: `Deposit via ${paymentMethod || "manual"} (N$${amount.toFixed(2)} - N$${fee.toFixed(2)} fee)`,
        paymentMethod: paymentMethod || "manual",
        externalTransactionId,
      });
      
      res.json({ 
        success: true,
        message: "Deposit processed successfully",
        amount,
        fee,
        netAmount
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
      
      // Calculate fee (8%)
      const fee = amount * 0.08;
      const netAmount = amount - fee;

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
        (w: any) => w.status === "completed" && String(w.destinationKey || "") === destinationKey,
      );

      if (hasTrustedDestination) {
        const { db } = await import("./db.js");
        const { wallets, transactions } = await import("../shared/schema.js");
        const { eq, sql } = await import("drizzle-orm");

        const withdrawal = await storage.createWithdrawalRequest({
          userId,
          amount,
          fee,
          netAmount,
          paymentMethod: method,
          bankName,
          accountHolder,
          accountNumber,
          iban,
          swiftCode,
          ewalletProvider,
          ewalletId,
          destinationKey,
          destinationVerified: true,
          status: "completed",
          reviewedAt: new Date(),
          adminNotes: "Auto-approved trusted payout destination",
        } as any);

        await db.transaction(async (tx) => {
          await tx
            .update(wallets)
            .set({ balance: sql`${wallets.balance} - ${amount}` } as any)
            .where(eq(wallets.userId, userId));

          await tx.insert(transactions).values({
            userId,
            type: "withdrawal",
            amount: -amount,
            description: `Instant withdrawal auto-approved: ${netAmount} (fee: ${fee})`,
          } as any);
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
          netAmount,
        });
      }

      // Lock funds immediately until approved/rejected
      await storage.lockFunds(userId, amount);

      const releaseAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const verificationToken = randomUUID().replace(/-/g, "");
      
      // Create withdrawal request
      const withdrawal = await storage.createWithdrawalRequest({
        userId,
        amount,
        fee,
        netAmount,
        paymentMethod: method,
        bankName,
        accountHolder,
        accountNumber,
        iban,
        swiftCode,
        ewalletProvider,
        ewalletId,
        destinationKey,
        destinationVerified: false,
        verificationToken,
        releaseAfter,
        status: "processing",
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
        netAmount,
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
        .where(and(eq(withdrawalRequests.verificationToken, token), eq(withdrawalRequests.status, "processing" as any)));

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
      
      res.json(listings);
    } catch (error: any) {
      console.error("Failed to fetch marketplace listings:", error);
      res.status(500).json({ message: "Failed to fetch marketplace listings" });
    }
  });

  // List a card for sale
  app.post("/api/marketplace/list", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, price } = req.body;
      
      if (!cardId || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive price required" });
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
      
      // Check if already listed
      if (card.forSale) {
        return res.status(400).json({ message: "Card is already listed for sale" });
      }

      // Disallow listing cards used in any active/open competition lineup
      const activeEntries = await storage.getUserCompetitions(userId);
      let inActiveLineup = false;
      for (const entry of activeEntries) {
        const entryComp = await storage.getCompetition(entry.competitionId);
        if (!entryComp || (entryComp.status !== "open" && entryComp.status !== "active")) continue;
        if (Array.isArray(entry?.lineupCardIds) && entry.lineupCardIds.includes(cardId)) {
          inActiveLineup = true;
          break;
        }
      }
      if (inActiveLineup) {
        return res.status(400).json({
          message: "Cannot list a card that is currently used in a tournament lineup.",
        });
      }
      
      // Enforce base prices by rarity
      const basePrices: Record<string, number> = {
        common: 10,
        rare: 100,
        unique: 250,
        legendary: 500,
      };
      
      const basePrice = basePrices[card.rarity];
      if (basePrice && price < basePrice) {
        return res.status(400).json({ 
          message: `Minimum price for ${card.rarity} cards is N$${basePrice}` 
        });
      }
      
      // TODO: Check if card is in an active auction (when auctions are implemented)
      
      // List the card
      await storage.updatePlayerCard(cardId, {
        forSale: true,
        price
      });
      
      res.json({ 
        success: true, 
        message: "Card listed for sale",
        cardId,
        price
      });
    } catch (error: any) {
      console.error("Failed to list card:", error);
      res.status(500).json({ message: "Failed to list card" });
    }
  });

  // Cancel a listing
  app.post("/api/marketplace/cancel/:cardId", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const cardId = parseInt(req.params.cardId, 10);
      
      if (!cardId || isNaN(cardId)) {
        return res.status(400).json({ message: "Valid cardId required" });
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
      
      // Check if listed
      if (!card.forSale) {
        return res.status(400).json({ message: "Card is not listed for sale" });
      }
      
      // Cancel listing
      await storage.updatePlayerCard(cardId, {
        forSale: false,
        price: 0
      });
      
      res.json({ 
        success: true, 
        message: "Listing cancelled",
        cardId
      });
    } catch (error: any) {
      console.error("Failed to cancel listing:", error);
      res.status(500).json({ message: "Failed to cancel listing" });
    }
  });

  // Buy a card (atomic transaction)
  app.post("/api/marketplace/buy/:cardId", requireAuth, async (req: any, res) => {
    try {
      const buyerId = req.authUserId;
      const cardId = parseInt(req.params.cardId, 10);
      
      if (!cardId || isNaN(cardId)) {
        return res.status(400).json({ message: "Valid cardId required" });
      }
      
      // Import db for transaction
      const { db } = await import("./db.js");
      
      // Wrap in database transaction for atomicity
      await db.transaction(async (tx) => {
        // Get the card with FOR UPDATE lock
        const [card] = await tx
          .select()
          .from((await import("../shared/schema.js")).playerCards)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).playerCards.id, cardId))
          .for("update");
        
        if (!card) {
          throw new Error("Card not found");
        }
        
        // Verify card is for sale
        if (!card.forSale) {
          throw new Error("Card is not for sale");
        }
        
        const sellerId = card.ownerId;
        const price = card.price || 0;
        
        // Can't buy your own card
        if (sellerId === buyerId) {
          throw new Error("Cannot buy your own card");
        }
        
        // Calculate 8% platform fee
        const fee = price * 0.08;
        const sellerReceives = price - fee;
        
        // Check buyer balance
        const [buyerWallet] = await tx
          .select()
          .from((await import("../shared/schema.js")).wallets)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).wallets.userId, buyerId));
        
        if (!buyerWallet || (buyerWallet.balance || 0) < price) {
          throw new Error("Insufficient balance");
        }
        
        // Debit buyer (full price)
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: (await import("drizzle-orm")).sql`${(await import("../shared/schema.js")).wallets.balance} - ${price}` } as any)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).wallets.userId, buyerId));
        
        // Credit seller (price minus 8% fee)
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: (await import("drizzle-orm")).sql`${(await import("../shared/schema.js")).wallets.balance} + ${sellerReceives}` } as any)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).wallets.userId, sellerId!));
        
        // Transfer card ownership
        await tx
          .update((await import("../shared/schema.js")).playerCards)
          .set({ 
            ownerId: buyerId,
            forSale: false,
            price: 0
          } as any)
          .where((await import("drizzle-orm")).eq((await import("../shared/schema.js")).playerCards.id, cardId));
        
        // Create transactions
        await tx.insert((await import("../shared/schema.js")).transactions).values({
          userId: buyerId,
          type: "purchase",
          amount: -price,
          description: `Purchased card #${cardId} (N$${price.toFixed(2)})`,
        } as any);
        
        await tx.insert((await import("../shared/schema.js")).transactions).values({
          userId: sellerId!,
          type: "sale",
          amount: sellerReceives,
          description: `Sold card #${cardId} (N$${price.toFixed(2)} - N$${fee.toFixed(2)} fee)`,
        } as any);
      });
      
      res.json({ 
        success: true, 
        message: "Card purchased successfully",
        cardId
      });
    } catch (error: any) {
      console.error("Failed to buy card:", error);
      res.status(500).json({ message: error.message || "Failed to buy card" });
    }
  });

  // Old route (for backwards compatibility)
  app.post("/api/marketplace/buy", requireAuth, async (req: any, res) => {
    const { cardId } = req.body;
    if (!cardId) {
      return res.status(400).json({ message: "cardId required" });
    }
    // Redirect to new endpoint
    req.params.cardId = cardId.toString();
    return app._router.handle(req, res);
  });

  // Old sell route (deprecated - use /list instead)
  app.post("/api/marketplace/sell", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const { cardId, price } = req.body;
      
      if (!cardId || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "Valid cardId and positive price required" });
      }
      
      // Use the new list endpoint logic
      const card = await storage.getPlayerCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      if (card.ownerId !== userId) {
        return res.status(403).json({ message: "You don't own this card" });
      }

      const activeEntries = await storage.getUserCompetitions(userId);
      let inActiveLineup = false;
      for (const entry of activeEntries) {
        const entryComp = await storage.getCompetition(entry.competitionId);
        if (!entryComp || (entryComp.status !== "open" && entryComp.status !== "active")) continue;
        if (Array.isArray(entry?.lineupCardIds) && entry.lineupCardIds.includes(cardId)) {
          inActiveLineup = true;
          break;
        }
      }
      if (inActiveLineup) {
        return res.status(400).json({
          message: "Cannot list a card that is currently used in a tournament lineup.",
        });
      }
      
      await storage.updatePlayerCard(cardId, {
        forSale: true,
        price
      });
      
      res.json({ 
        success: true,
        message: "Card listed for sale" 
      });
    } catch (error: any) {
      console.error("Failed to sell card:", error);
      res.status(500).json({ message: "Failed to sell card" });
    }
  });

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
      const { amount } = req.body;
      
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      
      const { db } = await import("./db.js");
      const { auctions, auctionBids, wallets } = await import("../shared/schema.js");
      const { eq, desc } = await import("drizzle-orm");
      
      // Get auction
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      // Check auction status
      if (auction.status !== "live") {
        return res.status(400).json({ message: "Auction is not active" });
      }
      
      // Check if expired
      if (auction.endsAt && new Date(auction.endsAt) < new Date()) {
        return res.status(400).json({ message: "Auction has ended" });
      }
      
      // Can't bid on own auction
      if (auction.sellerUserId === userId) {
        return res.status(400).json({ message: "Cannot bid on your own auction" });
      }
      
      // Get current highest bid
      const bids = await getAuctionBids(auctionId);
      const currentBid = bids[0];
      const currentAmount = currentBid?.amount || auction.startPrice || 0;
      
      // Check bid amount
      if (amount < currentAmount + (auction.minIncrement || 1)) {
        return res.status(400).json({ 
          message: `Bid must be at least ${currentAmount + (auction.minIncrement || 1)}` 
        });
      }
      
      // Check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet || (wallet.balance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Place hold on bidder's wallet
      await storage.lockFunds(userId, amount);
      
      // Release previous bidder's hold (if exists)
      if (currentBid && currentBid.bidderUserId !== userId) {
        await storage.unlockFunds(currentBid.bidderUserId, currentBid.amount);
      }
      
      // Create bid
      const [bid] = await db.insert(auctionBids).values({
        auctionId,
        bidderUserId: userId,
        amount,
      } as any).returning();
      
      res.json({
        success: true,
        message: "Bid placed successfully",
        bid,
      });
    } catch (error: any) {
      console.error("Failed to place bid:", error);
      res.status(500).json({ message: error.message || "Failed to place bid" });
    }
  });
  
  // Buy now (instant purchase)
  app.post("/api/auctions/:id/buy-now", requireAuth, async (req: any, res) => {
    try {
      const userId = req.authUserId;
      const auctionId = parseInt(req.params.id, 10);
      
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      if (!auction.buyNowPrice) {
        return res.status(400).json({ message: "This auction does not have a buy now price" });
      }
      
      if (auction.status !== "live") {
        return res.status(400).json({ message: "Auction is not active" });
      }
      
      if (auction.sellerUserId === userId) {
        return res.status(400).json({ message: "Cannot buy your own auction" });
      }
      
      // Check balance
      const wallet = await storage.getWallet(userId);
      if (!wallet || (wallet.balance || 0) < auction.buyNowPrice) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Settle instantly
      const { db } = await import("./db.js");
      const { auctions, playerCards, transactions } = await import("../shared/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      
      await db.transaction(async (tx) => {
        // Charge buyer
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: sql`${(await import("../shared/schema.js")).wallets.balance} - ${auction.buyNowPrice}` } as any)
          .where(eq((await import("../shared/schema.js")).wallets.userId, userId));
        
        // Credit seller
        await tx
          .update((await import("../shared/schema.js")).wallets)
          .set({ balance: sql`${(await import("../shared/schema.js")).wallets.balance} + ${auction.buyNowPrice}` } as any)
          .where(eq((await import("../shared/schema.js")).wallets.userId, auction.sellerUserId));
        
        // Transfer card
        await tx
          .update(playerCards)
          .set({ ownerId: userId } as any)
          .where(eq(playerCards.id, auction.cardId));
        
        // Mark auction as settled
        await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(eq(auctions.id, auctionId));
        
        // Create transactions
        await tx.insert(transactions).values({
          userId,
          type: "auction_settlement",
          amount: -(auction.buyNowPrice || 0),
          description: `Auction buy now: Card #${auction.cardId}`,
        } as any);
        
        await tx.insert(transactions).values({
          userId: auction.sellerUserId,
          type: "auction_settlement",
          amount: auction.buyNowPrice || 0,
          description: `Auction sale: Card #${auction.cardId}`,
        } as any);
      });
      
      res.json({
        success: true,
        message: "Auction purchased successfully",
      });
    } catch (error: any) {
      console.error("Failed to buy now:", error);
      res.status(500).json({ message: "Failed to buy now" });
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
  
  // Settle auction (manually or auto)
  app.post("/api/auctions/:id/settle", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const auctionId = parseInt(req.params.id, 10);
      
      const auction = await getAuction(auctionId);
      if (!auction) {
        return res.status(404).json({ message: "Auction not found" });
      }
      
      if (auction.status === "settled") {
        return res.status(400).json({ message: "Auction already settled" });
      }
      
      const bids = await getAuctionBids(auctionId);
      const winningBid = bids[0];
      
      if (!winningBid) {
        // No bids - just mark as ended
        const { db } = await import("./db.js");
        const { auctions } = await import("../shared/schema.js");
        const { eq } = await import("drizzle-orm");
        
        await db
          .update(auctions)
          .set({ status: "ended" } as any)
          .where(eq(auctions.id, auctionId));
        
        return res.json({
          success: true,
          message: "Auction ended with no bids",
        });
      }
      
      // Check reserve price
      if (winningBid.amount < (auction.reservePrice || 0)) {
        // Reserve not met - release hold and end auction
        await storage.unlockFunds(winningBid.bidderUserId, winningBid.amount);
        
        const { db } = await import("./db.js");
        const { auctions } = await import("../shared/schema.js");
        const { eq } = await import("drizzle-orm");
        
        await db
          .update(auctions)
          .set({ status: "ended" } as any)
          .where(eq(auctions.id, auctionId));
        
        return res.json({
          success: true,
          message: "Auction ended - reserve price not met",
        });
      }
      
      // Settle: charge winner, credit seller, transfer card
      const { db } = await import("./db.js");
      const { auctions, playerCards, wallets, transactions } = await import("../shared/schema.js");
      const { eq, sql } = await import("drizzle-orm");
      
      await db.transaction(async (tx) => {
        // Convert hold to actual debit (unlock + deduct)
        await tx
          .update(wallets)
          .set({
            balance: sql`${wallets.balance}`,
            lockedBalance: sql`${wallets.lockedBalance} - ${winningBid.amount}`,
          } as any)
          .where(eq(wallets.userId, winningBid.bidderUserId));
        
        // Credit seller
        await tx
          .update(wallets)
          .set({ balance: sql`${wallets.balance} + ${winningBid.amount}` } as any)
          .where(eq(wallets.userId, auction.sellerUserId));
        
        // Transfer card
        await tx
          .update(playerCards)
          .set({ ownerId: winningBid.bidderUserId } as any)
          .where(eq(playerCards.id, auction.cardId));
        
        // Mark auction as settled
        await tx
          .update(auctions)
          .set({ status: "settled" } as any)
          .where(eq(auctions.id, auctionId));
        
        // Create transactions
        await tx.insert(transactions).values({
          userId: winningBid.bidderUserId,
          type: "auction_settlement",
          amount: -winningBid.amount,
          description: `Auction won: Card #${auction.cardId}`,
        } as any);
        
        await tx.insert(transactions).values({
          userId: auction.sellerUserId,
          type: "auction_settlement",
          amount: winningBid.amount,
          description: `Auction sale: Card #${auction.cardId}`,
        } as any);
        
        // Release holds for other bidders
        for (let i = 1; i < bids.length; i++) {
          await tx
            .update(wallets)
            .set({
              balance: sql`${wallets.balance} + ${bids[i].amount}`,
              lockedBalance: sql`${wallets.lockedBalance} - ${bids[i].amount}`,
            } as any)
            .where(eq(wallets.userId, bids[i].bidderUserId));
        }
      });
      
      res.json({
        success: true,
        message: "Auction settled successfully",
        winnerId: winningBid.bidderUserId,
        winningAmount: winningBid.amount,
      });
    } catch (error: any) {
      console.error("Failed to settle auction:", error);
      res.status(500).json({ message: "Failed to settle auction" });
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
            entries: sortedEntries,
            entryCount: sortedEntries.length,
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
      
      // Validate lineup (1 GK, 1 DEF, 1 MID, 1 FWD, 1 Utility)
      const cards = await Promise.all(cardIds.map(id => storage.getPlayerCard(id)));
      
      // Verify ownership
      for (const card of cards) {
        if (!card || card.ownerId !== userId) {
          return res.status(403).json({ message: "You don't own all selected cards" });
        }
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
      
      // Check balance and deduct entry fee
      const entryFee = competition.entryFee || 0;
      if (entryFee > 0) {
        const wallet = await storage.getWallet(userId);
        if (!wallet || (wallet.balance || 0) < entryFee) {
          return res.status(400).json({ message: "Insufficient balance for entry fee" });
        }
        
        await storage.updateWalletBalance(userId, -entryFee);
        await storage.createTransaction({
          userId,
          type: "entry_fee",
          amount: -entryFee,
          description: `Entered tournament: ${competition.name}`,
        });
      }
      
      // Create entry
      const entry = await storage.createCompetitionEntry({
        competitionId,
        userId,
        lineupCardIds: cardIds,
        captainId: captainId || cardIds[0],
        totalScore: 0,
      });
      
      res.json({ 
        success: true, 
        message: "Successfully joined tournament",
        entryId: entry.id
      });
    } catch (error: any) {
      console.error("Failed to join competition:", error);
      res.status(500).json({ message: error.message || "Failed to join tournament" });
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
    try {
      const competitionId = parseInt(req.params.id, 10);
      
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

      const { db } = await import("./db.js");
      const { notifications } = await import("../shared/schema.js");
      
      // Distribute prizes (60%, 30%, 10% for top 3)
      const totalPrizePool = entries.length * (competition.entryFee || 0);
      const prizes = [
        totalPrizePool * 0.6,  // 1st place
        totalPrizePool * 0.3,  // 2nd place
        totalPrizePool * 0.1,  // 3rd place
      ];
      
      for (let i = 0; i < Math.min(3, sortedEntries.length); i++) {
        const entry = sortedEntries[i];
        const prize = prizes[i];
        
        await storage.updateCompetitionEntry(entry.id, {
          rank: i + 1,
          prizeAmount: prize,
        });
        
        // Credit winner's wallet
        if (prize > 0) {
          await storage.updateWalletBalance(entry.userId, prize);
          await storage.createTransaction({
            userId: entry.userId,
            type: "prize",
            amount: prize,
            description: `Tournament prize: ${competition.name} - Rank ${i + 1}`,
          });
        }
      }

      let winnerPrizeCardId: number | null = null;
      if (sortedEntries.length > 0) {
        const winner = sortedEntries[0];
        const prizeRarity = String(competition.prizeCardRarity || "rare").toLowerCase();
        const todayTeams = await getTodayTeamNames();
        const allPlayers = await storage.getPlayers();
        const todayPlayers = todayTeams.size
          ? allPlayers.filter((p: any) => todayTeams.has(String(p.team || "").toLowerCase()))
          : [];
        const candidatePool = shuffle(todayPlayers.length > 0 ? todayPlayers : allPlayers);

        for (const p of candidatePool) {
          try {
            const created = await storage.createPlayerCard({
              playerId: p.id,
              ownerId: winner.userId,
              rarity: prizeRarity as any,
              level: 1,
              xp: 0,
              decisiveScore: 35,
              last5Scores: [0, 0, 0, 0, 0],
              forSale: false,
              price: 0,
            } as any);
            winnerPrizeCardId = created.id;
            break;
          } catch (_e) {
            continue;
          }
        }

        const winnerUser = await storage.getUser(winner.userId);
        const prizeRarityLabel = `${prizeRarity.charAt(0).toUpperCase()}${prizeRarity.slice(1)}`;
        const winnerTitle = winnerPrizeCardId
          ? `🏆 You won! ${prizeRarityLabel} card awarded`
          : "🏆 You won today's tournament";
        const winnerMessage = winnerPrizeCardId
          ? `You finished 1st in ${competition.name}. Your ${prizeRarityLabel.toLowerCase()} card prize was auto-delivered to your collection.`
          : `You finished 1st in ${competition.name}. ${prizeRarityLabel} card supply was exhausted, but your cash prize was delivered.`;

        await db.insert(notifications).values({
          userId: winner.userId,
          type: "win",
          title: winnerTitle,
          message: winnerMessage,
          read: false,
        } as any);

        if (winnerUser?.email) {
          await sendEmailNotification(
            winnerUser.email,
            `You won today - ${prizeRarityLabel.toLowerCase()} card awarded`,
            `<p>Congrats! You finished <strong>1st</strong> in <strong>${competition.name}</strong>.</p><p>${winnerMessage}</p>`,
          );
        }

        if (sortedEntries.length > 1) {
          const runnerUp = sortedEntries[1];
          const runnerUpUser = await storage.getUser(runnerUp.userId);
          const runnerUpMessage = `You finished 2nd in ${competition.name}. Great run today — stay confident and try again in the next contest.`;

          await db.insert(notifications).values({
            userId: runnerUp.userId,
            type: "runner_up",
            title: "🥈 Runner-up today — keep pushing",
            message: runnerUpMessage,
            read: false,
          } as any);

          if (runnerUpUser?.email) {
            await sendEmailNotification(
              runnerUpUser.email,
              "Runner-up today - keep going",
              `<p>You placed <strong>2nd</strong> in <strong>${competition.name}</strong>.</p><p>${runnerUpMessage}</p>`,
            );
          }
        }
      }
      
      // Mark competition as completed
      await storage.updateCompetition(competitionId, {
        status: "completed",
      });

      if (winnerPrizeCardId && sortedEntries[0]) {
        await storage.updateCompetitionEntry(sortedEntries[0].id, {
          prizeCardId: winnerPrizeCardId,
        });
      }
      
      res.json({ 
        success: true,
        message: "Tournament settled successfully",
        winnersCount: Math.min(3, sortedEntries.length),
        winnerPrizeCardId,
      });
    } catch (error: any) {
      console.error("Failed to settle competition:", error);
      res.status(500).json({ message: "Failed to settle tournament" });
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
      res.json(rewards);
    } catch (error: any) {
      console.error("Failed to fetch rewards:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  // -------------------------
  // ADMIN ENDPOINTS
  // -------------------------

  app.get("/api/admin/check", requireAuth, async (req: any, res) => {
    const userId = req.authUserId;
    const requestEmail = String(req.user?.email || req.user?.claims?.email || "").toLowerCase();
    const isAdminUser =
      Boolean(userId) &&
      (ADMIN_USER_IDS.includes(userId) ||
        (Boolean(requestEmail) && ADMIN_EMAILS.includes(requestEmail)));
    res.json({ isAdmin: isAdminUser });
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
      
      res.json({
        users: userCount.count,
        cards: cardCount.count,
        auctions: auctionCount.count,
        competitions: competitionCount.count,
        transactions: transactionCount.count,
      });
    } catch (error: any) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
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
      const normalizedStatus = String(status || "upcoming").toLowerCase();
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
      return res.json({ success: true, message: "Tournament updated successfully", competition: updated });
    } catch (error: any) {
      console.error("Failed to update tournament:", error);
      return res.status(500).json({ message: "Failed to update tournament", error: error?.message });
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

        const photoId = typeof fplPlayer.photo === "string" ? fplPlayer.photo.replace(".jpg", "") : "";
        const overall = Math.max(55, Math.min(95, Math.round(Number(fplPlayer.now_cost || 50) + 30)));

        const created = await storage.createPlayer({
          name: fullName,
          team: teamName,
          league: "Premier League",
          position,
          nationality: "Unknown",
          age: 24,
          overall,
          imageUrl: photoId
            ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoId}.png`
            : "/images/player-1.png",
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
      
      const { db } = await import("./db.js");
      const { auditLogs } = await import("../shared/schema.js");
      const { desc } = await import("drizzle-orm");
      
      const allLogs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt));
      
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
  
  // Approve/reject withdrawal request
  app.post("/api/admin/withdrawals/:id/review", requireAuth, isAdmin, async (req: any, res) => {
    try {
      const withdrawalId = parseInt(req.params.id, 10);
      const { status, adminNotes } = req.body;
      
      if (!["completed", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'completed' or 'rejected'" });
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
      
      if (!["pending", "processing"].includes(String(withdrawal.status))) {
        return res.status(400).json({ message: "Withdrawal already processed" });
      }
      
      await db.transaction(async (tx) => {
        if (status === "completed") {
          // Funds already moved to locked balance at request time; finalize by reducing locked
          await tx
            .update(wallets)
            .set({ lockedBalance: sql`${wallets.lockedBalance} - ${withdrawal.amount}` } as any)
            .where(eq(wallets.userId, withdrawal.userId));
          
          // Create transaction
          await tx.insert(transactions).values({
            userId: withdrawal.userId,
            type: "withdrawal",
            amount: -withdrawal.amount,
            description: `Withdrawal approved: ${withdrawal.netAmount} (fee: ${withdrawal.fee})`,
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
