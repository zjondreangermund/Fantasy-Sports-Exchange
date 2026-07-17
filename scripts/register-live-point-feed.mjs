import fs from "node:fs";

const path = "server/routes.ts";
let source = fs.readFileSync(path, "utf8");

const importAnchor = 'import { registerUserTournamentRoutes } from "./routes/userTournaments.routes.js";';
const serviceImport = 'import { buildRealFplPointFeed } from "./services/liveFplFeed.js";';
if (!source.includes(serviceImport)) {
  if (!source.includes(importAnchor)) throw new Error("Route import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${serviceImport}`);
}

const registrationAnchor = '  registerUserTournamentRoutes(app, { requireAuth });';
const routeBlock = `  app.get("/api/live/point-feed", async (req, res) => {\n    try {\n      const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));\n      res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=10");\n      return res.json(await buildRealFplPointFeed(limit));\n    } catch (error) {\n      console.error("Real FPL point feed failed:", error);\n      return res.json([]);\n    }\n  });`;
if (!source.includes('app.get("/api/live/point-feed"')) {
  if (!source.includes(registrationAnchor)) throw new Error("Route registration anchor not found");
  source = source.replace(registrationAnchor, `${registrationAnchor}\n\n${routeBlock}`);
}

fs.writeFileSync(path, source);
console.log("Registered /api/live/point-feed without changing existing route handlers.");
