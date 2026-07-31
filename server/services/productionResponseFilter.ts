import type { Express } from "express";

function isProductionTestTournament(value: any) {
  return String(value?.name || "").trim().toUpperCase().startsWith("[TEST]");
}

/**
 * Simulator data is useful in explicitly enabled admin environments but must
 * never be exposed by the normal public tournament listing in production.
 */
export function registerProductionResponseFilters(app: Express) {
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
