import type { Express } from "express";
import { registerDailyLoginRewardRoutes } from "../routes/dailyLoginReward.routes.js";
import { strictReadOnlyGuard } from "./readOnlyGuard.js";

function isProductionTestTournament(value: any) {
  return String(value?.name || "").trim().toUpperCase().startsWith("[TEST]");
}

/**
 * Registers the final global protection layer before any application routes.
 * The strict guard is intentionally installed here because this function is
 * called immediately after the base security middleware and before route
 * registration in server/index.ts.
 */
export function registerProductionResponseFilters(app: Express) {
  app.use(strictReadOnlyGuard);
  registerDailyLoginRewardRoutes(app);

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path !== "/api/competitions") {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (Array.isArray(body)) {
        return originalJson(body.filter((item) => !isProductionTestTournament(item)));
      }

      if (body && Array.isArray(body.competitions)) {
        return originalJson({
          ...body,
          competitions: body.competitions.filter((item: any) => !isProductionTestTournament(item)),
        });
      }

      return originalJson(body);
    }) as typeof res.json;

    next();
  });
}
