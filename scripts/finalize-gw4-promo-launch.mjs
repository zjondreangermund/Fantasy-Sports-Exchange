import fs from "node:fs";

const appPath = "client/src/App.tsx";
let app = fs.readFileSync(appPath, "utf8");
const routeLine = '        <Route path="/gw4-free" component={Gw4PromoAuthenticatedRedirect} />\n';
app = app.replaceAll(routeLine, "");
const legalAnchor = '        {legalRouteElements()}\n';
const legalCount = app.split(legalAnchor).length - 1;
if (legalCount < 2) throw new Error("[gw4-promo] expected both onboarding and authenticated route switches");
app = app.replaceAll(legalAnchor, `${legalAnchor}${routeLine}`);

if (!app.includes('sendGw4PromoEvent("tournament_open_after_signup")')) {
  const effect = `  React.useEffect(() => {\n    if (!user) return;\n    if (isNativeMobileApp()) reportNativeAccountLinked(String((user as any)?.id || (user as any)?.claims?.sub || ""));\n    const params = new URLSearchParams(window.location.search);\n    if (window.location.pathname === "/competitions" && params.get("promo") === GW4_PROMO_CAMPAIGN) {\n      void sendGw4PromoEvent("tournament_open_after_signup");\n      clearPostSignupTarget();\n    }\n  }, [user]);\n`;
  const appContentOffset = app.indexOf("function AppContent() {");
  const loadingOffset = app.indexOf("\n  if (isLoading)", appContentOffset);
  if (appContentOffset < 0 || loadingOffset < 0) throw new Error("[gw4-promo] AppContent insertion point missing");
  app = `${app.slice(0, loadingOffset + 1)}${effect}${app.slice(loadingOffset + 1)}`;
}
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

const promoClientPath = "client/src/lib/gw4-promo.ts";
let promoClient = fs.readFileSync(promoClientPath, "utf8");
promoClient = promoClient.replace(
  'if (typeof window === "undefined") return { source: "direct", medium: "", campaign: GW4_PROMO_CAMPAIGN, content: "" };',
  'if (typeof window === "undefined") return { source: "direct", medium: "", campaign: "unknown", content: "" };',
);
promoClient = promoClient.replace(
  'campaign: clean(params.get("utm_campaign") || stored.campaign || GW4_PROMO_CAMPAIGN, 160) || GW4_PROMO_CAMPAIGN,',
  'campaign: clean(params.get("utm_campaign") || stored.campaign || "unknown", 160) || "unknown",',
);
fs.writeFileSync(promoClientPath, promoClient);

console.log("GW4 promo route placement, ad-only analytics isolation and post-signup tracking finalized.");
