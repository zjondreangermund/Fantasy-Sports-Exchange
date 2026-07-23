import type { Express } from "express";
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
