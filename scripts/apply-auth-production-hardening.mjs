import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`Could not apply ${label}`);
  return source.replace(search, replacement);
}

const authConfig = `import { randomBytes } from "node:crypto";

export const isProduction = process.env.NODE_ENV === "production";
export const isReplit = Boolean(process.env.REPL_ID);

const mockAuthRequested = process.env.USE_MOCK_AUTH === "true";
export const useMockAuth = mockAuthRequested && !isProduction;

export const appUrl = String(process.env.APP_URL || "http://localhost:5000").replace(/\\/$/, "");
export const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
export const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();

const productionAppUrlConfigured = !isProduction || Boolean(String(process.env.APP_URL || "").trim());
export const googleAuthEnabled = !isReplit
  && !useMockAuth
  && Boolean(googleClientId && googleClientSecret && productionAppUrlConfigured);

export const authConfigurationError = !isReplit && !useMockAuth && !googleAuthEnabled
  ? "Authentication is temporarily unavailable because Google OAuth is not fully configured."
  : null;

const configuredSessionSecret = String(process.env.SESSION_SECRET || "").trim();
const ephemeralSessionSecret = randomBytes(48).toString("hex");

export function getSessionSecret(): string {
  return configuredSessionSecret.length >= 32 ? configuredSessionSecret : ephemeralSessionSecret;
}

export const authStartupWarnings: string[] = [
  ...(isProduction && mockAuthRequested
    ? ["USE_MOCK_AUTH was requested in production and has been disabled. Configure Google OAuth instead."]
    : []),
  ...(configuredSessionSecret.length < 32
    ? [isProduction
      ? "SESSION_SECRET is missing or shorter than 32 characters. An ephemeral secret is being used; sessions will reset after a restart."
      : "SESSION_SECRET is missing or shorter than 32 characters. Using an ephemeral development secret."]
    : []),
  ...(authConfigurationError ? [authConfigurationError] : []),
];
`;
write("server/auth-config.ts", authConfig);

const authRoutes = `import type { Express } from "express";
import type passport from "passport";

interface RegisterAuthRoutesDeps {
  isReplit: boolean;
  useMockAuth: boolean;
  googleAuthEnabled: boolean;
  authConfigurationError: string | null;
  setupAuth: (app: Express) => Promise<void>;
  registerReplitAuthRoutes: (app: Express) => void;
  passport: typeof passport;
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

  app.get("/api/login", passport.authenticate("google", { scope: ["profile", "email"] }));
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/?auth_error=google" }),
    (_req, res) => res.redirect("/"),
  );

  app.get("/api/auth/user", (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    return res.json(req.user);
  });

  app.get("/api/logout", (req: any, res) => {
    req.logout?.(() => {});
    req.session?.destroy(() => {});
    res.clearCookie("fantasyarena.sid");
    return res.redirect("/");
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.logout?.(() => {});
    req.session?.destroy(() => {});
    res.clearCookie("fantasyarena.sid");
    return res.json({ success: true });
  });
}
`;
write("server/routes/auth.routes.ts", authRoutes);

let routes = read("server/routes.ts");
routes = replaceRequired(
  routes,
  'import { registerAuthModeRoutes } from "./routes/auth.routes.js";',
  'import { registerAuthModeRoutes } from "./routes/auth.routes.js";\nimport { authConfigurationError, googleAuthEnabled, isReplit, useMockAuth } from "./auth-config.js";',
  "central auth config import",
);
routes = routes.replace('const isReplit = Boolean(process.env.REPL_ID);\nconst useMockAuth = process.env.USE_MOCK_AUTH === "true" || (!isReplit && !process.env.SESSION_SECRET);\n', "");
routes = replaceRequired(
  routes,
  '  await registerAuthModeRoutes(app, { isReplit, useMockAuth, setupAuth, registerReplitAuthRoutes: registerAuthRoutes, passport });',
  '  await registerAuthModeRoutes(app, { isReplit, useMockAuth, googleAuthEnabled, authConfigurationError, setupAuth, registerReplitAuthRoutes: registerAuthRoutes, passport });',
  "auth route registration",
);
routes = replaceRequired(
  routes,
  '    const mockUserId = process.env.MOCK_USER_ID || "test-user-1";',
  '    const mockUserId = String(process.env.MOCK_USER_ID || "").trim();\n    if (!mockUserId) return res.status(503).json({ message: "Mock authentication is not configured" });',
  "mock auth user validation",
);
write("server/routes.ts", routes);

let index = read("server/index.ts");
index = replaceRequired(
  index,
  'import { ensureApiFootballSyncSchema, startApiFootballSyncScheduler } from "./services/apiFootballSync.js";',
  'import { ensureApiFootballSyncSchema, startApiFootballSyncScheduler } from "./services/apiFootballSync.js";\nimport { appUrl, authStartupWarnings, getSessionSecret, googleAuthEnabled, googleClientId, googleClientSecret } from "./auth-config.js";',
  "auth config import in server entrypoint",
);
index = replaceRequired(
  index,
  '  session({\n    store: new PgSession({ conString: process.env.DATABASE_URL, createTableIfMissing: true }),\n    secret: process.env.SESSION_SECRET || "dev_secret_change_me",',
  '  session({\n    name: "fantasyarena.sid",\n    proxy: true,\n    store: new PgSession({ conString: process.env.DATABASE_URL, createTableIfMissing: true }),\n    secret: getSessionSecret(),',
  "secure session configuration",
);

const oldGoogleBlock = /const publicUrl = process\.env\.APP_URL \|\| "http:\/\/localhost:5000";[\s\S]*?\n\}\)\);\n/;
if (!index.includes("if (googleAuthEnabled) {") && !oldGoogleBlock.test(index)) throw new Error("Could not locate Google strategy block");
if (!index.includes("if (googleAuthEnabled) {")) {
  index = index.replace(oldGoogleBlock, `for (const warning of authStartupWarnings) console.warn(\`[auth] \${warning}\`);\n\nif (googleAuthEnabled) {\n  passport.use(new GoogleStrategy({ clientID: googleClientId, clientSecret: googleClientSecret, callbackURL: \`\${appUrl}/api/auth/google/callback\` }, async (_accessToken, _refreshToken, profile, done) => {\n    try {\n      const { storage } = await import("./storage.js");\n      const userId = profile.id;\n      const email = profile.emails?.[0]?.value || "";\n      const name = profile.displayName || "";\n      let user = await storage.getUser(userId);\n      if (!user) { await storage.createUser({ id: userId, email, name, avatarUrl: profile.photos?.[0]?.value }); user = await storage.getUser(userId); }\n      const wallet = await storage.getWallet(userId);\n      if (!wallet) await storage.createWallet({ userId, balance: 0, lockedBalance: 0 } as any);\n      return done(null, { id: userId, name, email, photo: profile.photos?.[0]?.value });\n    } catch (error) { console.error("Auth error:", error); return done(error as Error); }\n  }));\n}\n`);
}

const oldLogger = /app\.use\(\(req, res, next\) => \{ const start = Date\.now\(\); const requestPath = req\.path;[\s\S]*? next\(\); \}\);\n\n\(async \(\) =>/;
if (!index.includes("API response bodies are intentionally excluded") && !oldLogger.test(index)) throw new Error("Could not locate API logger");
if (!index.includes("API response bodies are intentionally excluded")) {
  index = index.replace(oldLogger, `// API response bodies are intentionally excluded from logs because they may contain\n// wallet data, personal details, card ownership and other private account data.\napp.use((req, res, next) => {\n  const start = Date.now();\n  const requestPath = req.path;\n  res.on("finish", () => {\n    if (!requestPath.startsWith("/api")) return;\n    const duration = Date.now() - start;\n    log(\`\${req.method} \${requestPath} \${res.statusCode} in \${duration}ms\`);\n  });\n  next();\n});\n\n(async () =>`);
}
write("server/index.ts", index);

let env = read(".env.example");
env = env.replace(
  '# Development/Testing Mode (skip real auth)\nUSE_MOCK_AUTH=true',
  '# Development/Testing Mode (local only; production always disables mock auth)\nUSE_MOCK_AUTH=false',
);
if (!env.includes("MOCK_EMAIL=")) env = env.replace("MOCK_LAST_NAME=Buyer", "MOCK_LAST_NAME=Buyer\nMOCK_EMAIL=demo@local.test");
write(".env.example", env);

let readme = read("README.md");
readme = readme.replace(
  '# For development (skip real auth)\nUSE_MOCK_AUTH=true\nMOCK_USER_ID=demo-buyer-1',
  '# For local development only (never enable in production)\nUSE_MOCK_AUTH=true\nMOCK_USER_ID=demo-buyer-1',
);
readme = readme.replace(
  '# For production (Google OAuth)\nGOOGLE_CLIENT_ID=your_client_id',
  '# For production (Google OAuth; USE_MOCK_AUTH must be false)\nGOOGLE_CLIENT_ID=your_client_id',
);
if (!readme.includes("Production refuses mock authentication")) {
  readme = readme.replace(
    'To switch accounts, change `MOCK_USER_ID` in `.env` and restart server.',
    'To switch accounts, change `MOCK_USER_ID` in `.env` and restart server. Production refuses mock authentication even if `USE_MOCK_AUTH=true`; configure Google OAuth, `APP_URL`, and a 32+ character `SESSION_SECRET` instead.',
  );
}
write("README.md", readme);

console.log("Applied production authentication and private logging hardening.");
