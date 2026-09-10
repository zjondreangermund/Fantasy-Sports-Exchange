import fs from "node:fs";

const appPath = "client/src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");
const routeLine = '        <Route path="/gw4-free" component={Gw4PromoAuthenticatedRedirect} />\n';
app = app.replaceAll(routeLine, "");
const legalAnchor = '        {legalRouteElements()}\n';
const legalCount = app.split(legalAnchor).length - 1;
if (legalCount < 2) throw new Error("[gw4-promo] expected both onboarding and authenticated route switches");
app = app.replaceAll(legalAnchor, `${legalAnchor}${routeLine}`);
fs.writeFileSync(appPath, app);

const promoRoutesPath = "server/routes/gw4Promo.routes.ts";
let routes = fs.readFileSync(promoRoutesPath, "utf8");
if (!routes.includes("Normal tournament entries are intentionally not included")) {
  routes = routes.replace(
    '  app.get("/api/admin/gw4-promo", requireAuth, isAdmin, async (req: any, res) => {',
    '  // Normal tournament entries are intentionally not included in acquisition metrics.\n  app.get("/api/admin/gw4-promo", requireAuth, isAdmin, async (req: any, res) => {',
  );
}
fs.writeFileSync(promoRoutesPath, routes);

console.log("GW4 promo route placement and ad-only analytics isolation finalized.");
