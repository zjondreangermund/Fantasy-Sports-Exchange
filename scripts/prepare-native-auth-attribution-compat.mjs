import fs from "node:fs";

const path = "scripts/apply-signup-source-attribution-v3.mjs";
let source = fs.readFileSync(path, "utf8");

const marker = "NATIVE_AUTH_ATTRIBUTION_COMPAT_V1";
if (source.includes(marker)) {
  console.log("Native auth attribution compatibility already prepared.");
  process.exit(0);
}

const target = '  source = replaceOnce(source, oldGoogleRoutes, newGoogleRoutes, "Google attribution routes");';
if (!source.includes(target)) {
  throw new Error("Could not locate Google attribution route patch anchor");
}

const replacement = String.raw`  // NATIVE_AUTH_ATTRIBUTION_COMPAT_V1
  if (source.includes('const NATIVE_STATE_PREFIX = "fanative";')) {
    source = replaceOnce(
      source,
      '  app.get("/api/login", (req: any, res, next) => {\n    const options: any = { scope: ["profile", "email"] };\n    if (isNativeLoginRequest(req)) options.state = createNativeOAuthState();\n    return passport.authenticate("google", options)(req, res, next);\n  });',
      '  app.get("/api/login", async (req: any, res, next) => {\n    try { await captureMarketingAttribution(req); } catch (error) { console.warn("Marketing attribution capture failed:", error); }\n    const options: any = { scope: ["profile", "email"] };\n    if (isNativeLoginRequest(req)) options.state = createNativeOAuthState();\n    return passport.authenticate("google", options)(req, res, next);\n  });',
      "native Google login attribution",
    );

    source = replaceOnce(
      source,
      '  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));',
      '  app.get("/api/auth/google", async (req: any, res, next) => {\n    try { await captureMarketingAttribution(req); } catch (error) { console.warn("Marketing attribution capture failed:", error); }\n    return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);\n  });',
      "native alternate Google login attribution",
    );

    source = replaceOnce(
      source,
      '      try {\n        const ticket = await issueNativeAuthTicket(user);',
      '      try {\n        const attribution = (req.session as any)?.marketingAttribution as MarketingAttribution | undefined;\n        if (attribution?.visitorId) {\n          const userId = String(user?.id || user?.claims?.sub || "");\n          const action = user?.isNewUser ? "marketing.signup_completed" : "marketing.login_completed";\n          if (userId) await writeMarketingAttribution(action, userId, attribution).catch((attributionError) => console.warn("Marketing native Google attribution write failed:", attributionError));\n          delete (req.session as any).marketingAttribution;\n        }\n        const ticket = await issueNativeAuthTicket(user);',
      "native Google completion attribution",
    );

    source = replaceOnce(
      source,
      '  app.get(\n    "/api/auth/google/callback",\n    passport.authenticate("google", { failureRedirect: "/?auth_error=google" }),\n    (_req, res) => res.redirect("/"),\n  );',
      '  app.get(\n    "/api/auth/google/callback",\n    passport.authenticate("google", { failureRedirect: "/?auth_error=google" }),\n    async (req: any, res) => {\n      const attribution = (req.session as any)?.marketingAttribution as MarketingAttribution | undefined;\n      if (attribution?.visitorId) {\n        const userId = String(req.user?.id || req.user?.claims?.sub || "");\n        const action = req.user?.isNewUser ? "marketing.signup_completed" : "marketing.login_completed";\n        if (userId) await writeMarketingAttribution(action, userId, attribution).catch((error) => console.warn("Marketing Google attribution write failed:", error));\n        delete (req.session as any).marketingAttribution;\n      }\n      return res.redirect("/");\n    },\n  );',
      "web Google completion attribution beside native flow",
    );
  } else {
    source = replaceOnce(source, oldGoogleRoutes, newGoogleRoutes, "Google attribution routes");
  }`;

source = source.replace(target, replacement);
fs.writeFileSync(path, source);
console.log("Prepared signup attribution for the native Google auth return flow.");
