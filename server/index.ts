// server/index.ts

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { seedDatabase } from "./seed.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import fs from "fs";
import path from "path";

import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pgSession from "connect-pg-simple";

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
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

const publicUrl = process.env.APP_URL || "http://localhost:5000";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Google auth will not work until set.");
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: `${publicUrl}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const { storage } = await import("./storage.js");
        const userId = profile.id;
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName || "";

        let user = await storage.getUser(userId);
        if (!user) {
          await storage.createUser({ id: userId, email, name, avatarUrl: profile.photos?.[0]?.value });
          user = await storage.getUser(userId);
        }

        const wallet = await storage.getWallet(userId);
        if (!wallet) await storage.createWallet({ userId, balance: 0, lockedBalance: 0 });

        return done(null, { id: userId, name, email, photo: profile.photos?.[0]?.value });
      } catch (error) {
        console.error("Auth error:", error);
        return done(error as Error);
      }
    },
  ),
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

async function ensurePlayerImageColumns() {
  if (!process.env.DATABASE_URL) return;
  const { pool } = await import("./db.js");
  const tableCheck = await pool.query(`select to_regclass('app.players') as table_name`);
  if (!tableCheck.rows?.[0]?.table_name) {
    console.warn("Skipping player image column migration: app.players table does not exist yet.");
    return;
  }
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS official_portrait_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS headshot_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS cutout_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS fallback_image_url text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS image_source text`);
  await pool.query(`ALTER TABLE app.players ADD COLUMN IF NOT EXISTS image_updated_at timestamp`);
}

const fallbackFixtures = [
  { id: "fallback-1", date: new Date(Date.now() + 2 * 86400000).toISOString(), status: "NS", homeTeam: { name: "Arsenal" }, awayTeam: { name: "Chelsea" }, venue: "Emirates Stadium" },
  { id: "fallback-2", date: new Date(Date.now() + 3 * 86400000).toISOString(), status: "NS", homeTeam: { name: "Liverpool" }, awayTeam: { name: "Tottenham" }, venue: "Anfield" },
  { id: "fallback-3", date: new Date(Date.now() + 4 * 86400000).toISOString(), status: "NS", homeTeam: { name: "Manchester City" }, awayTeam: { name: "Newcastle" }, venue: "Etihad Stadium" },
];

function stripXml(value: string) {
  return String(value || "").replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
}

function normalizeSearch(value: string) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeSportsDbEvent(event: any) {
  return {
    id: event?.idEvent || `${event?.strHomeTeam}-${event?.strAwayTeam}-${event?.dateEvent}`,
    date: event?.strTimestamp || `${event?.dateEvent || ""}T${event?.strTime || "15:00:00"}Z`,
    status: event?.intHomeScore || event?.intAwayScore ? "FT" : "NS",
    venue: event?.strVenue || "",
    homeTeam: { name: event?.strHomeTeam || "TBD", badge: event?.strHomeTeamBadge || "", score: event?.intHomeScore ?? null },
    awayTeam: { name: event?.strAwayTeam || "TBD", badge: event?.strAwayTeamBadge || "", score: event?.intAwayScore ?? null },
  };
}

function bestSportsDbPlayerImage(players: any[], requestedTeam: string) {
  const normalizedTeam = normalizeSearch(requestedTeam);
  const scored = players
    .map((player) => {
      const image = player?.strCutout || player?.strRender || player?.strThumb || player?.strFanart1 || "";
      const team = normalizeSearch(player?.strTeam || "");
      const sport = normalizeSearch(player?.strSport || "");
      let score = 0;
      if (image) score += 20;
      if (sport.includes("soccer")) score += 10;
      if (normalizedTeam && team && (team.includes(normalizedTeam) || normalizedTeam.includes(team))) score += 12;
      if (player?.strCutout) score += 6;
      if (player?.strRender) score += 4;
      return { image, score };
    })
    .filter((item) => item.image);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.image || null;
}

async function resolveFplPlayerImage(name: string, team: string) {
  const { fplApi } = await import("./services/fplApi.js");
  const bootstrap = await fplApi.bootstrap();
  const teams = Array.isArray(bootstrap?.teams) ? bootstrap.teams : [];
  const elements = Array.isArray(bootstrap?.elements) ? bootstrap.elements : [];
  const normalizedName = normalizeSearch(name);
  const normalizedTeam = normalizeSearch(team);
  const teamNameById = new Map<number, string>();
  for (const item of teams) {
    teamNameById.set(Number(item.id), normalizeSearch(String(item.name || item.short_name || "")));
  }
  const matches = elements
    .map((element: any) => {
      const fullName = normalizeSearch(`${String(element.first_name || "")} ${String(element.second_name || "")}`.trim());
      const webName = normalizeSearch(String(element.web_name || ""));
      const elementTeam = teamNameById.get(Number(element.team)) || "";
      let score = 0;
      if (fullName === normalizedName || webName === normalizedName) score += 40;
      if (fullName.includes(normalizedName) || normalizedName.includes(fullName) || webName.includes(normalizedName) || normalizedName.includes(webName)) score += 20;
      if (normalizedTeam && elementTeam && (elementTeam.includes(normalizedTeam) || normalizedTeam.includes(elementTeam))) score += 18;
      if (element.code || element.photo) score += 5;
      return { element, score };
    })
    .filter((item: any) => item.score >= 20)
    .sort((a: any, b: any) => b.score - a.score);
  const best = matches[0]?.element;
  if (!best) return null;
  return fplApi.playerPhotoUrl(best, 250);
}

app.get("/api/matchday/epl", async (_req, res) => {
  const result: any = {
    updatedAt: new Date().toISOString(),
    source: "TheSportsDB + Guardian RSS",
    liveGames: [],
    nextFixtures: fallbackFixtures,
    news: [],
  };

  try {
    const fixturesRes = await fetch("https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4328", {
      headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" },
    });
    if (fixturesRes.ok) {
      const payload = await fixturesRes.json();
      const events = Array.isArray(payload?.events) ? payload.events : [];
      if (events.length) result.nextFixtures = events.slice(0, 10).map(normalizeSportsDbEvent);
    }
  } catch (error) {
    console.warn("Matchday fixtures fallback used:", error);
  }

  try {
    const newsRes = await fetch("https://www.theguardian.com/football/premierleague/rss", {
      headers: { Accept: "application/rss+xml,text/xml", "User-Agent": "FantasyArena/1.0" },
    });
    if (newsRes.ok) {
      const xml = await newsRes.text();
      const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].slice(0, 6).map((match) => {
        const item = match[0];
        const title = stripXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
        const url = stripXml(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "");
        const publishedAt = stripXml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "");
        return { title, url, publishedAt, source: "The Guardian" };
      }).filter((item) => item.title);
      result.news = items;
    }
  } catch (error) {
    console.warn("Matchday news unavailable:", error);
  }

  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json(result);
});

app.get("/api/player-image/resolve", async (req, res) => {
  const name = String(req.query.name || "").trim();
  const team = String(req.query.team || "").trim();
  if (!name || name.length < 2) return res.status(404).json({ message: "Missing player name" });

  const cacheKey = `${normalizeSearch(name)}|${normalizeSearch(team)}`;
  const cached = playerImageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.url) return res.redirect(302, cached.url);
    return res.status(404).json({ message: "No image found" });
  }

  try {
    const fplImage = await resolveFplPlayerImage(name, team);
    if (fplImage) {
      const proxied = `/api/image-proxy?url=${encodeURIComponent(fplImage)}`;
      playerImageCache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60 * 1000, url: proxied });
      res.setHeader("Cache-Control", "public, max-age=43200");
      return res.redirect(302, proxied);
    }
  } catch (error) {
    console.warn("FPL player image resolve failed:", error);
  }

  try {
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json", "User-Agent": "FantasyArena/1.0" },
    });
    if (!response.ok) throw new Error(`TheSportsDB ${response.status}`);
    const payload = await response.json();
    const players = Array.isArray(payload?.player) ? payload.player : [];
    const image = bestSportsDbPlayerImage(players, team);
    playerImageCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, url: image });
    if (image) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.redirect(302, image);
    }
  } catch (error) {
    console.warn("Player image resolve failed:", error);
  }

  playerImageCache.set(cacheKey, { expiresAt: Date.now() + 60 * 60 * 1000, url: null });
  return res.status(404).json({ message: "No image found" });
});

app.get("/api/image-proxy", async (req, res) => {
  const raw = String(req.query.url || "");
  if (!raw) return res.status(400).json({ message: "Image URL is required" });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ message: "Invalid URL" });
  }

  if (target.hostname !== "resources.premierleague.com") return res.status(403).json({ message: "Host not allowed" });

  try {
    const r = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        Referer: "https://www.premierleague.com/",
        Origin: "https://www.premierleague.com",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    const ct = String(r.headers.get("content-type") || "");
    if (!r.ok || !ct.startsWith("image/")) return res.status(502).json({ message: "Upstream image fetch failed" });

    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    return res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e: any) {
    console.error("image-proxy error", e?.message);
    return res.status(502).json({ message: "Upstream image fetch failed" });
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });
  next();
});

(async () => {
  try {
    await ensurePlayerImageColumns();
  } catch (error) {
    console.warn("Could not ensure player image columns:", error);
  }
  try {
    await seedDatabase();
  } catch (error) {
    console.warn("Could not auto-seed player/card data:", error);
  }
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  const builtClientIndex = path.resolve(process.cwd(), "dist", "public", "index.html");
  const hasBuiltClient = fs.existsSync(builtClientIndex);

  if (process.env.NODE_ENV === "development" && !hasBuiltClient) {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => log(`serving on port ${port}`));
})();
