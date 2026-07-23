// server/index.ts

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, requireAuth, isAdmin } from "./routes.js";
import { registerAdminInsightsRoutes } from "./routes/adminInsights.routes.js";
import { registerDepositVerificationRoutes } from "./routes/depositVerification.routes.js";
import { seedDatabase } from "./seed.js";
import { serveStatic } from "./static.js";
import { ensureRuntimeSchema } from "./runtime-schema.js";
import { createServer } from "http";
import fs from "fs";
import path from "path";

import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pgSession from "connect-pg-simple";
import { ensureFplPlayerColumns, syncFplPremierLeaguePlayers } from "./services/fplPlayerSync.js";
import { ensureApiFootballSyncSchema, startApiFootballSyncScheduler } from "./services/apiFootballSync.js";
import { appUrl, authStartupWarnings, getSessionSecret, googleAuthEnabled, googleClientId, googleClientSecret } from "./auth-config.js";

const app = express();
const httpServer = createServer(app);
const playerImageCache = new Map<string, { expiresAt: number; url: string | null }>();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.set("trust proxy", 1);
app.use(cookieParser());

const PgSession = pgSession(session);

app.use(
  session({
    name: "fantasyarena.sid",
    proxy: true,
    store: new PgSession({ conString: process.env.DATABASE_URL, createTableIfMissing: true }),
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 },
  }),
);

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

for (const warning of authStartupWarnings) console.warn(`[auth] ${warning}`);

if (googleAuthEnabled) {
  passport.use(new GoogleStrategy({ clientID: googleClientId, clientSecret: googleClientSecret, callbackURL: `${appUrl}/api/auth/google/callback` }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const { storage } = await import("./storage.js");
      const userId = profile.id;
      const email = profile.emails?.[0]?.value || "";
      const name = profile.displayName || "";
      let user = await storage.getUser(userId);
      if (!user) { await storage.createUser({ id: userId, email, name, avatarUrl: profile.photos?.[0]?.value }); user = await storage.getUser(userId); }
      const wallet = await storage.getWallet(userId);
      if (!wallet) await storage.createWallet({ userId, balance: 0, lockedBalance: 0 } as any);
      return done(null, { id: userId, name, email, photo: profile.photos?.[0]?.value });
    } catch (error) { console.error("Auth error:", error); return done(error as Error); }
  }));
}

app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));

async function ensurePlayerImageColumns() {
  if (!process.env.DATABASE_URL) return;
  const { pool } = await import("./db.js");
  const tableCheck = await pool.query(`select to_regclass('app.players') as table_name`);
  if (!tableCheck.rows?.[0]?.table_name) { console.warn("Skipping player image column migration: app.players table does not exist yet."); return; }
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS official_portrait_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS headshot_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS cutout_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS fallback_image_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS image_source text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS image_updated_at timestamp`);
}

function stripXml(value: string) { return String(value || "").replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim(); }
function normalizeSearch(value: string) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function normalizeSportsDbEvent(event: any) { const hasScore = event?.intHomeScore !== null && event?.intHomeScore !== undefined && event?.intAwayScore !== null && event?.intAwayScore !== undefined; const rawStatus = String(event?.strStatus || event?.strProgress || "").toUpperCase(); const finished = hasScore || ["FT", "AET", "PEN", "MATCH FINISHED"].includes(rawStatus); return { id: event?.idEvent || `${event?.strHomeTeam}-${event?.strAwayTeam}-${event?.dateEvent}`, date: event?.strTimestamp || `${event?.dateEvent || ""}T${event?.strTime || "15:00:00"}Z`, status: finished ? "FT" : rawStatus || "NS", venue: event?.strVenue || "", homeTeam: { name: event?.strHomeTeam || "TBD", badge: event?.strHomeTeamBadge || "", score: event?.intHomeScore ?? null }, awayTeam: { name: event?.strAwayTeam || "TBD", badge: event?.strAwayTeamBadge || "", score: event?.intAwayScore ?? null } }; }
function bestSportsDbPlayerImage(players: any[], requestedTeam: string) { const normalizedTeam = normalizeSearch(requestedTeam); const scored = players.map((player) => { const image = player?.strCutout || player?.strRender || player?.strThumb || player?.strFanart1 || ""; const team = normalizeSearch(player?.strTeam || ""); const sport = normalizeSearch(player?.strSport || ""); let score = 0; if (image) score += 20; if (sport.includes("soccer")) score += 10; if (normalizedTeam && team && (team.includes(normalizedTeam) || normalizedTeam.includes(team))) score += 12; if (player?.strCutout) score += 6; if (player?.strRender) score += 4; return { image, score }; }).filter((item) => item.image); scored.sort((a, b) => b.score - a.score); return scored[0]?.image || null; }
async function resolveFplPlayerImage(name: string, team: string) { const { fplApi } = await import("./services/fplApi.js"); const bootstrap = await fplApi.bootstrap(); const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : []; const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : []; const normalizedName = normalizeSearch(name); const normalizedTeam = normalizeSearch(team); const teamNameById = new Map<number, string>(); for (const item of teams) teamNameById.set(Number(item.id), normalizeSearch(String(item.name || item.short_name || ""))); const matches = elements.map((element: any) => { const fullName = normalizeSearch(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim()); const webName = normalizeSearch(String(element.web_name || "")); const elementTeam = teamNameById.get(Number(element.team)) || ""; let score = 0; if (fullName === normalizedName || webName === normalizedName) score += 40; if (fullName.includes(normalizedName) || normalizedName.includes(fullName) || webName.includes(normalizedName) || normalizedName.includes(webName)) score += 20; if (normalizedTeam && elementTeam && (elementTeam.includes(normalizedTeam) || normalizedTeam.includes(elementTeam))) score += 18; if (element.code || element.photo) score += 5; return { element, score }; }).filter((item: any) => item.score >= 20).sort((a: any, b: any) => b.score - a.score); const best = matches[0]?.element; if (!best) return null; return fplApi.playerPhotoUrl(best, 250); }

app.get("/api/matchday/epl", async (_req, res) => {
  const result: any = { updatedAt: new Date().toISOString(), source: "TheSportsDB + Guardian RSS", liveGames: [], nextFixtures: [], news: [], fixturesAvailable: false };
  try { const fixturesRes = await fetch("https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328", { headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" } }); if (fixturesRes.ok) { const payload = await fixturesRes.json(); const events = Array.isArray(payload?.events) ? payload.events : []; if (events.length) { result.nextFixtures = events.slice(0, 10).map(normalizeSportsDbEvent); result.fixturesAvailable = true; } } } catch (error) { console.warn("Matchday fixtures unavailable:", error); }
  try { const newsRes = await fetch("https://www.theguardian.com/football/premierleague/rss", { headers: { Accept: "application/rss+xml,text/xml", "User-Agent": "FantasyArena/1.0" } }); if (newsRes.ok) { const xml = await newsRes.text(); result.news = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].slice(0, 6).map((match) => { const item = match[0]; return { title: stripXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ""), url: stripXml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ""), publishedAt: stripXml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || ""), source: "The Guardian" }; }).filter((item) => item.title); } } catch (error) { console.warn("Matchday news unavailable:", error); }
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json(result);
});

app.post("/api/admin/sync-fpl-players", requireAuth, isAdmin, async (_req, res) => {
  try { const result = await syncFplPremierLeaguePlayers(); return res.json({ success: true, ...result }); }
  catch (error: any) { console.error("FPL player sync failed:", error); return res.status(500).json({ message: error?.message || "FPL player sync failed" }); }
});

app.get("/api/player-image/resolve", async (req, res) => {
  const name = String(req.query.name || "").trim(); const team = String(req.query.team || "").trim();
  if (!name || name.length < 2) return res.status(404).json({ message: "Missing player name" });
  const cacheKey = `${normalizeSearch(name)}|${normalizeSearch(team)}`; const cached = playerImageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) { if (cached.url) return res.redirect(302, cached.url); return res.status(404).json({ message: "No image found" }); }
  try { const fplImage = await resolveFplPlayerImage(name, team); if (fplImage) { const proxied = `/api/image-proxy?url=${encodeURIComponent(fplImage)}`; playerImageCache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60 * 1000, url: proxied }); res.setHeader("Cache-Control", "public, max-age=43200"); return res.redirect(302, proxied); } } catch (error) { console.warn("FPL player image resolve failed:", error); }
  try { const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`, { headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" } }); if (!response.ok) throw new Error(`TheSportsDB ${response.status}`); const payload = await response.json(); const players = Array.isArray(payload?.player) ? payload.player : []; const image = bestSportsDbPlayerImage(players, team); playerImageCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, url: image }); if (image) { res.setHeader("Cache-Control", "public, max-age=86400"); return res.redirect(302, image); } } catch (error) { console.warn("Player image resolve failed:", error); }
  playerImageCache.set(cacheKey, { expiresAt: Date.now() + 60 * 60 * 1000, url: null }); return res.status(404).json({ message: "No image found" });
});

app.get("/api/image-proxy", async (req, res) => {
  const raw = String(req.query.url || "");
  if (!raw) return res.redirect(302, "/players/fallback.svg");
  let target: URL;
  try { target = new URL(raw); } catch { return res.redirect(302, "/players/fallback.svg"); }
  if (target.hostname !== "resources.premierleague.com") return res.status(403).json({ message: "Host not allowed" });

  const urlsToTry = [target.toString()];
  const codeMatch = target.pathname.match(/\/players\/(?:\d+x\d+)\/p(\d+)\.(?:png|jpg|jpeg|webp)$/i);
  if (codeMatch?.[1]) {
    const code = codeMatch[1];
    for (const size of ["500x500", "250x250", "110x110", "40x40"]) urlsToTry.push(`https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`);
  }

  for (const url of Array.from(new Set(urlsToTry))) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const r = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36", Referer: "https://www.premierleague.com/", Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" } }).finally(() => clearTimeout(timeout));
      const ct = String(r.headers.get("content-type") || "");
      if (r.ok && ct.startsWith("image/")) {
        res.setHeader("Content-Type", ct);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        return res.send(Buffer.from(await r.arrayBuffer()));
      }
    } catch (e: any) { console.warn("image-proxy candidate failed", url, e?.message || e); }
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.redirect(302, "/players/fallback.svg");
});

export function log(message: string, source = "express") { const formattedTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "numeric", hour12: true }); console.log(`${formattedTime} [${source}] ${message}`); }

// API response bodies are intentionally excluded from logs because they may contain
// wallet data, personal details, card ownership and other private account data.
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  res.on("finish", () => {
    if (!requestPath.startsWith("/api")) return;
    const duration = Date.now() - start;
    log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

(async () => {
  try { await ensurePlayerImageColumns(); await ensureFplPlayerColumns(); } catch (error) { console.warn("Could not ensure player columns:", error); }
  try { await ensureApiFootballSyncSchema(); } catch (error) { console.warn("Could not prepare API-Football sync tables:", error); }
  try { await seedDatabase(); } catch (error) { console.warn("Could not auto-seed player/card data:", error); }
  registerDepositVerificationRoutes(app, { requireAuth, isAdmin });
  await ensureRuntimeSchema();
  try { const result = await syncFplPremierLeaguePlayers(); console.log("FPL Premier League player sync complete:", result); } catch (error) { console.warn("Could not sync FPL Premier League players:", error); }
  await registerRoutes(httpServer, app);
  registerAdminInsightsRoutes(app, { requireAuth, isAdmin });
  startApiFootballSyncScheduler();
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => { const status = err.status || err.statusCode || 500; const message = err.message || "Internal Server Error"; console.error("Internal Server Error:", err); if (res.headersSent) return next(err); return res.status(status).json({ message }); });
  const builtClientIndex = path.resolve(process.cwd(), "dist", "public", "index.html"); const hasBuiltClient = fs.existsSync(builtClientIndex);
  if (process.env.NODE_ENV === "development" && !hasBuiltClient) { const { setupVite } = await import("./vite.js"); await setupVite(httpServer, app); } else { serveStatic(app); }
  const port = parseInt(process.env.PORT || "5000", 10); httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => log(`serving on port ${port}`));
})();
