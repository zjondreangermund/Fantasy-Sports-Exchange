import type { RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { db, pool } from "../db.js";

export type SecuritySettings = {
  emergency: {
    readOnly: boolean;
    authPaused: boolean;
    depositsPaused: boolean;
    withdrawalsPaused: boolean;
    marketplacePaused: boolean;
    auctionsPaused: boolean;
    message: string;
  };
  rateLimits: {
    apiPerMinute: number;
    authPer15Minutes: number;
    financialPerMinute: number;
    auctionPerMinute: number;
    adminPerMinute: number;
  };
  detection: {
    authAttemptsPer15Minutes: number;
    bidAttemptsPerMinute: number;
    financialActionsPerMinute: number;
    blockMinutes: number;
  };
  posture: {
    adminMfaRequired: boolean;
    cloudflareEnabled: boolean;
    githubSecurityEnabled: boolean;
    backupsVerified: boolean;
    penetrationTestDate: string;
    incidentContact: string;
  };
};

export type SecuritySettingsRecord = {
  settings: SecuritySettings;
  updatedAt: string | null;
  updatedBy: string | null;
};

type SecurityEventInput = {
  userId?: string | null;
  ip?: string | null;
  category: string;
  action: string;
  route?: string | null;
  severity?: "info" | "warning" | "critical";
  details?: Record<string, unknown>;
};

type RateBucket = {
  windowStartedAt: number;
  count: number;
  blockedUntil: number;
  alertLogged: boolean;
  blockLogged: boolean;
};

const DEFAULT_SETTINGS: SecuritySettings = {
  emergency: {
    readOnly: false,
    authPaused: false,
    depositsPaused: false,
    withdrawalsPaused: false,
    marketplacePaused: false,
    auctionsPaused: false,
    message: "Fantasy Arena is temporarily restricted while the security team completes checks.",
  },
  rateLimits: {
    apiPerMinute: 240,
    authPer15Minutes: 20,
    financialPerMinute: 20,
    auctionPerMinute: 30,
    adminPerMinute: 120,
  },
  detection: {
    authAttemptsPer15Minutes: 8,
    bidAttemptsPerMinute: 12,
    financialActionsPerMinute: 8,
    blockMinutes: 15,
  },
  posture: {
    adminMfaRequired: true,
    cloudflareEnabled: false,
    githubSecurityEnabled: false,
    backupsVerified: false,
    penetrationTestDate: "",
    incidentContact: "",
  },
};

const buckets = new Map<string, RateBucket>();
let settingsCache: { value: SecuritySettingsRecord; expiresAt: number } | null = null;
let lastBucketCleanup = 0;

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function int(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function text(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeSettings(value: unknown): SecuritySettings {
  const source = value && typeof value === "object" ? value as any : {};
  const emergency = source.emergency || {};
  const rateLimits = source.rateLimits || {};
  const detection = source.detection || {};
  const posture = source.posture || {};

  return {
    emergency: {
      readOnly: bool(emergency.readOnly, DEFAULT_SETTINGS.emergency.readOnly),
      authPaused: bool(emergency.authPaused, DEFAULT_SETTINGS.emergency.authPaused),
      depositsPaused: bool(emergency.depositsPaused, DEFAULT_SETTINGS.emergency.depositsPaused),
      withdrawalsPaused: bool(emergency.withdrawalsPaused, DEFAULT_SETTINGS.emergency.withdrawalsPaused),
      marketplacePaused: bool(emergency.marketplacePaused, DEFAULT_SETTINGS.emergency.marketplacePaused),
      auctionsPaused: bool(emergency.auctionsPaused, DEFAULT_SETTINGS.emergency.auctionsPaused),
      message: text(emergency.message, DEFAULT_SETTINGS.emergency.message, 240),
    },
    rateLimits: {
      apiPerMinute: int(rateLimits.apiPerMinute, DEFAULT_SETTINGS.rateLimits.apiPerMinute, 30, 5000),
      authPer15Minutes: int(rateLimits.authPer15Minutes, DEFAULT_SETTINGS.rateLimits.authPer15Minutes, 3, 500),
      financialPerMinute: int(rateLimits.financialPerMinute, DEFAULT_SETTINGS.rateLimits.financialPerMinute, 2, 500),
      auctionPerMinute: int(rateLimits.auctionPerMinute, DEFAULT_SETTINGS.rateLimits.auctionPerMinute, 3, 1000),
      adminPerMinute: int(rateLimits.adminPerMinute, DEFAULT_SETTINGS.rateLimits.adminPerMinute, 10, 2000),
    },
    detection: {
      authAttemptsPer15Minutes: int(detection.authAttemptsPer15Minutes, DEFAULT_SETTINGS.detection.authAttemptsPer15Minutes, 2, 500),
      bidAttemptsPerMinute: int(detection.bidAttemptsPerMinute, DEFAULT_SETTINGS.detection.bidAttemptsPerMinute, 2, 1000),
      financialActionsPerMinute: int(detection.financialActionsPerMinute, DEFAULT_SETTINGS.detection.financialActionsPerMinute, 2, 500),
      blockMinutes: int(detection.blockMinutes, DEFAULT_SETTINGS.detection.blockMinutes, 1, 1440),
    },
    posture: {
      adminMfaRequired: bool(posture.adminMfaRequired, DEFAULT_SETTINGS.posture.adminMfaRequired),
      cloudflareEnabled: bool(posture.cloudflareEnabled, DEFAULT_SETTINGS.posture.cloudflareEnabled),
      githubSecurityEnabled: bool(posture.githubSecurityEnabled, DEFAULT_SETTINGS.posture.githubSecurityEnabled),
      backupsVerified: bool(posture.backupsVerified, DEFAULT_SETTINGS.posture.backupsVerified),
      penetrationTestDate: text(posture.penetrationTestDate, DEFAULT_SETTINGS.posture.penetrationTestDate, 32),
      incidentContact: text(posture.incidentContact, DEFAULT_SETTINGS.posture.incidentContact, 160),
    },
  };
}

export async function ensureSecurityControlSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app.security_settings (
      id integer PRIMARY KEY,
      config jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_by varchar(255),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT security_settings_singleton CHECK (id = 1)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app.security_events (
      id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id varchar(255),
      ip text,
      category text NOT NULL,
      action text NOT NULL,
      route text,
      severity text NOT NULL DEFAULT 'warning',
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      resolved boolean NOT NULL DEFAULT false,
      resolved_at timestamp,
      resolved_by varchar(255),
      resolution text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON app.security_events (created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS security_events_open_idx ON app.security_events (resolved, severity, created_at DESC)`);
  await db.execute(sql`
    INSERT INTO app.security_settings (id, config)
    VALUES (1, ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function getSecuritySettings(force = false): Promise<SecuritySettingsRecord> {
  if (!force && settingsCache && settingsCache.expiresAt > Date.now()) return settingsCache.value;
  try {
    const row = rowsOf(await db.execute(sql`
      SELECT config, updated_by AS "updatedBy", updated_at AS "updatedAt"
      FROM app.security_settings WHERE id = 1
    `))[0];
    const value: SecuritySettingsRecord = {
      settings: normalizeSettings(row?.config),
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      updatedBy: row?.updatedBy ? String(row.updatedBy) : null,
    };
    settingsCache = { value, expiresAt: Date.now() + 10_000 };
    return value;
  } catch (error) {
    console.warn("Security settings unavailable; using safe defaults:", error);
    return { settings: normalizeSettings(DEFAULT_SETTINGS), updatedAt: null, updatedBy: null };
  }
}

export async function updateSecuritySettings(input: unknown, adminId: string): Promise<SecuritySettingsRecord> {
  const settings = normalizeSettings(input);
  const result = await db.execute(sql`
    UPDATE app.security_settings
    SET config = ${JSON.stringify(settings)}::jsonb,
        updated_by = ${adminId || null},
        updated_at = now()
    WHERE id = 1
    RETURNING updated_by AS "updatedBy", updated_at AS "updatedAt"
  `);
  const row = rowsOf(result)[0] || {};
  const record: SecuritySettingsRecord = {
    settings,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    updatedBy: row.updatedBy ? String(row.updatedBy) : adminId || null,
  };
  settingsCache = { value: record, expiresAt: Date.now() + 10_000 };

  await db.execute(sql`
    INSERT INTO app.audit_logs (user_id, action, meta)
    VALUES (${adminId || null}, 'security.settings.updated', ${JSON.stringify({ settings })}::jsonb)
  `);
  await recordSecurityEvent({
    userId: adminId || null,
    category: "administration",
    action: "security.settings.updated",
    severity: "info",
    details: { settings },
  });
  return record;
}

export async function recordSecurityEvent(event: SecurityEventInput) {
  try {
    await db.execute(sql`
      INSERT INTO app.security_events (user_id, ip, category, action, route, severity, details)
      VALUES (
        ${event.userId || null},
        ${event.ip || null},
        ${event.category},
        ${event.action},
        ${event.route || null},
        ${event.severity || "warning"},
        ${JSON.stringify(event.details || {})}::jsonb
      )
    `);
  } catch (error) {
    console.warn("Could not record security event:", error);
  }
}

export async function resolveSecurityEvent(eventId: number, adminId: string, resolution: string) {
  const result = await db.execute(sql`
    UPDATE app.security_events
    SET resolved = true,
        resolved_at = now(),
        resolved_by = ${adminId || null},
        resolution = ${text(resolution, "Reviewed by administrator", 300)}
    WHERE id = ${eventId}
    RETURNING id
  `);
  if (!rowsOf(result).length) throw new Error("Security event not found");
  await db.execute(sql`
    INSERT INTO app.audit_logs (user_id, action, meta)
    VALUES (${adminId || null}, 'security.event.resolved', ${JSON.stringify({ eventId, resolution })}::jsonb)
  `);
  return { success: true, eventId };
}

export async function getSecurityOverview(limit = 60) {
  const safeLimit = Math.max(10, Math.min(200, Math.round(Number(limit) || 60)));
  const counts = rowsOf(await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::int AS "eventsLastHour",
      count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS "eventsLast24Hours",
      count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND action LIKE '%.blocked%')::int AS "blockedLast24Hours",
      count(*) FILTER (WHERE resolved = false)::int AS "openEvents",
      count(*) FILTER (WHERE resolved = false AND severity = 'critical')::int AS "criticalOpenEvents"
    FROM app.security_events
  `))[0] || {};
  const recentEvents = rowsOf(await db.execute(sql`
    SELECT id, user_id AS "userId", ip, category, action, route, severity, details,
           resolved, resolved_at AS "resolvedAt", resolved_by AS "resolvedBy",
           resolution, created_at AS "createdAt"
    FROM app.security_events
    ORDER BY created_at DESC, id DESC
    LIMIT ${safeLimit}
  `));
  const topCategories = rowsOf(await db.execute(sql`
    SELECT category, count(*)::int AS count
    FROM app.security_events
    WHERE created_at >= now() - interval '24 hours'
    GROUP BY category
    ORDER BY count(*) DESC
    LIMIT 10
  `));
  return {
    summary: {
      eventsLastHour: Number(counts.eventsLastHour || 0),
      eventsLast24Hours: Number(counts.eventsLast24Hours || 0),
      blockedLast24Hours: Number(counts.blockedLast24Hours || 0),
      openEvents: Number(counts.openEvents || 0),
      criticalOpenEvents: Number(counts.criticalOpenEvents || 0),
    },
    topCategories,
    recentEvents,
  };
}

export function clearRateLimitBuckets() {
  const cleared = buckets.size;
  buckets.clear();
  return cleared;
}

export async function revokeOtherSessions(currentSessionId: string, adminId: string) {
  const result = await pool.query('DELETE FROM "session" WHERE sid <> $1', [currentSessionId || ""]);
  await db.execute(sql`
    INSERT INTO app.audit_logs (user_id, action, meta)
    VALUES (${adminId || null}, 'security.sessions.revoked', ${JSON.stringify({ revoked: result.rowCount || 0 })}::jsonb)
  `);
  await recordSecurityEvent({
    userId: adminId || null,
    category: "authentication",
    action: "security.sessions.revoked",
    severity: "warning",
    details: { revoked: result.rowCount || 0 },
  });
  return Number(result.rowCount || 0);
}

function requestUserId(req: any) {
  return String(req.authUserId || req.user?.claims?.sub || req.user?.id || "");
}

function requestIp(req: any) {
  return String(req.ip || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase());
}

function isAuthenticationRoute(path: string) {
  return path === "/api/login" || path === "/api/auth/google" || path === "/api/auth/google/callback";
}

function isReadOnlyPreviewMutation(method: string, path: string) {
  const upper = String(method || "GET").toUpperCase();
  if (upper === "PATCH" && path === "/api/user/profile") return true;
  if (upper !== "POST") return false;
  return [
    "/api/onboarding/create-offer",
    "/api/onboarding/choose",
    "/api/rewards/daily-login/claim",
    "/api/referrals/claim",
  ].includes(path);
}

function cleanupBuckets(now: number) {
  if (now - lastBucketCleanup < 60_000) return;
  lastBucketCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.blockedUntil < now && now - bucket.windowStartedAt > 60 * 60 * 1000) buckets.delete(key);
  }
}

function rateGroup(req: any, settings: SecuritySettings) {
  const path = String(req.path || "");
  const unsafe = isUnsafeMethod(req.method);
  if (path.startsWith("/api/admin/")) {
    return { name: "admin", limit: settings.rateLimits.adminPerMinute, windowMs: 60_000, alert: Math.max(10, Math.floor(settings.rateLimits.adminPerMinute * 0.8)) };
  }
  if (path === "/api/login" || path.startsWith("/api/auth/")) {
    return { name: "auth", limit: settings.rateLimits.authPer15Minutes, windowMs: 15 * 60_000, alert: settings.detection.authAttemptsPer15Minutes };
  }
  if (unsafe && path.startsWith("/api/auctions")) {
    return { name: "auction", limit: settings.rateLimits.auctionPerMinute, windowMs: 60_000, alert: settings.detection.bidAttemptsPerMinute };
  }
  if (unsafe && (path.startsWith("/api/wallet") || path.startsWith("/api/marketplace"))) {
    return { name: "financial", limit: settings.rateLimits.financialPerMinute, windowMs: 60_000, alert: settings.detection.financialActionsPerMinute };
  }
  if (path.startsWith("/api/")) {
    return { name: "api", limit: settings.rateLimits.apiPerMinute, windowMs: 60_000, alert: Math.max(20, Math.floor(settings.rateLimits.apiPerMinute * 0.85)) };
  }
  return null;
}

function emergencyBlock(settings: SecuritySettings, req: any) {
  const path = String(req.path || "");
  if (path.startsWith("/api/admin/security") || path === "/api/security/status" || path === "/api/auth/logout" || path === "/api/logout") return null;
  if (settings.emergency.authPaused && isAuthenticationRoute(path)) return "auth_paused";
  if (settings.emergency.readOnly && isUnsafeMethod(req.method) && !isReadOnlyPreviewMutation(req.method, path)) return "read_only";
  if (settings.emergency.depositsPaused && req.method === "POST" && path === "/api/wallet/deposit") return "deposits_paused";
  if (settings.emergency.withdrawalsPaused && req.method === "POST" && path === "/api/wallet/withdraw") return "withdrawals_paused";
  if (settings.emergency.marketplacePaused && isUnsafeMethod(req.method) && path.startsWith("/api/marketplace")) return "marketplace_paused";
  if (settings.emergency.auctionsPaused && isUnsafeMethod(req.method) && path.startsWith("/api/auctions")) return "auctions_paused";
  return null;
}

export const securityHeadersMiddleware: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; frame-src 'none'",
    );
  }
  next();
};

export const securityOriginGuard: RequestHandler = (req: any, res, next) => {
  if (!String(req.path || "").startsWith("/api/") || !isUnsafeMethod(req.method)) return next();
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return next();

  const allowed = new Set<string>([
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
  ]);
  for (const raw of [process.env.APP_URL, process.env.PUBLIC_URL, ...(process.env.CORS_ORIGINS || "").split(",")]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    try { allowed.add(new URL(value).origin); } catch { /* ignore malformed deployment values */ }
  }
  const requestOrigin = `${req.protocol}://${req.get("host")}`;
  if (origin === requestOrigin || allowed.has(origin)) return next();

  void recordSecurityEvent({
    userId: requestUserId(req) || null,
    ip: requestIp(req),
    category: "request_origin",
    action: "request.origin.blocked",
    route: req.path,
    severity: "warning",
    details: { origin, method: req.method },
  });
  return res.status(403).json({ message: "Request origin is not allowed" });
};

export const securityControlMiddleware: RequestHandler = async (req: any, res, next) => {
  if (!String(req.path || "").startsWith("/api/")) return next();
  try {
    const record = await getSecuritySettings();
    const settings = record.settings;
    const blockedBy = emergencyBlock(settings, req);
    if (blockedBy) {
      void recordSecurityEvent({
        userId: requestUserId(req) || null,
        ip: requestIp(req),
        category: "emergency_control",
        action: `request.blocked.${blockedBy}`,
        route: req.path,
        severity: blockedBy === "read_only" ? "warning" : "info",
        details: { method: req.method },
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ code: blockedBy, message: blockedBy === "auth_paused" ? "New sign-ups and logins are temporarily paused." : settings.emergency.message });
    }

    const group = rateGroup(req, settings);
    if (!group) return next();
    const now = Date.now();
    cleanupBuckets(now);
    const identity = requestUserId(req) || requestIp(req);
    const key = `${group.name}:${identity}`;
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStartedAt >= group.windowMs) {
      bucket = { windowStartedAt: now, count: 0, blockedUntil: 0, alertLogged: false, blockLogged: false };
      buckets.set(key, bucket);
    }

    if (bucket.blockedUntil > now) {
      const retrySeconds = Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000));
      res.setHeader("Retry-After", String(retrySeconds));
      return res.status(429).json({ message: "Too many requests. Please wait and try again.", retryAfterSeconds: retrySeconds });
    }

    bucket.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((bucket.windowStartedAt + group.windowMs - now) / 1000));
    res.setHeader("X-RateLimit-Limit", String(group.limit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, group.limit - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(resetSeconds));

    if (!bucket.alertLogged && bucket.count >= group.alert) {
      bucket.alertLogged = true;
      void recordSecurityEvent({
        userId: requestUserId(req) || null,
        ip: requestIp(req),
        category: "rate_limit",
        action: `request.suspicious.${group.name}`,
        route: req.path,
        severity: "warning",
        details: { count: bucket.count, alertThreshold: group.alert, windowMs: group.windowMs },
      });
    }

    if (bucket.count > group.limit) {
      bucket.blockedUntil = now + settings.detection.blockMinutes * 60_000;
      if (!bucket.blockLogged) {
        bucket.blockLogged = true;
        void recordSecurityEvent({
          userId: requestUserId(req) || null,
          ip: requestIp(req),
          category: "rate_limit",
          action: `request.blocked.${group.name}`,
          route: req.path,
          severity: group.name === "financial" || group.name === "admin" ? "critical" : "warning",
          details: { count: bucket.count, limit: group.limit, blockedMinutes: settings.detection.blockMinutes },
        });
      }
      const retrySeconds = settings.detection.blockMinutes * 60;
      res.setHeader("Retry-After", String(retrySeconds));
      return res.status(429).json({ message: "Too many requests. Access has been temporarily limited.", retryAfterSeconds: retrySeconds });
    }

    return next();
  } catch (error) {
    console.warn("Security middleware failed open to preserve availability:", error);
    return next();
  }
};

export function getRuntimeSecurityStatus() {
  return {
    nodeEnvironment: process.env.NODE_ENV || "development",
    sessionSecretConfigured: String(process.env.SESSION_SECRET || "").trim().length >= 32,
    googleOAuthConfigured: Boolean(String(process.env.GOOGLE_CLIENT_ID || "").trim() && String(process.env.GOOGLE_CLIENT_SECRET || "").trim()),
    appUrlConfigured: Boolean(String(process.env.APP_URL || "").trim()),
    databaseConfigured: Boolean(String(process.env.DATABASE_URL || "").trim()),
    secureCookiesEnabled: process.env.NODE_ENV === "production",
    bodyLimit: "256kb",
    csrfOriginGuard: true,
    securityHeaders: true,
    applicationRateLimiting: true,
    previewSignupsDuringReadOnly: true,
    dailyLoginCommonCardCap: 20,
  };
}
