import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import type passport from "passport";
import { sql } from "drizzle-orm";
import { getSessionSecret } from "../auth-config.js";
import { db, pool } from "../db.js";

interface RegisterAuthRoutesDeps {
  isReplit: boolean;
  useMockAuth: boolean;
  googleAuthEnabled: boolean;
  authConfigurationError: string | null;
  setupAuth: (app: Express) => Promise<void>;
  registerReplitAuthRoutes: (app: Express) => void;
  passport: typeof passport;
}

const NATIVE_USER_AGENT_MARKER = "FantasyArenaNative/";
const NATIVE_STATE_PREFIX = "fanative";
const NATIVE_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const NATIVE_TICKET_TTL_MS = 3 * 60 * 1000;

function safeEqualText(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function isNativeLoginRequest(req: any): boolean {
  const userAgent = String(req.get?.("user-agent") || "");
  return String(req.query?.native || "") === "1" || userAgent.includes(NATIVE_USER_AGENT_MARKER);
}

function createNativeOAuthState(): string {
  const issuedAt = Date.now().toString(36);
  const nonce = randomBytes(18).toString("base64url");
  const payload = `${issuedAt}.${nonce}`;
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${NATIVE_STATE_PREFIX}.${payload}.${signature}`;
}

function isValidNativeOAuthState(value: unknown): boolean {
  const parts = String(value || "").split(".");
  if (parts.length !== 4 || parts[0] !== NATIVE_STATE_PREFIX) return false;
  const [, issuedAtRaw, nonce, signature] = parts;
  const issuedAt = parseInt(issuedAtRaw, 36);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > NATIVE_STATE_MAX_AGE_MS) return false;
  if (!/^[A-Za-z0-9_-]{16,}$/.test(nonce) || !/^[A-Za-z0-9_-]{32,}$/.test(signature)) return false;
  const payload = `${issuedAtRaw}.${nonce}`;
  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function ensureNativeAuthTicketTable() {
  await pool.query(`
    create table if not exists app.native_auth_tickets (
      token_hash text primary key,
      user_payload jsonb not null,
      expires_at timestamptz not null
    )
  `);
  await pool.query(`delete from app.native_auth_tickets where expires_at <= now()`);
}

async function issueNativeAuthTicket(user: any): Promise<string> {
  await ensureNativeAuthTicketTable();
  const ticket = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(ticket).digest("hex");
  const expiresAt = new Date(Date.now() + NATIVE_TICKET_TTL_MS);
  await pool.query(
    `insert into app.native_auth_tickets (token_hash, user_payload, expires_at) values ($1, $2::jsonb, $3)`,
    [tokenHash, JSON.stringify(user || {}), expiresAt],
  );
  return ticket;
}

async function consumeNativeAuthTicket(ticket: string): Promise<any | null> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(ticket)) return null;
  await ensureNativeAuthTicketTable();
  const tokenHash = createHash("sha256").update(ticket).digest("hex");
  const result = await pool.query(
    `delete from app.native_auth_tickets where token_hash = $1 and expires_at > now() returning user_payload`,
    [tokenHash],
  );
  const payload = result.rows?.[0]?.user_payload;
  if (!payload) return null;
  return typeof payload === "string" ? JSON.parse(payload) : payload;
}

function nativeReturnUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return `fantasyarena://auth/callback${query ? `?${query}` : ""}`;
}

async function endAuthenticatedSession(req: any): Promise<void> {
  // Passport 0.6 regenerates the session during logout. Destroying the same
  // session concurrently can race that regeneration and surface an unhandled
  // session-store error. Always complete Passport logout first, then destroy
  // only this request's session.
  if (typeof req.logout === "function") {
    await new Promise<void>((resolve) => {
      try {
        req.logout((error: any) => {
          if (error) console.warn("Passport logout failed; continuing local session cleanup:", error?.message || error);
          resolve();
        });
      } catch (error: any) {
        console.warn("Passport logout threw; continuing local session cleanup:", error?.message || error);
        resolve();
      }
    });
  }

  if (typeof req.session?.destroy === "function") {
    await new Promise<void>((resolve) => {
      try {
        req.session.destroy((error: any) => {
          if (error) console.warn("Session destroy failed during logout:", error?.message || error);
          resolve();
        });
      } catch (error: any) {
        console.warn("Session destroy threw during logout:", error?.message || error);
        resolve();
      }
    });
  }
}

export async function registerAuthModeRoutes(app: Express, deps: RegisterAuthRoutesDeps) {
  const {
    isReplit,
    useMockAuth,
    googleAuthEnabled,
    authConfigurationError,
    setupAuth,
    registerReplitAuthRoutes,
    passport,
  } = deps;

  // Temporary automation/audit access. This never activates unless all three
  // Railway variables are explicitly set. The secret is accepted only through
  // a request header so it does not appear in URLs, redirects, or normal API logs.
  // The expiry is mandatory, and the feature can be shut off without a code deploy.
  if (String(process.env.TEMP_AUDIT_LOGIN_ENABLED || "").toLowerCase() === "true") {
    app.get("/api/auth/audit-login", async (req: any, res) => {
      res.setHeader("Cache-Control", "no-store");
      const expectedToken = String(process.env.TEMP_AUDIT_LOGIN_TOKEN || "");
      const suppliedToken = String(req.get?.("x-fantasy-audit-token") || "");
      const userId = String(process.env.TEMP_AUDIT_LOGIN_USER_ID || "").trim();
      const expiresAt = Date.parse(String(process.env.TEMP_AUDIT_LOGIN_EXPIRES_AT || ""));

      if (!expectedToken || !suppliedToken || !safeEqualText(suppliedToken, expectedToken)) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
        return res.status(410).json({ message: "Temporary audit login expired" });
      }
      if (!userId) return res.status(503).json({ message: "Temporary audit login is not configured" });

      try {
        const { storage } = await import("../storage.js");
        let user: any = await storage.getUser(userId);
        if (!user && userId === "demo-buyer-1") {
          user = await storage.createUser({
            id: userId,
            email: "audit-preview@local.test",
            name: "Fantasy Arena Preview",
          });
          const wallet = await storage.getWallet(userId);
          if (!wallet) await storage.createWallet({ userId, balance: 0, lockedBalance: 0 } as any);
        }
        if (!user) return res.status(404).json({ message: "Configured audit user was not found" });

        const sessionUser = {
          id: user.id,
          name: user.name || "Demo User",
          email: user.email || "",
          photo: user.avatarUrl || undefined,
        };
        await new Promise<void>((resolve, reject) => {
          req.logIn(sessionUser, (error: any) => error ? reject(error) : resolve());
        });
        await new Promise<void>((resolve, reject) => {
          req.session.save((error: any) => error ? reject(error) : resolve());
        });
        return res.redirect("/");
      } catch (error: any) {
        console.error("Temporary audit login failed:", error?.message || error);
        return res.status(500).json({ message: "Temporary audit login failed" });
      }
    });
  }

  if (isReplit) {
    await setupAuth(app);
    registerReplitAuthRoutes(app);
    return;
  }

  if (useMockAuth) {
    console.warn("Using explicitly enabled mock auth for local development/testing only.");

    app.use((req: any, _res, next) => {
      const mockId = String(process.env.MOCK_USER_ID || "").trim();
      if (!mockId) throw new Error("MOCK_USER_ID is required when USE_MOCK_AUTH=true");

      req.isAuthenticated = () => true;
      req.user = {
        id: mockId,
        claims: { sub: mockId },
        firstName: process.env.MOCK_FIRST_NAME || "Mock",
        lastName: process.env.MOCK_LAST_NAME || "User",
        email: process.env.MOCK_EMAIL || "admin@local.test",
      };
      req.authUserId = mockId;
      next();
    });

    app.get("/api/auth/user", (req: any, res) => res.json(req.user));
    app.get("/api/login", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
    return;
  }

  if (!googleAuthEnabled) {
    const message = authConfigurationError || "Authentication is temporarily unavailable.";
    app.get("/api/auth/user", (_req, res) => res.status(503).json({ message }));
    app.get("/api/login", (_req, res) => res.redirect("/?auth_error=configuration"));
    app.get("/api/auth/google", (_req, res) => res.redirect("/?auth_error=configuration"));
    app.get("/api/auth/google/callback", (_req, res) => res.redirect("/?auth_error=configuration"));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    app.post("/api/auth/logout", (_req, res) => res.json({ success: true }));
    return;
  }

  app.get("/api/login", (req: any, res, next) => {
    const options: any = { scope: ["profile", "email"] };
    if (isNativeLoginRequest(req)) options.state = createNativeOAuthState();
    return passport.authenticate("google", options)(req, res, next);
  });
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/api/auth/google/callback", (req: any, res, next) => {
    if (!isValidNativeOAuthState(req.query?.state)) return next();

    return passport.authenticate("google", { session: false }, async (error: any, user: any) => {
      if (error || !user) {
        console.warn("Native Google authentication failed:", error?.message || error || "No user returned");
        return res.redirect(nativeReturnUrl({ error: "google" }));
      }
      try {
        const ticket = await issueNativeAuthTicket(user);
        res.setHeader("Cache-Control", "no-store");
        return res.redirect(nativeReturnUrl({ ticket }));
      } catch (ticketError: any) {
        console.error("Could not issue native auth ticket:", ticketError?.message || ticketError);
        return res.redirect(nativeReturnUrl({ error: "ticket" }));
      }
    })(req, res, next);
  });

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/?auth_error=google" }),
    (_req, res) => res.redirect("/"),
  );

  app.get("/api/auth/native/complete", async (req: any, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const ticket = String(req.query?.ticket || "");
      const user = await consumeNativeAuthTicket(ticket);
      if (!user?.id) return res.redirect("/?auth_error=native_ticket");

      await new Promise<void>((resolve, reject) => {
        req.logIn(user, (error: any) => error ? reject(error) : resolve());
      });
      await new Promise<void>((resolve, reject) => {
        req.session.save((error: any) => error ? reject(error) : resolve());
      });
      return res.redirect("/");
    } catch (error: any) {
      console.error("Native auth completion failed:", error?.message || error);
      return res.redirect("/?auth_error=native");
    }
  });

  app.get("/api/auth/user", (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    return res.json(req.user);
  });

  app.get("/api/logout", async (req: any, res) => {
    await endAuthenticatedSession(req);
    res.clearCookie("fantasyarena.sid");
    return res.redirect("/");
  });

  app.post("/api/auth/logout", async (req: any, res) => {
    await endAuthenticatedSession(req);
    res.clearCookie("fantasyarena.sid");
    return res.json({ success: true });
  });
}
