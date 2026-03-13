// server/index.ts (FULL FILE — updated with /api/image-proxy)

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import fs from "fs";
import path from "path";


// ✅ Google Auth / Sessions
import session from "express-session";
import cookieParser from "cookie-parser";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pgSession from "connect-pg-simple";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ✅ Railway / proxies: required for secure cookies behind a proxy
app.set("trust proxy", 1);

// ✅ Cookie + session middleware (must be BEFORE passport.session())
app.use(cookieParser());

const PgSession = pgSession(session);

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true, // 👈 ADD THIS LINE
    }),
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }),
);

// ✅ Passport init (must be AFTER session())
app.use(passport.initialize());
app.use(passport.session());

// ✅ Passport serialize/deserialize
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

// ✅ Google Strategy
const publicUrl = process.env.APP_URL || "http://localhost:5000"; // set APP_URL in Railway

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Google auth will not work until set.");
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // ✅ FIXED callback URL (must match Google Console redirect URI exactly)
      callbackURL: `${publicUrl}/api/auth/google/callback`,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        // Import storage dynamically to avoid circular deps
        const { storage } = await import("./storage.js");

        const userId = profile.id;
        const email = profile.emails?.[0]?.value || "";
        const name = profile.displayName || "";

        // Find or create user
        let user = await storage.getUser(userId);
        if (!user) {
          // Create user in DB
          await storage.createUser({
            id: userId,
            email,
            name,
            avatarUrl: profile.photos?.[0]?.value,
          });
          user = await storage.getUser(userId);
        }

        // Ensure wallet exists
        let wallet = await storage.getWallet(userId);
        if (!wallet) {
          await storage.createWallet({ userId, balance: 0, lockedBalance: 0 });
        }

        return done(null, {
          id: userId,
          name,
          email,
          photo: profile.photos?.[0]?.value,
        });
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

// ✅ EPL image proxy (fixes 403/CORS hotlink protection)
app.get("/api/image-proxy", async (req, res) => {
  const raw = String(req.query.url || "");
  if (!raw) return res.status(400).json({ message: "Image URL is required" });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ message: "Invalid URL" });
  }

  // ✅ Safety: only allow Premier League resources host
  if (target.hostname !== "resources.premierleague.com") {
    return res.status(403).json({ message: "Host not allowed" });
  }

  try {
    const r = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://www.premierleague.com/",
        Origin: "https://www.premierleague.com",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const ct = String(r.headers.get("content-type") || "");
    const ok = r.ok;

    // ✅ PL sometimes returns XML/HTML "AccessDenied" — reject it
    if (!ok || !ct.startsWith("image/")) {
      console.error("image-proxy blocked", {
        status: r.status,
        contentType: ct,
        url: target.toString(),
      });
      return res.status(502).json({ message: "Upstream image fetch failed" });
    }

    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    const data = Buffer.from(await r.arrayBuffer());
    return res.send(data);
  } catch (e: any) {
    console.error("image-proxy error", e?.message);
    return res.status(502).json({ message: "Upstream image fetch failed" });
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

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
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // ✅ All routes (including /api/auth/google and callback) should be defined in server/routes.ts
  // so we avoid duplicates and keep auth logic in one place.
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  // Prefer static build assets whenever they exist (deployed/built runtime).
  const builtClientIndex = path.resolve(process.cwd(), "dist", "public", "index.html");
  const hasBuiltClient = fs.existsSync(builtClientIndex);

  if (process.env.NODE_ENV === "development" && !hasBuiltClient) {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
