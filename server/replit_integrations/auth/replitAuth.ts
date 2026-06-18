import passport from "passport";
import type { Express, RequestHandler } from "express";

export async function setupAuth(app: Express) {
  const publicUrl = process.env.PUBLIC_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;

  // Session + passport already initialized in server/index.ts — skip re-initializing here.

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const { Strategy: GoogleStrategy } = await import("passport-google-oauth20");
    const { authStorage } = await import("./storage.js");

    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${publicUrl}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value ?? null;

            const user = {
              id: profile.id,
              email,
              firstName: (profile.name?.givenName ?? "") || null,
              lastName: (profile.name?.familyName ?? "") || null,
              profileImageUrl: profile.photos?.[0]?.value ?? null,
            };

            await authStorage.upsertUser({
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
            });

            return done(null, user);
          } catch (e) {
            return done(e as any);
          }
        }
      )
    );
  } else {
    console.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set — Google OAuth routes will redirect to /.");
  }

  // Google login
  app.get("/api/login", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.redirect("/");
    return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  // Google callback
  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      if (!process.env.GOOGLE_CLIENT_ID) return res.redirect("/");
      return passport.authenticate("google", { failureRedirect: "/" })(req, res, next);
    },
    (_req, res) => {
      res.redirect("/");
    }
  );

  // Logout
  app.get("/api/logout", (req: any, res) => {
    req.logout?.(() => {});
    req.session?.destroy(() => {});
    res.clearCookie("connect.sid");
    res.redirect("/");
  });

  // Who am I?
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    res.json(req.user);
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  return next();
};

// getSession kept for backward compatibility but no longer needed since index.ts handles it
export function getSession() {
  return (_req: any, _res: any, next: any) => next();
}
